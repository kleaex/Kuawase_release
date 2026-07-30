const { installMatchSelectorBridge } = require("../../../packages/kuawase-core/src");

installMatchSelectorBridge(window);
window.KuawaseMatchSelectorBridge?.installAutoRefresh?.();
