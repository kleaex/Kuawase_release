const { contextBridge, ipcRenderer } = require("electron");
const path = require("path");
const { createProductAppShell } = require("../../../packages/kuawase-core/src");

createProductAppShell({
  appDir: path.join(__dirname, ".."),
  prototypeUserDataName: "Kuawase Prototype"
}).installPrototypePreload({
  contextBridge,
  ipcRenderer
});
