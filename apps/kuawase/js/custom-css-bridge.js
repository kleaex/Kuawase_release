(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/custom-css-bridge.js"
    : "../../packages/kuawase-core/src/renderer/custom-css-bridge.js";
  document.write(`<script src="${src}"><\/script>`);
})();
