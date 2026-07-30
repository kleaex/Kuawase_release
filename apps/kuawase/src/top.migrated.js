const { requireCore } = require("./core");
const { createTopPageRuntime } = requireCore("renderer/common-top");
const extension = require("./extensions/top-extension");

const runtime = createTopPageRuntime({
  extension
});

window.KuawaseTopRuntime = runtime;
runtime.init();
