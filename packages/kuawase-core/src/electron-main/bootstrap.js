const DEFAULT_SPLASH_DELAY_MS = 3000;

function logInfo(logger, message) {
  if (logger && typeof logger.info === "function") {
    logger.info(message);
  }
}

function logError(logger, message, error) {
  if (logger && typeof logger.error === "function") {
    logger.error(message, error);
  }
}

function disableWindowReloadShortcuts(window) {
  if (!window || !window.webContents) {
    return;
  }

  window.webContents.on("before-input-event", (event, input) => {
    if (
      input.type === "keyDown" &&
      (input.key === "F5" || (input.key === "r" && (input.control || input.meta)))
    ) {
      event.preventDefault();
    }
  });
}

function attachMutualClose(primaryWindow, secondaryWindow) {
  if (!primaryWindow || !secondaryWindow) {
    return;
  }

  primaryWindow.on("closed", () => {
    if (secondaryWindow && !secondaryWindow.isDestroyed()) {
      secondaryWindow.close();
    }
  });
}

function createSplashWindow(splashOptions, remoteMain, BrowserWindowClass) {
  const BrowserWindowImpl = BrowserWindowClass || require("electron").BrowserWindow;
  const splashWindow = new BrowserWindowImpl(splashOptions);

  if (remoteMain && typeof remoteMain.enable === "function") {
    remoteMain.enable(splashWindow.webContents);
  }

  return splashWindow;
}

function attachWindowDebugLogging(window, windowName, logger) {
  if (!window || !window.webContents) {
    return;
  }

  window.on("ready-to-show", () => {
    logInfo(logger, `[main:${windowName}] ready-to-show`);
  });

  window.on("show", () => {
    logInfo(logger, `[main:${windowName}] show`);
  });

  window.on("closed", () => {
    logInfo(logger, `[main:${windowName}] closed`);
  });

  window.webContents.on("did-start-loading", () => {
    logInfo(logger, `[main:${windowName}] did-start-loading`);
  });

  window.webContents.on("did-finish-load", () => {
    logInfo(logger, `[main:${windowName}] did-finish-load`);
  });

  window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedUrl) => {
    logError(
      logger,
      `[main:${windowName}] did-fail-load ${errorCode} ${errorDescription} ${validatedUrl}`
    );
  });

  window.webContents.on("render-process-gone", (_event, details) => {
    logError(logger, `[main:${windowName}] render-process-gone ${JSON.stringify(details)}`);
  });

  window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    logInfo(logger, `[renderer:${windowName}:console:${level}] ${sourceId}:${line} ${message}`);
  });
}

function createAppBootstrap({
  app,
  runtime,
  remoteMain,
  logger,
  setupAutoUpdaterHandlers,
  createAdminWindow,
  createProjectorWindow,
  ensureConfigExists,
  splashOptions,
  splashHtmlFile,
  splashDelayMs = DEFAULT_SPLASH_DELAY_MS,
  afterWindowsCreated
}) {
  if (!app) {
    throw new Error("createAppBootstrap requires app");
  }

  return function bootstrap() {
    logInfo(logger, "[main] bootstrap start");
    app.whenReady().then(() => {
      logInfo(logger, "[main] app.whenReady resolved");
      if (remoteMain && typeof remoteMain.initialize === "function") {
        logInfo(logger, "[main] remoteMain.initialize");
        remoteMain.initialize();
      }

      const splashWindow = createSplashWindow(splashOptions, remoteMain);
      attachWindowDebugLogging(splashWindow, "splash", logger);
      logInfo(logger, `[main] splash loadFile ${splashHtmlFile}`);
      splashWindow.loadFile(splashHtmlFile).catch((error) => {
        logError(logger, `[main] splash loadFile failed ${splashHtmlFile}`, error);
      });

      setTimeout(() => {
        try {
          logInfo(logger, "[main] splash delay elapsed");
          if (typeof setupAutoUpdaterHandlers === "function") {
            logInfo(logger, "[main] setupAutoUpdaterHandlers");
            setupAutoUpdaterHandlers();
          }

          if (typeof ensureConfigExists === "function") {
            logInfo(logger, "[main] ensureConfigExists");
            ensureConfigExists();
          }

          logInfo(logger, "[main] createAdminWindow");
          const adminWindow = createAdminWindow();
          attachWindowDebugLogging(adminWindow, "admin", logger);

          logInfo(logger, "[main] createProjectorWindow");
          const projectorWindow = createProjectorWindow();
          attachWindowDebugLogging(projectorWindow, "projector", logger);

          disableWindowReloadShortcuts(adminWindow);
          disableWindowReloadShortcuts(projectorWindow);
          attachMutualClose(adminWindow, projectorWindow);
          attachMutualClose(projectorWindow, adminWindow);

          if (typeof afterWindowsCreated === "function") {
            logInfo(logger, "[main] afterWindowsCreated");
            afterWindowsCreated({
              runtime,
              splashWindow,
              adminWindow,
              projectorWindow,
              logger
            });
          }

          if (splashWindow && !splashWindow.isDestroyed()) {
            logInfo(logger, "[main] closing splash");
            splashWindow.close();
          }
        } catch (error) {
          logError(logger, "[main] bootstrap timer failed", error);
        }
      }, splashDelayMs);
    }).catch((error) => {
      logError(logger, "[main] app.whenReady failed", error);
    });
  };
}

module.exports = {
  DEFAULT_SPLASH_DELAY_MS,
  attachMutualClose,
  createAppBootstrap,
  disableWindowReloadShortcuts
};
