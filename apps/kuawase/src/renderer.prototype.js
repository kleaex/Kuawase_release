(function () {
  function loadFallbackScript() {
    if (window.__kuawaseFallbackRendererLoaded) return;
    window.__kuawaseFallbackRendererLoaded = true;
    const fallbackScript = document.createElement("script");
    fallbackScript.src = "legacy/renderer.js";
    document.body.appendChild(fallbackScript);
  }

  function shouldUseLegacyRenderer() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("legacyRenderer") === "1" || params.get("migrated") === "0") return true;
    try {
      return localStorage.getItem("kuawase-prototype-use-migrated-renderer") === "false";
    } catch {
      return false;
    }
  }

  try {
    if (shouldUseLegacyRenderer()) {
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", loadFallbackScript, { once: true });
      } else {
        loadFallbackScript();
      }
      return;
    }

    const runtime = window.devLoader?.loadWorkspaceModule?.("packages/kuawase-core/src/renderer/prototype-renderer-runtime.js") || window.KuawasePrototypeRenderer;
    if (!runtime?.start) {
      throw new Error("prototype renderer runtime is unavailable");
    }
    runtime.start({
      appPath: "apps/kuawase",
      storagePrefix: "kuawase"
    });
  } catch (error) {
    console.error("[renderer.prototype] failed to start shared runtime", error);
  }
})();
