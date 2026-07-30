'use strict';

function installCssThemeRuntime(windowObject, documentObject) {
  const w = windowObject || (typeof window !== "undefined" ? window : null);
  const d = documentObject || (typeof document !== "undefined" ? document : null);
  if (!w || !d) return;
  if (w.__cssThemeRuntimeInstalled) return;
  w.__cssThemeRuntimeInstalled = true;

  const CSS_DIR = "css/";
  const FALLBACK_NAME = "battle.css";
  const FALLBACK_PATH = CSS_DIR + FALLBACK_NAME;
  const STORAGE_KEY = "battle-css-file";
  const USER_PATH_KEY = "battle-user-css-paths";
  const USER_STYLE_ID = "user-style";
  let userPathCache = null;

  function safeRead(key) {
    try {
      return w.localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeWrite(key, value) {
    try {
      w.localStorage.setItem(key, value);
    } catch (err) {
      /* noop */
    }
  }

  function loadUserPaths() {
    if (userPathCache) return userPathCache;
    userPathCache = {};
    const raw = safeRead(USER_PATH_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          userPathCache = parsed;
        }
      } catch (err) {
        userPathCache = {};
      }
    }
    return userPathCache;
  }

  function persistUserPaths() {
    if (!userPathCache) return;
    safeWrite(USER_PATH_KEY, JSON.stringify(userPathCache));
  }

  function sanitizeValue(raw) {
    if (typeof raw !== "string") {
      return { type: "builtin", name: FALLBACK_NAME, value: FALLBACK_NAME };
    }
    const value = raw.trim();
    if (value.startsWith("user:")) {
      const name = value.slice(5);
      if (/^[\w\-.]+\.css$/.test(name)) {
        return { type: "user", name, value: `user:${name}` };
      }
    } else if (/^[\w\-.]+\.css$/.test(value)) {
      return { type: "builtin", name: value, value };
    }
    return { type: "builtin", name: FALLBACK_NAME, value: FALLBACK_NAME };
  }

  function resolveHref(raw) {
    const meta = sanitizeValue(raw);
    if (meta.type === "user") {
      const map = loadUserPaths();
      const path = map[meta.name];
      if (typeof path === "string" && path) {
        return { href: path, meta };
      }
      return { href: FALLBACK_PATH, meta, missingUserPath: true };
    }
    return { href: CSS_DIR + meta.name, meta };
  }

  function ensureLink(targetDoc) {
    const doc = targetDoc || d;
    if (!doc) return null;
    let link = doc.getElementById("active-style");
    if (!link && doc.head) {
      link = doc.createElement("link");
      link.id = "active-style";
      link.rel = "stylesheet";
      doc.head.appendChild(link);
    }
    return link;
  }

  function ensureUserLink(targetDoc) {
    const doc = targetDoc || d;
    if (!doc || !doc.head) return null;
    let link = doc.getElementById(USER_STYLE_ID);
    if (!link) {
      link = doc.createElement("link");
      link.id = USER_STYLE_ID;
      link.rel = "stylesheet";
      doc.head.appendChild(link);
    }
    return link;
  }

  function removeUserLink(targetDoc) {
    const doc = targetDoc || d;
    const link = doc?.getElementById(USER_STYLE_ID);
    if (link?.parentNode) link.parentNode.removeChild(link);
  }

  function applyValue(raw, targetDoc) {
    const link = ensureLink(targetDoc);
    const result = resolveHref(raw);
    if (link) {
      link.setAttribute("href", result.href);
    }
    return result;
  }

  function rememberUserPath(name, path) {
    if (!name || typeof path !== "string" || !path) return;
    const map = loadUserPaths();
    map[name] = path;
    persistUserPaths();
  }

  function forgetUserPath(name) {
    if (!name) return;
    const map = loadUserPaths();
    if (map && map[name]) {
      delete map[name];
      persistUserPaths();
    }
  }

  function getUserPath(name) {
    const map = loadUserPaths();
    return map ? map[name] : undefined;
  }

  function readInitialPreference() {
    if (typeof w.__initialCssTheme === "string") {
      return w.__initialCssTheme;
    }
    const stored = safeRead(STORAGE_KEY);
    return stored || FALLBACK_NAME;
  }

  const core = w.__cssTheme || {};
  core.sanitize = sanitizeValue;
  core.resolve = resolveHref;
  core.apply = applyValue;
  core.ensureLink = ensureLink;
  core.rememberUserPath = rememberUserPath;
  core.forgetUserPath = forgetUserPath;
  core.getUserPath = getUserPath;
  core.readInitialPreference = readInitialPreference;
  core.fallbackName = FALLBACK_NAME;
  w.__cssTheme = core;

  function applyCssThemeValue(value, targetDoc) {
    const meta = sanitizeValue(value);
    if (meta.type === "user") {
      const cached = getUserPath(meta.name);
      applyValue(FALLBACK_NAME, targetDoc);
      if (cached) {
        const userLink = ensureUserLink(targetDoc);
        if (userLink) userLink.setAttribute("href", cached);
        return Promise.resolve(true);
      }
      if (!w.electron?.invoke) {
        removeUserLink(targetDoc);
        return Promise.resolve(false);
      }
      return w.electron.invoke("get-user-style-path", meta.name)
        .then((path) => {
          if (path) {
            rememberUserPath(meta.name, path);
            const userLink = ensureUserLink(targetDoc);
            if (userLink) userLink.setAttribute("href", path);
            return true;
          }
          removeUserLink(targetDoc);
          return false;
        })
        .catch(() => {
          removeUserLink(targetDoc);
          return false;
        });
    }
    removeUserLink(targetDoc);
    applyValue(meta.value, targetDoc);
    return Promise.resolve(true);
  }

  w.applyCssThemeValue = applyCssThemeValue;
  w.rememberUserCssPath = rememberUserPath;
  w.forgetUserCssPath = forgetUserPath;
  w.ensureActiveStyleLink = ensureLink;

  const shouldBootstrap = d?.documentElement?.dataset?.enableBattleCss === "true";
  if (shouldBootstrap) {
    const initial = readInitialPreference();
    applyCssThemeValue(initial, d);
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  installCssThemeRuntime(window, document);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    installCssThemeRuntime
  };
}

