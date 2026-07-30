(function () {
  var src = location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/admin-tabnav.js"
    : "../../packages/kuawase-core/src/renderer/admin-tabnav.js";
  document.write('<script src="' + src + '"><\/script>');
})();
