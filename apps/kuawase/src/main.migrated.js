const path = require("path");
const { BrowserWindow, app, dialog, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const log = require("electron-log");
const remoteMain = require("@electron/remote/main");
const fs = require("fs");
const axios = require("axios");
const xlsx = require("xlsx");
const { createProductAppShell } = require("../../../packages/kuawase-core/src");

const appShell = createProductAppShell({
  appDir: path.join(__dirname, "..")
});

const { bootstrap } = appShell.createMigratedBootstrap({
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  autoUpdater,
  log,
  remoteMain,
  fs,
  pathModule: path,
  axios,
  xlsx
});

bootstrap();
