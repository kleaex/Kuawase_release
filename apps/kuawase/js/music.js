(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/music.js"
    : "../../packages/kuawase-core/src/renderer/music.js";
  document.write(`<script src="${src}"><\/script>`);
})();
