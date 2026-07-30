const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_INVOKE_CHANNELS = new Set([
  "get-config",
  "get-excel-data",
  "get-user-style-path"
]);

const ALLOWED_RECEIVE_CHANNELS = new Set([
  "update-content"
]);

function assertAllowed(channel, allowedChannels, type) {
  if (!allowedChannels.has(channel)) {
    throw new Error(`IPC ${type} channel is not allowed: ${channel}`);
  }
}

contextBridge.exposeInMainWorld("electron", {
  invoke: (channel, ...args) => {
    assertAllowed(channel, ALLOWED_INVOKE_CHANNELS, "invoke");
    return ipcRenderer.invoke(channel, ...args);
  },
  receive: (channel, callback) => {
    assertAllowed(channel, ALLOWED_RECEIVE_CHANNELS, "receive");
    ipcRenderer.on(channel, (_, data) => callback(data));
  }
});
