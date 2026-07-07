/* ============================================================
   Foundry Studio — renderer logic
   ============================================================ */

const $ = (id) => document.getElementById(id);
const F = window.foundry;

// ---------------------------------------------------------------------------
// State & config
// ---------------------------------------------------------------------------
const DEFAULT_CHAINS = [
  { name: 'Anvil Local', chainId: 31337, rpc: 'http://127.0.0.1:8545', explorer: '' },
  { name: 'Ethereum', chainId: 1, rpc: 'https://ethereum-rpc.publicnode.com', explorer: 'https://etherscan.io' },
  { name: 'Sepolia', chainId: 11155111, rpc: 'https://ethereum-sepolia-rpc.publicnode.com', explorer: 'https://sepolia.etherscan.io' },
  { name: 'Base', chainId: 8453, rpc: 'https://mainnet.base.org', explorer: 'https://basescan.org' },
  { name: 'Arbitrum One', chainId: 42161, rpc: 'https://arb1.arbitrum.io/rpc', explorer: 'https://arbiscan.io' },
  { name: 'Optimism', chainId: 10, rpc: 'https://mainnet.optimism.io', explorer: 'https://optimistic.etherscan.io' },
  { name: 'Polygon', chainId: 137, rpc: 'https://polygon-rpc.com', explorer: 'https://polygonscan.com' },
  { name: 'BSC', chainId: 56, rpc: 'https://bsc-dataseed.bnbchain.org', explorer: 'https://bscscan.com' },
];

let config = {};
let chains = [];
let currentChainIdx = 1; // default Ethereum

function currentChain() { return chains[currentChainIdx] || chains[0]; }
function rpcArgs() { return ['--rpc-url', currentChain().rpc]; }

async function loadConfig() {
  config = (await F.getConfig()) || {};
  chains = config.chains && config.chains.length ? config.chains : DEFAULT_CHAINS.slice();
  currentChainIdx = Math.min(config.currentChainIdx ?? 1, chains.length - 1);
  if (config.theme) document.documentElement.setAttribute('data-theme', config.theme);
  if (config.etherscanKey) $('s-etherscan').value = config.etherscanKey;
  if (config.lastProject) { $('f-project').value = config.lastProject; $('dep-project').value = config.lastProject; }
  if (config.locale && config.locale !== 'zh') {
    $('locale-select').value = config.locale;
    setLocale(config.locale);
  }
}

// debounced: chain switches / history writes etc. can fire in bursts
let saveTimer = null;
function saveConfig() {
  config.chains = chains;
  config.currentChainIdx = currentChainIdx;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { saveTimer = null; F.setConfig(config); }, 250);
}
window.addEventListener('beforeunload', () => {
  if (saveTimer) { clearTimeout(saveTimer); F.setConfig(config); }
});

// surface unexpected renderer errors instead of failing silently
window.addEventListener('error', (e) => toast(`内部错误: ${e.message}`));
window.addEventListener('unhandledrejection', (e) => toast(`内部错误: ${e.reason?.message || e.reason}`));

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = t(msg); // translate Chinese source strings at display time
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// split a command-line style string into args, respecting quotes
function splitArgs(str) {
  if (!str || !str.trim()) return [];
  const out = [];
  const re = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = re.exec(str))) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function setResult(id, res, { tintOk = false } = {}) {
  const el = $(id);
  const text = (res.stdout || '').trim() || (res.stderr || '').trim() || (res.ok ? t('(无输出)') : t('(失败)'));
  el.textContent = text;
  el.classList.toggle('err', !res.ok);
  el.classList.toggle('ok-tint', res.ok && tintOk);
  return res.ok;
}

async function busy(btn, fn) {
  const orig = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spin"></span> ${t('执行中')}`;
  try { return await fn(); }
  finally { btn.disabled = false; btn.innerHTML = orig; }
}

function bindEnter(inputId, btnId) {
  $(inputId).addEventListener('keydown', (e) => { if (e.key === 'Enter') $(btnId).click(); });
}

// run cast with current chain rpc appended
async function cast(args, opts = {}) {
  return F.run('cast', [...args, ...rpcArgs()], opts);
}
// run cast without rpc (offline utilities)
async function castLocal(args, opts = {}) {
  return F.run('cast', args, opts);
}

// Terminal append — batched per animation frame so high-frequency streams
// (forge test -vvvv, anvil logs) don't thrash layout; DOM node count is capped.
const TERM_MAX_NODES = 3000;
const termQueues = new Map(); // termId -> { frags: [[text, cls]], scheduled }

function termAppend(termId, text, cls) {
  let q = termQueues.get(termId);
  if (!q) { q = { frags: [], scheduled: false }; termQueues.set(termId, q); }
  const last = q.frags[q.frags.length - 1];
  if (last && last[1] === cls) last[0] += text; // merge adjacent same-style fragments
  else q.frags.push([text, cls]);
  if (!q.scheduled) {
    q.scheduled = true;
    requestAnimationFrame(() => flushTerm(termId));
  }
}

function flushTerm(termId) {
  const q = termQueues.get(termId);
  const el = $(termId);
  if (!q || !el) return;
  q.scheduled = false;
  // only auto-scroll if the user is already at the bottom
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60;
  const frag = document.createDocumentFragment();
  for (const [text, cls] of q.frags) {
    const span = document.createElement('span');
    if (cls) span.className = cls;
    span.textContent = text;
    frag.appendChild(span);
  }
  q.frags = [];
  el.appendChild(frag);
  while (el.childNodes.length > TERM_MAX_NODES) el.removeChild(el.firstChild);
  if (atBottom) el.scrollTop = el.scrollHeight;
}

function termClear(termId) {
  const q = termQueues.get(termId);
  if (q) { q.frags = []; q.scheduled = false; }
  $(termId).innerHTML = '';
}

// ---------------------------------------------------------------------------
// Streaming process plumbing — route proc events to handlers
// ---------------------------------------------------------------------------
const procHandlers = new Map(); // id -> { onData, onExit }
F.onProcData(({ id, stream, data }) => {
  const h = procHandlers.get(id);
  if (h) h.onData(stream, data);
});
F.onProcExit(({ id, code }) => {
  const h = procHandlers.get(id);
  if (h) { h.onExit(code); procHandlers.delete(id); }
});

async function startStream(tool, args, { cwd, termId, onExit, onData } = {}) {
  const r = await F.procStart(tool, args, { cwd });
  if (!r.ok) {
    if (termId) termAppend(termId, `启动失败: ${r.error}\n`, 'err');
    return null;
  }
  procHandlers.set(r.id, {
    onData: (stream, data) => {
      if (onData) onData(stream, data);
      if (termId) termAppend(termId, data, stream === 'stderr' ? 'dim' : '');
    },
    onExit: (code) => { if (onExit) onExit(code); },
  });
  return r.id;
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
const PAGE_TITLES = {
  dashboard: '仪表盘', forge: '项目构建 & 测试', deploy: '合约部署', transfer: '转账',
  interact: '合约调用', workbench: 'ABI 工作台', query: '链上查询', debug: '调试 & 日志',
  tools: '编码 & 转换',
  wallet: '钱包工具', anvil: 'Anvil 本地节点', chisel: 'Chisel REPL', settings: '网络 & 设置',
};

let currentPage = 'dashboard';
function gotoPage(page) {
  currentPage = page;
  document.querySelectorAll('.nav button').forEach((b) => b.classList.toggle('active', b.dataset.page === page));
  document.querySelectorAll('.page').forEach((p) => p.classList.toggle('active', p.id === `page-${page}`));
  $('topbar-title').textContent = t(PAGE_TITLES[page]) || page;
  if (page === 'dashboard') refreshDashboard();
}

// language switcher
$('locale-select').addEventListener('change', () => {
  const l = $('locale-select').value;
  config.locale = l;
  saveConfig();
  setLocale(l);
  $('topbar-title').textContent = t(PAGE_TITLES[currentPage]) || currentPage;
  renderChainsTable();
  renderHistory();
});

document.querySelectorAll('.nav button').forEach((b) => b.addEventListener('click', () => gotoPage(b.dataset.page)));
document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => gotoPage(b.dataset.goto)));

// theme
$('theme-toggle').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? '' : 'dark';
  if (next) document.documentElement.setAttribute('data-theme', next);
  else document.documentElement.removeAttribute('data-theme');
  config.theme = next;
  saveConfig();
});

// tabs
document.querySelectorAll('.tabs').forEach((tabs) => {
  tabs.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      tabs.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      const pane = tabs.parentElement;
      pane.querySelectorAll(':scope > .tab-pane').forEach((p) => p.classList.toggle('active', p.id === `tab-${b.dataset.tab}`));
    });
  });
});

// term copy / clear buttons
document.querySelectorAll('[data-copy-term]').forEach((b) =>
  b.addEventListener('click', () => { F.copy($(b.dataset.copyTerm).textContent); toast('已复制'); }));
document.querySelectorAll('[data-clear-term]').forEach((b) =>
  b.addEventListener('click', () => termClear(b.dataset.clearTerm)));

// ---------------------------------------------------------------------------
// Chain selector
// ---------------------------------------------------------------------------
function renderChainMenu() {
  const menu = $('chain-menu');
  menu.innerHTML = '';
  chains.forEach((c, i) => {
    const item = document.createElement('div');
    item.className = 'item' + (i === currentChainIdx ? ' sel' : '');
    item.innerHTML = `<span>${c.name}</span><span class="cid">${c.chainId}</span>`;
    item.addEventListener('click', () => {
      currentChainIdx = i;
      saveConfig();
      menu.classList.remove('open');
      updateChainPill();
      refreshDashboard();
      renderChainMenu();
    });
    menu.appendChild(item);
  });
}

function updateChainPill() {
  $('chain-name').textContent = currentChain().name;
  $('chain-dot').className = 'dot';
  $('d-chain').textContent = currentChain().name;
  $('d-chainid').textContent = `Chain ID ${currentChain().chainId} · ${currentChain().rpc}`;
}

