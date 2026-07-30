const path = require("path");
const { createAppBootstrap } = require("./bootstrap");
const { loadPrototypeDependencies } = require("../prototype/external-deps");

function attachWindowConsoleLogging(log, windowName, browserWindow) {
  if (!browserWindow?.webContents) {
    return;
  }

  browserWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    log.info(`[prototype:${windowName}:console:${level}] ${sourceId}:${line} ${message}`);
  });

  browserWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    log.error(`[prototype:${windowName}:load-fail] ${errorCode} ${errorDescription} ${validatedUrl}`);
  });
}

function shouldSandboxPrototypeWindows() {
  return process.env.NODE_ENV !== "development";
}

function createPrototypeWindowOptions(windowOptions, prototypePreloadPath) {
  return {
    ...windowOptions,
    webPreferences: {
      ...windowOptions.webPreferences,
      preload: prototypePreloadPath,
      sandbox: shouldSandboxPrototypeWindows()
    }
  };
}

function createPrototypeMainEntry({
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  fs,
  pathModule = path,
  createCommonMainServices,
  registerAppIpc,
  prototypeUserDataName,
  appRoot,
  prototypePreloadPath,
  splashDelayMs = 3000
}) {
  const { autoUpdater, log, remoteMain, axios, xlsx } = loadPrototypeDependencies();
  const prototypeUserDataDir = pathModule.join(app.getPath("appData"), prototypeUserDataName);

  app.setPath("userData", prototypeUserDataDir);
  app.setPath("sessionData", pathModule.join(prototypeUserDataDir, "Session Data"));

  if (log?.transports?.console) {
    log.transports.console.level = false;
  }

  const services = createCommonMainServices({
    app,
    autoUpdater,
    fs,
    log
  });

  services.runtime.html = {
    admin: pathModule.join(appRoot, "home.html"),
    projector: pathModule.join(appRoot, "top.html"),
    splash: pathModule.join(appRoot, "splash.html")
  };
  services.uiState.projectorHtmlFile = services.runtime.html.projector;

  registerAppIpc({
    ipcMain,
    app,
    fs,
    path: pathModule,
    dialog,
    axios,
    xlsx,
    log,
    userDataPaths: services.userDataPaths,
    uiState: services.uiState,
    projectorState: services.projectorState
  });

  const bootstrap = createAppBootstrap({
    app,
    runtime: services.runtime,
    remoteMain,
    logger: log,
    setupAutoUpdaterHandlers: () => {
      services.setupAutoUpdaterHandlers();
    },
    ensureConfigExists: () => services.ensureConfigExists(),
    createAdminWindow: () =>
      services.createAdminWindow(
        BrowserWindow,
        createPrototypeWindowOptions(services.windows.admin, prototypePreloadPath)
      ),
    createProjectorWindow: () =>
      services.createProjectorWindow(
        BrowserWindow,
        {},
        createPrototypeWindowOptions(services.windows.projector, prototypePreloadPath)
      ),
    splashOptions: {
      ...services.windows.splash,
      webPreferences: {
        ...services.windows.splash.webPreferences,
        preload: prototypePreloadPath,
        sandbox: shouldSandboxPrototypeWindows()
      }
    },
    splashHtmlFile: services.runtime.html.splash,
    splashDelayMs,
    afterWindowsCreated: ({ splashWindow, adminWindow, projectorWindow }) => {
      services.uiState.adminWindow = adminWindow;
      services.projectorState.adminWindow = adminWindow;
      services.projectorState.projectorWindow = projectorWindow;
      attachWindowConsoleLogging(log, "splash", splashWindow);
      attachWindowConsoleLogging(log, "admin", adminWindow);
      attachWindowConsoleLogging(log, "projector", projectorWindow);
    }
  });

  return {
    bootstrap,
    services
  };
}

module.exports = {
  createPrototypeMainEntry
};
