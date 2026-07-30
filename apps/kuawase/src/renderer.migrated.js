try {
  const { requireCore } = require("./core");
  const { createMigratedRendererApp } = requireCore("renderer/migrated-renderer-app");
  const rendererExtension = require("./extensions/renderer-extension");
  const projectorExtension = require("./extensions/renderer-projector-extension");

  createMigratedRendererApp({
    rendererExtension,
    projectorExtension
  });
} catch (error) {
  console.error("[renderer.migrated] failed", error);
}
