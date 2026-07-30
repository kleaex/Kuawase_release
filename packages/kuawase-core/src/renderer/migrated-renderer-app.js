const { createBattleRenderer } = require("./battle-renderer");
const { createRendererRuntime } = require("./common-renderer");
const {
  loadExcelFile,
  loadGoogleSheet,
  populateMatchSelectors,
  restoreMatchConfig,
  saveMatchConfig,
  showToast,
  showToastAndReload,
  updateExcelData
} = require("./battle-page-ui");
const { bootstrapBattlePage } = require("./bootstrap-battle-page");

function createPreloadLanguageRuntime() {
  let translations = {};
  let currentLang = null;
  let langReady = Promise.resolve();

  const getLang = () => {
    try {
      return localStorage.getItem("lang") || "ja";
    } catch {
      return "ja";
    }
  };

  const loadLocale = async (lang) => {
    if (!lang) return;
    currentLang = lang;
    try {
      const res = await fetch(`locales/${lang}.json`);
      translations = await res.json();
    } catch {
      translations = {};
    }
  };

  const sync = (lang = getLang()) => {
    langReady = loadLocale(lang);
    window.langReady = langReady;
    return langReady;
  };

  const ensure = async () => {
    const lang = getLang();
    if (lang && lang !== currentLang) {
      sync(lang);
    }
    return langReady;
  };

  sync();

  return {
    ready: () => langReady,
    ensure,
    sync,
    t: (key) => translations[key] || key
  };
}

function installLanguageRuntime(preloadLang) {
  const appT = typeof window.t === "function" ? window.t : null;
  window.t = (key) => {
    const text = preloadLang.t(key);
    if (text && text !== key) return text;
    return appT ? appT(key) : key;
  };
  window.langReady = preloadLang.ready();

  window.addEventListener("storage", (event) => {
    if (event.key === "lang") {
      preloadLang.sync(event.newValue || undefined);
    }
  });
  window.addEventListener("language:changed", () => {
    preloadLang.sync();
  });
}

function installConfirmRuntime() {
  if (typeof window.showConfirm === "function") return;

  window.showConfirm = (messageKey, paramsOrRaw) => {
    const modal = document.getElementById("confirm-modal");
    const content = modal?.querySelector(".confirm-modal-content") || modal?.querySelector(".modal-content");
    const msgEl = document.getElementById("confirm-modal-message");
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      return Promise.resolve(false);
    }

    let text = "";
    if (typeof paramsOrRaw === "string") {
      text = paramsOrRaw;
    } else if (messageKey) {
      try {
        text = typeof window.t === "function" ? window.t(messageKey) : messageKey;
      } catch {
        text = messageKey;
      }
    }
    if (paramsOrRaw && typeof paramsOrRaw === "object" && !Array.isArray(paramsOrRaw)) {
      Object.entries(paramsOrRaw).forEach(([key, value]) => {
        text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
      });
    }

    return new Promise((resolve) => {
      msgEl.textContent = text;
      modal.style.display = "block";

      const cleanup = (result) => {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onOverlay);
        document.removeEventListener("keydown", onKeyDown);
        modal.style.display = "none";
        resolve(result);
      };
      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onOverlay = (event) => {
        if (!content || !content.contains(event.target)) cleanup(false);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") cleanup(false);
      };

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onOverlay);
      document.addEventListener("keydown", onKeyDown);
    });
  };
}

function createPrivateExtensionResolver({ appKey, rendererExtension, projectorExtension, noopRendererExtension, noopProjectorExtension }) {
  function flagFromQueryOrStorage(queryName, storageName, defaultValue) {
    const params = new URLSearchParams(window.location.search);
    if (params.get(queryName) === "1") return true;
    if (params.get(queryName) === "0") return false;
    try {
      const value = localStorage.getItem(storageName);
      return value === null ? defaultValue : value !== "false";
    } catch {
      return defaultValue;
    }
  }

  function shouldUseCoreOnlyMode() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("coreOnly") === "1") return true;
    try {
      return localStorage.getItem(`${appKey}-prototype-use-core-only`) === "true";
    } catch {
      return false;
    }
  }

  const useCoreOnly = appKey ? shouldUseCoreOnlyMode() : false;
  const usePrivateRenderer = appKey
    ? flagFromQueryOrStorage("privateRenderer", `${appKey}-prototype-use-private-renderer-extension`, true)
    : true;
  const usePrivateProjector = appKey
    ? flagFromQueryOrStorage("privateProjector", `${appKey}-prototype-use-private-projector-extension`, true)
    : true;

  return {
    rendererExtension: useCoreOnly || !usePrivateRenderer ? noopRendererExtension : rendererExtension,
    projectorExtension: useCoreOnly || !usePrivateProjector ? noopProjectorExtension : projectorExtension
  };
}

