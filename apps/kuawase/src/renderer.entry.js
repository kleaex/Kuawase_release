(function () {
  try {
    window.KuawaseRendererEntryConfig = {
      appPath: "apps/kuawase",
      storagePrefix: "kuawase"
    };
    const src = location.href.includes(".asar/")
      ? "packages/kuawase-core/src/renderer/renderer-entry.browser.js"
      : "../../packages/kuawase-core/src/renderer/renderer-entry.browser.js";
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.onerror = () => console.error("[renderer.entry] failed to load shared entry", src);
    document.body.appendChild(script);
  } catch (error) {
    console.error("[renderer.entry] bootstrap failed", error);
  }
})();
