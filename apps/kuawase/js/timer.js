(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/timer.js"
    : "../../packages/kuawase-core/src/renderer/timer.js";
  document.write('<script src="' + src + '"><\/script>');
})();
