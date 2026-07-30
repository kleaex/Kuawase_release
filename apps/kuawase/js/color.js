(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/color.js"
    : "../../packages/kuawase-core/src/renderer/color.js";
  document.write('<script src="' + src + '"><\/script>');
})();
