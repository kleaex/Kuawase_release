(function () {
  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/bgm-manager-bridge.js"
    : "../../packages/kuawase-core/src/renderer/bgm-manager-bridge.js";
  document.write(`<script src="${src}"><\/script>`);
})();
