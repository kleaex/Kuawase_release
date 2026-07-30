const { requireCore } = require("../core");
const { createNoopTopExtension } = requireCore("renderer/top-extension-contract");

module.exports = createNoopTopExtension();
