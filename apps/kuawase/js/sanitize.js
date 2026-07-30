(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/sanitize.js"
    : "../../packages/kuawase-core/src/renderer/sanitize.js";
  document.write('<script src="' + src + '"><\/script>');
})();
