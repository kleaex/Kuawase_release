const ADMIN_CSS_STORAGE_KEY = "battle-css-file-admin";
const ADMIN_CSS_INHERIT = "inherit";

function resolveCssThemeRuntimeFactory(windowObject) {
  if (windowObject?.KuawaseCssTheme?.createCssThemeRuntime) {
    return windowObject.KuawaseCssTheme.createCssThemeRuntime;
  }
  if (typeof require === "function") {
    return require("./css-theme").createCssThemeRuntime;
  }
  return null;
}

function installCustomCssBridge(windowObject) {
  if (!windowObject?.electron || typeof document === "undefined" || !document.getElementById) {
    return;
  }
  if (windowObject.__kuawaseCustomCssBridgeInstalled) {
    return;
  }

  const createCssThemeRuntime = resolveCssThemeRuntimeFactory(windowObject);
  if (typeof createCssThemeRuntime !== "function") {
    console.warn("[custom-css-bridge] css theme runtime is not available");
    return;
  }
  windowObject.__kuawaseCustomCssBridgeInstalled = true;

  const cssTheme = createCssThemeRuntime();

  let currentProjCssFile = "battle.css";
  let currentAdminCssFile = ADMIN_CSS_INHERIT;
  let adminCssControlsPresent = false;

  function resolveIframeCssValue(projValue) {
    if (adminCssControlsPresent && currentAdminCssFile && currentAdminCssFile !== ADMIN_CSS_INHERIT) {
      return currentAdminCssFile;
    }
    return projValue;
  }
  // Exposed so other renderer runtimes (battle-renderer.js, migrated-renderer-app.browser.js)
  // that re-apply the proj CSS value on their own (e.g. on page navigation / iframe "ready")
  // route through the admin override instead of unconditionally overwriting the iframe.
  windowObject.__kuawaseResolveIframeCss = resolveIframeCssValue;

  function applyIframeCss() {
    cssTheme.applyCssToIframe(resolveIframeCssValue(currentProjCssFile));
  }

  async function readAdminCssThemePreference(defaultValue) {
    let value = defaultValue ?? ADMIN_CSS_INHERIT;
    try {
      value = windowObject.localStorage?.getItem(ADMIN_CSS_STORAGE_KEY) || value;
    } catch {}
    try {
      if (windowObject.electron?.invoke) {
        const cfg = await windowObject.electron.invoke("get-config");
        if (cfg?.adminCssTheme) value = cfg.adminCssTheme;
      }
    } catch {}
    return value;
  }

  function replaceNode(node) {
    if (!node || !node.parentNode) return node;
    const replacement = node.cloneNode(true);
    node.parentNode.replaceChild(replacement, node);
    return replacement;
  }

  function formatConfirmText(messageKey, params) {
    let text = "";
    if (messageKey) {
      try {
        text = typeof windowObject.t === "function" ? windowObject.t(messageKey) : messageKey;
      } catch {
        text = messageKey;
      }
    }
    if (params && typeof params === "object") {
      Object.entries(params).forEach(([key, value]) => {
        text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
      });
    }
    return text;
  }

  function showBridgeConfirm(messageKey, params) {
    if (typeof windowObject.showConfirm === "function") {
      return windowObject.showConfirm(messageKey, params);
    }

    const modal = document.getElementById("confirm-modal");
    const content = modal?.querySelector(".confirm-modal-content") || modal?.querySelector(".modal-content");
    const msgEl = document.getElementById("confirm-modal-message");
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      console.warn("[custom-css-bridge] confirm modal is not available");
      return Promise.resolve(false);
    }

    return new Promise((resolve) => {
      msgEl.textContent = formatConfirmText(messageKey, params);
      modal.style.display = "block";

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onOverlay = (event) => {
        if (!content || !content.contains(event.target)) {
          cleanup(false);
        }
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          cleanup(false);
        }
      };

      function cleanup(result) {
        okBtn.removeEventListener("click", onOk);
        cancelBtn.removeEventListener("click", onCancel);
        modal.removeEventListener("click", onOverlay);
        document.removeEventListener("keydown", onKeyDown);
        modal.style.display = "none";
        resolve(result);
      }

      okBtn.addEventListener("click", onOk);
      cancelBtn.addEventListener("click", onCancel);
      modal.addEventListener("click", onOverlay);
      document.addEventListener("keydown", onKeyDown);
    });
  }

  async function syncCssTheme(file) {
    currentProjCssFile = file;

    try {
      window.localStorage.setItem("battle-css-file", file);
    } catch {}

    applyIframeCss();
    postCssThemeToIframe(file);

    try {
      const config = await windowObject.electron.invoke("get-config");
      config.cssTheme = file;
      await windowObject.electron.invoke("update-config", config);
    } catch (error) {
      console.warn("[custom-css-bridge] cssTheme save failed", error);
    }

    try {
      await windowObject.electron.invoke("send-data-to-projector", {
        type: "css-theme",
        content: file
      });
    } catch (error) {
      console.warn("[custom-css-bridge] projector sync failed", error);
    }
  }

  async function syncAdminCssTheme(file) {
    currentAdminCssFile = file;

    try {
      windowObject.localStorage.setItem(ADMIN_CSS_STORAGE_KEY, file);
    } catch {}

    applyIframeCss();

    try {
      const config = await windowObject.electron.invoke("get-config");
      config.adminCssTheme = file;
      await windowObject.electron.invoke("update-config", config);
    } catch (error) {
      console.warn("[custom-css-bridge] adminCssTheme save failed", error);
    }
  }

  function postCssThemeToIframe(file) {
    const iframe = document.getElementById("slide-frame");
    if (!iframe) return;

    const sanitized = cssTheme.sanitizeCssFilename(file);
    if (sanitized.type === "user") {
      return;
    }

    const post = () => {
      try {
        const origin = windowObject.location?.origin;
        const targetOrigin = windowObject.location?.protocol === "file:"
          ? "*"
          : origin && origin !== "null" ? origin : "*";
        iframe.contentWindow?.postMessage({ type: "css-theme", content: file }, targetOrigin);
      } catch {}
    };

    try {
      if (iframe.contentDocument?.readyState === "complete") {
        post();
        return;
      }
      iframe.addEventListener("load", post, { once: true });
    } catch {
      post();
    }
  }

  async function init() {
    let cssSelect = document.getElementById("css-select");
    let addBtn = document.getElementById("add-custom-css-btn");
    let fileInput = document.getElementById("custom-css-input");
    const userListEl = document.getElementById("user-css-file-list");
    if (!cssSelect || !addBtn || !fileInput || !userListEl) {
      return;
    }

    let adminSelect = document.getElementById("admin-css-select");

    function applyLanguageUpdates() {
      windowObject.applyTranslations?.();
    }

    function addUserOptionIfMissing(selectEl, value, label) {
      if (selectEl && !selectEl.querySelector(`option[value="${value}"]`)) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        selectEl.appendChild(option);
      }
    }

    // Shared by both the 対戦デザイン(CSS) select (proj) and the KHB-only
    // 実況卓プレビュー専用デザイン(CSS) select (admin preview override, see admin-css-select).
    async function refreshUserCssList() {
      userListEl.innerHTML = "";
      let files = [];
      try {
        files = await windowObject.electron.invoke("list-user-styles");
      } catch {}

      [cssSelect, adminSelect].forEach((selectEl) => {
        if (!selectEl) return;
        Array.from(selectEl.querySelectorAll("option")).forEach((option) => {
          if (option.value.startsWith("user:")) {
            option.remove();
          }
        });
      });

      files.forEach((fileName) => {
        addUserOptionIfMissing(cssSelect, `user:${fileName}`, fileName);
        addUserOptionIfMissing(adminSelect, `user:${fileName}`, fileName);

        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.className = "user-css-file-name";
        nameSpan.textContent = fileName;

        const delBtn = document.createElement("button");
        delBtn.className = "delete-user-css-btn";
        delBtn.setAttribute("data-lang", "bgm-delete");
        delBtn.textContent = windowObject.t ? windowObject.t("bgm-delete") : "Delete";
        delBtn.onclick = async () => {
          const ok = await showBridgeConfirm("confirm-delete-css", { name: fileName });
          if (!ok) return;

          const result = await windowObject.electron.invoke("delete-user-style", fileName);
          if (!result?.success) {
            windowObject.showToast?.(windowObject.t ? windowObject.t("user-css-delete-fail") : "Delete failed", true);
            return;
          }

          if (cssSelect.value === `user:${fileName}`) {
            cssSelect.value = "battle.css";
            await syncCssTheme("battle.css");
          }
          if (adminSelect && adminSelect.value === `user:${fileName}`) {
            adminSelect.value = ADMIN_CSS_INHERIT;
            await syncAdminCssTheme(ADMIN_CSS_INHERIT);
          }
          await refreshUserCssList();
          windowObject.showToast?.(windowObject.t ? windowObject.t("user-css-delete-success") : "Deleted");
        };

        li.appendChild(nameSpan);
        li.appendChild(delBtn);
        userListEl.appendChild(li);
      });

      applyLanguageUpdates();
    }

    cssSelect = replaceNode(cssSelect);
    addBtn = replaceNode(addBtn);
    fileInput = replaceNode(fileInput);
    // The markup's own default-selected <option> (e.g. a KHB-only composition layout preset)
    // decides first-run behavior; "inherit" is just one of the possible options, not assumed here.
    const adminMarkupDefault = adminSelect ? adminSelect.value : ADMIN_CSS_INHERIT;
    if (adminSelect) adminSelect = replaceNode(adminSelect);

    windowObject.refreshUserCssList = refreshUserCssList;
    await refreshUserCssList();

    if (adminSelect) {
      adminCssControlsPresent = true;

      try {
        const savedAdminCss = await readAdminCssThemePreference(adminMarkupDefault);
        if (adminSelect.querySelector(`option[value="${savedAdminCss}"]`)) {
          adminSelect.value = savedAdminCss;
          currentAdminCssFile = savedAdminCss;
        } else {
          adminSelect.value = adminMarkupDefault;
          currentAdminCssFile = adminMarkupDefault;
        }
      } catch {
        adminSelect.value = adminMarkupDefault;
        currentAdminCssFile = adminMarkupDefault;
      }

      adminSelect.addEventListener("change", async () => {
        await syncAdminCssTheme(adminSelect.value);
      });
    }

    if (windowObject.addEventListener) {
      windowObject.addEventListener("language:changed", applyLanguageUpdates);
    }

    try {
      const savedCss = await cssTheme.readCssThemePreference();
      cssSelect.value = savedCss;
      await syncCssTheme(savedCss);
    } catch {
      await syncCssTheme("battle.css");
    }

    cssSelect.addEventListener("change", async () => {
      await syncCssTheme(cssSelect.value);
    });

    addBtn.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", async () => {
      if (!fileInput.files || !fileInput.files[0]) return;
      const file = fileInput.files[0];
      try {
        const content = await file.text();
        const saveResult = await windowObject.electron.invoke("save-user-style", { name: file.name, content });
        if (!saveResult?.success) {
          return;
        }
        const sanitizedName = cssTheme.sanitizeCssFilename(`user:${saveResult.file}`).name;
        const value = `user:${sanitizedName}`;
        if (!cssSelect.querySelector(`option[value="${value}"]`)) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = sanitizedName;
          cssSelect.appendChild(option);
        }
        cssSelect.value = value;
        await syncCssTheme(value);
        await refreshUserCssList();
      } catch (error) {
        console.error("[custom-css-bridge] save failed", error);
      } finally {
        fileInput.value = "";
      }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((error) => console.error("[custom-css-bridge] init failed:", error));
    }, { once: true });
  } else {
    init().catch((error) => console.error("[custom-css-bridge] init failed:", error));
  }
}

var KuawaseCustomCssBridge = {
  installCustomCssBridge
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = KuawaseCustomCssBridge;
}

if (typeof window !== "undefined") {
  window.KuawaseCustomCssBridge = KuawaseCustomCssBridge;
}
