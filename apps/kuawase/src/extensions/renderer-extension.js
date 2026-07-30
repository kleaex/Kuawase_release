const { requireCore } = require("../core");
const { createNoopRendererExtension } = requireCore("renderer/renderer-extension-contract");

module.exports = createNoopRendererExtension();
