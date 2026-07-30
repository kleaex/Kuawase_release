const { applyThemeToDocument } = require("./color");
const { readCssThemePreference } = require("./css-theme");
const { installCssThemeRuntime } = require("./css-theme-runtime");

function createTopPageRuntime({ extension }) {
  const topExtension = extension || {};
  let lastTitleData = null;
  let titleWaiters = [];

  function renderTitle(data) {
    if (!data) return;
    const el = document.getElementById("Compe-name");
    if (el) {
      el.textContent = data.compename || "";
    }
  }

  function applyThemeValue(themeName) {
    applyThemeToDocument(themeName, document, window.localStorage);
  }

  function applyCssThemeValue(raw) {
    if (isEmbeddedFrame()) {
      return Promise.resolve(false);
    }
    installCssThemeRuntime(window, document);
    if (typeof window.applyCssThemeValue === "function") {
      return window.applyCssThemeValue(raw);
    }
    return Promise.resolve(false);
  }

  function isEmbeddedFrame() {
    try {
      return window.parent && window.parent !== window;
    } catch {
      return false;
    }
  }

  function handlePayload(type, content) {
    if (type === "title" && content) {
      lastTitleData = content;
      renderTitle(content);
      notifyTitleWaiters();
      return;
    }
    if (type === "theme") {
      applyThemeValue(content);
      return;
    }
    if (type === "css-theme") {
      applyCssThemeValue(content);
      return;
    }
    if (typeof topExtension.handlePayload === "function") {
      topExtension.handlePayload({ type, content, renderTitle, getLastTitleData: () => lastTitleData });
    }
  }

  function notifyTitleWaiters() {
    const waiters = titleWaiters;
    titleWaiters = [];
    waiters.forEach((resolve) => resolve(true));
  }

  function waitForTitlePayload(timeoutMs = 500) {
    if (lastTitleData) return Promise.resolve(true);

    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        titleWaiters = titleWaiters.filter((waiter) => waiter !== complete);
        resolve(false);
      }, timeoutMs);

      function complete() {
        window.clearTimeout(timer);
        resolve(true);
      }

      titleWaiters.push(complete);
    });
  }

  async function loadFallbackTitle() {
    let compename = "";
    try {
      if (window.electron?.invoke) {
        const excelData = await window.electron.invoke("get-excel-data");
        compename = excelData["B1"] || "";
      }
    } catch (error) {
      console.error("[common-top] fallback excel read failed:", error);
    }

    if (!compename) compename = "データなし";
    renderTitle({ compename });
  }

  async function initThemeFromState() {
    let theme = "Gray";
    try {
      theme = window.localStorage?.getItem("theme") || theme;
    } catch {}
    applyThemeValue(theme);

    if (!isEmbeddedFrame()) {
      await applyCssThemeValue(await readCssThemePreference(window));
    }
  }

  async function initDomReady() {
    if (typeof topExtension.initBeforeTitleLoad === "function") {
      await topExtension.initBeforeTitleLoad({ renderTitle, getLastTitleData: () => lastTitleData });
    }

    window.parent.postMessage({ type: "ready" }, "*");

    const receivedTitle = await waitForTitlePayload();
    if (!receivedTitle && !lastTitleData) {
      await loadFallbackTitle();
    }

    await initThemeFromState();

    if (typeof topExtension.initAfterTitleLoad === "function") {
      await topExtension.initAfterTitleLoad({ renderTitle, getLastTitleData: () => lastTitleData });
    }
  }

  function init() {
    window.appConfig = window.appConfig || {};

    window.addEventListener("message", (event) => {
      if (typeof topExtension.allowMessageEvent === "function" && !topExtension.allowMessageEvent(event)) {
        return;
      }
      if (!event.data) return;
      const { type, content } = event.data;
      handlePayload(type, content);
    });

    if (window.electron?.receive) {
      window.electron.receive("update-content", (data) => {
        const { type, content } = data;
        handlePayload(type, content);
      });
    }

    document.addEventListener("DOMContentLoaded", initDomReady);
  }

  return {
    init,
    renderTitle
  };
}

module.exports = {
  createTopPageRuntime
};
