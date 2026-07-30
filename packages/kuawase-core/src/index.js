const { loadProductConfig } = require("./product-config");
const { createForgeConfig } = require("./forge-config");
const { createMainProcessConfig } = require("./main-process-config");
const {
  applyProductToApp,
  applyProductToAutoUpdater,
  createProductRuntime,
  createWindowOptions
} = require("./electron-main/runtime");
const {
  DEFAULT_SPLASH_DELAY_MS,
  attachMutualClose,
  createAppBootstrap,
  disableWindowReloadShortcuts
} = require("./electron-main/bootstrap");
const { setupAutoUpdaterHandlers } = require("./electron-main/updater");
const { createUserDataPaths, ensureConfigExists } = require("./electron-main/config-files");
const {
  createAdminWindowController,
  createProjectorWindowController
} = require("./electron-main/windows");
const { createAppMainEntry } = require("./electron-main/app-main-entry");
const { createProductAppShell } = require("./electron-main/app-shell");
const { createProductMainModule } = require("./electron-main/product-main-module");
const { installPreloadApis } = require("./electron-main/install-preload");
const { registerCommonIpcHandlers } = require("./electron-main/ipc/common-ipc");
const {
  buildProjectorUrl,
  createProjectorReadyHandler,
  createProjectorReloadHandler,
  createProjectorState
} = require("./electron-main/projector");
const { createPrototypeMainEntry } = require("./electron-main/prototype-main-entry");
const { bootstrapBattlePage } = require("./renderer/bootstrap-battle-page");
const { createBattleRenderer } = require("./renderer/battle-renderer");
const {
  loadExcelFile,
  loadGoogleSheet,
  populateMatchSelectors,
  restoreMatchConfig,
  saveMatchConfig,
  showToast,
  showToastAndReload,
  updateExcelData
} = require("./renderer/battle-page-ui");
const { installMatchSelectorBridge } = require("./renderer/match-selector-bridge");
const { installBgmManagerBridge } = require("./renderer/bgm-manager-bridge");
const { installCustomCssBridge } = require("./renderer/custom-css-bridge");
const { installProjectorSyncBridge } = require("./renderer/projector-sync-bridge");
const { installTimerBridge } = require("./renderer/timer-bridge");
const {
  createNoopRendererProjectorExtension
} = require("./renderer/renderer-projector-extension-contract");
const { loadPrototypeDependencies } = require("./prototype/external-deps");

module.exports = {
  loadProductConfig,
  createForgeConfig,
  createMainProcessConfig,
  applyProductToApp,
  applyProductToAutoUpdater,
  createProductRuntime,
  createWindowOptions,
  DEFAULT_SPLASH_DELAY_MS,
  attachMutualClose,
  createAppBootstrap,
  disableWindowReloadShortcuts,
  setupAutoUpdaterHandlers,
  createUserDataPaths,
  ensureConfigExists,
  createAdminWindowController,
  createProjectorWindowController,
  createAppMainEntry,
  createProductAppShell,
  createProductMainModule,
  installPreloadApis,
  registerCommonIpcHandlers,
  buildProjectorUrl,
  createProjectorReadyHandler,
  createProjectorReloadHandler,
  createProjectorState,
  createPrototypeMainEntry,
  bootstrapBattlePage,
  createBattleRenderer,
  loadExcelFile,
  loadGoogleSheet,
  populateMatchSelectors,
  restoreMatchConfig,
  saveMatchConfig,
  showToast,
  showToastAndReload,
  updateExcelData,
  installMatchSelectorBridge,
  installBgmManagerBridge,
  installCustomCssBridge,
  installProjectorSyncBridge,
  installTimerBridge,
  createNoopRendererProjectorExtension,
  loadPrototypeDependencies
};
