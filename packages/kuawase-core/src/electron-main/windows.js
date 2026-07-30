function createAdminWindowController({
  BrowserWindow,
  windowOptions,
  htmlFile,
  state,
  onRoleReady = "admin",
  maximized = false
}) {
  const adminWindow = new BrowserWindow(windowOptions);
  if (maximized) {
    adminWindow.maximize();
  }
  state.adminWindow = adminWindow;
  adminWindow.loadFile(htmlFile);

  adminWindow.webContents.once("did-finish-load", () => {
    adminWindow.webContents.send("set-role", onRoleReady);
  });

  adminWindow.webContents.on("did-finish-load", () => {
    if (!state.adminFirstLoadDone) {
      state.adminFirstLoadDone = true;
      return;
    }

    if (state.projectorWindow && !state.projectorWindow.isDestroyed()) {
      state.projectorWindow.loadFile(state.projectorHtmlFile);
    }
  });

  return adminWindow;
}

function createProjectorWindowController({
  BrowserWindow,
  windowOptions,
  state,
  initialUrl,
  baseWidth = 1920,
  baseHeight = 1080,
  onReady,
  onReload
}) {
  const projectorWindow = new BrowserWindow(windowOptions);

  function adjustProjectorZoom() {
    if (!projectorWindow || projectorWindow.isDestroyed()) {
      return;
    }

    const [width, height] = projectorWindow.getContentSize();
    const scaleW = width / baseWidth;
    const scaleH = height / baseHeight;
    let factor = Math.min(scaleW, scaleH);

    if (!isFinite(factor) || factor <= 0) {
      factor = 1;
    }

    factor = Math.max(0.3, Math.min(4, factor));
    projectorWindow.webContents.setZoomFactor(factor);
  }

  projectorWindow.on("resize", adjustProjectorZoom);
  projectorWindow.on("maximize", adjustProjectorZoom);
  projectorWindow.on("unmaximize", adjustProjectorZoom);
  projectorWindow.on("enter-full-screen", adjustProjectorZoom);
  projectorWindow.on("leave-full-screen", adjustProjectorZoom);

  projectorWindow.webContents.once("did-finish-load", () => {
    adjustProjectorZoom();
    if (typeof onReady === "function") {
      onReady(projectorWindow);
    }
  });

  projectorWindow.webContents.on("did-finish-load", () => {
    adjustProjectorZoom();
    if (typeof onReload === "function") {
      onReload(projectorWindow);
    }
  });

  if (initialUrl) {
    projectorWindow.loadURL(initialUrl);
  }

  state.projectorWindow = projectorWindow;
  return projectorWindow;
}

module.exports = {
  createAdminWindowController,
  createProjectorWindowController
};
