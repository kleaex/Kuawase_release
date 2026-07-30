const { createCssThemeRuntime } = require("./css-theme");
const { createTitlePayload, getHaikuCellKey, getMatchIndexFromIframe, updateHikouPanelVisibility } = require("./match-helpers");
const { createRendererProjectorSync } = require("./projector-sync");

function createBattleRenderer({ extension, projectorExtension } = {}) {
  const cssTheme = createCssThemeRuntime();
  const rendererExtension = extension || {};
  const rendererProjectorExtension = projectorExtension || {};

  function createRuntime() {
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
      extension: rendererProjectorExtension
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
      updateHikouPanelVisibility(src);
      try {
        if (typeof window.playHikouWithTemporaryVolume === "function") {
          window.playHikouWithTemporaryVolume(0);
        }
      } catch (error) {
        console.warn("[battle-renderer] hikou preview failed", error);
      }

      const iframe = document.getElementById("slide-frame");
      if (!iframe) return;
      iframe.onload = async () => {
        projectorSync.sendInitialData(createTitlePayload);
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
        console.error("[battle-renderer] projector change failed", error);
      });
    }

    async function showHaiku(side) {
      const data = await window.electron.invoke("get-excel-data");
      const matchIndex = getMatchIndexFromIframe();
      const teamKey = side === "red" ? window.appConfig.redTeam : window.appConfig.whiteTeam;
      const kendaiKey = window.appConfig.kendai;
      const haikuCellKey = getHaikuCellKey(teamKey, kendaiKey, matchIndex);
      const haikuData = data[haikuCellKey] || "データなし";
      projectorSync.sendContent(side, { [haikuCellKey]: haikuData });
    }

    function sendInitialDataToIframe() {
      projectorSync.sendInitialData(createTitlePayload);
    }

    function installIframeReadySync() {
      if (window.__kuawaseBattleIframeReadySyncInstalled) return;
      window.__kuawaseBattleIframeReadySyncInstalled = true;
      window.addEventListener("message", (event) => {
        const iframe = document.getElementById("slide-frame");
        if (event.source === iframe?.contentWindow && event.data?.type === "ready") {
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
      applyCssToIframe: cssTheme.applyCssToIframe,
      buildSrcWithCssParam: cssTheme.buildSrcWithCssParam,
      changeIframeSrc,
      resolveCssHref: cssTheme.resolveCssHref,
      sanitizeCssFilename: cssTheme.sanitizeCssFilename,
      sendContent: projectorSync.sendContent,
      sendInitialData: sendInitialDataToIframe,
      setupIframeSync,
      showRedHaiku: () => showHaiku("red"),
      showWhiteHaiku: () => showHaiku("white"),
      updateHikouPanelVisibility
    };
  }

  return {
    createRuntime
  };
}

module.exports = {
  createBattleRenderer
};
