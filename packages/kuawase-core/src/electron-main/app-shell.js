const path = require("path");
const { createAppMainEntry } = require("./app-main-entry");
const { createProductMainModule } = require("./product-main-module");
const { createPrototypeMainEntry } = require("./prototype-main-entry");
const { installPreloadApis } = require("./install-preload");

function createProductAppShell({
  appDir,
  productConfigPath = path.join(appDir, "product.config.json"),
  prototypeUserDataName,
  extraIpcRegistrars = [],
  preloadExtraInvokeChannels = [],
  projectorBaseResolution,
  projectorWindowSize,
  adminMaximized
}) {
  const productMainModule = createProductMainModule({
    appDir,
    productConfigPath,
    extraIpcRegistrars,
    projectorBaseResolution,
    projectorWindowSize,
    adminMaximized
  });

  function createPrototypeBootstrap({
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    fs,
    pathModule = path
  }) {
    return createPrototypeMainEntry({
      app,
      BrowserWindow,
      dialog,
      ipcMain,
      fs,
      pathModule,
      createCommonMainServices: productMainModule.createCommonMainServices,
      registerAppIpc: productMainModule.registerAppIpc,
      prototypeUserDataName,
      appRoot: appDir,
      prototypePreloadPath: path.join(appDir, "src", "prototype-preload.js")
    });
  }

  function createMigratedBootstrap({
    app,
    BrowserWindow,
    dialog,
    ipcMain,
    autoUpdater,
    log,
    remoteMain,
    fs,
    pathModule = path,
    axios,
    xlsx,
    checkForUpdates
  }) {
    return createAppMainEntry({
      app,
      BrowserWindow,
      dialog,
      ipcMain,
      autoUpdater,
      log,
      remoteMain,
      fs,
      pathModule,
      axios,
      xlsx,
      createCommonMainServices: productMainModule.createCommonMainServices,
      createBootstrap: productMainModule.createBootstrap,
      registerAppIpc: productMainModule.registerAppIpc,
      checkForUpdates
    });
  }

  function installAppPreload({ contextBridge, ipcRenderer, envOverrides }) {
    installPreloadApis({
      contextBridge,
      ipcRenderer,
      appRoot: appDir,
      envOverrides,
      extraInvokeChannels: preloadExtraInvokeChannels
    });
  }

  function installPrototypePreload({ contextBridge, ipcRenderer, envOverrides }) {
    installPreloadApis({
      contextBridge,
      ipcRenderer,
      includeDevLoader: true,
      appRoot: appDir,
      extraInvokeChannels: preloadExtraInvokeChannels,
      envOverrides: {
        NODE_ENV: process.env.NODE_ENV || "development",
        ...envOverrides
      }
    });
  }

  return {
    createMigratedBootstrap,
    createPrototypeBootstrap,
    installAppPreload,
    installPrototypePreload,
    productMainModule
  };
}

module.exports = {
  createProductAppShell
};
