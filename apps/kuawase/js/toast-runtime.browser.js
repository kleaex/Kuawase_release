(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/toast-runtime.browser.js"
    : "../../packages/kuawase-core/src/renderer/toast-runtime.browser.js";
  document.write(`<script src="${src}"><\/script>`);
})();
