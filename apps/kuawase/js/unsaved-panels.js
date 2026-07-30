(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/unsaved-panels.js"
    : "../../packages/kuawase-core/src/renderer/unsaved-panels.js";
  document.write('<script src="' + src + '"><\/script>');
})();
