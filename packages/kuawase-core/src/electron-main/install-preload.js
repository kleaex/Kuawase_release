const path = require("path");
const { createElectronApi, createAppVersionApi } = require("./preload-api");

const ALLOWED_WORKSPACE_MODULES = [
  /^packages\/kuawase-core\/src\/renderer\/(?:prototype-renderer-runtime|prototype-bridge-policy\.runtime|toast-runtime)\.js$/,
  /^apps\/(?:kuawase|khb-kuawase)\/src\/(?:match-selector-bridge|projector-sync-bridge|timer-bridge|custom-css-bridge|renderer\.migrated)\.js$/
];

function normalizeWorkspaceModulePath(workspaceRelativePath) {
  if (typeof workspaceRelativePath !== "string" || !workspaceRelativePath.trim()) {
    throw new Error("workspace module path is required");
  }
  if (path.isAbsolute(workspaceRelativePath)) {
    throw new Error("absolute workspace module paths are not allowed");
  }
  const normalized = workspaceRelativePath.replace(/\\/g, "/");
  if (normalized.split("/").includes("..")) {
    throw new Error("parent directory traversal is not allowed");
  }
  if (!ALLOWED_WORKSPACE_MODULES.some((pattern) => pattern.test(normalized))) {
    throw new Error(`workspace module is not allowed: ${workspaceRelativePath}`);
  }
  return normalized;
}

function resolveWorkspaceModule(workspaceRoot, workspaceRelativePath) {
  const normalized = normalizeWorkspaceModulePath(workspaceRelativePath);
  const resolvedRoot = path.resolve(workspaceRoot);
  const resolvedModule = path.resolve(resolvedRoot, normalized);
  const relative = path.relative(resolvedRoot, resolvedModule);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("workspace module resolved outside workspace");
  }
  return resolvedModule;
}

function installPreloadApis({
  contextBridge,
  ipcRenderer,
  includeDevLoader = false,
  appRoot,
  workspaceRoot = process.cwd(),
  envOverrides,
  extraInvokeChannels = []
}) {
  const effectiveEnv = {
    NODE_ENV: process.env.NODE_ENV || "production",
    ...envOverrides
  };
  const electronApi = createElectronApi(ipcRenderer, envOverrides, extraInvokeChannels);
  const appVersionApi = createAppVersionApi(ipcRenderer);
  const apis = {
    electron: electronApi,
    appVersion: appVersionApi,
    rendererLoader: {
      startMigratedRenderer: () => {
        if (!appRoot) {
          throw new Error("startMigratedRenderer requires appRoot");
        }
        require(path.join(appRoot, "src", "renderer.migrated.js"));
        return true;
      }
    },
    topLoader: {
      startMigratedTop: () => {
        if (!appRoot) {
          throw new Error("startMigratedTop requires appRoot");
        }
        require(path.join(appRoot, "src", "top.migrated.js"));
        return true;
      }
    }
  };

  if (includeDevLoader && effectiveEnv.NODE_ENV === "development") {
    apis.devLoader = {
      loadWorkspaceModule: (workspaceRelativePath) => {
        return require(resolveWorkspaceModule(workspaceRoot, workspaceRelativePath));
      },
      startPrototypeRenderer: (config) => {
        const runtime = require(path.join(
          workspaceRoot,
          "packages/kuawase-core/src/renderer/prototype-renderer-runtime.js"
        ));
        if (!runtime || typeof runtime.start !== "function") {
          throw new Error("prototype renderer runtime is unavailable");
        }
        runtime.start(config);
        return true;
      }
    };
  }

  for (const [name, value] of Object.entries(apis)) {
    contextBridge.exposeInMainWorld(name, value);
  }
}

module.exports = {
  installPreloadApis
};