$('chain-pill').addEventListener('click', (e) => {
  e.stopPropagation();
  $('chain-menu').classList.toggle('open');
});
document.addEventListener('click', () => $('chain-menu').classList.remove('open'));

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
let dashSeq = 0;
async function refreshDashboard() {
  const seq = ++dashSeq;
  updateChainPill();
  $('d-block').textContent = '…';
  $('d-gas').textContent = '…';
  $('d-latency').textContent = '…';
  $('d-rpc-host').textContent = (() => { try { return new URL(currentChain().rpc).host; } catch { return currentChain().rpc; } })();

  const t0 = performance.now();
  const bn = await cast(['block-number'], { timeoutMs: 12000 });
  if (seq !== dashSeq) return;
  const latency = Math.round(performance.now() - t0);
  if (bn.ok) {
    $('d-block').textContent = Number(bn.stdout.trim()).toLocaleString();
    $('d-latency').textContent = `${latency} ms`;
    $('chain-dot').className = 'dot ok';
    $('d-block-time').textContent = t('在线');
  } else {
    $('d-block').textContent = t('离线');
    $('d-latency').textContent = '—';
    $('chain-dot').className = 'dot bad';
    $('d-block-time').textContent = t('RPC 不可达');
    $('d-gas').textContent = '—';
    return;
  }
  const gas = await cast(['base-fee'], { timeoutMs: 12000 });
  if (seq !== dashSeq) return;
  if (gas.ok) {
    const wei = BigInt(gas.stdout.trim());
    const gwei = Number(wei) / 1e9;
    $('d-gas').textContent = gwei >= 1 ? `${gwei.toFixed(2)} gwei` : `${gwei.toFixed(4)} gwei`;
  } else {
    $('d-gas').textContent = '—';
  }
}

async function loadVersions() {
  const tools = ['forge', 'cast', 'anvil', 'chisel'];
  const parts = await Promise.all(tools.map(async (t) => {
    const r = await F.run(t, ['--version'], { timeoutMs: 10000 });
    const line = (r.stdout || r.stderr || '').split('\n')[0].trim();
    return { tool: t, line: r.ok ? line : '—' };
  }));
  $('d-versions').innerHTML = parts.map((p) =>
    `<div class="kv"><span class="k">${p.tool}</span><span class="v">${p.line || '—'}</span></div>`).join('');
  const forgeLine = parts[0].line.match(/[\d.]+/);
  $('foundry-ver').textContent = forgeLine ? `foundry ${forgeLine[0]}` : 'foundry ?';
  $('s-versions').textContent = parts.map((p) => `${p.tool} ${(p.line.match(/[\d.]+(-\w+)?/) || ['?'])[0]}`).join(' · ');
}

$('d-bal-btn').addEventListener('click', () => busy($('d-bal-btn'), async () => {
  const addr = $('d-bal-addr').value.trim();
  if (!addr) return;
  const r = await cast(['balance', addr, '--ether']);
  if (r.ok) r.stdout = `${r.stdout.trim()} ETH`;
  setResult('d-bal-out', r, { tintOk: true });
}));
bindEnter('d-bal-addr', 'd-bal-btn');

// ---------------------------------------------------------------------------
// Forge — build & test
// ---------------------------------------------------------------------------
let forgeProcId = null;

async function validateProject(inputId, statusElId) {
  const dir = $(inputId).value.trim();
  const statusEl = statusElId ? $(statusElId) : null;
  if (!dir) { if (statusEl) statusEl.innerHTML = ''; return null; }
  const scan = await F.scanProject(dir);
  if (statusEl) {
    statusEl.innerHTML = scan.valid
      ? `<span class="badge green">${t('✓ 有效的 Foundry 项目')}</span> <span class="badge gray">${tf('{0} 个合约', scan.contracts.length)}</span> <span class="badge ${scan.hasArtifacts ? 'gray' : 'amber'}">${t(scan.hasArtifacts ? '已构建' : '未构建')}</span>`
      : `<span class="badge red">${t('未找到 foundry.toml')}</span>`;
  }
  return scan;
}

$('f-pick').addEventListener('click', async () => {
  const dir = await F.pickDir();
  if (dir) {
    $('f-project').value = dir;
    config.lastProject = dir;
    saveConfig();
    validateProject('f-project', 'f-project-status');
  }
});
$('f-project').addEventListener('change', () => validateProject('f-project', 'f-project-status'));

$('f-init').addEventListener('click', async () => {
  const dir = await F.pickDir();
  if (!dir) return;
  termClear('f-term');
  termAppend('f-term', `$ forge init ${dir}\n`, 'dim');
  forgeProcId = await startStream('forge', ['init', dir, '--no-git'], {
    termId: 'f-term',
    onExit: (code) => {
      termAppend('f-term', '\n' + tf('[进程结束，退出码 {0}]', code) + '\n', code === 0 ? 'ok' : 'err');
      $('f-stop').disabled = true;
      if (code === 0) {
        $('f-project').value = dir;
        config.lastProject = dir; saveConfig();
        validateProject('f-project', 'f-project-status');
        toast('项目创建成功');
      }
    },
  });
  $('f-stop').disabled = !forgeProcId;
});

document.querySelectorAll('[data-forge]').forEach((btn) => {
  btn.addEventListener('click', async () => {
    const dir = $('f-project').value.trim();
    if (!dir) { toast('请先选择项目目录'); return; }
    const action = btn.dataset.forge;
    const extra = splitArgs($('f-extra').value);
    const match = $('f-match').value.trim();
    let args;
    switch (action) {
      case 'build': args = ['build']; break;
      case 'test': args = ['test']; break;
      case 'test-vvv': args = ['test', '-vvv']; break;
      case 'fmt': args = ['fmt']; break;
      case 'snapshot': args = ['snapshot']; break;
      case 'coverage': args = ['coverage']; break;
      case 'clean': args = ['clean']; break;
      default: return;
    }
    if ((action === 'test' || action === 'test-vvv') && match) args.push('--match-test', match);
    args.push(...extra);
    termClear('f-term');
    termAppend('f-term', `$ forge ${args.join(' ')}\n\n`, 'dim');
    config.lastProject = dir; saveConfig();
    forgeProcId = await startStream('forge', args, {
      cwd: dir,
      termId: 'f-term',
      onExit: (code) => {
        termAppend('f-term', '\n' + tf('[进程结束，退出码 {0}]', code) + '\n', code === 0 ? 'ok' : 'err');
        $('f-stop').disabled = true;
        forgeProcId = null;
        validateProject('f-project', 'f-project-status');
      },
    });
    $('f-stop').disabled = !forgeProcId;
  });
});

$('f-stop').addEventListener('click', () => {
  if (forgeProcId) F.procKill(forgeProcId);
});

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------
let depScan = null;

async function depRescan() {
  const dir = $('dep-project').value.trim();
  const sel = $('dep-contract');
  const ssel = $('dep-script');
  sel.innerHTML = `<option value="">${t('— 请先选择项目 —')}</option>`;
  ssel.innerHTML = `<option value="">${t('— 请先选择项目 —')}</option>`;
  $('dep-ctor').innerHTML = '';
  if (!dir) return;
  depScan = await F.scanProject(dir);
  if (!depScan.valid) {
    sel.innerHTML = `<option value="">${t('✗ 该目录不是 Foundry 项目')}</option>`;
    ssel.innerHTML = `<option value="">${t('✗ 该目录不是 Foundry 项目')}</option>`;
    return;
  }
  sel.innerHTML = `<option value="">${t('— 选择要部署的合约 —')}</option>`;
  depScan.contracts.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${c.name}  (${c.file})`;
    sel.appendChild(opt);
  });
  ssel.innerHTML = (depScan.scripts || []).length
    ? `<option value="">${t('— 选择部署脚本 —')}</option>`
    : `<option value="">${t('（项目中没有 script/*.s.sol）')}</option>`;
  (depScan.scripts || []).forEach((s, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${s.name}  (${s.file})`;
    ssel.appendChild(opt);
  });
}
$('dep-script-rescan').addEventListener('click', depRescan);

$('dep-pick').addEventListener('click', async () => {
  const dir = await F.pickDir();
  if (dir) {
    $('dep-project').value = dir;
    config.lastProject = dir; saveConfig();
    depRescan();
  }
});
$('dep-project').addEventListener('change', depRescan);
$('dep-rescan').addEventListener('click', depRescan);

$('dep-contract').addEventListener('change', async () => {
  $('dep-ctor').innerHTML = '';
  const i = $('dep-contract').value;
  if (i === '' || !depScan) return;
  const c = depScan.contracts[Number(i)];
  const art = await F.getArtifact($('dep-project').value.trim(), c.file, c.name);
  const box = $('dep-ctor');
  if (!art) {
    box.innerHTML = `<div class="note">${t('未找到编译产物 — 点击「先构建」后可自动解析构造函数参数；也可以直接在下方手动填写。')}</div>` + ctorManualField();
    return;
  }
  if (!art.constructorInputs.length) {
    box.innerHTML = `<div style="font-size:12.5px;color:var(--text-2);margin-top:4px">${t('该合约无构造函数参数。')}</div>`;
    return;
  }
  box.innerHTML = `<label style="display:block;font-size:12px;font-weight:500;color:var(--text-2);margin:8px 0 6px">${t('构造函数参数')}</label>` +
    art.constructorInputs.map((inp, idx) =>
      `<div class="field"><label>${inp.name || `arg${idx}`} · <span style="font-family:var(--font-mono)">${inp.type}</span></label>
       <input type="text" class="dep-ctor-arg" data-type="${inp.type}" placeholder="${inp.type}"></div>`).join('');
});

function ctorManualField() {
  return `<div class="field" style="margin-top:8px"><label>${t('构造函数参数（空格分隔，可留空）')}</label>
    <input type="text" id="dep-ctor-manual" placeholder='"My Token" MTK 18'></div>`;
}

