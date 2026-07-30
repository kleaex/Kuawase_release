const ALLOWED_INVOKE_CHANNELS = new Set([
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
  "upload-music-file",
  "change-projector-src"
]);

const ALLOWED_SEND_CHANNELS = new Set([
  "change-iframe-src"
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

function createElectronApi(ipcRenderer, envOverrides = {}, extraInvokeChannels = []) {
  const allowedInvokeChannels = new Set([
    ...ALLOWED_INVOKE_CHANNELS,
    ...extraInvokeChannels
  ]);

  return {
    env: {
      NODE_ENV: process.env.NODE_ENV || "production",
      ...envOverrides
    },
    invoke: (channel, ...args) => {
      assertAllowed(channel, allowedInvokeChannels, "invoke");
      return ipcRenderer.invoke(channel, ...args);
    },
    send: (channel, ...args) => {
      assertAllowed(channel, ALLOWED_SEND_CHANNELS, "send");
      return ipcRenderer.send(channel, ...args);
    },
    on: (channel, callback) => {
      assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "receive");
      return ipcRenderer.on(channel, (_, data) => callback(data));
    },
    changeIframeSrc: (src) => {
      assertAllowed("change-iframe-src", ALLOWED_SEND_CHANNELS, "send");
      return ipcRenderer.send("change-iframe-src", src);
    },
    receive: (channel, callback) => {
      assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "receive");
      ipcRenderer.on(channel, (_, data) => {
        callback(data);
      });
    },
    listMusicFiles: () => {
      assertAllowed("list-music-files", allowedInvokeChannels, "invoke");
      return ipcRenderer.invoke("list-music-files");
    },
    uploadMusicFile: (name, buffer) => {
      assertAllowed("upload-music-file", allowedInvokeChannels, "invoke");
      return ipcRenderer.invoke("upload-music-file", { name, buffer });
    },
    deleteMusicFile: (name) => {
      assertAllowed("delete-music-file", allowedInvokeChannels, "invoke");
      return ipcRenderer.invoke("delete-music-file", name);
    },
    getBgmConfig: () => {
      assertAllowed("get-bgm-config", allowedInvokeChannels, "invoke");
      return ipcRenderer.invoke("get-bgm-config");
    },
    setBgmConfig: (bgmConfig) => {
      assertAllowed("set-bgm-config", allowedInvokeChannels, "invoke");
      return ipcRenderer.invoke("set-bgm-config", bgmConfig);
    }
  };
}

function createAppVersionApi(ipcRenderer) {
  return {
    get: () => ipcRenderer.invoke("get-app-version")
  };
}

module.exports = {
  createElectronApi,
  createAppVersionApi
};
