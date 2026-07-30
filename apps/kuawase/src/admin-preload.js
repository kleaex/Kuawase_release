const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_INVOKE_CHANNELS = new Set([
  "change-projector-src",
  "delete-all-bgm-files",
  "delete-music-file",
  "delete-user-style",
  "get-app-version",
  "get-bgm-config",
  "get-config",
  "get-excel-data",
  "get-music-file-path",
  "get-user-style-path",
  "list-music-files",
  "list-user-styles",
  "load-from-google-sheet",
  "reset-bgm-settings",
  "reset-data",
  "save-user-style",
  "select-excel-file",
  "send-data-to-projector",
  "set-bgm-config",
  "set-excel-file",
  "update-config",
  "upload-music-file"
]);

const ALLOWED_RECEIVE_CHANNELS = new Set([
  "change-iframe-src",
  "update-content"
]);

function assertAllowed(channel, allowedChannels, type) {
  if (!allowedChannels.has(channel)) {
    throw new Error(`IPC ${type} channel is not allowed: ${channel}`);
  }
}

const electronApi = {
  env: {
    NODE_ENV: "production"
  },
  invoke: (channel, ...args) => {
    assertAllowed(channel, ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke(channel, ...args);
  },
  receive: (channel, callback) => {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "receive");
    ipcRenderer.on(channel, (_, data) => callback(data));
  },
  listMusicFiles: () => {
    assertAllowed("list-music-files", ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke("list-music-files");
  },
  uploadMusicFile: (name, buffer) => {
    assertAllowed("upload-music-file", ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke("upload-music-file", { name, buffer });
  },
  deleteMusicFile: (name) => {
    assertAllowed("delete-music-file", ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke("delete-music-file", name);
  },
  getBgmConfig: () => {
    assertAllowed("get-bgm-config", ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke("get-bgm-config");
  },
  setBgmConfig: (bgmConfig) => {
    assertAllowed("set-bgm-config", ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke("set-bgm-config", bgmConfig);
  }
};

contextBridge.exposeInMainWorld("electron", electronApi);
