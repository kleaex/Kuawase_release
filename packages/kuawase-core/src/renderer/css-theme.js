const DEFAULT_CSS_THEME = "battle.css";
const CSS_THEME_STORAGE_KEY = "battle-css-file";

function sanitizeCssFilename(file) {
  if (file.startsWith("user:")) {
    const name = file.slice(5);
    if (/^[\w.-]+\.css$/.test(name)) {
      return { type: "user", name };
    }
  } else if (/^[\w.-]+\.css$/.test(file)) {
    return { type: "builtin", name: file };
  }
  return { type: "builtin", name: DEFAULT_CSS_THEME };
}

async function readCssThemePreference(windowObject) {
  const w = windowObject || (typeof window !== "undefined" ? window : null);
  let cssThemeValue = DEFAULT_CSS_THEME;

  try {
    cssThemeValue = w?.localStorage?.getItem(CSS_THEME_STORAGE_KEY) || cssThemeValue;
  } catch {}

  try {
    if (w?.electron?.invoke) {
      const cfg = await w.electron.invoke("get-config");
      if (cfg?.cssTheme) cssThemeValue = cfg.cssTheme;
    }
  } catch {}

  return cssThemeValue;
}

function createCssThemeRuntime() {
  const cssHrefCache = new Map();

  async function resolveCssHref(file) {
    const sanitized = sanitizeCssFilename(file);
    if (sanitized.type === "user") {
      if (cssHrefCache.has(sanitized.name)) return cssHrefCache.get(sanitized.name);
      try {
        const resolvedPath = await window.electron.invoke("get-user-style-path", sanitized.name);
        if (resolvedPath) {
          cssHrefCache.set(sanitized.name, resolvedPath);
          return resolvedPath;
        }
      } catch {}
      return "css/battle.css";
    }
    return `css/${sanitized.name}`;
  }

  function buildSrcWithCssParam(src, cssHref) {
    const [base, query] = src.split("?");
    const params = new URLSearchParams(query || "");
    if (cssHref) params.set("css", cssHref);
    const q = params.toString();
    return q ? `${base}?${q}` : base;
  }

  function applyCssToIframe(file) {
    const iframe = document.getElementById("slide-frame");
    if (!iframe) return;

    const swap = () => {
      try {
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc?.head) return false;
        const sanitized = sanitizeCssFilename(file);
        const activeLink = doc.getElementById("active-style") || doc.querySelector('link[rel="stylesheet"]');
        const ensureActiveLink = () => {
          if (activeLink) return activeLink;
          const link = doc.createElement("link");
          link.rel = "stylesheet";
          link.id = "active-style";
          doc.head.appendChild(link);
          return link;
        };
        const ensureUserLink = () => {
          let link = doc.getElementById("user-style");
          if (!link) {
            link = doc.createElement("link");
            link.rel = "stylesheet";
            link.id = "user-style";
            doc.head.appendChild(link);
          }
          return link;
        };
        const removeUserLink = () => {
          const link = doc.getElementById("user-style");
          if (link?.parentNode) link.parentNode.removeChild(link);
        };

        if (sanitized.type === "user") {
          ensureActiveLink().href = "css/battle.css";
          resolveCssHref(file)
            .then((href) => {
              ensureUserLink().href = href;
            })
            .catch(() => removeUserLink());
          return true;
        }

        removeUserLink();
        resolveCssHref(file)
          .then((href) => {
            ensureActiveLink().href = href;
          })
          .catch(() => {
            ensureActiveLink().href = "css/battle.css";
          });
        return true;
      } catch (error) {
        console.error("CSS切替失敗", error);
        return false;
      }
    };

    swap();
    if (iframe.contentDocument?.readyState !== "complete") {
      iframe.addEventListener("load", swap, { once: true });
    }
  }

  return {
    applyCssToIframe,
    buildSrcWithCssParam,
    readCssThemePreference: () => readCssThemePreference(window),
    resolveCssHref,
    sanitizeCssFilename
  };
}

var KuawaseCssTheme = {
  createCssThemeRuntime,
  readCssThemePreference,
  sanitizeCssFilename
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = KuawaseCssTheme;
}

if (typeof window !== "undefined") {
  window.KuawaseCssTheme = KuawaseCssTheme;
}
