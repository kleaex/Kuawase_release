const path = require("path");
const { createProductAppShell } = require("./core");

const appShell = createProductAppShell({
  appDir: path.join(__dirname, ".."),
  productConfigPath: path.join(__dirname, "..", "product.config.json")
});

module.exports = appShell.productMainModule;

if (process.versions.electron && process.env.KUAWASE_SKIP_BOOTSTRAP !== "1") {
  const { app, BrowserWindow, dialog, ipcMain } = require("electron");
  const { autoUpdater } = require("electron-updater");
  const log = require("electron-log");
  const remoteMain = require("@electron/remote/main");
  const fs = require("fs");
  const axios = require("axios");
  const xlsx = require("xlsx");

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
}
