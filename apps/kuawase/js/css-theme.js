(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/css-theme.js"
    : "../../packages/kuawase-core/src/renderer/css-theme.js";
  document.write(`<script src="${src}"><\/script>`);
})();
