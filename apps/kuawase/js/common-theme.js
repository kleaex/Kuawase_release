(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/common-theme.js"
    : "../../packages/kuawase-core/src/renderer/common-theme.js";
  document.write(`<script src="${src}"><\/script>`);
})();
