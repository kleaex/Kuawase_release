const path = require("path");
const { createMainProcessConfig, loadProductConfig } = require("../../../packages/kuawase-core/src");
const {
  createBootstrap,
  createCommonMainServices,
  createRuntime,
  createWindowBlueprints,
  registerAppIpc
} = require("../src/main");

const product = loadProductConfig(path.join(__dirname, "..", "product.config.json"));
const runtime = createRuntime(
  {
    app: { setName() {} },
    autoUpdater: { setFeedURL() {} },
    log: { transports: { file: {} } }
  }
);
const bootstrap = createBootstrap({
  app: {
    whenReady() {
      return Promise.resolve();
    }
  },
  autoUpdater: { setFeedURL() {} },
  log: { transports: { file: {} } },
  remoteMain: {
    initialize() {},
    enable() {}
  },
  setupAutoUpdaterHandlers() {},
  createAdminWindow(windowOptions) {
    return createFakeWindow(windowOptions);
  },
  createProjectorWindow(windowOptions) {
    return createFakeWindow(windowOptions);
  },
  ensureConfigExists() {}
});
const commonServices = createCommonMainServices({
  app: {
    getPath() {
      return "C:\\fake-user-data";
    },
    setName() {}
  },
  autoUpdater: fakeAutoUpdater(),
  fs: fakeFs(),
  log: fakeLogger()
});
const ipcMain = createFakeIpcMain();
registerAppIpc({
  ipcMain,
  app: {
    getPath() {
      return "C:\\fake-user-data";
    },
    getVersion() {
      return "0.0.0";
    }
  },
  fs: fakeFs(),
  path: require("path"),
  dialog: {
    showOpenDialog() {
      return Promise.resolve({ canceled: true, filePaths: [] });
    }
  },
  axios: { get() { throw new Error("not used"); } },
  xlsx: { read() {}, readFile() {} },
  userDataPaths: commonServices.userDataPaths,
  uiState: commonServices.uiState,
  projectorState: commonServices.projectorState
});

console.log(
  JSON.stringify(
    {
      mainProcess: createMainProcessConfig(product),
      runtime,
      windows: createWindowBlueprints(runtime),
      bootstrapType: typeof bootstrap,
      userDataPaths: commonServices.userDataPaths,
      ipcHandlers: ipcMain.handlers
    },
    null,
    2
  )
);

function createFakeWindow(windowOptions) {
  return {
    options: windowOptions,
    webContents: {
      on() {},
      once() {}
    },
    on() {},
    close() {},
    isDestroyed() {
      return false;
    }
  };
}

function fakeAutoUpdater() {
  return {
    setFeedURL() {},
    on() {}
  };
}

function fakeLogger() {
  return {
    info() {},
    error() {},
    transports: { file: {} }
  };
}

function createFakeIpcMain() {
  return {
    handlers: [],
    handle(name) {
      this.handlers.push(name);
    }
  };
}

function fakeFs() {
  return {
    existsSync() {
      return false;
    },
    readFileSync() {
      return "{}";
    },
    writeFileSync() {},
    mkdirSync() {},
    copyFileSync() {},
    readdirSync() {
      return [];
    },
    unlinkSync() {}
  };
}
