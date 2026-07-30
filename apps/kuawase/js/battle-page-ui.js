(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/battle-page-ui.js"
    : "../../packages/kuawase-core/src/renderer/battle-page-ui.js";
  document.write(`<script src="${src}"><\/script>`);
})();
