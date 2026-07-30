const { createBattleRenderer, installProjectorSyncBridge } = require("../../../packages/kuawase-core/src");
const rendererExtension = require("./extensions/renderer-extension");
const projectorExtension = require("./extensions/renderer-projector-extension");

const battleRuntime = createBattleRenderer({
  extension: rendererExtension,
  projectorExtension
}).createRuntime();

installProjectorSyncBridge(window, battleRuntime);