function createMigratedRendererApp(options) {
  const preloadLang = createPreloadLanguageRuntime();
  installLanguageRuntime(preloadLang);

  const selectedExtensions = options.privateExtensionConfig
    ? createPrivateExtensionResolver(options.privateExtensionConfig)
    : {
      rendererExtension: options.rendererExtension,
      projectorExtension: options.projectorExtension
    };

  const rendererExtension = selectedExtensions.rendererExtension;
  const projectorExtension = selectedExtensions.projectorExtension;
  const extensionRuntime = createRendererRuntime({ extension: rendererExtension });
  const battleRenderer = createBattleRenderer({ extension: rendererExtension, projectorExtension });
  const battleRuntime = battleRenderer.createRuntime();

  async function ensureLangReady() {
    try {
      if (window.langReady) {
        await window.langReady;
        return;
      }
    } catch {}

    await preloadLang.ensure();
  }

  async function resolveMessage(key, fallback) {
    await ensureLangReady();
    if (typeof window.t === "function") {
      return window.t(key) || fallback || key;
    }
    return preloadLang.t(key) || fallback || key;
  }

  function translate(key) {
    return typeof window.t === "function" ? window.t(key) : preloadLang.t(key);
  }

  window.KuawaseRendererExtension = extensionRuntime;
  window.KuawaseBattleRenderer = battleRenderer;
  window.showToast = showToast;
  window.showToastAndReload = showToastAndReload;
  installConfirmRuntime();
  window.changeIframeSrc = battleRuntime.changeIframeSrc;
  window.sendContent = battleRuntime.sendContent;
  window.sendInitialData = battleRuntime.sendInitialData;
  window.showRedHaiku = battleRuntime.showRedHaiku;
  window.showWhiteHaiku = battleRuntime.showWhiteHaiku;
  console.log("[renderer.migrated] loaded");

  const gsModal = document.getElementById("gs-modal");
  const openGsModalBtn = document.getElementById("open-gs-modal-btn");
  const closeGsModalBtn = document.querySelector("#gs-modal .close-btn");

  openGsModalBtn?.addEventListener("click", () => {
    if (gsModal) gsModal.style.display = "block";
  });
  closeGsModalBtn?.addEventListener("click", () => {
    if (gsModal) gsModal.style.display = "none";
  });
  window.addEventListener("click", (event) => {
    if (event.target === gsModal) {
      gsModal.style.display = "none";
    }
  });

  document.getElementById("reset-excel-only-btn")?.addEventListener("click", async () => {
    await ensureLangReady();
    const ok = typeof window.showConfirm === "function"
      ? await window.showConfirm("excel-only-reset-confirm")
      : true;
    if (!ok) {
      const cancelMsg = await resolveMessage("excel-only-reset-cancel");
      showToast(cancelMsg, true);
      return;
    }
    try {
      const reset = await window.electron.invoke("reset-data");
      if (!reset?.success) throw new Error(reset?.error || "reset-data failed");
      const cfg = await window.electron.invoke("get-config");
      const bgm = cfg?.bgm || {};
      await window.electron.invoke("update-config", { bgm });
      const lastExcelFileSpan = document.getElementById("last-excel-file");
      if (lastExcelFileSpan) {
        lastExcelFileSpan.textContent = "";
        lastExcelFileSpan.setAttribute("data-lang", "not-selected");
      }
      if (typeof window.setLanguage === "function") {
        window.setLanguage(localStorage.getItem("lang") || "ja");
      }
      await updateExcelData();
      const successMsg = await resolveMessage("excel-only-reset-success");
      showToastAndReload(successMsg);
    } catch (error) {
      console.error("Excel-only reset failed", error);
      const failMsg = await resolveMessage("excel-only-reset-fail");
      showToast(failMsg, true);
    }
  });

  const refreshMatchSelectorsAfterDataLoad = async () => {
    populateMatchSelectors(window.excelData || {});
    await restoreMatchConfig();
  };

  document.getElementById("excel-select-btn")?.addEventListener("click", async () => {
    const picked = await window.electron.invoke("select-excel-file");
    if (picked?.canceled || !picked?.filePath) return;
    await ensureLangReady();
    await loadExcelFile(picked.filePath, {
      t: translate,
      onUpdated: refreshMatchSelectorsAfterDataLoad
    });
  });

  document.getElementById("excel-input")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    const filePath = file?.path;
    const isFakePath = !filePath || /\\fakepath\\/i.test(filePath);
    if (isFakePath) return;
    await ensureLangReady();
    await loadExcelFile(filePath, {
      t: translate,
      onUpdated: refreshMatchSelectorsAfterDataLoad
    });
  });

  document.getElementById("load-gs-btn")?.addEventListener("click", async () => {
    const urlInput = document.getElementById("gs-url-input");
    const url = urlInput?.value || "";
    await ensureLangReady();
    await loadGoogleSheet(url, {
      t: translate,
      closeModal: () => {
        if (gsModal) gsModal.style.display = "none";
        if (urlInput) urlInput.value = "";
      },
      onUpdated: refreshMatchSelectorsAfterDataLoad
    });
  });

  document.getElementById("saveMatchConfig")?.addEventListener("click", async () => {
    const result = await saveMatchConfig(window.appConfig || {});
    if (result.success) {
      const msg = await resolveMessage("save-success");
      showToastAndReload(msg);
    }
  });

  bootstrapBattlePage({
    battleRenderer,
    extensionRuntime,
    hooks: {
      showConfirm: (...args) => window.showConfirm?.(...args),
      showToast,
      t: (...args) => translate(args[0]),
      beforeInitExtensions: async () => {
        window.appConfig = await window.electron.invoke("get-config");
        window.excelData = await updateExcelData();
        populateMatchSelectors(window.excelData || {});
        await restoreMatchConfig();
      },
      afterInitExtensions: async () => {
        const config = await window.electron.invoke("get-config");
        const lastExcelFileSpan = document.getElementById("last-excel-file");
        if (lastExcelFileSpan) {
          if (config?.lastExcelFile) {
            lastExcelFileSpan.textContent = config.lastExcelFile;
            lastExcelFileSpan.removeAttribute("data-lang");
          } else {
            lastExcelFileSpan.setAttribute("data-lang", "not-selected");
          }
        }
        const iframe = document.getElementById("slide-frame");
        if (iframe) {
          battleRuntime.updateHikouPanelVisibility(iframe.src.split("/").pop().split("\\").pop());
          if (iframe.contentDocument?.readyState === "complete") {
            battleRuntime.sendInitialData();
          }
        }
      }
    }
  });
}

module.exports = {
  createMigratedRendererApp
};
