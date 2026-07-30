function createAppMainEntry({
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  fs,
  pathModule,
  autoUpdater,
  log,
  remoteMain,
  axios,
  xlsx,
  createCommonMainServices,
  createBootstrap,
  registerAppIpc,
  checkForUpdates
}) {
  const services = createCommonMainServices({
    app,
    autoUpdater,
    fs,
    log
  });

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

  const bootstrap = createBootstrap({
    app,
    autoUpdater,
    log,
    remoteMain,
    setupAutoUpdaterHandlers: () => {
      services.setupAutoUpdaterHandlers();
      const shouldCheckForUpdates = checkForUpdates ?? (services.runtime?.product?.updater?.enabled !== false);
      if (shouldCheckForUpdates && typeof autoUpdater?.checkForUpdatesAndNotify === "function") {
        autoUpdater.checkForUpdatesAndNotify().catch((error) => {
          log?.error?.("AutoUpdater check failed:", error);
        });
      }
    },
    ensureConfigExists: () => services.ensureConfigExists(),
    createAdminWindow: (windowOptions) => services.createAdminWindow(BrowserWindow, windowOptions),
    createProjectorWindow: (windowOptions) => services.createProjectorWindow(BrowserWindow, windowOptions),
    afterWindowsCreated: ({ adminWindow, projectorWindow }) => {
      services.uiState.adminWindow = adminWindow;
      services.projectorState.adminWindow = adminWindow;
      services.projectorState.projectorWindow = projectorWindow;
    }
  });

  return {
    bootstrap,
    services
  };
}

module.exports = {
  createAppMainEntry
};
