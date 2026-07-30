(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/lang.js"
    : "../../packages/kuawase-core/src/renderer/lang.js";
  document.write(`<script src="${src}"><\/script>`);
})();
