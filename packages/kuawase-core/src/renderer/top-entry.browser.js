(function () {
  function createNoopTopExtension() {
    return {
      allowMessageEvent() {
        return true;
      },
      handlePayload() {},
      async initBeforeTitleLoad() {},
      async initAfterTitleLoad() {}
    };
  }

  function runWhenDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function createTopRuntime(extension) {
    const topExtension = extension || createNoopTopExtension();
    let lastTitleData = null;
    let titleWaiters = [];

    function renderTitle(data) {
      if (!data) return;
      const el = document.getElementById("Compe-name");
      if (el) {
        el.textContent = data.compename || "";
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
        console.error("[top-entry.browser] fallback excel read failed:", error);
      }

      if (!compename) compename = "データなし";
      renderTitle({ compename });
    }

    function applyThemeValue(themeName) {
      if (typeof window.applyTheme === "function") {
        window.applyTheme(themeName);
      }
    }

    function applyCssThemeValue(raw) {
      if (typeof window.installCssThemeRuntime === "function") {
        window.installCssThemeRuntime(window, document);
      }
      if (typeof window.applyCssThemeValue === "function") {
        return window.applyCssThemeValue(raw);
      }
      return Promise.resolve(false);
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
        topExtension.handlePayload({
          type,
          content,
          renderTitle,
          getLastTitleData: () => lastTitleData
        });
      }
    }

    function isAllowedParentMessage(event) {
      if (window.parent === window || event.source !== window.parent) return false;
      const ownOrigin = window.location.origin;
      return event.origin === ownOrigin || event.origin === "null" || event.origin === "file://";
    }

    async function initDomReady() {
      if (typeof topExtension.initBeforeTitleLoad === "function") {
        await topExtension.initBeforeTitleLoad({
          renderTitle,
          getLastTitleData: () => lastTitleData
        });
      }

      if (window.parent !== window) {
        window.parent.postMessage({ type: "ready" }, "*");
      }

      const receivedTitle = await waitForTitlePayload();
      if (!receivedTitle && !lastTitleData) {
        await loadFallbackTitle();
      }

      try {
        applyThemeValue(window.localStorage?.getItem("theme") || "Gray");
      } catch {
        applyThemeValue("Gray");
      }

      if (typeof topExtension.initAfterTitleLoad === "function") {
        await topExtension.initAfterTitleLoad({
          renderTitle,
          getLastTitleData: () => lastTitleData
        });
      }
    }

    function init() {
      window.addEventListener("message", (event) => {
        if (!isAllowedParentMessage(event)) {
          return;
        }
        if (typeof topExtension.allowMessageEvent === "function" && !topExtension.allowMessageEvent(event)) {
          return;
        }
        if (!event.data) return;
        const { type, content } = event.data;
        handlePayload(type, content);
      });

      if (window.electron?.receive) {
        window.electron.receive("update-content", (data) => {
          if (!data) return;
          const { type, content } = data;
          handlePayload(type, content);
        });
      }

      runWhenDomReady(() => {
        initDomReady().catch((error) => {
          console.error("[top-entry.browser] init failed", error);
        });
      });
    }

    return {
      init,
      renderTitle
    };
  }

  const runtime = createTopRuntime(window.KuawaseTopExtension || createNoopTopExtension());
  window.KuawaseTopRuntime = runtime;
  runtime.init();
})();
