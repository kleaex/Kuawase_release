function setupAutoUpdaterHandlers(autoUpdater, logger, hooks = {}) {
  autoUpdater.on("update-available", (info) => {
    logger.info("Update available:", info);
    if (typeof hooks.onUpdateAvailable === "function") {
      hooks.onUpdateAvailable(info);
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    logger.info("Update downloaded:", info);
    if (typeof hooks.onUpdateDownloaded === "function") {
      hooks.onUpdateDownloaded(info);
    }
  });

  autoUpdater.on("error", (error) => {
    logger.error("AutoUpdater error:", error);
    if (typeof hooks.onError === "function") {
      hooks.onError(error);
    }
  });
}

module.exports = {
  setupAutoUpdaterHandlers
};
