(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/match-helpers.js"
    : "../../packages/kuawase-core/src/renderer/match-helpers.js";
  document.write(`<script src="${src}"><\/script>`);
})();
