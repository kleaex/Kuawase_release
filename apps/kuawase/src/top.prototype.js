function shouldUseLegacyTop() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("legacy") === "1") {
    return true;
  }

  try {
    return localStorage.getItem("kuawase-prototype-use-legacy-top") === "true";
  } catch {
    return false;
  }
}

function loadFallbackScript() {
  const fallbackScript = document.createElement("script");
  fallbackScript.src = "legacy/top.js";
  fallbackScript.onload = () => {
    document.dispatchEvent(new Event("DOMContentLoaded"));
  };
  document.body.appendChild(fallbackScript);
}

function getCoreBrowserTopEntrySrc() {
  return location.href.includes(".asar/")
    ? "packages/kuawase-core/src/renderer/top-entry.browser.js"
    : "../../packages/kuawase-core/src/renderer/top-entry.browser.js";
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

async function loadBrowserTopEntry() {
  await loadScript(getCoreBrowserTopEntrySrc());
}

function isEmbeddedFrame() {
  try {
    return window.parent && window.parent !== window;
  } catch {
    return false;
  }
}

function waitForElementId(id, maxAttempts = 40, intervalMs = 100) {
  let attempts = 0;

  return new Promise((resolve) => {
    const timer = window.setInterval(() => {
      attempts += 1;
      const found = Boolean(document.getElementById(id));
      if (found || attempts >= maxAttempts) {
        window.clearInterval(timer);
        resolve(found);
      }
    }, intervalMs);
  });
}

const useLegacyTop = shouldUseLegacyTop();

if (!useLegacyTop && window.devLoader?.loadWorkspaceModule) {
  window.devLoader.loadWorkspaceModule("apps/kuawase/src/top.migrated.js");
} else if (!useLegacyTop && window.topLoader?.startMigratedTop) {
  try {
    window.topLoader.startMigratedTop();
  } catch (error) {
    console.error("[top.prototype] migrated top load failed", error);
    if (isEmbeddedFrame()) {
      loadBrowserTopEntry().catch((browserError) => {
        console.error("[top.prototype] browser top entry failed", browserError);
      });
    }
  }
} else if (!useLegacyTop) {
  loadBrowserTopEntry().catch((error) => {
    console.error("[top.prototype] browser top entry failed", error);
  });
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", async () => {
    const found = await waitForElementId("Compe-name");
    if (!found) {
      console.warn("[top.prototype] title element was not found before loading legacy/top.js");
    }
    loadFallbackScript();
  }, { once: true });
} else {
  waitForElementId("Compe-name").then((found) => {
    if (!found) {
      console.warn("[top.prototype] title element was not found before loading legacy/top.js");
    }
    loadFallbackScript();
  });
}
