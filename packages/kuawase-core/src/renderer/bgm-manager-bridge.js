  function installBgmManagerBridge(windowObject) {
  if (!windowObject?.electron || typeof document === "undefined" || !document.getElementById) {
    return;
  }
  if (windowObject.__kuawaseBgmManagerBridgeInstalled) {
    return;
  }
  windowObject.__kuawaseBgmManagerBridgeActive = true;
  windowObject.__kuawaseBgmManagerBridgeInstalled = true;

  const audioTypes = ["hikou", "in", "out", "wait", "timer1", "timer2"];

  function dispatchBgmConfigEvent(type) {
    try {
      document.dispatchEvent(new CustomEvent(`bgm-config:${type}`));
    } catch {}
  }

  function extractFileNameFromUrl(url) {
    if (!url) return "";
    try {
      const parsed = new URL(url);
      const pathname = decodeURIComponent(parsed.pathname || "");
      return pathname.split("/").pop() || "";
    } catch {
      return url.split("/").pop() || "";
    }
  }

  function releaseAudioElement(audio) {
    try { audio.pause(); } catch {}
    try { audio.removeAttribute("src"); } catch {}
    try { audio.load(); } catch {}
  }

  function releaseBgmAudioByType(type) {
    const existing = windowObject.bgmAudioElements?.[type] || document.getElementById(`audio_dynamic_${type}`);
    if (!existing) return;
    releaseAudioElement(existing);
    try { existing.remove(); } catch {}
    if (windowObject.bgmAudioElements) {
      delete windowObject.bgmAudioElements[type];
    }
  }

  function releaseBgmAudiosByFile(fileName) {
    if (!fileName) return;
    Object.entries(windowObject.bgmAudioElements || {}).forEach(([type, audio]) => {
      const current = extractFileNameFromUrl(audio?.src || "");
      if (current && current === fileName) {
        releaseAudioElement(audio);
        try { audio.remove(); } catch {}
        delete windowObject.bgmAudioElements[type];
      }
    });
  }

  async function clearBgmConfigForFile(fileName) {
    if (!windowObject.electron?.getBgmConfig || !windowObject.electron?.setBgmConfig) return;
    const bgm = await windowObject.electron.getBgmConfig();
    let changed = false;
    Object.keys(bgm || {}).forEach((key) => {
      if (bgm[key] === fileName) {
        bgm[key] = "";
        changed = true;
      }
    });
    if (changed) {
      await windowObject.electron.setBgmConfig(bgm);
    }
  }

  async function preloadBgmAudios() {
    if (!windowObject.bgmAudioElements) {
      windowObject.bgmAudioElements = {};
    }

    if (!windowObject.electron?.getBgmConfig) return;
    const bgm = await windowObject.electron.getBgmConfig();
    for (const type of audioTypes) {
      const file = bgm[type];
      if (!file) {
        releaseBgmAudioByType(type);
        continue;
      }
      const path = await windowObject.electron.invoke("get-music-file-path", file);
      let audio = document.getElementById(`audio_dynamic_${type}`);
      if (!audio) {
        audio = document.createElement("audio");
        audio.id = `audio_dynamic_${type}`;
        audio.preload = "auto";
        document.body.appendChild(audio);
      }
      audio.src = path;
      windowObject.bgmAudioElements[type] = audio;
    }
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

  async function showBridgeConfirm(messageKey, params) {
    try {
      if (windowObject.langReady) {
        await windowObject.langReady;
      }
    } catch {}

    if (typeof windowObject.showConfirm === "function") {
      return windowObject.showConfirm(messageKey, params);
    }

    const modal = document.getElementById("confirm-modal");
    const content = modal?.querySelector(".confirm-modal-content") || modal?.querySelector(".modal-content");
    const msgEl = document.getElementById("confirm-modal-message");
    const okBtn = document.getElementById("confirm-ok-btn");
    const cancelBtn = document.getElementById("confirm-cancel-btn");
    if (!modal || !msgEl || !okBtn || !cancelBtn) {
      console.warn("[bgm-manager-bridge] confirm modal is not available");
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

  async function init() {
    const fileList = document.getElementById("music-file-list");
    let uploadInput = document.getElementById("music-upload-input");
    let saveBtn = document.getElementById("save-bgm-config");
    let deleteAllBtn = document.getElementById("delete-all-music-btn");
    const selects = {
      hikou: document.getElementById("bgm-hikou"),
      in: document.getElementById("bgm-in"),
      out: document.getElementById("bgm-out"),
      wait: document.getElementById("bgm-wait"),
      timer1: document.getElementById("bgm-timer1"),
      timer2: document.getElementById("bgm-timer2")
    };

    if (!fileList || !uploadInput || !saveBtn || Object.values(selects).some((value) => !value)) {
      return;
    }

    windowObject.bgmAudioElements = windowObject.bgmAudioElements || {};

    function applyLanguageUpdates() {
      windowObject.applyTranslations?.();
    }

    async function getTranslatedMessage(messageKey, fallback, params) {
      try {
        if (windowObject.langReady) {
          await windowObject.langReady;
        }
      } catch {}

      if (typeof windowObject.t !== "function") {
        return fallback || messageKey || "";
      }
      let text = windowObject.t(messageKey);
      if (params && typeof params === "object") {
        Object.entries(params).forEach(([key, value]) => {
          text = text.replace(new RegExp(`\\{${key}\\}`, "g"), String(value));
        });
      }
      return text || fallback || messageKey || "";
    }

    function getFallbackByLang(enText, jaText) {
      const lang = (typeof windowObject.getCurrentLang === "function"
        ? windowObject.getCurrentLang()
        : (windowObject.localStorage?.getItem("lang") || "ja")) || "ja";
      return lang === "en" ? enText : jaText;
    }

    const handleDeleteOne = async (fileName) => {
      if (!fileName) return;
      const ok = await showBridgeConfirm("bgm-delete-one-confirm", { name: fileName });
      if (!ok) {
        const cancelFallback = getFallbackByLang("Deletion cancelled", "削除をキャンセルしました");
        const cancelMsg = await getTranslatedMessage("bgm-delete-one-cancel", cancelFallback);
        windowObject.showToast?.(cancelMsg, true);
        return;
      }

      releaseBgmAudiosByFile(fileName);
      const res = await windowObject.electron.deleteMusicFile(fileName);
      if (!res?.success) {
        const msg = res?.error || (windowObject.t ? windowObject.t("bgm-delete-fail") : "削除に失敗しました");
        windowObject.showToast?.(msg, true);
        return;
      }

      await clearBgmConfigForFile(fileName);
      await refreshListAndSelects();
      await preloadBgmAudios();
      const successFallback = getFallbackByLang("Deleted", "削除しました");
      const successMsg = await getTranslatedMessage("bgm-delete-one-success", successFallback);
      windowObject.showToast?.(successMsg);
    };

    async function refreshListAndSelects() {
      const files = await windowObject.electron.listMusicFiles();
      fileList.innerHTML = "";
      files.forEach((fileName) => {
        const li = document.createElement("li");
        const nameSpan = document.createElement("span");
        nameSpan.className = "music-file-name";
        nameSpan.textContent = fileName;
        li.appendChild(nameSpan);

        const del = document.createElement("button");
        del.setAttribute("data-lang", "bgm-delete");
        del.textContent = windowObject.t ? windowObject.t("bgm-delete") : "削除";
        li.appendChild(del);
        fileList.appendChild(li);
      });

      Object.values(selects).forEach((select) => {
        select.innerHTML = "";
        const defaultOption = document.createElement("option");
        defaultOption.value = "";
        defaultOption.textContent = "（未設定）";
        select.appendChild(defaultOption);
        files.forEach((fileName) => {
          const option = document.createElement("option");
          option.value = fileName;
          option.textContent = fileName;
          select.appendChild(option);
        });
      });

      const bgm = await windowObject.electron.getBgmConfig();
      audioTypes.forEach((type) => {
        if (selects[type]) {
          selects[type].value = bgm[type] || "";
        }
      });
      await preloadBgmAudios();
      applyLanguageUpdates();
      dispatchBgmConfigEvent("loaded");
    }

    uploadInput = replaceNode(uploadInput);
    uploadInput.addEventListener("change", async () => {
      const files = uploadInput.files;
      if (!files || files.length === 0) return;
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        await windowObject.electron.uploadMusicFile(file.name, new Uint8Array(arrayBuffer));
      }
      uploadInput.value = "";
      await refreshListAndSelects();
    });

    saveBtn = replaceNode(saveBtn);
    saveBtn.addEventListener("click", async () => {
      const bgmConfig = {};
      audioTypes.forEach((type) => {
        bgmConfig[type] = selects[type]?.value || "";
      });
      await windowObject.electron.setBgmConfig(bgmConfig);
      const savedMsg = await getTranslatedMessage("bgm-save-success", "保存しました");
      windowObject.showToast?.(savedMsg);
      await preloadBgmAudios();
      dispatchBgmConfigEvent("saved");
    });

    if (deleteAllBtn) {
      deleteAllBtn = replaceNode(deleteAllBtn);
      const handleDeleteAll = async () => {
        const ok = await showBridgeConfirm("bgm-delete-all-confirm");
        if (!ok) {
          const cancelFallback = getFallbackByLang("Deletion cancelled", "キャンセルしました");
          const cancelMsg = await getTranslatedMessage("bgm-delete-all-cancel", cancelFallback);
          windowObject.showToast?.(cancelMsg, true);
          return;
        }
        windowObject.stopBgm?.(0);
        Object.values(windowObject.bgmAudioElements || {}).forEach(releaseAudioElement);
        windowObject.bgmAudioElements = {};
        const res = await windowObject.electron.invoke("delete-all-bgm-files");
        if (!res?.success) {
          const msg = res?.error || (windowObject.t ? windowObject.t("bgm-delete-fail") : "削除に失敗しました");
          windowObject.showToast?.(msg, true);
          return;
        }
        await windowObject.electron.setBgmConfig({});
        await refreshListAndSelects();
        await preloadBgmAudios();
        dispatchBgmConfigEvent("reset");
        const successFallback = getFallbackByLang("Deleted", "削除しました");
        const successMsg = await getTranslatedMessage("bgm-delete-all-success", successFallback);
        windowObject.showToast?.(successMsg);
      };

      // Use capture to block legacy onclick registered later during synthetic DOMContentLoaded.
      deleteAllBtn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        handleDeleteAll().catch((error) => {
          console.error("[bgm-manager-bridge] delete all failed:", error);
        });
      }, true);
    }

    // Use capture so single delete always prefers bridge confirm over legacy onclick.
    fileList.addEventListener("click", (event) => {
      const target = event.target;
      if (!target || typeof target.closest !== "function") return;
      const deleteBtn = target.closest('button[data-lang="bgm-delete"]');
      if (!deleteBtn || !fileList.contains(deleteBtn)) return;
      const item = deleteBtn.closest("li");
      const fileName = item?.querySelector(".music-file-name")?.textContent?.trim();
      if (!fileName) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      handleDeleteOne(fileName).catch((error) => {
        console.error("[bgm-manager-bridge] delete one failed:", error);
      });
    }, true);

    windowObject.refreshBgmManager = refreshListAndSelects;
    await refreshListAndSelects();

    if (windowObject.addEventListener) {
      windowObject.addEventListener("language:changed", applyLanguageUpdates);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      init().catch((error) => console.error("[bgm-manager-bridge] init failed:", error));
    }, { once: true });
  } else {
    init().catch((error) => console.error("[bgm-manager-bridge] init failed:", error));
  }
}

if (typeof window !== "undefined") {
  window.installBgmManagerBridge = installBgmManagerBridge;
  installBgmManagerBridge(window);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    installBgmManagerBridge
  };
}