$('dep-build').addEventListener('click', () => busy($('dep-build'), async () => {
  const dir = $('dep-project').value.trim();
  if (!dir) { toast('请先选择项目'); return; }
  termClear('dep-term');
  termAppend('dep-term', '$ forge build\n\n', 'dim');
  await new Promise((resolve) => {
    startStream('forge', ['build'], {
      cwd: dir, termId: 'dep-term',
      onExit: (code) => {
        termAppend('dep-term', '\n' + t(code === 0 ? '[构建成功]' : '[构建失败]') + '\n', code === 0 ? 'ok' : 'err');
        resolve();
      },
    });
  });
  // re-trigger ctor parse
  $('dep-contract').dispatchEvent(new Event('change'));
}));

function buildDeployArgs(dryRun) {
  const dir = $('dep-project').value.trim();
  const i = $('dep-contract').value;
  if (!dir || i === '' || !depScan) { toast('请选择项目和合约'); return null; }
  const c = depScan.contracts[Number(i)];
  const signer = signerArgs('dep-pk', 'dep-account', 'dep-pass');
  if (!dryRun && !signer) { toast('请填写私钥或 Keystore 账户'); return null; }

  const args = ['create', `${c.file}:${c.name}`, ...rpcArgs()];
  if (signer) args.push(...signer);
  else args.push('--from', '0x0000000000000000000000000000000000000001', '--unlocked'); // dry-run placeholder sender

  const value = $('dep-value').value.trim();
  if (value) args.push('--value', value);
  const gas = $('dep-gas').value.trim();
  if (gas) args.push('--gas-limit', gas);
  if ($('dep-verify').checked && config.etherscanKey) args.push('--verify', '--etherscan-api-key', config.etherscanKey);
  args.push(...splitArgs($('dep-extra').value));
  // forge create is a dry-run by default; --broadcast actually sends the tx
  if (!dryRun) args.push('--broadcast');

  // --constructor-args is greedy/variadic — it must be the LAST argument
  const ctorArgs = [];
  document.querySelectorAll('.dep-ctor-arg').forEach((inp) => { if (inp.value.trim() !== '') ctorArgs.push(inp.value.trim()); });
  const manual = $('dep-ctor-manual');
  if (manual && manual.value.trim()) ctorArgs.push(...splitArgs(manual.value));
  if (ctorArgs.length) args.push('--constructor-args', ...ctorArgs);

  return { args, dir, name: c.name };
}

async function runDeploy(dryRun) {
  const built = buildDeployArgs(dryRun);
  if (!built) return;
  const { args, dir, name } = built;
  const label = dryRun ? '模拟' : '部署';
  const shownArgs = args.map((a, idx) => (['--private-key', '--password'].includes(args[idx - 1]) ? '****' : a));
  termClear('dep-term');
  $('dep-result').innerHTML = '';
  termAppend('dep-term', `$ forge ${shownArgs.join(' ')}\n\n`, 'dim');
  let buffer = '';
  await new Promise((resolve) => {
    startStream('forge', args, {
      cwd: dir, termId: 'dep-term',
      onData: (_s, data) => { buffer += data; },
      onExit: (code) => {
        if (code === 0) {
          termAppend('dep-term', '\n' + t(dryRun ? '[模拟成功]' : '[部署成功]') + '\n', 'ok');
          const addrMatch = buffer.match(/Deployed to:\s*(0x[a-fA-F0-9]{40})/);
          const txMatch = buffer.match(/Transaction hash:\s*(0x[a-fA-F0-9]{64})/);
          if (dryRun) {
            $('dep-result').innerHTML = `<div class="result-box" style="display:block">${t('模拟执行通过 ✓ — 合约可以部署。点击「🚀 部署合约」正式发送交易。')}</div>`;
          } else if (addrMatch) {
            if (txMatch) recordTx('部署', `${name} → ${addrMatch[1]}`, txMatch[1]);
            const explorer = currentChain().explorer;
            $('dep-result').innerHTML = `
              <div class="result-box ok-tint" style="display:block">
                <div><b>${name}</b> ${t('部署成功 ✓')}</div>
                <div style="margin-top:6px">${t('合约地址：')}<span class="copyable" data-copy="${addrMatch[1]}">${addrMatch[1]}</span></div>
                ${txMatch ? `<div>${t('交易哈希：')}<span class="copyable" data-copy="${txMatch[1]}">${txMatch[1]}</span></div>` : ''}
                ${explorer && addrMatch ? `<div style="margin-top:6px"><a href="#" data-ext="${explorer}/address/${addrMatch[1]}" style="color:var(--accent)">${t('在区块浏览器中查看 ↗')}</a></div>` : ''}
              </div>`;
            bindCopyables($('dep-result'));
          }
        } else {
          termAppend('dep-term', '\n' + tf('[部署失败，退出码 {0}]', code) + '\n', 'err');
        }
        resolve();
      },
    });
  });
}

function bindCopyables(root) {
  root.querySelectorAll('[data-copy]').forEach((el) =>
    el.addEventListener('click', () => { F.copy(el.dataset.copy); toast('已复制'); }));
  root.querySelectorAll('[data-ext]').forEach((el) =>
    el.addEventListener('click', (e) => { e.preventDefault(); F.openExternal(el.dataset.ext); }));
}

$('dep-go').addEventListener('click', () => busy($('dep-go'), () => runDeploy(false)));
$('dep-dry').addEventListener('click', () => busy($('dep-dry'), () => runDeploy(true)));

// --- forge script ---
async function runScript(broadcast) {
  const dir = $('dep-project').value.trim();
  const i = $('dep-script').value;
  if (!dir || i === '' || !depScan || !depScan.scripts[Number(i)]) { toast('请选择项目和部署脚本'); return; }
  const s = depScan.scripts[Number(i)];
  const args = ['script', `${s.file}:${s.name}`, ...rpcArgs()];
  const sig = $('dep-sig').value.trim();
  if (sig) args.push('--sig', sig);
  const signer = signerArgs('dep-pk', 'dep-account', 'dep-pass');
  if (broadcast) {
    if (!signer) { toast('广播执行需要私钥或 Keystore 账户'); return; }
    args.push(...signer, '--broadcast');
  } else if (signer) {
    args.push(...signer);
  }
  args.push(...splitArgs($('dep-script-extra').value));

  const shownArgs = args.map((a, idx) => (['--private-key', '--password'].includes(args[idx - 1]) ? '****' : a));
  termClear('dep-term');
  $('dep-result').innerHTML = '';
  termAppend('dep-term', `$ forge ${shownArgs.join(' ')}\n\n`, 'dim');
  let buffer = '';
  await new Promise((resolve) => {
    startStream('forge', args, {
      cwd: dir, termId: 'dep-term',
      onData: (_s2, data) => { if (buffer.length < 512 * 1024) buffer += data; },
      onExit: async (code) => {
        if (code === 0) {
          termAppend('dep-term', '\n' + t(broadcast ? '[脚本广播执行成功]' : '[脚本模拟执行成功]') + '\n', 'ok');
          if (broadcast) {
            // tx details live in broadcast/<script>/<chainid>/run-latest.json, not stdout
            const fileMatch = buffer.match(/Transactions saved to:\s*(\S+\.json)/);
            const run = fileMatch ? await F.readJSON(fileMatch[1]) : null;
            const txs = (run?.transactions || []).map((t) => ({
              hash: t.hash,
              type: t.transactionType,
              name: t.contractName || '',
              addr: t.contractAddress || '',
            }));
            if (txs.length) recordTx('脚本部署', `${s.name} · ${txs.length} 笔交易`, txs[0].hash);
            const explorer = currentChain().explorer;
            $('dep-result').innerHTML = `
              <div class="result-box ok-tint" style="display:block">
                <div><b>${s.name}</b> ${tf('脚本执行成功 ✓（{0} 笔交易已上链）', txs.length)}</div>
                ${txs.map((tx) => `<div style="margin-top:4px">${t(tx.type === 'CREATE' ? '部署' : '调用')} ${tx.name || ''}${tx.addr ? '：<span class="copyable" data-copy="' + tx.addr + '">' + tx.addr + '</span>' : ''}
                  ${tx.hash ? `· <span class="copyable" data-copy="${tx.hash}">tx ${tx.hash.slice(0, 10)}…</span>` : ''}
                  ${explorer && tx.hash ? `<a href="#" data-ext="${explorer}/tx/${tx.hash}" style="color:var(--accent)">↗</a>` : ''}</div>`).join('')}
              </div>`;
          } else {
            const addrs = [...new Set([...buffer.matchAll(/Contract Address:\s*(0x[a-fA-F0-9]{40})/g)].map((m) => m[1]))];
            $('dep-result').innerHTML = `
              <div class="result-box" style="display:block">${tf('模拟执行通过 ✓{0}。点击「🚀 广播执行」正式上链。', addrs.length ? tf(' — 将部署：{0}', addrs.join(', ')) : '')}</div>`;
          }
          bindCopyables($('dep-result'));
        } else {
          termAppend('dep-term', '\n' + tf('[脚本执行失败，退出码 {0}]', code) + '\n', 'err');
        }
        resolve();
      },
    });
  });
}

$('dep-script-sim').addEventListener('click', () => busy($('dep-script-sim'), () => runScript(false)));
$('dep-script-go').addEventListener('click', () => busy($('dep-script-go'), () => runScript(true)));

// ---------------------------------------------------------------------------
// Shared signer / unit helpers
// ---------------------------------------------------------------------------
// build --private-key / --account [--password] args from a trio of input ids
function signerArgs(pkId, accountId, passId) {
  const pk = $(pkId).value.trim();
  const account = $(accountId).value.trim();
  const pass = passId ? $(passId).value : '';
  if (account) {
    const a = ['--account', account];
    if (pass) a.push('--password', pass);
    return a;
  }
  if (pk) return ['--private-key', pk];
  return null;
}

function parseUnits(amount, decimals) {
  const clean = String(amount).trim();
  if (!/^\d*\.?\d*$/.test(clean) || clean === '' || clean === '.') return null;
  const [i, f = ''] = clean.split('.');
  if (f.length > decimals) return null; // too many decimal places
  const frac = (f + '0'.repeat(decimals)).slice(0, decimals);
  return (BigInt(i || '0') * 10n ** BigInt(decimals) + BigInt(frac || '0')).toString();
}

