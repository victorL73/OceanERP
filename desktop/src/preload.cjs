const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('oceanErpDesktop', {
  platform: process.platform,
  notify: (title, body) => ipcRenderer.send('notify', { title, body }),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  connectServer: (serverUrl) => ipcRenderer.invoke('settings:connect', { serverUrl }),
  quit: () => ipcRenderer.send('app:quit')
});
