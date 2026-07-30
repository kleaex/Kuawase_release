const { showToast, showToastAndReload } = require("./battle-page-ui");

function installToastRuntime(windowObject) {
  const target = windowObject || (typeof window !== "undefined" ? window : null);
  if (!target) return;
  if (typeof target.showToast !== "function") {
    target.showToast = showToast;
  }
  if (typeof target.showToastAndReload !== "function") {
    target.showToastAndReload = showToastAndReload;
  }
}

if (typeof window !== "undefined") {
  installToastRuntime(window);
}

module.exports = {
  installToastRuntime
};