function formatUnits(raw, decimals) {
  try {
    const v = BigInt(raw);
    const base = 10n ** BigInt(decimals);
    const whole = v / base;
    const frac = (v % base).toString().padStart(decimals, '0').replace(/0+$/, '');
    return frac ? `${whole}.${frac}` : whole.toString();
  } catch { return String(raw); }
}

// derive sender address from private key (keystore accounts are skipped)
async function deriveAddress(pkId) {
  const pk = $(pkId).value.trim();
  if (!pk) return null;
  const r = await castLocal(['wallet', 'address', '--private-key', pk]);
  return r.ok ? r.stdout.trim() : null;
}

// ---------------------------------------------------------------------------
// Transaction history (persisted in config)
// ---------------------------------------------------------------------------
function recordTx(type, detail, hash) {
  if (!config.txHistory) config.txHistory = [];
  config.txHistory.unshift({ t: Date.now(), type, detail, hash, chain: currentChain().name, explorer: currentChain().explorer });
  config.txHistory = config.txHistory.slice(0, 50);
  saveConfig();
  renderHistory();
}

function renderHistory() {
  const list = config.txHistory || [];
  const tbody = $('hist-table').querySelector('tbody');
  $('hist-empty').style.display = list.length ? 'none' : '';
  tbody.innerHTML = '';
  list.forEach((h) => {
    const d = new Date(h.t);
    const time = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const short = h.hash ? `${h.hash.slice(0, 10)}…${h.hash.slice(-6)}` : '—';
    const link = h.explorer && h.hash ? `<a href="#" data-ext="${h.explorer}/tx/${h.hash}" style="color:var(--accent);text-decoration:none">${short} ↗</a>` : `<span class="copyable" data-copy="${h.hash || ''}">${short}</span>`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="white-space:nowrap;color:var(--text-2)">${time}</td>
      <td><span class="badge gray">${t(h.type)}</span></td>
      <td>${h.chain}</td>
      <td class="mono" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${h.detail}">${h.detail}</td>
      <td class="mono">${link}</td>`;
    tbody.appendChild(tr);
  });
  bindCopyables(tbody);
}

$('hist-clear').addEventListener('click', () => {
  config.txHistory = [];
  saveConfig();
  renderHistory();
});

// extract a tx hash from cast/forge output (json or table format)
function extractTxHash(text) {
  const j = text.match(/"transactionHash"\s*:\s*"(0x[a-fA-F0-9]{64})"/);
  if (j) return j[1];
  const t = text.match(/transactionHash\s+(0x[a-fA-F0-9]{64})/);
  if (t) return t[1];
  const f = text.match(/Transaction hash:\s*(0x[a-fA-F0-9]{64})/);
  return f ? f[1] : null;
}

// ---------------------------------------------------------------------------
// Transfer — native & ERC-20
// ---------------------------------------------------------------------------
$('tr-whoami').addEventListener('click', () => busy($('tr-whoami'), async () => {
  const out = $('tr-whoami-out');
  const account = $('tr-account').value.trim();
  const addr = await deriveAddress('tr-pk');
  if (!addr) {
    out.textContent = account ? tf('Keystore 账户「{0}」（发送时使用）', account) : t('请先填写私钥或账户名');
    return;
  }
  const bal = await cast(['balance', addr, '--ether']);
  out.textContent = `${addr} · ${bal.ok ? Number(bal.stdout.trim()).toFixed(6) + ' ' : ''}${bal.ok ? 'ETH' : ''}`;
}));

$('tr-eth-max').addEventListener('click', () => busy($('tr-eth-max'), async () => {
  const addr = await deriveAddress('tr-pk');
  if (!addr) { toast('「全部余额」需要填写私钥'); return; }
  const [bal, gp] = await Promise.all([cast(['balance', addr]), cast(['gas-price'])]);
  if (!bal.ok || !gp.ok) { toast('RPC 查询失败'); return; }
  const balance = BigInt(bal.stdout.trim());
  const reserve = BigInt(gp.stdout.trim()) * 30000n; // keep ~1.5x a 21k transfer for gas
  const max = balance > reserve ? balance - reserve : 0n;
  $('tr-eth-amount').value = formatUnits(max.toString(), 18);
}));

$('tr-eth-go').addEventListener('click', () => busy($('tr-eth-go'), async () => {
  const to = $('tr-eth-to').value.trim();
  const amount = $('tr-eth-amount').value.trim();
  const signer = signerArgs('tr-pk', 'tr-account', 'tr-pass');
  if (!to || !amount) return toast('请填写接收地址和金额');
  if (!signer) return toast('请填写私钥或 Keystore 账户');
  if (parseUnits(amount, 18) === null) return toast('金额格式不正确');
  const r = await cast(['send', to, '--value', `${amount}ether`, ...signer, '--json'], { timeoutMs: 180000 });
  const hash = extractTxHash(r.stdout);
  if (r.ok && hash) {
    r.stdout = `${t('转账成功 ✓')}\n${t('交易哈希：')}${hash}`;
    recordTx('转账', `${amount} ETH → ${to}`, hash);
  }
  setResult('tr-eth-out', r, { tintOk: true });
}));

let tokDecimals = null;

$('tr-tok-info').addEventListener('click', () => busy($('tr-tok-info'), async () => {
  const token = $('tr-tok-addr').value.trim();
  if (!token) return toast('请填写代币合约地址');
  const meta = $('tr-tok-meta');
  meta.textContent = '…';
  const [sym, dec, name] = await Promise.all([
    cast(['call', token, 'symbol()(string)']),
    cast(['call', token, 'decimals()(uint8)']),
    cast(['call', token, 'name()(string)']),
  ]);
  if (!dec.ok) {
    meta.textContent = tf('查询失败：该地址可能不是 ERC-20 合约（{0}）', (dec.stderr || '').split('\n')[0].slice(0, 80));
    tokDecimals = null;
    return;
  }
  tokDecimals = parseInt(dec.stdout.trim(), 10);
  const symbol = sym.ok ? sym.stdout.trim().replace(/^"|"$/g, '') : '?';
  const nm = name.ok ? name.stdout.trim().replace(/^"|"$/g, '') : '';
  meta.textContent = tf('✓ {0} ({1}) · decimals: {2}', nm, symbol, tokDecimals);
}));

$('tr-tok-bal').addEventListener('click', () => busy($('tr-tok-bal'), async () => {
  const token = $('tr-tok-addr').value.trim();
  if (!token) return toast('请填写代币合约地址');
  const addr = await deriveAddress('tr-pk');
  if (!addr) return toast('查余额需要填写私钥');
  if (tokDecimals === null) $('tr-tok-info').click();
  const r = await cast(['call', token, 'balanceOf(address)(uint256)', addr]);
  if (r.ok) {
    const raw = r.stdout.trim().split(/\s/)[0]; // strip possible "[5e18]" annotation
    r.stdout = tokDecimals !== null ? `${formatUnits(raw, tokDecimals)}${tf('（raw: {0}）', raw)}` : raw;
  }
  setResult('tr-tok-out', r, { tintOk: true });
}));

$('tr-tok-go').addEventListener('click', () => busy($('tr-tok-go'), async () => {
  const token = $('tr-tok-addr').value.trim();
  const to = $('tr-tok-to').value.trim();
  const amount = $('tr-tok-amount').value.trim();
  const signer = signerArgs('tr-pk', 'tr-account', 'tr-pass');
  if (!token || !to || !amount) return toast('请填写代币地址、接收地址和数量');
  if (!signer) return toast('请填写私钥或 Keystore 账户');
  if (tokDecimals === null) {
    const dec = await cast(['call', token, 'decimals()(uint8)']);
    if (!dec.ok) return setResult('tr-tok-out', { ok: false, stdout: '', stderr: t('无法读取代币 decimals，请先点击「查询代币」确认合约有效') });
    tokDecimals = parseInt(dec.stdout.trim(), 10);
  }
  const raw = parseUnits(amount, tokDecimals);
  if (raw === null) return toast(tf('数量格式不正确（最多 {0} 位小数）', tokDecimals));
  const r = await cast(['send', token, 'transfer(address,uint256)', to, raw, ...signer, '--json'], { timeoutMs: 180000 });
  const hash = extractTxHash(r.stdout);
  if (r.ok && hash) {
    const revert = /"status"\s*:\s*"0x0"/.test(r.stdout);
    r.ok = !revert;
    r.stdout = revert ? `${t('交易已上链但执行失败（reverted）')}\n${t('哈希：')}${hash}` : `${t('代币转账成功 ✓')}\n${t('数量：')}${amount}${tf('（raw: {0}）', raw)}\n${t('交易哈希：')}${hash}`;
    if (!revert) recordTx('ERC-20', `${amount} → ${to}`, hash);
  }
  setResult('tr-tok-out', r, { tintOk: true });
}));

// --- ERC-20 approve / allowance ---
const MAX_UINT256 = '115792089237316195423570985008687907853269984665640564039457584007913129639935';

async function ensureTokDecimals(token) {
  if (tokDecimals !== null) return true;
  const dec = await cast(['call', token, 'decimals()(uint8)']);
  if (!dec.ok) return false;
  tokDecimals = parseInt(dec.stdout.trim(), 10);
  return true;
}

async function doApprove(rawAmount, label) {
  const token = $('tr-tok-addr').value.trim();
  const spender = $('tr-ap-spender').value.trim();
  const signer = signerArgs('tr-pk', 'tr-account', 'tr-pass');
  if (!token || !spender) return toast('请填写代币地址和 spender');
  if (!signer) return toast('请填写私钥或 Keystore 账户');
  const r = await cast(['send', token, 'approve(address,uint256)', spender, rawAmount, ...signer, '--json'], { timeoutMs: 180000 });
  const hash = extractTxHash(r.stdout);
  if (r.ok && hash) {
    const revert = /"status"\s*:\s*"0x0"/.test(r.stdout);
    r.ok = !revert;
    r.stdout = revert ? `${t('交易已上链但执行失败（reverted）')}\n${t('哈希：')}${hash}` : `${tf('授权成功 ✓（{0}）', t(label))}\n${t('交易哈希：')}${hash}`;
    if (!revert) recordTx('授权', `${label} → ${spender.slice(0, 10)}…`, hash);
  }
  setResult('tr-ap-out', r, { tintOk: true });
}

$('tr-ap-go').addEventListener('click', () => busy($('tr-ap-go'), async () => {
  const token = $('tr-tok-addr').value.trim();
  const amount = $('tr-ap-amount').value.trim();
  if (!token || !amount) return toast('请填写代币地址和授权数量');
  if (!(await ensureTokDecimals(token))) return toast('无法读取代币 decimals');
  const raw = parseUnits(amount, tokDecimals);
  if (raw === null) return toast('数量格式不正确');
  await doApprove(raw, amount);
}));

$('tr-ap-max').addEventListener('click', () => busy($('tr-ap-max'), () => doApprove(MAX_UINT256, '无限额度')));

$('tr-ap-query').addEventListener('click', () => busy($('tr-ap-query'), async () => {
  const token = $('tr-tok-addr').value.trim();
  const spender = $('tr-ap-spender').value.trim();
  if (!token || !spender) return toast('请填写代币地址和 spender');
  const owner = await deriveAddress('tr-pk');
  if (!owner) return toast('查询 allowance 需要填写私钥（用于确定 owner）');
  const r = await cast(['call', token, 'allowance(address,address)(uint256)', owner, spender]);
  if (r.ok) {
    const raw = r.stdout.trim().split(/\s/)[0];
    const isMax = raw === MAX_UINT256;
    await ensureTokDecimals(token);
    r.stdout = isMax ? t('∞ 无限授权') : (tokDecimals !== null ? `${formatUnits(raw, tokDecimals)}${tf('（raw: {0}）', raw)}` : raw);
  }
  setResult('tr-ap-out', r, { tintOk: true });
}));

// ---------------------------------------------------------------------------
// Interact — call / send / raw
// ---------------------------------------------------------------------------
$('ir-go').addEventListener('click', () => busy($('ir-go'), async () => {
  const addr = $('ir-addr').value.trim();
  const sig = $('ir-sig').value.trim();
  if (!addr || !sig) { toast('请填写地址和方法签名'); return; }
  const args = ['call', addr, sig, ...splitArgs($('ir-args').value)];
  setResult('ir-out', await cast(args), { tintOk: true });
}));
bindEnter('ir-args', 'ir-go');

$('iw-estimate').addEventListener('click', () => busy($('iw-estimate'), async () => {
  const addr = $('iw-addr').value.trim();
  const sig = $('iw-sig').value.trim();
  if (!addr || !sig) { toast('请填写地址和方法签名'); return; }
  const args = ['estimate', addr, sig, ...splitArgs($('iw-args').value)];
  const from = await deriveAddress('iw-pk');
  if (from) args.push('--from', from); // simulate from the real sender, not the zero address
  const value = $('iw-value').value.trim();
  if (value) args.push('--value', value);
  const r = await cast(args);
  if (r.ok) r.stdout = tf('预计 gas: {0}', r.stdout.trim());
  setResult('iw-out', r, { tintOk: true });
}));

$('iw-go').addEventListener('click', () => busy($('iw-go'), async () => {
  const addr = $('iw-addr').value.trim();
  const sig = $('iw-sig').value.trim();
  const signer = signerArgs('iw-pk', 'iw-account', 'iw-pass');
  if (!addr || !sig) { toast('请填写地址和方法签名'); return; }
  if (!signer) { toast('请填写私钥或 Keystore 账户'); return; }
  const args = ['send', addr, sig, ...splitArgs($('iw-args').value), ...signer];
  const value = $('iw-value').value.trim();
  if (value) args.push('--value', value);
  const r = await cast(args, { timeoutMs: 180000 });
  const hash = extractTxHash(r.stdout);
  if (r.ok && hash) recordTx('合约写入', `${sig} @ ${addr.slice(0, 10)}…`, hash);
  setResult('iw-out', r, { tintOk: true });
}));

// --- raw calldata (works for unverified contracts) ---
$('ic-call').addEventListener('click', () => busy($('ic-call'), async () => {
  const addr = $('ic-addr').value.trim();
  const data = $('ic-data').value.trim();
  if (!addr || !data) return toast('请填写合约地址和 calldata');
  const r = await cast(['call', addr, '--data', data]);
  const rettype = $('ic-rettype').value.trim();
  if (r.ok && rettype && r.stdout.trim() !== '0x') {
    const dec = await castLocal(['abi-decode', `f()(${rettype})`, r.stdout.trim()]);
    if (dec.ok) r.stdout = `${dec.stdout.trim()}\n\n原始返回：${r.stdout.trim()}`;
  }
  setResult('ic-out', r, { tintOk: true });
}));

$('ic-estimate').addEventListener('click', () => busy($('ic-estimate'), async () => {
  const addr = $('ic-addr').value.trim();
  const data = $('ic-data').value.trim();
  if (!addr || !data) return toast('请填写合约地址和 calldata');
  const args = ['estimate', addr, data];
  const from = await deriveAddress('ic-pk');
  if (from) args.push('--from', from); // simulate from the real sender, not the zero address
  const value = $('ic-value').value.trim();
  if (value) args.push('--value', value);
  const r = await cast(args);
  if (r.ok) r.stdout = tf('预计 gas: {0}', r.stdout.trim());
  setResult('ic-out', r, { tintOk: true });
}));

$('ic-send').addEventListener('click', () => busy($('ic-send'), async () => {
  const addr = $('ic-addr').value.trim();
  const data = $('ic-data').value.trim();
  const signer = signerArgs('ic-pk', 'ic-account', 'ic-pass');
  if (!addr || !data) return toast('请填写合约地址和 calldata');
  if (!signer) return toast('请填写私钥或 Keystore 账户');
  const args = ['send', addr, data, ...signer, '--json'];
  const value = $('ic-value').value.trim();
  if (value) args.push('--value', value);
  const r = await cast(args, { timeoutMs: 180000 });
  const hash = extractTxHash(r.stdout);
  if (r.ok && hash) {
    const revert = /"status"\s*:\s*"0x0"/.test(r.stdout);
    r.ok = !revert;
    r.stdout = revert
      ? `${t('交易已上链但执行失败（reverted）')}\n${t('哈希：')}${hash}`
      : `${t('交易成功 ✓')}\n${t('交易哈希：')}${hash}`;
    if (!revert) recordTx('Raw 调用', `${data.slice(0, 10)}… @ ${addr.slice(0, 10)}…`, hash);
  }
  setResult('ic-out', r, { tintOk: true });
}));

$('raw-cast-go').addEventListener('click', () => busy($('raw-cast-go'), async () => {
  const line = $('raw-cast').value.trim();
  if (!line) return;
  const args = splitArgs(line);
  // append rpc automatically unless user already provided one
  const hasRpc = args.includes('--rpc-url') || args.includes('-r');
  const r = await F.run('cast', hasRpc ? args : [...args, ...rpcArgs()], { timeoutMs: 120000 });
  setResult('raw-cast-out', r, { tintOk: true });
}));
bindEnter('raw-cast', 'raw-cast-go');

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------
document.querySelectorAll('[data-q]').forEach((btn) => {
  btn.addEventListener('click', () => busy(btn, async () => {
    const kind = btn.dataset.q;
    let args, outId;
    switch (kind) {
      case 'balance': {
        const a = $('q-addr').value.trim(); if (!a) return toast('请填写地址');
        args = ['balance', a, '--ether']; outId = 'q-addr-out'; break;
      }
      case 'nonce': {
        const a = $('q-addr').value.trim(); if (!a) return toast('请填写地址');
        args = ['nonce', a]; outId = 'q-addr-out'; break;
      }
      case 'code': {
        const a = $('q-addr').value.trim(); if (!a) return toast('请填写地址');
        args = ['code', a]; outId = 'q-addr-out'; break;
      }
      case 'codesize': {
        const a = $('q-addr').value.trim(); if (!a) return toast('请填写地址');
        args = ['codesize', a]; outId = 'q-addr-out'; break;
      }
      case 'tx': {
        const h = $('q-tx').value.trim(); if (!h) return toast('请填写交易哈希');
        args = ['tx', h]; outId = 'q-tx-out'; break;
      }
      case 'receipt': {
        const h = $('q-tx').value.trim(); if (!h) return toast('请填写交易哈希');
        args = ['receipt', h]; outId = 'q-tx-out'; break;
      }
      case 'block': {
        const b = $('q-block').value.trim() || 'latest';
        args = ['block', b]; outId = 'q-block-out'; break;
      }
      case 'storage': {
        const a = $('q-st-addr').value.trim(); const s = $('q-st-slot').value.trim();
        if (!a) return toast('请填写合约地址');
        args = ['storage', a, s || '0']; outId = 'q-st-out'; break;
      }
      default: return;
    }
    const r = await cast(args, { timeoutMs: 30000 });
    if (kind === 'balance' && r.ok) r.stdout = `${r.stdout.trim()} ETH`;
    if (kind === 'code' && r.ok && r.stdout.trim() === '0x') r.stdout = t('0x （该地址不是合约 / 无代码）');
    setResult(outId, r, { tintOk: true });
  }));
});

// ---------------------------------------------------------------------------
// Tools (offline cast utilities)
// ---------------------------------------------------------------------------
$('t-unit-go').addEventListener('click', () => busy($('t-unit-go'), async () => {
  const v = $('t-unit-val').value.trim(); if (!v) return;
  const dir = $('t-unit-dir').value;
  let r;
  if (dir === 'to-wei') r = await castLocal(['to-wei', v, 'ether']);
  else if (dir === 'from-wei') r = await castLocal(['from-wei', v, 'ether']);
  else r = await castLocal(['to-unit', v, 'gwei']);
  setResult('t-unit-out', r, { tintOk: true });
}));
bindEnter('t-unit-val', 't-unit-go');

$('t-base-go').addEventListener('click', () => busy($('t-base-go'), async () => {
  const v = $('t-base-val').value.trim(); if (!v) return;
  const dir = $('t-base-dir').value;
  const r = dir === 'to-hex' ? await castLocal(['to-hex', v]) : await castLocal(['to-dec', v]);
  setResult('t-base-out', r, { tintOk: true });
}));
bindEnter('t-base-val', 't-base-go');

$('t-keccak-go').addEventListener('click', () => busy($('t-keccak-go'), async () => {
  const v = $('t-keccak-val').value; if (!v) return;
  setResult('t-keccak-out', await castLocal(['keccak', v]), { tintOk: true });
}));
bindEnter('t-keccak-val', 't-keccak-go');

$('t-sig-go').addEventListener('click', () => busy($('t-sig-go'), async () => {
  const v = $('t-sig-val').value.trim(); if (!v) return;
  const kind = $('t-sig-kind').value;
  setResult('t-sig-out', await castLocal([kind, v]), { tintOk: true });
}));
bindEnter('t-sig-val', 't-sig-go');

$('t-abi-go').addEventListener('click', () => busy($('t-abi-go'), async () => {
  const sig = $('t-abi-sig').value.trim(); if (!sig) return;
  const args = splitArgs($('t-abi-args').value);
  const mode = $('t-abi-mode').value;
  const r = mode === 'calldata'
    ? await castLocal(['calldata', sig, ...args])
    : await castLocal(['abi-encode', sig, ...args]);
  setResult('t-abi-out', r, { tintOk: true });
}));

$('t-dec-go').addEventListener('click', () => busy($('t-dec-go'), async () => {
  const sig = $('t-dec-sig').value.trim();
  const data = $('t-dec-data').value.trim();
  if (!sig || !data) return;
  setResult('t-dec-out', await castLocal(['decode-calldata', sig, data]), { tintOk: true });
}));

$('t-addr-go').addEventListener('click', () => busy($('t-addr-go'), async () => {
  const v = $('t-addr-val').value.trim(); if (!v) return;
  const kind = $('t-addr-kind').value;
  let r;
  if (kind === 'compute-address') r = await cast(['compute-address', v]);
  else r = await castLocal([kind, v]);
  setResult('t-addr-out', r, { tintOk: true });
}));
bindEnter('t-addr-val', 't-addr-go');

$('t-4b-go').addEventListener('click', () => busy($('t-4b-go'), async () => {
  const v = $('t-4b-val').value.trim(); if (!v) return;
  const sub = v.length > 10 ? '4byte-calldata' : '4byte';
  setResult('t-4b-out', await castLocal([sub, v], { timeoutMs: 20000 }), { tintOk: true });
}));
bindEnter('t-4b-val', 't-4b-go');

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------
$('w-new').addEventListener('click', () => busy($('w-new'), async () => {
  setResult('w-new-out', await castLocal(['wallet', 'new']), { tintOk: true });
}));
$('w-new-mn').addEventListener('click', () => busy($('w-new-mn'), async () => {
  setResult('w-new-out', await castLocal(['wallet', 'new-mnemonic']), { tintOk: true });
}));

$('w-pk-go').addEventListener('click', () => busy($('w-pk-go'), async () => {
  const pk = $('w-pk').value.trim(); if (!pk) return;
  setResult('w-pk-out', await castLocal(['wallet', 'address', '--private-key', pk]), { tintOk: true });
}));

$('w-sign-go').addEventListener('click', () => busy($('w-sign-go'), async () => {
  const msg = $('w-sign-msg').value;
  const pk = $('w-sign-pk').value.trim();
  if (!msg || !pk) return toast('请填写消息和私钥');
  setResult('w-sign-out', await castLocal(['wallet', 'sign', '--private-key', pk, msg]), { tintOk: true });
}));

$('w-ver-go').addEventListener('click', () => busy($('w-ver-go'), async () => {
  const msg = $('w-ver-msg').value;
  const sig = $('w-ver-sig').value.trim();
  const addr = $('w-ver-addr').value.trim();
  if (!msg || !sig || !addr) return toast('请填写消息、签名和地址');
  setResult('w-ver-out', await castLocal(['wallet', 'verify', '--address', addr, msg, sig]), { tintOk: true });
}));

$('w-ks-import').addEventListener('click', () => busy($('w-ks-import'), async () => {
  const name = $('w-ks-name').value.trim();
  const pk = $('w-ks-pk').value.trim();
  const pass = $('w-ks-pass').value;
  if (!name || !pk || !pass) return toast('请填写账户名、私钥和密码');
  setResult('w-ks-out', await castLocal(['wallet', 'import', name, '--private-key', pk, '--unsafe-password', pass]), { tintOk: true });
}));

$('w-ks-list').addEventListener('click', () => busy($('w-ks-list'), async () => {
  const r = await castLocal(['wallet', 'list']);
  if (r.ok && !r.stdout.trim()) r.stdout = t('（暂无 keystore 账户）');
  setResult('w-ks-out', r, { tintOk: true });
}));

// ---------------------------------------------------------------------------
// Anvil
// ---------------------------------------------------------------------------
let anvilProcId = null;

function setAnvilUI(running) {
  $('anvil-status').className = 'badge ' + (running ? 'green' : 'gray');
  $('anvil-status').textContent = t(running ? '运行中' : '未运行');
  $('anvil-start').disabled = running;
  $('anvil-stop').disabled = !running;
}

$('anvil-start').addEventListener('click', async () => {
  const args = [];
  const port = $('anvil-port').value.trim();
  const chainId = $('anvil-chainid').value.trim();
  const blockTime = $('anvil-blocktime').value.trim();
  const fork = $('anvil-fork').value.trim();
  const forkBlock = $('anvil-fork-block').value.trim();
  if (port) args.push('--port', port);
  if (chainId) args.push('--chain-id', chainId);
  if (blockTime) args.push('--block-time', blockTime);
  if (fork) args.push('--fork-url', fork);
  if (fork && forkBlock && forkBlock !== 'latest') args.push('--fork-block-number', forkBlock);

  termClear('anvil-term');
  termAppend('anvil-term', `$ anvil ${args.join(' ')}\n\n`, 'dim');
  let anvilBuf = '';
  let accountsParsed = false;
  $('anvil-accounts-card').style.display = 'none';
  anvilProcId = await startStream('anvil', args, {
    termId: 'anvil-term',
    onData: (_s, data) => {
      if (accountsParsed) return;
      anvilBuf += data;
      if (anvilBuf.includes('Listening on')) {
        accountsParsed = true;
        renderAnvilAccounts(anvilBuf);
      }
    },
    onExit: (code) => {
      termAppend('anvil-term', '\n' + tf('[anvil 已退出，退出码 {0}]', code) + '\n', code === 0 ? 'dim' : 'err');
      anvilProcId = null;
      setAnvilUI(false);
    },
  });
  if (anvilProcId) {
    setAnvilUI(true);
    // keep local chain rpc in sync with chosen port
    const local = chains.find((c) => c.name === 'Anvil Local');
    if (local && port) { local.rpc = `http://127.0.0.1:${port}`; saveConfig(); }
    toast('Anvil 已启动');
  }
});

