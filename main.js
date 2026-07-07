const { app, BrowserWindow, ipcMain, dialog, shell, clipboard, nativeImage } = require('electron');
const { spawn, execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// ---------------------------------------------------------------------------
// Foundry binary resolution — GUI apps on macOS don't inherit the shell PATH,
// so we look in the standard foundry install dir first, then fall back to PATH.
// ---------------------------------------------------------------------------
const FOUNDRY_DIR = path.join(os.homedir(), '.foundry', 'bin');

function resolveBin(name) {
  const candidate = path.join(FOUNDRY_DIR, name);
  if (fs.existsSync(candidate)) return candidate;
  return name; // hope it's on PATH
}

const BINS = {
  forge: resolveBin('forge'),
  cast: resolveBin('cast'),
  anvil: resolveBin('anvil'),
  chisel: resolveBin('chisel'),
};

const SPAWN_ENV = {
  ...process.env,
  PATH: `${FOUNDRY_DIR}:${process.env.PATH || ''}:/usr/local/bin:/opt/homebrew/bin`,
  NO_COLOR: '1',
  FOUNDRY_DISABLE_NIGHTLY_WARNING: '1',
};

// keep the app alive on unexpected errors instead of crashing mid-deploy
process.on('uncaughtException', (err) => console.error('[main] uncaught:', err));
process.on('unhandledRejection', (err) => console.error('[main] unhandled rejection:', err));

// single instance — a second launch would fight over child processes and config
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
}

// ---------------------------------------------------------------------------
// Config store (plain JSON in userData)
// ---------------------------------------------------------------------------
const configPath = () => path.join(app.getPath('userData'), 'config.json');

// migrate config from pre-rename locations (app was "foundry-gui" before "hearth")
function migrateOldConfig() {
  try {
    const p = configPath();
    if (fs.existsSync(p)) return;
    const candidates = [
      path.join(app.getPath('userData'), 'foundry-gui-config.json'),
      path.join(app.getPath('appData'), 'foundry-gui', 'foundry-gui-config.json'),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) { fs.copyFileSync(c, p); return; }
    }
  } catch {}
}

function readConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8'));
  } catch {
    return {};
  }
}

