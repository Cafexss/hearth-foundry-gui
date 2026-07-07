const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('foundry', {
  run: (tool, args, opts = {}) => ipcRenderer.invoke('cmd:run', { tool, args, ...opts }),

  procStart: (tool, args, opts = {}) => ipcRenderer.invoke('proc:start', { tool, args, ...opts }),
  procWrite: (id, data) => ipcRenderer.invoke('proc:write', { id, data }),
  procKill: (id) => ipcRenderer.invoke('proc:kill', { id }),

  onProcData: (cb) => {
    ipcRenderer.on('proc:data', (_e, payload) => cb(payload));
  },
  onProcExit: (cb) => {
    ipcRenderer.on('proc:exit', (_e, payload) => cb(payload));
  },

  pickDir: () => ipcRenderer.invoke('dialog:pickDir'),
  pickFile: (filters) => ipcRenderer.invoke('dialog:pickFile', filters),

  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),

  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),

  readJSON: (p) => ipcRenderer.invoke('fs:readJSON', p),
  scanProject: (dir) => ipcRenderer.invoke('project:scan', dir),
  getArtifact: (projectDir, file, name) => ipcRenderer.invoke('project:artifact', { projectDir, file, name }),
});
