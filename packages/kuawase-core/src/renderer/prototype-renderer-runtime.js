(function () {
  function loadFallbackScript() {
    if (window.__kuawaseFallbackRendererLoaded) return;
    window.__kuawaseFallbackRendererLoaded = true;
    var fallbackScript = document.createElement("script");
    fallbackScript.src = "legacy/renderer.js";
    document.body.appendChild(fallbackScript);
  }

  function getSearchParams() {
    return new URLSearchParams(window.location.search);
  }

  function readLocalStorage(key, fallback) {
    try {
      var value = localStorage.getItem(key);
      return value === null ? fallback : value;
    } catch {
      return fallback;
    }
  }

  function shouldUseMigratedRenderer(storagePrefix) {
    var params = getSearchParams();
    if (params.get("migrated") === "1") return true;
    return readLocalStorage(storagePrefix + "-prototype-use-migrated-renderer", "true") !== "false";
  }

  function shouldUseLegacyBridge(storagePrefix, queryName, storageSuffix) {
    var params = getSearchParams();
    if (params.get(queryName) === "1") return true;
    return readLocalStorage(storagePrefix + "-prototype-use-" + storageSuffix, "false") === "true";
  }

  function shouldUseLegacyCustomCssBridge(storagePrefix) {
    var params = getSearchParams();
    if (params.get("customCssBridge") === "1") return false;
    if (params.get("legacyCustomCssBridge") === "1") return true;
    return readLocalStorage(storagePrefix + "-prototype-use-custom-css-bridge", "false") !== "true";
  }

  function waitForElementIds(ids, maxAttempts, intervalMs) {
    var attempts = 0;
    var max = maxAttempts || 40;
    var interval = intervalMs || 100;

    return new Promise(function (resolve) {
      var timer = window.setInterval(function () {
        attempts += 1;
        var allFound = ids.every(function (id) {
          return document.getElementById(id);
        });
        if (allFound || attempts >= max) {
          window.clearInterval(timer);
          resolve(allFound);
        }
      }, interval);
    });
  }

  function loadWorkspaceModule(path) {
    if (!window.devLoader?.loadWorkspaceModule) return false;
    window.devLoader.loadWorkspaceModule(path);
    return true;
  }

  function loadOptionalWorkspaceModule(path, warning) {
    try {
      loadWorkspaceModule(path);
    } catch (error) {
      console.warn(warning, error);
    }
  }

  function bindMigratedRendererWorldHandlers() {
    ["showRed", "showWhite"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", function () {
          if (typeof window.audio_hikou === "function") {
            window.audio_hikou();
          }
        });
      }
    });

    (function initThemeSelect() {
      var themeSelect = document.getElementById("theme-select");
      if (!themeSelect || !window.THEMES) return;

      themeSelect.innerHTML = "";
      Object.keys(window.THEMES).forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        themeSelect.appendChild(opt);
      });

      var savedTheme = localStorage.getItem("theme") || "Gray";
      themeSelect.value = savedTheme;
      if (typeof window.applyTheme === "function") {
        window.applyTheme(savedTheme);
      }

      themeSelect.addEventListener("change", function () {
        var theme = themeSelect.value;
        if (typeof window.applyTheme === "function") {
          window.applyTheme(theme);
        }
        var iframe = document.getElementById("slide-frame");
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: "theme", theme: theme }, "*");
        }
        if (window.electron) {
          window.electron.invoke("send-data-to-projector", { type: "theme", content: theme });
        }
      });
    })();
  }

  function loadFallbackWhenReady() {
    var requiredIds = ["excel-select-btn", "excel-input", "reset-data-btn"];
    waitForElementIds(requiredIds).then(function (found) {
      if (!found) {
        console.warn("[renderer.prototype] required admin elements were not all found before loading legacy/renderer.js");
      }
      loadFallbackScript();
    });
  }

  function startPrototypeRenderer(config) {
    var appPath = config.appPath;
    var storagePrefix = config.storagePrefix;
    var useMigratedRenderer = shouldUseMigratedRenderer(storagePrefix);

    if (window.devLoader?.loadWorkspaceModule) {
      loadOptionalWorkspaceModule(
        "packages/kuawase-core/src/renderer/prototype-bridge-policy.runtime.js",
        "[renderer.prototype] failed to load prototype bridge policy runtime"
      );
      loadOptionalWorkspaceModule(
        "packages/kuawase-core/src/renderer/toast-runtime.js",
        "[renderer.prototype] failed to load toast runtime"
      );
    }

    if (!useMigratedRenderer && !shouldUseLegacyBridge(storagePrefix, "legacyMatchBridge", "legacy-match-selector-bridge")) {
      loadWorkspaceModule(appPath + "/src/match-selector-bridge.js");
    }

    if (!useMigratedRenderer && !shouldUseLegacyBridge(storagePrefix, "legacyProjectorBridge", "legacy-projector-sync-bridge")) {
      loadWorkspaceModule(appPath + "/src/projector-sync-bridge.js");
    }

    if (!useMigratedRenderer && !shouldUseLegacyBridge(storagePrefix, "legacyTimerBridge", "legacy-timer-bridge")) {
      loadWorkspaceModule(appPath + "/src/timer-bridge.js");
    }

    var params = getSearchParams();
    var shouldLoadCustomCssBridge = params.get("legacyCustomCssBridge") !== "1"
      && (useMigratedRenderer || !shouldUseLegacyCustomCssBridge(storagePrefix));

    if (shouldLoadCustomCssBridge) {
      loadWorkspaceModule(appPath + "/src/custom-css-bridge.js");
    }

    if (useMigratedRenderer && window.devLoader?.loadWorkspaceModule) {
      try {
        loadWorkspaceModule(appPath + "/src/renderer.migrated.js");
        console.log("[renderer.prototype] loaded renderer.migrated.js");
      } catch (error) {
        console.error("[renderer.prototype] failed to load renderer.migrated.js", error);
      }
      bindMigratedRendererWorldHandlers();
    } else if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", loadFallbackWhenReady, { once: true });
    } else {
      loadFallbackWhenReady();
    }
  }

  const api = {
    start: startPrototypeRenderer
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.KuawasePrototypeRenderer = api;
  }
})();

