(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/music-manager.js"
    : "../../packages/kuawase-core/src/renderer/music-manager.js";
  document.write('<script src="' + src + '"><\/script>');
})();
