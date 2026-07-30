const { createRendererRuntime } = require("../../../packages/kuawase-core/src/renderer/common-renderer");
const { createBattleRenderer } = require("../../../packages/kuawase-core/src/renderer/battle-renderer");
const { bootstrapBattlePage } = require("../../../packages/kuawase-core/src/renderer/bootstrap-battle-page");
const extension = require("./extensions/renderer-extension");
const projectorExtension = require("./extensions/renderer-projector-extension");

const extensionRuntime = createRendererRuntime({ extension });
const battleRenderer = createBattleRenderer({ extension, projectorExtension });

window.KuawaseRendererExtension = extensionRuntime;
window.KuawaseBattleRenderer = battleRenderer;
window.KuawaseBattleBootstrap = bootstrapBattlePage({
  battleRenderer,
  extensionRuntime,
  hooks: {
    showConfirm: (...args) => window.showConfirm?.(...args),
    showToast: (...args) => window.showToast?.(...args),
    t: (...args) => (typeof window.t === "function" ? window.t(...args) : args[0])
  }
});