$('anvil-stop').addEventListener('click', () => {
  if (anvilProcId) F.procKill(anvilProcId);
});

// parse "Available Accounts" / "Private Keys" sections from anvil startup banner
function renderAnvilAccounts(buf) {
  const addrs = [...buf.matchAll(/\((\d+)\)\s+(0x[a-fA-F0-9]{40})\s+\(([\d._]+\s*ETH)\)/g)];
  const keys = [...buf.matchAll(/\((\d+)\)\s+(0x[a-fA-F0-9]{64})/g)];
  if (!addrs.length) return;
  const keyByIdx = new Map(keys.map((k) => [k[1], k[2]]));
  const tbody = $('anvil-accounts').querySelector('tbody');
  tbody.innerHTML = '';
  addrs.forEach((a) => {
    const pk = keyByIdx.get(a[1]) || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="mono">${a[1]}</td>
      <td class="mono"><span class="copyable" data-copy="${a[2]}">${a[2]}</span></td>
      <td class="mono">${a[3].replace(/\.?0+\s*ETH/, ' ETH')}</td>
      <td style="text-align:right">${pk ? `<button class="icon-btn" data-copy="${pk}">复制私钥</button>` : ''}</td>`;
    tbody.appendChild(tr);
  });
  bindCopyables(tbody);
  $('anvil-accounts-card').style.display = '';
}

// --- anvil chain operations (cast rpc, targets the current network) ---
function showOpsResult(r, okText) {
  if (r.ok) {
    const raw = r.stdout.trim();
    r.stdout = okText + (raw && raw !== 'null' && raw !== 'true' ? ` · ${raw.replace(/^"|"$/g, '')}` : '');
  }
  setResult('av-ops-out', r, { tintOk: true });
}

$('av-mine').addEventListener('click', () => busy($('av-mine'), async () => {
  const n = $('av-mine-n').value.trim() || '1';
  if (!/^\d+$/.test(n)) return toast('挖块数量必须是整数');
  const r = await cast(['rpc', 'anvil_mine', n]);
  showOpsResult(r, tf('✓ 已挖 {0} 个区块', n));
  refreshDashboard();
}));

$('av-time').addEventListener('click', () => busy($('av-time'), async () => {
  const s = $('av-time-s').value.trim();
  if (!/^\d+$/.test(s)) return toast('请填写快进秒数');
  const r1 = await cast(['rpc', 'evm_increaseTime', s]);
  if (!r1.ok) return showOpsResult(r1, '');
  const r2 = await cast(['rpc', 'anvil_mine', '1']);
  showOpsResult(r2, tf('✓ 时间已快进 {0} 秒并挖出 1 个区块', s));
}));

$('av-snap').addEventListener('click', () => busy($('av-snap'), async () => {
  const r = await cast(['rpc', 'evm_snapshot']);
  if (r.ok) {
    const id = r.stdout.trim().replace(/^"|"$/g, '');
    const bn = await cast(['block-number']);
    const sel = $('av-snapshots');
    if (sel.options[0]?.value === '') sel.innerHTML = '';
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = tf('快照 {0}（区块 {1}）', id, bn.ok ? bn.stdout.trim() : '?');
    sel.appendChild(opt);
    sel.value = id;
    showOpsResult({ ok: true, stdout: '' }, tf('✓ 快照已创建，ID {0}', id));
  } else {
    showOpsResult(r, '');
  }
}));

$('av-revert').addEventListener('click', () => busy($('av-revert'), async () => {
  const id = $('av-snapshots').value;
  if (!id) return toast('请先创建快照');
  const r = await cast(['rpc', 'evm_revert', id]);
  if (r.ok && r.stdout.trim() === 'false') { r.ok = false; r.stderr = t('回滚失败：快照不存在或已被使用'); r.stdout = ''; }
  else if (r.ok) $('av-snapshots').querySelector(`option[value="${id}"]`)?.remove();
  showOpsResult(r, tf('✓ 已回滚到快照 {0}（该快照及之后的快照已失效）', id));
  refreshDashboard();
}));

$('av-setbal').addEventListener('click', () => busy($('av-setbal'), async () => {
  const addr = $('av-bal-addr').value.trim();
  const amount = $('av-bal-amount').value.trim();
  if (!addr || !amount) return toast('请填写地址和余额');
  const raw = parseUnits(amount, 18);
  if (raw === null) return toast('余额格式不正确');
  const hex = '0x' + BigInt(raw).toString(16);
  const r = await cast(['rpc', 'anvil_setBalance', addr, hex]);
  showOpsResult(r, tf('✓ {0} 余额已设为 {1} ETH', addr.slice(0, 10) + '…', amount));
}));

$('av-imp-on').addEventListener('click', () => busy($('av-imp-on'), async () => {
  const addr = $('av-imp-addr').value.trim();
  if (!addr) return toast('请填写要模拟的地址');
  const r = await cast(['rpc', 'anvil_impersonateAccount', addr]);
  showOpsResult(r, tf('✓ 已开启 impersonate：{0}（发交易时用 --from 该地址 --unlocked）', addr.slice(0, 10) + '…'));
}));

$('av-imp-off').addEventListener('click', () => busy($('av-imp-off'), async () => {
  const addr = $('av-imp-addr').value.trim();
  if (!addr) return toast('请填写地址');
  const r = await cast(['rpc', 'anvil_stopImpersonatingAccount', addr]);
  showOpsResult(r, tf('✓ 已停止 impersonate：{0}', addr.slice(0, 10) + '…'));
}));

// ---------------------------------------------------------------------------
// Chisel REPL
// ---------------------------------------------------------------------------
let chiselProcId = null;

function setChiselUI(running) {
  $('chisel-status').className = 'badge ' + (running ? 'green' : 'gray');
  $('chisel-status').textContent = t(running ? '会话进行中' : '未启动');
  $('chisel-start').disabled = running;
  $('chisel-stop').disabled = !running;
  $('chisel-input').disabled = !running;
  $('chisel-send').disabled = !running;
  if (running) $('chisel-input').focus();
}

$('chisel-start').addEventListener('click', async () => {
  termClear('chisel-term');
  termAppend('chisel-term', t('正在启动 chisel…') + '\n', 'dim');
  chiselProcId = await startStream('chisel', [], {
    onData: (_s, data) => {
      // strip ANSI escape sequences & the "➜ " prompt noise
      const clean = data.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').replace(/\x1b\][^\x07]*\x07/g, '');
      if (clean.trim() === '' || /^➜\s*$/.test(clean.trim())) return;
      termAppend('chisel-term', clean.replace(/➜ /g, ''));
    },
    onExit: (code) => {
      termAppend('chisel-term', '\n' + t('[会话已结束]') + '\n', 'dim');
      chiselProcId = null;
      setChiselUI(false);
    },
  });
  setChiselUI(!!chiselProcId);
});

$('chisel-stop').addEventListener('click', () => {
  if (chiselProcId) F.procKill(chiselProcId);
});

const chiselHistory = [];
let chiselHistIdx = -1;

function chiselSend() {
  const input = $('chisel-input');
  const line = input.value;
  if (!chiselProcId || !line.trim()) return;
  termAppend('chisel-term', `\n➜ ${line}\n`, 'ok');
  F.procWrite(chiselProcId, line + '\n');
  chiselHistory.push(line);
  chiselHistIdx = chiselHistory.length;
  input.value = '';
}

$('chisel-send').addEventListener('click', chiselSend);
$('chisel-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') chiselSend();
  else if (e.key === 'ArrowUp') {
    if (chiselHistIdx > 0) { chiselHistIdx--; $('chisel-input').value = chiselHistory[chiselHistIdx]; }
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (chiselHistIdx < chiselHistory.length - 1) { chiselHistIdx++; $('chisel-input').value = chiselHistory[chiselHistIdx]; }
    else { chiselHistIdx = chiselHistory.length; $('chisel-input').value = ''; }
    e.preventDefault();
  }
});

// ---------------------------------------------------------------------------
// ABI Workbench
// ---------------------------------------------------------------------------
let wbScan = null;

// simple concurrency pool — batch reads without hammering the RPC
async function pool(items, worker, limit = 4) {
  const results = new Array(items.length);
  let next = 0;
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const idx = next++;
      results[idx] = await worker(items[idx], idx);
    }
  });
  await Promise.all(runners);
  return results;
}

function abiTypeStr(t) {
  if (t.type && t.type.startsWith('tuple')) {
    return '(' + (t.components || []).map(abiTypeStr).join(',') + ')' + t.type.slice(5);
  }
  return t.type;
}
const fnIns = (fn) => (fn.inputs || []).map(abiTypeStr).join(',');
const fnOuts = (fn) => (fn.outputs || []).map(abiTypeStr).join(',');
const fnCallSig = (fn) => `${fn.name}(${fnIns(fn)})` + (fnOuts(fn) ? `(${fnOuts(fn)})` : '');
const fnSendSig = (fn) => `${fn.name}(${fnIns(fn)})`;

async function wbRescan() {
  const dir = $('wb-project').value.trim();
  const sel = $('wb-contract');
  sel.innerHTML = `<option value="">${t('— 请先选择项目 —')}</option>`;
  if (!dir) return;
  wbScan = await F.scanProject(dir);
  if (!wbScan.valid) { sel.innerHTML = `<option value="">${t('✗ 该目录不是 Foundry 项目')}</option>`; return; }
  sel.innerHTML = `<option value="">${t('— 选择合约 —')}</option>`;
  wbScan.contracts.forEach((c, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `${c.name}  (${c.file})`;
    sel.appendChild(opt);
  });
}

$('wb-pick').addEventListener('click', async () => {
  const dir = await F.pickDir();
  if (dir) { $('wb-project').value = dir; wbRescan(); }
});
$('wb-project').addEventListener('change', wbRescan);

$('wb-load').addEventListener('click', () => busy($('wb-load'), async () => {
  const dir = $('wb-project').value.trim();
  const i = $('wb-contract').value;
  if (!dir || i === '' || !wbScan) return toast('请选择项目和合约');
  const c = wbScan.contracts[Number(i)];
  const art = await F.getArtifact(dir, c.file, c.name);
  if (!art) {
    $('wb-abi-status').innerHTML = `<span class="badge red">${t('未找到编译产物 — 请先在「项目构建」页执行 Build')}</span>`;
    return;
  }
  wbSetAbi(art.functions, c.name);
}));

$('wb-parse').addEventListener('click', () => {
  let parsed;
  try {
    parsed = JSON.parse($('wb-abi-paste').value);
  } catch (e) {
    $('wb-abi-status').innerHTML = `<span class="badge red">${tf('JSON 解析失败：{0}', String(e.message).slice(0, 60))}</span>`;
    return;
  }
  const abi = Array.isArray(parsed) ? parsed : parsed.abi;
  if (!Array.isArray(abi)) {
    $('wb-abi-status').innerHTML = `<span class="badge red">${t('未找到 ABI 数组（支持纯数组或含 abi 字段的 artifact）')}</span>`;
    return;
  }
  wbSetAbi(abi.filter((x) => x.type === 'function'), t('粘贴的 ABI'));
});

function wbSetAbi(fns, label) {
  const reads = fns.filter((f) => f.stateMutability === 'view' || f.stateMutability === 'pure');
  const writes = fns.filter((f) => f.stateMutability !== 'view' && f.stateMutability !== 'pure');
  $('wb-abi-status').innerHTML =
    `<span class="badge green">✓ ${label}</span> <span class="badge gray">${tf('读 {0}', reads.length)}</span> <span class="badge gray">${tf('写 {0}', writes.length)}</span>`;
  $('wb-signer-card').style.display = writes.length ? '' : 'none';
  $('wb-reads-card').style.display = '';
  $('wb-writes-card').style.display = '';
  $('wb-reads-count').textContent = tf('{0} 个', reads.length);
  $('wb-writes-count').textContent = tf('{0} 个', writes.length);
  renderFnList('wb-reads', reads, 'read');
  renderFnList('wb-writes', writes, 'write');
}

function requireWbAddr() {
  const addr = $('wb-addr').value.trim();
  if (!addr) { toast('请填写合约地址'); return null; }
  return addr;
}

function collectFnArgs(item, fn) {
  const values = [];
  for (const inp of item.querySelectorAll('.fn-arg')) {
    if (inp.value.trim() === '') { toast(tf('请填写参数 {0}', inp.placeholder)); return null; }
    values.push(inp.value.trim());
  }
  return values;
}

function renderFnList(containerId, fns, kind) {
  const box = $(containerId);
  box.innerHTML = fns.length ? '' : `<div class="empty-hint">${t('该合约没有此类函数')}</div>`;
  fns.forEach((fn) => {
    const item = document.createElement('div');
    item.className = 'fn-item';
    item._fn = fn;
    const payable = fn.stateMutability === 'payable';
    const head = `
      <div class="fn-head">
        <span class="fn-name">${fn.name}(<span class="fn-outs">${fnIns(fn)}</span>)${fnOuts(fn) ? ` <span class="fn-outs">→ ${fnOuts(fn)}</span>` : ''}${payable ? ' <span class="badge amber">payable</span>' : ''}</span>
        <span class="fn-inline-val"></span>
        <span class="fn-acts">
          ${kind === 'read'
            ? '<button class="btn sm primary act-call">调用</button>'
            : '<button class="btn sm act-est">估算</button><button class="btn sm primary act-send">发送</button>'}
        </span>
      </div>`;
    const params = (fn.inputs || []).length
      ? `<div class="fn-params">${fn.inputs.map((inp, i2) =>
          `<input type="text" class="fn-arg" placeholder="${inp.name || `arg${i2}`}: ${abiTypeStr(inp)}">`).join('')}
          ${payable ? '<input type="text" class="fn-value" placeholder="附带 ETH（可选，如 0.1ether）">' : ''}</div>`
      : (payable ? '<div class="fn-params"><input type="text" class="fn-value" placeholder="附带 ETH（可选，如 0.1ether）"></div>' : '');
    item.innerHTML = head + params + '<div class="result-box fn-out"></div>';
    box.appendChild(item);

    const out = item.querySelector('.fn-out');
    const setOut = (r) => {
      out.textContent = (r.stdout || '').trim() || (r.stderr || '').trim() || (r.ok ? t('(无输出)') : t('(失败)'));
      out.classList.toggle('err', !r.ok);
      out.classList.toggle('ok-tint', r.ok);
    };

    if (kind === 'read') {
      item.querySelector('.act-call').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        const addr = requireWbAddr(); if (!addr) return;
        const args = collectFnArgs(item, fn); if (args === null) return;
        setOut(await cast(['call', addr, fnCallSig(fn), ...args]));
      }));
    } else {
      item.querySelector('.act-est').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        const addr = requireWbAddr(); if (!addr) return;
        const args = collectFnArgs(item, fn); if (args === null) return;
        const a = ['estimate', addr, fnSendSig(fn), ...args];
        const from = await deriveAddress('wb-pk');
        if (from) a.push('--from', from);
        const v = item.querySelector('.fn-value')?.value.trim();
        if (v) a.push('--value', v);
        const r = await cast(a);
        if (r.ok) r.stdout = tf('预计 gas: {0}', r.stdout.trim());
        setOut(r);
      }));
      item.querySelector('.act-send').addEventListener('click', (e) => busy(e.currentTarget, async () => {
        const addr = requireWbAddr(); if (!addr) return;
        const args = collectFnArgs(item, fn); if (args === null) return;
        const signer = signerArgs('wb-pk', 'wb-account', 'wb-pass');
        if (!signer) return toast('请在上方填写签名账户');
        const a = ['send', addr, fnSendSig(fn), ...args, ...signer, '--json'];
        const v = item.querySelector('.fn-value')?.value.trim();
        if (v) a.push('--value', v);
        const r = await cast(a, { timeoutMs: 180000 });
        const hash = extractTxHash(r.stdout);
        if (r.ok && hash) {
          const revert = /"status"\s*:\s*"0x0"/.test(r.stdout);
          r.ok = !revert;
          r.stdout = revert ? `${t('交易已上链但执行失败（reverted）')}\n${t('哈希：')}${hash}` : `${t('交易成功 ✓')}\n${t('交易哈希：')}${hash}`;
          if (!revert) recordTx('工作台', `${fn.name}() @ ${addr.slice(0, 10)}…`, hash);
        }
        setOut(r);
      }));
    }
  });
}

$('wb-read-all').addEventListener('click', () => busy($('wb-read-all'), async () => {
  const addr = requireWbAddr(); if (!addr) return;
  const items = [...$('wb-reads').querySelectorAll('.fn-item')].filter((it) => it._fn && !(it._fn.inputs || []).length);
  if (!items.length) return toast('没有无参读函数');
  await pool(items, async (it) => {
    const valEl = it.querySelector('.fn-inline-val');
    valEl.textContent = '…';
    const r = await cast(['call', addr, fnCallSig(it._fn)], { timeoutMs: 30000 });
    valEl.textContent = r.ok ? (r.stdout.trim().split('\n')[0].slice(0, 60) || t('(空)')) : t('读取失败');
    valEl.style.color = r.ok ? '' : 'var(--red)';
  }, 4);
}));

// ---------------------------------------------------------------------------
// Debug — trace & logs
// ---------------------------------------------------------------------------
function appendTrace(termId, text) {
  for (const line of text.split(/(?<=\n)/)) {
    let cls = '';
    if (/\[Revert\]|EvmError|revert|Error(?::|\b)/i.test(line)) cls = 'err';
    else if (/\[Return\]|\[Stop\]|SUCCESS|✅/.test(line)) cls = 'ok';
    else if (/^\s*(Executing|Traces|Transaction|Compiling)/.test(line)) cls = 'dim';
    termAppend(termId, line, cls);
  }
}

$('dbg-run').addEventListener('click', () => busy($('dbg-run'), async () => {
  const hash = $('dbg-tx').value.trim();
  if (!hash) return toast('请填写交易哈希');
  termClear('dbg-term');
  const args = ['run', hash];
  if ($('dbg-quick').checked) args.push('--quick');
  termAppend('dbg-term', `$ cast ${args.join(' ')}\n\n`, 'dim');
  await new Promise((resolve) => {
    startStream('cast', [...args, ...rpcArgs()], {
      onData: (_s, data) => appendTrace('dbg-term', data),
      onExit: (code) => {
        termAppend('dbg-term', '\n' + tf('[完成，退出码 {0}]', code) + '\n', code === 0 ? 'ok' : 'err');
        resolve();
      },
    });
  });
}));

$('dbg-call').addEventListener('click', () => busy($('dbg-call'), async () => {
  const addr = $('dbg-addr').value.trim();
  const sig = $('dbg-sig').value.trim();
  if (!addr || !sig) return toast('请填写合约地址和方法签名');
  termClear('dbg-term');
  const args = ['call', addr, sig, ...splitArgs($('dbg-args').value), '--trace'];
  const from = $('dbg-from').value.trim();
  if (from) args.push('--from', from);
  termAppend('dbg-term', `$ cast ${args.join(' ')}\n\n`, 'dim');
  const r = await cast(args, { timeoutMs: 120000 });
  appendTrace('dbg-term', r.stdout || '');
  if (r.stderr) appendTrace('dbg-term', r.stderr);
  termAppend('dbg-term', '\n' + t('[完成]') + '\n', r.ok ? 'ok' : 'err');
}));

$('logs-go').addEventListener('click', () => busy($('logs-go'), async () => {
  const addr = $('logs-addr').value.trim();
  const sig = $('logs-sig').value.trim();
  if (!addr && !sig) return toast('地址和事件签名至少填一个');
  termClear('logs-term');
  const args = ['logs'];
  if (sig) args.push(sig);
  if (addr) args.push('--address', addr);
  const fromB = $('logs-from').value.trim();
  const toB = $('logs-to').value.trim();
  if (fromB) args.push('--from-block', fromB);
  if (toB) args.push('--to-block', toB);
  termAppend('logs-term', `$ cast logs …\n\n`, 'dim');
  const r = await cast(args, { timeoutMs: 120000 });
  const text = (r.stdout || '').trim();
  if (r.ok && !text) termAppend('logs-term', t('（未查询到日志 — 可尝试调整区块范围）') + '\n', 'dim');
  else termAppend('logs-term', (text || r.stderr) + '\n', r.ok ? '' : 'err');
}));

// ---------------------------------------------------------------------------
// Settings — chain management
// ---------------------------------------------------------------------------
function renderChainsTable() {
  const tbody = $('chains-table').querySelector('tbody');
  tbody.innerHTML = '';
  chains.forEach((c, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}${i === currentChainIdx ? ` <span class="badge green">${t('当前')}</span>` : ''}</td>
      <td class="mono">${c.chainId}</td>
      <td class="mono" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.rpc}">${c.rpc}</td>
      <td class="mono" style="font-size:11px">${c.explorer ? '✓' : '—'}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="icon-btn" data-use="${i}">${t('使用')}</button>
        <button class="icon-btn" data-del="${i}">${t('删除')}</button>
      </td>`;
    tbody.appendChild(tr);
  });
  tbody.querySelectorAll('[data-use]').forEach((b) => b.addEventListener('click', () => {
    currentChainIdx = Number(b.dataset.use);
    saveConfig(); updateChainPill(); renderChainMenu(); renderChainsTable(); refreshDashboard();
  }));
  tbody.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.del);
    if (chains.length <= 1) return toast('至少保留一个网络');
    chains.splice(i, 1);
    if (currentChainIdx >= chains.length) currentChainIdx = 0;
    saveConfig(); updateChainPill(); renderChainMenu(); renderChainsTable();
  }));
}

