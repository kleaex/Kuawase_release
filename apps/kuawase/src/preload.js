const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const { createProductAppShell } = require("./core");

createProductAppShell({
  appDir: path.join(__dirname, "..")
}).installAppPreload({
  contextBridge,
  ipcRenderer
});
