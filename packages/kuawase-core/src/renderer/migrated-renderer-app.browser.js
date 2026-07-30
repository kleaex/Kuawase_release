(function () {
  function createNoopRendererExtension() {
    return {
      async initTopHtmlControls() {
        return undefined;
      }
    };
  }

  function createNoopProjectorExtension() {
    return {
      afterSendInitialData() {},
      async transformIframeSrc({ src }) {
        return src;
      }
    };
  }

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
      if (lang && lang !== currentLang) sync(lang);
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
      if (event.key === "lang") preloadLang.sync(event.newValue || undefined);
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
      if (!modal || !msgEl || !okBtn || !cancelBtn) return Promise.resolve(false);

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

  function createRendererProjectorSync({ getAppConfig, getExcelData, postToProjector, postToIframe, extension }) {
    const rendererExtension = extension || {};

    function sendContent(type, content) {
      const data = { type, content };
      postToIframe(data);
      postToProjector(data);
    }

    function sendInitialData(createTitlePayload) {
      const appConfig = getAppConfig();
      const excelData = getExcelData();
      if (!appConfig || !excelData) return;
      sendContent("config", appConfig);
      sendContent("title", createTitlePayload(appConfig, excelData));
      if (typeof rendererExtension.afterSendInitialData === "function") {
        rendererExtension.afterSendInitialData({ sendContent, appConfig, excelData });
      }
    }

    return {
      sendContent,
      sendInitialData
    };
  }

  function isAllowedFrameMessage(event, frameWindow) {
    if (!frameWindow || event.source !== frameWindow) return false;
    const ownOrigin = window.location.origin;
    return event.origin === ownOrigin || event.origin === "null" || event.origin === "file://";
  }

  function createBattleRuntime({ rendererExtension, projectorExtension }) {
    const cssTheme = window.KuawaseCssTheme.createCssThemeRuntime();
    const helpers = window.KuawaseMatchHelpers;
    const projectorSync = createRendererProjectorSync({
      getAppConfig: () => window.appConfig,
      getExcelData: () => window.excelData,
      postToProjector: (data) => {
        window.electron.invoke("send-data-to-projector", data).catch(console.error);
      },
      postToIframe: (data) => {
        const iframe = document.getElementById("slide-frame");
        if (iframe && iframe.contentWindow && iframe.contentDocument?.readyState === "complete") {
          iframe.contentWindow.postMessage({ type: "config", content: window.appConfig }, "*");
          iframe.contentWindow.postMessage(data, "*");
        }
      },
      extension: projectorExtension
    });

    async function readCssThemePreference() {
      return cssTheme.readCssThemePreference();
    }

    function resolveIframeCssValue(cssThemeValue) {
      return typeof window.__kuawaseResolveIframeCss === "function"
        ? window.__kuawaseResolveIframeCss(cssThemeValue)
        : cssThemeValue;
    }

    async function applyCurrentCssToIframe() {
      try {
        const cssThemeValue = await readCssThemePreference();
        cssTheme.applyCssToIframe(resolveIframeCssValue(cssThemeValue));
      } catch {}
    }

    async function changeIframeSrc(src) {
      helpers.updateHikouPanelVisibility(src);
      try {
        if (typeof window.playHikouWithTemporaryVolume === "function") {
          window.playHikouWithTemporaryVolume(0);
        }
      } catch (error) {
        console.warn("[renderer.browser] hikou preview failed", error);
      }

      const iframe = document.getElementById("slide-frame");
      if (!iframe) return;
      iframe.onload = async () => {
        projectorSync.sendInitialData(helpers.createTitlePayload);
        await applyCurrentCssToIframe();
      };

      const cssThemeValue = await readCssThemePreference();
      const iframeCssValue = resolveIframeCssValue(cssThemeValue);
      let targetSrc = src;
      if (typeof rendererExtension.transformIframeSrc === "function") {
        targetSrc = await rendererExtension.transformIframeSrc({ src, cssTheme, cssThemeValue });
      }
      targetSrc = cssTheme.buildSrcWithCssParam(targetSrc, iframeCssValue);
      iframe.src = targetSrc;
      try {
        cssTheme.applyCssToIframe(iframeCssValue);
      } catch {}

      window.electron.invoke("change-projector-src", targetSrc).catch((error) => {
        console.error("[renderer.browser] projector change failed", error);
      });
    }

    async function showHaiku(side) {
      const data = await window.electron.invoke("get-excel-data");
      const matchIndex = helpers.getMatchIndexFromIframe();
      const teamKey = side === "red" ? window.appConfig.redTeam : window.appConfig.whiteTeam;
      const kendaiKey = window.appConfig.kendai;
      const haikuCellKey = helpers.getHaikuCellKey(teamKey, kendaiKey, matchIndex);
      const haikuData = data[haikuCellKey] || "データなし";
      projectorSync.sendContent(side, { [haikuCellKey]: haikuData });
    }

    function sendInitialDataToIframe() {
      projectorSync.sendInitialData(helpers.createTitlePayload);
    }

    function installIframeReadySync() {
      if (window.__kuawaseBattleIframeReadySyncInstalled) return;
      window.__kuawaseBattleIframeReadySyncInstalled = true;
      window.addEventListener("message", (event) => {
        const iframe = document.getElementById("slide-frame");
        if (isAllowedFrameMessage(event, iframe?.contentWindow) && event.data?.type === "ready") {
          sendInitialDataToIframe();
          applyCurrentCssToIframe();
        }
      });
    }

    function setupIframeSync() {
      const iframe = document.getElementById("slide-frame");
      if (iframe) {
        iframe.onload = async () => {
          sendInitialDataToIframe();
          await applyCurrentCssToIframe();
        };
      }
      installIframeReadySync();
    }

    return {
      changeIframeSrc,
      sendContent: projectorSync.sendContent,
      sendInitialData: sendInitialDataToIframe,
      setupIframeSync,
      showRedHaiku: () => showHaiku("red"),
      showWhiteHaiku: () => showHaiku("white"),
      updateHikouPanelVisibility: helpers.updateHikouPanelVisibility
    };
  }

  function bindPageControls(runtime) {
    const pageControls = document.getElementById("page-controls");
    if (!pageControls) return;
    const buttons = Array.from(pageControls.querySelectorAll("button[onclick]"));
    buttons.forEach((button) => {
      const onclickValue = button.getAttribute("onclick") || "";
      const match = onclickValue.match(/changeIframeSrc\('([^']+)'\)/);
      if (!match) return;
      const targetSrc = match[1];
      button.removeAttribute("onclick");
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await runtime.changeIframeSrc(targetSrc);
        } catch (error) {
          console.error("[renderer.browser] changeIframeSrc failed", error);
        }
      });
    });
  }

  function bindBattleButtons(runtime) {
    const showRedBtn = document.getElementById("showRed");
    if (showRedBtn) {
      showRedBtn.addEventListener("click", async () => {
        try {
          if (typeof window.audio_hikou === "function") await window.audio_hikou();
          await runtime.showRedHaiku();
        } catch (error) {
          console.error("[renderer.browser] showRed failed", error);
        }
      });
    }

    const showWhiteBtn = document.getElementById("showWhite");
    if (showWhiteBtn) {
      showWhiteBtn.addEventListener("click", async () => {
        try {
          if (typeof window.audio_hikou === "function") await window.audio_hikou();
          await runtime.showWhiteHaiku();
        } catch (error) {
          console.error("[renderer.browser] showWhite failed", error);
        }
      });
    }
  }

  function resolveExtensions(config) {
    if (config.appKey === "khb-kuawase") {
      return {
        rendererExtension: window.KhbRendererExtension || createNoopRendererExtension(),
        projectorExtension: window.KhbRendererProjectorExtension || createNoopProjectorExtension()
      };
    }
    return {
      rendererExtension: createNoopRendererExtension(),
      projectorExtension: createNoopProjectorExtension()
    };
  }

  function createMigratedRendererBrowserApp(config) {
    const preloadLang = createPreloadLanguageRuntime();
    installLanguageRuntime(preloadLang);
    installConfirmRuntime();

    const ui = window.KuawaseBattlePageUi;
    const extensions = resolveExtensions(config || {});
    const rendererExtension = extensions.rendererExtension;
    const projectorExtension = extensions.projectorExtension;
    const battleRuntime = createBattleRuntime({ rendererExtension, projectorExtension });

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
      if (typeof window.t === "function") return window.t(key) || fallback || key;
      return preloadLang.t(key) || fallback || key;
    }

    function translate(key) {
      return typeof window.t === "function" ? window.t(key) : preloadLang.t(key);
    }

    window.showToast = ui.showToast;
    window.showToastAndReload = ui.showToastAndReload;
    window.changeIframeSrc = battleRuntime.changeIframeSrc;
    window.sendContent = battleRuntime.sendContent;
    window.sendInitialData = battleRuntime.sendInitialData;
    window.showRedHaiku = battleRuntime.showRedHaiku;
    window.showWhiteHaiku = battleRuntime.showWhiteHaiku;
    console.log("[renderer.browser] loaded");

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
      if (event.target === gsModal) gsModal.style.display = "none";
    });

    document.getElementById("reset-excel-only-btn")?.addEventListener("click", async () => {
      await ensureLangReady();
      const ok = typeof window.showConfirm === "function"
        ? await window.showConfirm("excel-only-reset-confirm")
        : true;
      if (!ok) {
        const cancelMsg = await resolveMessage("excel-only-reset-cancel");
        ui.showToast(cancelMsg, true);
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
        await ui.updateExcelData();
        const successMsg = await resolveMessage("excel-only-reset-success");
        ui.showToastAndReload(successMsg);
      } catch (error) {
        console.error("Excel-only reset failed", error);
        const failMsg = await resolveMessage("excel-only-reset-fail");
        ui.showToast(failMsg, true);
      }
    });

    const refreshMatchSelectorsAfterDataLoad = async () => {
      ui.populateMatchSelectors(window.excelData || {});
      await ui.restoreMatchConfig();
    };

    document.getElementById("excel-select-btn")?.addEventListener("click", async () => {
      const picked = await window.electron.invoke("select-excel-file");
      if (picked?.canceled || !picked?.filePath) return;
      await ensureLangReady();
      await ui.loadExcelFile(picked.filePath, {
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
      await ui.loadExcelFile(filePath, {
        t: translate,
        onUpdated: refreshMatchSelectorsAfterDataLoad
      });
    });

    document.getElementById("load-gs-btn")?.addEventListener("click", async () => {
      const urlInput = document.getElementById("gs-url-input");
      const url = urlInput?.value || "";
      await ensureLangReady();
      await ui.loadGoogleSheet(url, {
        t: translate,
        closeModal: () => {
          if (gsModal) gsModal.style.display = "none";
          if (urlInput) urlInput.value = "";
        },
        onUpdated: refreshMatchSelectorsAfterDataLoad
      });
    });

    document.getElementById("saveMatchConfig")?.addEventListener("click", async () => {
      const result = await ui.saveMatchConfig(window.appConfig || {});
      if (result.success) {
        const msg = await resolveMessage("save-success");
        ui.showToastAndReload(msg);
      }
    });

    async function initDomReady() {
      bindPageControls(battleRuntime);
      battleRuntime.setupIframeSync();
      bindBattleButtons(battleRuntime);

      window.appConfig = await window.electron.invoke("get-config");
      window.excelData = await ui.updateExcelData();
      ui.populateMatchSelectors(window.excelData || {});
      await ui.restoreMatchConfig();

      if (typeof rendererExtension.initTopHtmlControls === "function") {
        await rendererExtension.initTopHtmlControls({
          showConfirm: (...args) => window.showConfirm?.(...args),
          showToast: ui.showToast,
          t: (...args) => translate(args[0])
        });
      }

      const configFromDisk = await window.electron.invoke("get-config");
      const lastExcelFileSpan = document.getElementById("last-excel-file");
      if (lastExcelFileSpan) {
        if (configFromDisk?.lastExcelFile) {
          lastExcelFileSpan.textContent = configFromDisk.lastExcelFile;
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

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        initDomReady().catch((error) => console.error("[renderer.browser] init failed", error));
      }, { once: true });
    } else {
      initDomReady().catch((error) => console.error("[renderer.browser] init failed", error));
    }
  }

  window.KuawaseMigratedRendererBrowserApp = {
    createMigratedRendererBrowserApp
  };
})();