function writeConfig(cfg) {
  // atomic write (tmp + rename) so a crash mid-write can't corrupt the config
  try {
    const p = configPath();
    fs.writeFileSync(p + '.tmp', JSON.stringify(cfg, null, 2));
    fs.renameSync(p + '.tmp', p);
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
let win;

const APP_ICON = path.join(__dirname, 'build', 'icon.png');

function createWindow() {
  win = new BrowserWindow({
    icon: APP_ICON,
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 640,
    title: 'Hearth',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: '#FAF9F5',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  // a renderer reload orphans its child processes — kill them on navigation
  win.webContents.on('did-start-navigation', (e) => {
    if (e.isMainFrame && !e.isSameDocument) killAllProcs();
  });
  // recover from a renderer crash instead of leaving a dead window
  win.webContents.on('render-process-gone', (_e, details) => {
    if (details.reason !== 'clean-exit') {
      killAllProcs();
      win.webContents.reload();
    }
  });
}

app.whenReady().then(() => {
  migrateOldConfig();
  // dev-mode dock icon (packaged apps use the bundle's icon.icns)
  if (process.platform === 'darwin' && fs.existsSync(APP_ICON)) {
    try { app.dock.setIcon(nativeImage.createFromPath(APP_ICON)); } catch {}
  }
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  killAllProcs();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', killAllProcs);

// ---------------------------------------------------------------------------
// One-shot command execution (buffered)
// ---------------------------------------------------------------------------
ipcMain.handle('cmd:run', async (_e, { tool, args, cwd, timeoutMs }) => {
  const bin = BINS[tool];
  if (!bin) return { ok: false, stdout: '', stderr: `Unknown tool: ${tool}`, code: -1 };
  return new Promise((resolve) => {
    execFile(
      bin,
      args,
      {
        cwd: cwd || os.homedir(),
        env: SPAWN_ENV,
        timeout: timeoutMs || 60_000,
        maxBuffer: 32 * 1024 * 1024,
      },
      (err, stdout, stderr) => {
        resolve({
          ok: !err,
          stdout: stdout ? stdout.toString() : '',
          stderr: stderr ? stderr.toString() : (err && !stdout ? String(err.message) : ''),
          code: err ? (err.code ?? -1) : 0,
        });
      }
    );
  });
});

// ---------------------------------------------------------------------------
// Streaming / long-running processes (forge build/test, anvil, chisel)
// ---------------------------------------------------------------------------
const procs = new Map();
let procSeq = 0;
const MAX_PROCS = 24; // runaway guard
const MAX_STREAM_BYTES = 8 * 1024 * 1024; // per-process output cap forwarded to renderer

function killAllProcs() {
  for (const [, child] of procs) {
    try { child.kill('SIGKILL'); } catch {}
  }
  procs.clear();
}

function ipcSend(channel, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(channel, payload);
}

// Stream batching: coalesce high-frequency chunks (forge test -vvvv etc.) into
// ~40ms flushes so a chatty child can't flood IPC or thrash the renderer DOM.
const streamBufs = new Map(); // id -> { entries, timer, sent, truncated }

function pushStream(id, stream, data) {
  let b = streamBufs.get(id);
  if (!b) { b = { entries: [], timer: null, sent: 0, truncated: false }; streamBufs.set(id, b); }
  if (b.truncated) return;
  b.sent += data.length;
  if (b.sent > MAX_STREAM_BYTES) {
    b.truncated = true;
    b.entries.push({ stream: 'stderr', data: '\n[输出超过 8MB，已截断 — 完整输出请在终端中运行]\n' });
  } else {
    const last = b.entries[b.entries.length - 1];
    if (last && last.stream === stream) last.data += data; // merge adjacent same-stream chunks
    else b.entries.push({ stream, data });
  }
  if (!b.timer) b.timer = setTimeout(() => flushStream(id), 40);
}

function flushStream(id) {
  const b = streamBufs.get(id);
  if (!b) return;
  if (b.timer) { clearTimeout(b.timer); b.timer = null; }
  const entries = b.entries;
  b.entries = [];
  for (const e of entries) ipcSend('proc:data', { id, stream: e.stream, data: e.data });
}

ipcMain.handle('proc:start', (_e, { tool, args, cwd, env }) => {
  const bin = BINS[tool];
  if (!bin) return { ok: false, error: `Unknown tool: ${tool}` };
  if (procs.size >= MAX_PROCS) return { ok: false, error: `进程数已达上限（${MAX_PROCS}），请先停止部分任务` };
  const id = `p${++procSeq}`;
  try {
    const child = spawn(bin, args, {
      cwd: cwd || os.homedir(),
      env: { ...SPAWN_ENV, ...(env || {}) },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    procs.set(id, child);
    child.stdout.on('data', (d) => pushStream(id, 'stdout', d.toString()));
    child.stderr.on('data', (d) => pushStream(id, 'stderr', d.toString()));
    child.on('close', (code) => {
      procs.delete(id);
      flushStream(id); // deliver any tail output before the exit event
      streamBufs.delete(id);
      ipcSend('proc:exit', { id, code });
    });
    child.on('error', (err) => {
      procs.delete(id);
      pushStream(id, 'stderr', String(err.message) + '\n');
      flushStream(id);
      streamBufs.delete(id);
      ipcSend('proc:exit', { id, code: -1 });
    });
    return { ok: true, id, pid: child.pid };
  } catch (err) {
    return { ok: false, error: String(err.message) };
  }
});

ipcMain.handle('proc:write', (_e, { id, data }) => {
  const child = procs.get(id);
  if (!child || !child.stdin.writable) return false;
  child.stdin.write(data);
  return true;
});

ipcMain.handle('proc:kill', (_e, { id }) => {
  const child = procs.get(id);
  if (!child) return false;
  try { child.kill('SIGTERM'); } catch {}
  setTimeout(() => { try { child.kill('SIGKILL'); } catch {} }, 1500);
  return true;
});

ipcMain.handle('proc:list', () => Array.from(procs.keys()));

// ---------------------------------------------------------------------------
// Dialogs, filesystem helpers, config
// ---------------------------------------------------------------------------
ipcMain.handle('dialog:pickDir', async () => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  return r.canceled ? null : r.filePaths[0];
});

ipcMain.handle('dialog:pickFile', async (_e, filters) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: filters || [] });
  return r.canceled ? null : r.filePaths[0];
});

// read a JSON file (used for forge broadcast run-latest.json)
ipcMain.handle('fs:readJSON', (_e, p) => {
  try {
    if (typeof p !== 'string' || !p.endsWith('.json')) return null;
    const stat = fs.statSync(p);
    if (stat.size > 16 * 1024 * 1024) return null;
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('config:get', () => readConfig());
ipcMain.handle('config:set', (_e, cfg) => writeConfig(cfg));

ipcMain.handle('shell:openExternal', (_e, url) => {
  if (/^https?:\/\//.test(url)) shell.openExternal(url);
});

ipcMain.handle('clipboard:write', (_e, text) => clipboard.writeText(String(text)));

// Scan a foundry project: source contracts + deploy scripts (bounded walk)
ipcMain.handle('project:scan', (_e, projectDir) => {
  const result = { valid: false, contracts: [], scripts: [], hasArtifacts: false };
  try {
    const tomlPath = path.join(projectDir, 'foundry.toml');
    result.valid = fs.existsSync(tomlPath);
    let fileBudget = 4000; // bound the walk so a giant/misconfigured dir can't hang the app

    const collect = (rootDirs, suffix, sink) => {
      const walk = (d, depth) => {
        if (depth > 8 || fileBudget <= 0) return;
        let entries;
        try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
          if (fileBudget-- <= 0) return;
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'lib') continue;
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full, depth + 1);
          else if (entry.name.endsWith(suffix)) {
            let content;
            try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
            const re = /^\s*(?:abstract\s+)?(contract|library|interface)\s+([A-Za-z0-9_]+)/gm;
            let m;
            while ((m = re.exec(content))) {
              if (m[1] === 'contract') sink.set(`${m[2]}|${full}`, { name: m[2], file: path.relative(projectDir, full) });
            }
          }
        }
      };
      for (const rd of rootDirs) {
        const dir = path.join(projectDir, rd);
        if (fs.existsSync(dir)) walk(dir, 0);
      }
    };

    const contracts = new Map();
    collect(['src', 'contracts'], '.sol', contracts);
    result.contracts = Array.from(contracts.values());

    const scripts = new Map();
    collect(['script', 'scripts'], '.s.sol', scripts);
    result.scripts = Array.from(scripts.values());

    result.hasArtifacts = fs.existsSync(path.join(projectDir, 'out'));
  } catch {}
  return result;
});

// Read constructor inputs from a compiled artifact if present
ipcMain.handle('project:artifact', (_e, { projectDir, file, name }) => {
  try {
    const artifactPath = path.join(projectDir, 'out', path.basename(file), `${name}.json`);
    if (!fs.existsSync(artifactPath)) return null;
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const abi = artifact.abi || [];
    const ctor = abi.find((x) => x.type === 'constructor');
    return {
      constructorInputs: ctor ? ctor.inputs : [],
      functions: abi.filter((x) => x.type === 'function'),
    };
  } catch {
    return null;
  }
});
