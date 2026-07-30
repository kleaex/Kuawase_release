(function () {
  var src = location.href.includes(".asar/")
    ? "node_modules/dompurify/dist/purify.min.js"
    : "../../node_modules/dompurify/dist/purify.min.js";
  document.write('<script src="' + src + '"><\/script>');
})();
