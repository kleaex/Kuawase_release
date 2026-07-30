(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/battle-page-runtime.js"
    : "../../packages/kuawase-core/src/renderer/battle-page-runtime.js";
  try {
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onerror = function () {
      console.error("[core-shim] failed to load " + src);
    };
    document.head.appendChild(script);
  } catch (error) {
    console.error("[core-shim] failed to load " + src, error);
  }
})();
