const path = require("path");

const DEFAULT_ADMIN_WINDOW = {
  width: 1200,
  height: 800,
  htmlFile: "home.html"
};

const DEFAULT_PROJECTOR_WINDOW = {
  // Initial launch size (960x540 = exactly half of the 1920x1080 zoom
  // base in windows.js, i.e. a 50% starting zoom). Maximizing/resizing
  // adjusts the zoom to follow.
  width: 960,
  height: 540,
  htmlFile: "top.html"
};

const DEFAULT_SPLASH_WINDOW = {
  width: 800,
  height: 600,
  htmlFile: "splash.html",
  frame: false,
  alwaysOnTop: true,
  transparent: false,
  resizable: false,
  show: true
};

function createWindowOptions(productRuntime, preloadPath, kind, overrides = {}) {
  if (kind === "admin") {
    return {
      icon: productRuntime.iconAbsolutePath,
      width: DEFAULT_ADMIN_WINDOW.width,
      height: DEFAULT_ADMIN_WINDOW.height,
      title: productRuntime.windows.adminTitle,
      autoHideMenuBar: true,
      webPreferences: createWebPreferences(path.join(path.dirname(preloadPath), "admin-preload.js"), 1, {
        sandbox: true
      })
    };
  }

  if (kind === "projector") {
    return {
      icon: productRuntime.iconAbsolutePath,
      width: overrides.width || DEFAULT_PROJECTOR_WINDOW.width,
      height: overrides.height || DEFAULT_PROJECTOR_WINDOW.height,
      // width/height above must mean the same "content size" that
      // adjustProjectorZoom() in windows.js reads via getContentSize()
      // when computing scaleW/scaleH against baseWidth/baseHeight.
      // Without this, width/height are the outer window size (including
      // the title bar), so the content area opens slightly smaller than
      // the base resolution and the default zoom comes out just under
      // 100% instead of exactly 1.0.
      useContentSize: true,
      title: productRuntime.windows.projectorTitle,
      autoHideMenuBar: true,
      webPreferences: createWebPreferences(path.join(path.dirname(preloadPath), "projector-preload.js"), 1, {
        sandbox: true
      })
    };
  }

  if (kind === "splash") {
    return {
      icon: productRuntime.iconAbsolutePath,
      webPreferences: createWebPreferences(path.join(__dirname, "splash-preload.js"), 1, {
        sandbox: true
      }),
      width: DEFAULT_SPLASH_WINDOW.width,
      height: DEFAULT_SPLASH_WINDOW.height,
      frame: DEFAULT_SPLASH_WINDOW.frame,
      alwaysOnTop: DEFAULT_SPLASH_WINDOW.alwaysOnTop,
      transparent: DEFAULT_SPLASH_WINDOW.transparent,
      resizable: DEFAULT_SPLASH_WINDOW.resizable,
      show: DEFAULT_SPLASH_WINDOW.show
    };
  }

  throw new Error(`Unknown window kind: ${kind}`);
}

function createWebPreferences(preloadPath, zoomFactor, options = {}) {
  return {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: options.sandbox === true ? true : false,
    zoomFactor
  };
}

function createProductRuntime(product, appDir) {
  return {
    product,
    appName: product.displayName,
    iconAbsolutePath: path.join(appDir, product.iconPath),
    updater: { ...product.updater },
    windows: {
      adminTitle: `${product.windowTitlePrefix} - AdminWindow`,
      projectorTitle: `${product.windowTitlePrefix} - ProjectorWindow`
    },
    html: {
      admin: path.join(appDir, DEFAULT_ADMIN_WINDOW.htmlFile),
      projector: path.join(appDir, DEFAULT_PROJECTOR_WINDOW.htmlFile),
      splash: path.join(appDir, DEFAULT_SPLASH_WINDOW.htmlFile)
    }
  };
}

function applyProductToApp(app, runtime) {
  if (typeof app.setName === "function") {
    app.setName(runtime.appName);
  }
}

function applyProductToAutoUpdater(autoUpdater, logger, runtime) {
  autoUpdater.logger = logger;
  if (autoUpdater.logger && autoUpdater.logger.transports && autoUpdater.logger.transports.file) {
    autoUpdater.logger.transports.file.level = "info";
  }
  if (typeof autoUpdater.setFeedURL === "function") {
    autoUpdater.setFeedURL(runtime.updater);
  }
}

module.exports = {
  applyProductToApp,
  applyProductToAutoUpdater,
  createProductRuntime,
  createWindowOptions
};
