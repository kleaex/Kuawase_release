const path = require("path");
const { BrowserWindow, app, dialog, ipcMain } = require("electron");
const fs = require("fs");
const { createProductAppShell } = require("../../../packages/kuawase-core/src");

const appShell = createProductAppShell({
  appDir: path.join(__dirname, ".."),
  prototypeUserDataName: "Kuawase Prototype"
});

const { bootstrap } = appShell.createPrototypeBootstrap({
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  fs,
  pathModule: path
});

bootstrap();