$('s-c-add').addEventListener('click', () => {
  const name = $('s-c-name').value.trim();
  const id = $('s-c-id').value.trim();
  const rpc = $('s-c-rpc').value.trim();
  const explorer = $('s-c-explorer').value.trim();
  if (!name || !rpc) return toast('名称和 RPC 必填');
  chains.push({ name, chainId: Number(id) || 0, rpc, explorer });
  ['s-c-name', 's-c-id', 's-c-rpc', 's-c-explorer'].forEach((x) => { $(x).value = ''; });
  saveConfig(); renderChainMenu(); renderChainsTable();
  toast('网络已添加');
});

$('s-etherscan-save').addEventListener('click', () => {
  config.etherscanKey = $('s-etherscan').value.trim();
  saveConfig();
  toast('已保存');
});

$('s-foundry-link').addEventListener('click', () => F.openExternal('https://github.com/foundry-rs/foundry'));

// dashboard auto-refresh while visible
setInterval(() => {
  if ($('page-dashboard').classList.contains('active') && !document.hidden) refreshDashboard();
}, 20000);
// refresh immediately when the window regains visibility on the dashboard
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && $('page-dashboard').classList.contains('active')) refreshDashboard();
});

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
(async function boot() {
  await loadConfig();
  renderChainMenu();
  renderChainsTable();
  renderHistory();
  updateChainPill();
  loadVersions();
  refreshDashboard();
  if ($('f-project').value) validateProject('f-project', 'f-project-status');
  if ($('dep-project').value) depRescan();
  if (config.lastProject) { $('wb-project').value = config.lastProject; wbRescan(); }
})();
