const path = require("path");
const {
  applyProductToApp,
  applyProductToAutoUpdater,
  createProductRuntime,
  createWindowOptions
} = require("./runtime");
const { createAppBootstrap } = require("./bootstrap");
const { setupAutoUpdaterHandlers } = require("./updater");
const { createUserDataPaths, ensureConfigExists } = require("./config-files");
const { createAdminWindowController, createProjectorWindowController } = require("./windows");
const {
  buildProjectorUrl,
  createProjectorReadyHandler,
  createProjectorReloadHandler,
  createProjectorState
} = require("./projector");
const { registerCommonIpcHandlers } = require("./ipc/common-ipc");
const { loadProductConfig } = require("../product-config");

function createProductMainModule({
  appDir,
  productConfigPath,
  extraIpcRegistrars = [],
  // 投影コンテンツの基準解像度。ズーム計算(createProjectorWindowController の
  // baseWidth/baseHeight)にのみ使う。未指定の場合は windows.js 側の既定値
  // (1920x1080)のまま。
  projectorBaseResolution,
  // プロジェクターウィンドウの「初期起動サイズ」。基準解像度とは独立に指定できる。
  // 未指定なら runtime.js の既定値(960x540、基準解像度1920x1080のちょうど半分＝
  // 起動時ズーム50%)のまま。
  projectorWindowSize,
  // 管理ウィンドウを起動直後に最大化するかどうか。未指定(false)なら
  // windows.admin の width/height(既定1200x800)どおりに開く。
  adminMaximized = false
}) {
  function createRuntime(deps) {
    const product = loadProductConfig(productConfigPath || path.join(appDir, "product.config.json"));
    const runtime = createProductRuntime(product, appDir);

    applyProductToApp(deps.app, runtime);
    applyProductToAutoUpdater(deps.autoUpdater, deps.log, runtime);

    return runtime;
  }

  function createWindowBlueprints(runtime) {
    const preloadPath = path.join(appDir, "src", "preload.js");

    return {
      admin: createWindowOptions(runtime, preloadPath, "admin"),
      projector: createWindowOptions(runtime, preloadPath, "projector", projectorWindowSize),
      splash: createWindowOptions(runtime, preloadPath, "splash")
    };
  }

  function createBootstrap(deps) {
    const runtime = createRuntime(deps);
    const windows = createWindowBlueprints(runtime);

    return createAppBootstrap({
      app: deps.app,
      runtime,
      remoteMain: deps.remoteMain,
      logger: deps.log,
      setupAutoUpdaterHandlers: deps.setupAutoUpdaterHandlers,
      createAdminWindow: () => deps.createAdminWindow(windows.admin),
      createProjectorWindow: () => deps.createProjectorWindow(windows.projector),
      ensureConfigExists: deps.ensureConfigExists,
      splashOptions: windows.splash,
      splashHtmlFile: runtime.html.splash,
      splashDelayMs: deps.splashDelayMs,
      afterWindowsCreated: deps.afterWindowsCreated
    });
  }

  function createCommonMainServices(deps) {
    const runtime = createRuntime(deps);
    const windows = createWindowBlueprints(runtime);
    const userDataPaths = createUserDataPaths(deps.app);
    const state = {
      adminFirstLoadDone: false,
      projectorWindow: null,
      projectorHtmlFile: runtime.html.projector
    };
    const projectorState = createProjectorState({
      appDir,
      configPath: userDataPaths.configPath,
      userStylesDir: userDataPaths.userStylesDir,
      mode: runtime.product.projectorMode || "plain"
    });
    projectorState.logger = deps.log;

    return {
      runtime,
      windows,
      userDataPaths,
      projectorState,
      uiState: state,
      setupAutoUpdaterHandlers() {
        return setupAutoUpdaterHandlers(deps.autoUpdater, deps.log, deps.updaterHooks);
      },
      ensureConfigExists() {
        return ensureConfigExists({
          logger: deps.log,
          appDir,
          userDataPaths
        });
      },
      createAdminWindow(BrowserWindow, windowOptionsOverride) {
        const adminWindow = createAdminWindowController({
          BrowserWindow,
          windowOptions: windowOptionsOverride || windows.admin,
          htmlFile: runtime.html.admin,
          state,
          maximized: adminMaximized
        });
        projectorState.adminWindow = adminWindow;
        state.adminWindow = adminWindow;
        return adminWindow;
      },
      createProjectorWindow(BrowserWindow, handlers = {}, windowOptionsOverride) {
        const initialUrl = buildProjectorUrl({
          fs: deps.fs,
          projectorState,
          src: runtime.html.projector
        });
        const projectorWindow = createProjectorWindowController({
          BrowserWindow,
          windowOptions: windowOptionsOverride || windows.projector,
          state: projectorState,
          initialUrl,
          baseWidth: projectorBaseResolution && projectorBaseResolution.width,
          baseHeight: projectorBaseResolution && projectorBaseResolution.height,
          onReady: handlers.onReady || createProjectorReadyHandler({ fs: deps.fs, projectorState }),
          onReload: handlers.onReload || createProjectorReloadHandler({ fs: deps.fs, projectorState })
        });
        state.projectorWindow = projectorWindow;
        projectorState.adminWindow = state.adminWindow;
        return projectorWindow;
      }
    };
  }

  function registerAppIpc(deps) {
    registerCommonIpcHandlers({
      ipcMain: deps.ipcMain,
      app: deps.app,
      fs: deps.fs,
      path: deps.path,
      axios: deps.axios,
      xlsx: deps.xlsx,
      userDataPaths: deps.userDataPaths,
      dialog: deps.dialog,
      uiState: deps.uiState,
      projectorState: deps.projectorState,
      logger: deps.log
    });

    for (const registerExtraIpc of extraIpcRegistrars) {
      registerExtraIpc(deps);
    }
  }

  return {
    createRuntime,
    createWindowBlueprints,
    createBootstrap,
    createCommonMainServices,
    registerAppIpc
  };
}

module.exports = {
  createProductMainModule
};
