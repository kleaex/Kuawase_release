(function () {
  function runWhenDomReady(callback) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", callback, { once: true });
      return;
    }
    callback();
  }

  function getSafeSetHtml() {
    if (typeof window.safeSetHTML === "function") return window.safeSetHTML;
    return function fallbackSafeSetHtml(element, value) {
      if (element) element.textContent = value || "";
    };
  }

  function applyCssThemeSafely(content) {
    if (!content) return Promise.resolve(false);
    if (typeof window.applyCssThemeValue === "function") {
      return Promise.resolve(window.applyCssThemeValue(content));
    }
    if (window.CommonTheme?.applyCssTheme) {
      return Promise.resolve(window.CommonTheme.applyCssTheme(content));
    }
    return Promise.resolve(false);
  }

  function applyThemeSafely(content) {
    if (!content) return;
    if (typeof window.applyTheme === "function") {
      window.applyTheme(content);
      return;
    }
    if (window.CommonTheme?.applyTheme) {
      window.CommonTheme.applyTheme(content);
    }
  }

  function getLocalPostMessageTargetOrigin() {
    if (window.location?.protocol === "file:") return "*";
    const origin = window.location?.origin;
    return origin && origin !== "null" ? origin : "*";
  }

  function createBattlePageRuntime() {
    const safeSetHtml = getSafeSetHtml();
    let lastTitleData = null;
    let relayoutTimer = null;

    function renderTitle(data) {
      if (!data) return;

      const compName = document.getElementById("Compe-name");
      if (compName) compName.textContent = data.compename || "";

      let kendai = data.kendaiName || "";
      const lang = window.getCurrentLang ? window.getCurrentLang() : localStorage.getItem("lang") || "ja";
      if (kendai) {
        if (lang === "ja") {
          kendai = `「${kendai}」`;
        } else if (lang === "en") {
          kendai = `"${kendai}"`;
        }
      }

      const kendaiEl = document.getElementById("kendai");
      if (kendaiEl) kendaiEl.textContent = kendai;

      const redTeam = document.getElementById("redTeam");
      if (redTeam) redTeam.textContent = data.redTeamName || "";

      const whiteTeam = document.getElementById("whiteTeam");
      if (whiteTeam) whiteTeam.textContent = data.whiteTeamName || "";

      const gameid = document.getElementById("gameid");
      if (gameid && data.matchTitle) safeSetHtml(gameid, data.matchTitle);
    }

    function addFadeIn(element) {
      if (!element) return;
      element.classList.remove("fade-in");
      void element.offsetWidth;
      element.classList.add("fade-in");
    }

    function firstContentValue(content) {
      if (!content || typeof content !== "object") return "";
      return Object.values(content)[0] || "";
    }

    function renderHaiku(elementId, content) {
      const element = document.getElementById(elementId);
      addFadeIn(element);
      safeSetHtml(element, firstContentValue(content));
      queueHaikuRelayout();
    }

    function handlePayload(data) {
      if (!data) return;
      const { type, content } = data;

      if (type === "config") {
        window.appConfig = content || {};
        if (lastTitleData) renderTitle(lastTitleData);
      } else if (type === "title") {
        lastTitleData = content;
        renderTitle(content);
      } else if (type === "red") {
        renderHaiku("redHaiku", content);
      } else if (type === "white") {
        renderHaiku("whiteHaiku", content);
      } else if (type === "theme") {
        applyThemeSafely(content);
      } else if (type === "css-theme") {
        applyCssThemeSafely(content);
      }
    }

    function getAvailableHeight(element) {
      const parent = element.closest(".poem-panel");
      if (parent) {
        const parentHeight = parent.clientHeight;
        const heading = parent.querySelector("h3, h4");
        const headingHeight = heading ? heading.offsetHeight : 0;
        return parentHeight - headingHeight - 40;
      }
      return 200;
    }

    function applyVerticalLayout(elementId, containerHeight) {
      const element = document.getElementById(elementId);
      if (!element) return;
      element.classList.add("auto-vertical");

      const availableHeight = containerHeight || getAvailableHeight(element);
      const text = element.textContent.replace(/\r?\n/g, "").trim();

      element.style.letterSpacing = "0px";
      element.style.transform = "none";

      const charCount = Array.from(text).length;
      const naturalHeight = element.getBoundingClientRect().height;

      if (naturalHeight > availableHeight + 0.5) {
        const scale = availableHeight / naturalHeight;
        element.style.transform = `scaleY(${scale})`;
        return;
      }

      if (charCount > 1) {
        const gaps = charCount - 1;
        let spacing = (availableHeight - naturalHeight) / gaps;
        element.style.letterSpacing = `${spacing}px`;
        const adjustedHeight = element.getBoundingClientRect().height;
        if (Math.abs(adjustedHeight - availableHeight) > 0.5 && adjustedHeight > 0) {
          const adjust = availableHeight / adjustedHeight;
          spacing *= adjust;
          element.style.letterSpacing = `${spacing}px`;
        }
      }
    }

    function applyHaikuLayout() {
      for (const id of ["redHaiku", "whiteHaiku"]) {
        const element = document.getElementById(id);
        if (element && element.textContent.trim()) {
          applyVerticalLayout(id, getAvailableHeight(element));
        }
      }
    }

    function queueHaikuRelayout() {
      if (relayoutTimer) window.clearTimeout(relayoutTimer);
      relayoutTimer = window.setTimeout(() => {
        applyHaikuLayout();
        relayoutTimer = null;
      }, 80);
    }

    function isEmbeddedInParentFrame() {
      try {
        return window.parent && window.parent !== window;
      } catch {
        return false;
      }
    }

    function initTheme() {
      // When embedded in the admin preview iframe, the parent window applies
      // #active-style/#user-style directly (custom-css-bridge.js), including any
      // KHB-only admin-preview-only override. Self-applying the base/proj CSS here
      // would race with (and usually win over) that override.
      const isEmbedded = isEmbeddedInParentFrame();

      if (window.CommonTheme) {
        window.CommonTheme.setupThemeHandlers?.();
        window.CommonTheme.initThemeFromStorage?.({ defaultTheme: "gray", applyCssFromConfig: !isEmbedded });
        return;
      }

      applyThemeSafely(localStorage.getItem("theme") || "gray");
      if (isEmbedded) return;
      (async () => {
        try {
          let cssTheme = localStorage.getItem("battle-css-file") || "battle.css";
          if (window.electron?.invoke) {
            const cfg = await window.electron.invoke("get-config");
            if (cfg?.cssTheme) cssTheme = cfg.cssTheme;
          }
          await applyCssThemeSafely(cssTheme);
        } catch {}
      })();
    }

    function init() {
      window.appConfig = window.appConfig || {};

      window.addEventListener("message", (event) => {
        if (window.parent === window || event.source !== window.parent) return;
        if (!event.data) return;
        // Reaching here means this page is embedded in the admin preview iframe (the real
        // projector window receives updates via IPC below, not postMessage). The parent owns
        // #active-style/#user-style directly for that iframe, so skip re-applying css-theme
        // pushes here to avoid clobbering any KHB-only admin-preview-only override.
        if (event.data.type === "css-theme") return;
        handlePayload(event.data);
      });

      if (window.electron?.receive) {
        window.electron.receive("update-content", handlePayload);
      }

      safeSetHtml(document.getElementById("gameid"), "Undefined");
      window.parent.postMessage({ type: "ready" }, getLocalPostMessageTargetOrigin());

      runWhenDomReady(() => {
        initTheme();
        window.setTimeout(applyHaikuLayout, 150);
      });

      window.addEventListener("resize", queueHaikuRelayout);
    }

    return {
      init,
      renderTitle,
      applyHaikuLayout,
      queueHaikuRelayout
    };
  }

  if (window.KuawaseBattlePageRuntime?.__installed) return;
  const runtime = createBattlePageRuntime();
  runtime.__installed = true;
  window.KuawaseBattlePageRuntime = runtime;
  runtime.init();
})();
