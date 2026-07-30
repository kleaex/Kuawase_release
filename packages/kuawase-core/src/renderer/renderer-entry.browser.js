(function () {
  function runWhenDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function initThemeSelect() {
    if (window.__kuawaseThemeSelectInitialized) return;

    const themeSelect = document.getElementById("theme-select");
    if (!themeSelect || !window.THEMES) return false;

    window.__kuawaseThemeSelectInitialized = true;
    themeSelect.innerHTML = "";
    Object.keys(window.THEMES).forEach((name) => {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      themeSelect.appendChild(opt);
    });

    const savedTheme = localStorage.getItem("theme") || "Gray";
    themeSelect.value = savedTheme;
    if (typeof window.applyTheme === "function") {
      window.applyTheme(savedTheme);
    }

    themeSelect.addEventListener("change", () => {
      const theme = themeSelect.value;
      if (typeof window.applyTheme === "function") {
        window.applyTheme(theme);
      }
      const iframe = document.getElementById("slide-frame");
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "theme", theme }, "*");
      }
      if (window.electron) {
        window.electron.invoke("send-data-to-projector", { type: "theme", content: theme });
      }
    });
    return true;
  }

  function installMainWorldUiBindings() {
    let attempts = 0;

    function bindHikouAudioButtons() {
      ["showRed", "showWhite"].forEach((id) => {
        const button = document.getElementById(id);
        if (!button || button.dataset.mainWorldHikouAudioBound === "true") return;
        button.dataset.mainWorldHikouAudioBound = "true";
        button.addEventListener("click", () => {
          if (typeof window.audio_hikou === "function") {
            window.audio_hikou();
          }
        });
      });
    }

    const tryInstall = () => {
      attempts += 1;
      bindHikouAudioButtons();
      const themeReady = initThemeSelect() || window.__kuawaseThemeSelectInitialized;
      const customCssReady = !!window.KuawaseCustomCssBridge;
      window.KuawaseCustomCssBridge?.installCustomCssBridge(window);

      if ((!themeReady || !customCssReady) && attempts < 20) {
        window.setTimeout(tryInstall, 50);
      }
    };

    tryInstall();
  }

  function loadFallbackScript() {
    if (window.__kuawaseFallbackRendererLoaded) return;
    window.__kuawaseFallbackRendererLoaded = true;
    const fallbackScript = document.createElement("script");
    fallbackScript.src = "legacy/renderer.js";
    document.body.appendChild(fallbackScript);
  }

  function getCoreBrowserScriptSrc(fileName) {
    return location.href.includes(".asar/")
      ? `packages/kuawase-core/src/renderer/${fileName}`
      : `../../packages/kuawase-core/src/renderer/${fileName}`;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Failed to load ${src}`));
      document.body.appendChild(script);
    });
  }

  async function loadBrowserMigratedRenderer(config) {
    if (config.appPath === "apps/khb-kuawase") {
      await loadScript("src/extensions/renderer-extension.js");
      await loadScript("src/extensions/renderer-projector-extension.js");
    }
    await loadScript(getCoreBrowserScriptSrc("migrated-renderer-app.browser.js"));
    if (!window.KuawaseMigratedRendererBrowserApp?.createMigratedRendererBrowserApp) {
      throw new Error("browser migrated renderer app is unavailable");
    }
    window.KuawaseMigratedRendererBrowserApp.createMigratedRendererBrowserApp({
      appKey: config.storagePrefix
    });
  }

  function shouldUseLegacyRenderer(config) {
    const params = new URLSearchParams(window.location.search);
    if (params.get("legacyRenderer") === "1" || params.get("migrated") === "0") return true;
    try {
      return localStorage.getItem(`${config.storagePrefix}-prototype-use-migrated-renderer`) === "false";
    } catch {
      return false;
    }
  }

  try {
    const config = window.KuawaseRendererEntryConfig;
    if (!config) {
      throw new Error("renderer entry config is unavailable");
    }

    if (shouldUseLegacyRenderer(config)) {
      loadFallbackScript();
      return;
    }

    if (window.devLoader?.startPrototypeRenderer) {
      window.devLoader.startPrototypeRenderer(config);
      return;
    }

    if (window.rendererLoader?.startMigratedRenderer) {
      runWhenDomReady(installMainWorldUiBindings);
      window.rendererLoader.startMigratedRenderer(config);
      return;
    }

    runWhenDomReady(installMainWorldUiBindings);
    loadBrowserMigratedRenderer(config).catch((error) => {
      console.error("[renderer.entry] browser migrated renderer failed", error);
    });
  } catch (error) {
    console.error("[renderer.entry] failed", error);
  }
})();
