const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vortexLogin', {
  submit: () => ipcRenderer.send('login-success')
});
