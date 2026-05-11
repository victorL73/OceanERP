const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oceanErpDesktop', {
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('notify', { title, body })
});

