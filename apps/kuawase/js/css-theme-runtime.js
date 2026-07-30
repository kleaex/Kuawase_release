'use strict';

(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__cssThemeRuntimeInstalled || typeof window.applyCssThemeValue === "function") {
    return;
  }

  const src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/css-theme-runtime.js"
    : "../../packages/kuawase-core/src/renderer/css-theme-runtime.js";
  document.write(`<script id="core-css-theme-runtime" src="${src}"><\/script>`);
})();
