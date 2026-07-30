(() => {
  const DEFAULT_CSS = "css/battle.css";
  const USER_STYLE_ID = "user-style";

  function isDirectCssHref(val) {
    // Only allow css/ paths with a safe filename; never allow arbitrary file:// URLs
    if (typeof val !== "string") return false;
    if (!val.startsWith("css/")) return false;
    const name = val.slice(4);
    return /^[\w.-]+\.css$/.test(name);
  }

  function isSafeCssHref(href) {
    if (typeof href !== "string") return false;
    // Allow css/ paths and IPC-resolved file:// user styles
    if (/^css\/[\w.-]+\.css$/.test(href)) return true;
    return /^file:\/\/.+\.css$/i.test(href);
  }

  function sanitizeCssThemeValue(val) {
    if (typeof val !== "string") return null;
    // Direct hrefs must be css/ + safe filename
    if (isDirectCssHref(val)) return { type: "direct", href: val };
    if (val.startsWith("user:")) {
      const name = val.slice(5);
      if (/^[\w.-]+\.css$/.test(name)) return { type: "user", name };
      return null;
    }
    if (/^[\w.-]+\.css$/.test(val)) return { type: "builtin", name: val };
    return null;
  }

  async function resolveCssHref(val) {
    const parsed = sanitizeCssThemeValue(val);
    if (!parsed) return { href: DEFAULT_CSS, type: "fallback" };
    if (parsed.type === "direct") return { href: parsed.href, type: "direct" };
    if (parsed.type === "builtin") return { href: `css/${parsed.name}`, type: "builtin" };
    if (parsed.type === "user") {
      try {
        if (window.electron?.invoke) {
          const p = await window.electron.invoke("get-user-style-path", parsed.name);
          if (p && isSafeCssHref(p)) return { href: p, type: "user" };
        }
      } catch {}
      return { href: DEFAULT_CSS, type: "fallback" };
    }
    return { href: DEFAULT_CSS, type: "fallback" };
  }

  function ensureUserLink() {
    let link = document.getElementById(USER_STYLE_ID);
    if (!link && document.head) {
      link = document.createElement("link");
      link.id = USER_STYLE_ID;
      link.rel = "stylesheet";
      document.head.appendChild(link);
    }
    return link;
  }

  function removeUserLink() {
    const link = document.getElementById(USER_STYLE_ID);
    if (link?.parentNode) link.parentNode.removeChild(link);
  }

  async function applyCssTheme(val) {
    const link = document.getElementById("active-style");
    if (!link) return;
    const resolved = await resolveCssHref(val);
    const href = isSafeCssHref(resolved.href) ? resolved.href : DEFAULT_CSS;
    if (resolved.type === "user") {
      link.setAttribute("href", DEFAULT_CSS);
      const userLink = ensureUserLink();
      if (userLink) userLink.setAttribute("href", href);
      return;
    }
    removeUserLink();
    link.setAttribute("href", href);
  }

  function applyTheme(val) {
    if (window.applyTheme && val) window.applyTheme(val);
  }

  function isAllowedParentMessage(event) {
    if (window.parent === window || event.source !== window.parent) return false;
    const ownOrigin = window.location.origin;
    return event.origin === ownOrigin || event.origin === "null" || event.origin === "file://";
  }

  function setupThemeHandlers() {
    window.addEventListener("message", (event) => {
      if (!isAllowedParentMessage(event)) return;
      if (event.data?.type === "theme") applyTheme(event.data.content ?? event.data.theme);
      // "css-theme" is intentionally NOT applied here. This branch only ever runs when the
      // page is embedded in an iframe (see isAllowedParentMessage), and for the admin preview
      // iframe the parent window owns #active-style/#user-style directly (custom-css-bridge.js),
      // including any KHB-only admin-preview-only override. Re-applying the pushed value here
      // would silently overwrite that override with the base/proj value.
    });
    if (window.electron?.receive) {
      window.electron.receive("update-content", (data) => {
        if (data?.type === "theme") applyTheme(data.content);
        if (data?.type === "css-theme") applyCssTheme(data.content);
      });
    }
  }

  async function initThemeFromStorage(options = {}) {
    const { defaultTheme = "yellow", applyCssFromConfig = true } = options;
    const theme = localStorage.getItem("theme") || defaultTheme;
    applyTheme(theme);
    if (!applyCssFromConfig) return;
    let cssTheme = localStorage.getItem("battle-css-file") || "battle.css";
    try {
      if (window.electron?.invoke) {
        const cfg = await window.electron.invoke("get-config");
        if (cfg?.cssTheme) cssTheme = cfg.cssTheme;
      }
    } catch {}
    await applyCssTheme(cssTheme);
  }

  window.CommonTheme = {
    setupThemeHandlers,
    initThemeFromStorage,
    applyCssTheme,
    applyTheme
  };
})();
