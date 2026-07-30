const { installBgmManagerBridge } = require("../../../packages/kuawase-core/src/renderer/bgm-manager-bridge");

window.__kuawaseBgmManagerBridgeActive = true;

installBgmManagerBridge(window);
