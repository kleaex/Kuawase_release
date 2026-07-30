const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("appVersion", {
  get: () => ipcRenderer.invoke("get-app-version")
});
