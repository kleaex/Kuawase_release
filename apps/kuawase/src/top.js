const { requireCore } = require("./core");
const { createTopPageRuntime } = requireCore("renderer/common-top");
const extension = require("./extensions/top-extension");

createTopPageRuntime({
  extension
}).init();
