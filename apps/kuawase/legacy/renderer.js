var getHaikuCellKey = window.KuawaseMatchHelpers.getHaikuCellKey;
var getMatchIndexFromIframe = window.KuawaseMatchHelpers.getMatchIndexFromIframe;
var updateHikouPanelVisibility = window.KuawaseMatchHelpers.updateHikouPanelVisibility;
var loadExcelFile = window.KuawaseBattlePageUi.loadExcelFile;
var loadGoogleSheet = window.KuawaseBattlePageUi.loadGoogleSheet;
var populateMatchSelectors = window.KuawaseBattlePageUi.populateMatchSelectors;
var restoreMatchConfig = window.KuawaseBattlePageUi.restoreMatchConfig;
var saveMatchConfig = window.KuawaseBattlePageUi.saveMatchConfig;
var showToast = window.KuawaseBattlePageUi.showToast;
var showToastAndReload = window.KuawaseBattlePageUi.showToastAndReload;
var updateExcelData = window.KuawaseBattlePageUi.updateExcelData;
var kuawaseCssTheme = window.KuawaseCssTheme.createCssThemeRuntime();
var applyCssToIframe = kuawaseCssTheme.applyCssToIframe;
var buildSrcWithCssParam = kuawaseCssTheme.buildSrcWithCssParam;
var resolveCssHref = kuawaseCssTheme.resolveCssHref;
var sanitizeCssFilename = kuawaseCssTheme.sanitizeCssFilename;

async function refreshMatchSelectorsAfterDataLoad() {
    populateMatchSelectors(window.excelData || {});
    await restoreMatchConfig();
}

document.getElementById("excel-select-btn").addEventListener("click", async () => {
    const picked = await window.electron.invoke("select-excel-file");
    if (picked?.canceled || !picked?.filePath) return;
    await loadExcelFile(picked.filePath, { t, onUpdated: refreshMatchSelectorsAfterDataLoad });
});

document.getElementById("excel-input").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    const filePath = file?.path;
    const isFakePath = !filePath || /\\fakepath\\/i.test(filePath);
    if (isFakePath) return;
    await loadExcelFile(filePath, { t, onUpdated: refreshMatchSelectorsAfterDataLoad });
});

document.getElementById("reset-data-btn").addEventListener("click", async () => {
    const ok = await showConfirm("reset-confirm");
    if (!ok) { showToast(t("reset-cancel"), true); return; }
    // 句データ・対戦設定・テーマカラー・BGM設定・BGMファイル一括削除
    const result = await window.electron.invoke("reset-data");
    let allSuccess = result.success;
    // テーマカラー初期化
    try { localStorage.removeItem("theme"); if (window.applyTheme) window.applyTheme("Gray"); } catch {}
    // BGM設定・BGMファイル一括削除
    try { if (window.electron) { await window.electron.invoke("reset-bgm-settings"); await window.electron.invoke("delete-all-bgm-files"); } } catch {}
    // 対戦設定・UIリセット
    try {
        const config = await window.electron.invoke("get-config");
        config.lastExcelFile = "";
        await window.electron.invoke("update-config", config);
        const lastExcelFileSpan = document.getElementById("last-excel-file");
        lastExcelFileSpan.setAttribute("data-lang", "not-selected");
        setLanguage(localStorage.getItem("lang") || "ja");
        await updateExcelData();
    } catch {}
    if (allSuccess) { showToastAndReload(t("reset-success")); } else { showToast(t("reset-fail"), true); }
});

function sendContent(type, content) {
    const data = { type, content };
    const iframe = document.getElementById("slide-frame");

    if (iframe && iframe.contentWindow && iframe.contentDocument?.readyState === "complete") {
        iframe.contentWindow.postMessage({ type: "config", content: window.appConfig }, "*");
        iframe.contentWindow.postMessage(data, "*");
    }

    window.electron.invoke("send-data-to-projector", data).catch(console.error);
}

async function readCssThemePreference() {
   return kuawaseCssTheme.readCssThemePreference();
}

async function handleIframeLoaded() {
   sendInitialData();
   await applyCurrentCssToIframe();
}

async function applyCurrentCssToIframe() {
   try {
       applyCssToIframe(await readCssThemePreference());
   } catch {}
}

async function changeIframeSrc(src) {
       // 2) iframe切り替え前に披講パネルの表示/非表示を更新
   updateHikouPanelVisibility(src);

   // ステージボタン押下時：披講BGMを一時的な音量で再生
   // デバッグ中は既存音量の「半分」に設定（将来は0に切り替え予定）
   try {
       // 普通の披講再生関数（audio_hikou）を利用しつつ、一時的に音量0で再生
       if (typeof window.audio_hikou === 'function') {
           window.hikouNextPlayVolumeOverride = 0.0;
           window.audio_hikou();
           try { console.log('[renderer.js] ステージ切替に伴い披講BGMを音量0で再生（audio_hikou使用）'); } catch {}
       }
   } catch (e) {
       try { console.warn('[renderer.js] 披講BGM一時音量再生に失敗', e); } catch {}
   }

   const iframe = document.getElementById('slide-frame');
   const cssTheme = await readCssThemePreference();
   iframe.onload = async () => {
       console.log("[changeIframeSrc] iframeが読み込まれたのでデータを送信します");
       await handleIframeLoaded();
   };
   const cssHref = await resolveCssHref(cssTheme);
   const srcWithCss = buildSrcWithCssParam(src, cssHref);
   iframe.src = srcWithCss;

   window.electron.invoke("change-projector-src", srcWithCss)
       .then(() => {
           console.log("[renderer.js] projectorWindowの切り替えを指示しました:", src);
       })
       .catch((error) => {
           console.error("[renderer.js] projectorWindow切り替えエラー:", error);
       });
 }

document.getElementById("saveMatchConfig").addEventListener("click", async () => {
    const result = await saveMatchConfig(window.appConfig || {});
    if (result.success) {
        showToastAndReload(t("save-success"));
    }
});

async function initAdminRenderer() {
    if (window.__kuawaseAdminRendererInitialized) return;
    window.__kuawaseAdminRendererInitialized = true;
    try {
        window.excelData = await window.electron.invoke("get-excel-data");
        populateMatchSelectors(window.excelData);
        await restoreMatchConfig();
        setupIframeSync();

        // lastExcelFileの表示
        const config = await window.electron.invoke("get-config");
        const lastExcelFileSpan = document.getElementById("last-excel-file");
        if (config && config.lastExcelFile) {
            lastExcelFileSpan.textContent = config.lastExcelFile;
            lastExcelFileSpan.removeAttribute("data-lang"); // 翻訳されないように属性を削除
        } else {
            lastExcelFileSpan.setAttribute("data-lang", "not-selected");
        }

        const iframe = document.getElementById("slide-frame");
        if (iframe) {
            // 初回ロード時にも披講パネルを隠す／出す
            const filename = iframe.src.split("/").pop().split("\\").pop();
            updateHikouPanelVisibility(filename);
            if (iframe.contentDocument?.readyState === "complete") {
                sendInitialData();
            }
        }
     } catch (error) {
         console.error("初期データの読み込みに失敗:", error);
     }
    const themeSelect = document.getElementById("theme-select");
    if (themeSelect && window.THEMES) {
        themeSelect.innerHTML = "";
        Object.keys(window.THEMES).forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            themeSelect.appendChild(opt);
        });
        // 保存済みテーマを適用
        const savedTheme = localStorage.getItem("theme") || "Gray";
        themeSelect.value = savedTheme;
        window.applyTheme(savedTheme);

        // 変更時
        themeSelect.onchange = () => {
            const theme = themeSelect.value;
            window.applyTheme(theme);
            // iframeにも伝える
            const iframe = document.getElementById("slide-frame");
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: "theme", theme }, "*");
            }
            // projectorWindowにも伝える
            if (window.electron) {
                window.electron.invoke("send-data-to-projector", { type: "theme", content: theme });
            }
        };
    }
    window.KuawaseCustomCssBridge?.installCustomCssBridge(window);
    bindHikouButtons();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAdminRenderer, { once: true });
} else {
    initAdminRenderer();
}

function setupIframeSync() {
    const iframe = document.getElementById("slide-frame");
    if (iframe) {
        iframe.onload = handleIframeLoaded;
    }
}

function sendInitialData() {
    if (!window.appConfig || !window.excelData) return;
    sendContent("config", window.appConfig);
    sendContent("title", {
        compename: window.excelData["B1"] || "データなし",
        kendaiName: window.excelData[window.appConfig.kendai] || "データなし",
        redTeamName: window.excelData[window.appConfig.redTeam] || "データなし",
        whiteTeamName: window.excelData[window.appConfig.whiteTeam] || "データなし",
        matchTitle: window.appConfig.matchTitle || "試合未設定"
    });
}

function bindHikouButtons() {
    const redButton = document.getElementById("showRed");
    const whiteButton = document.getElementById("showWhite");

    if (redButton && !redButton.dataset.hikouBound) {
        redButton.dataset.hikouBound = "true";
        redButton.addEventListener("click", async () => {
            console.log("[renderer.js] '紅 表示' ボタンがクリックされました");
            try {
                await audio_hikou();
                await showRedHaiku();
            } catch (e) {
                console.error("[renderer.js] 紅の処理に失敗:", e);
            }
        });
    }

    if (whiteButton && !whiteButton.dataset.hikouBound) {
        whiteButton.dataset.hikouBound = "true";
        whiteButton.addEventListener("click", async () => {
            console.log("[renderer.js] '白 表示' ボタンがクリックされました");
            try {
                await audio_hikou();
                await showWhiteHaiku();
            } catch (e) {
                console.error("[renderer.js] 白の処理に失敗:", e);
            }
        });
    }
}

bindHikouButtons();

async function showRedHaiku() {
    const data = await window.electron.invoke("get-excel-data");
    const matchIndex = getMatchIndexFromIframe();
    const redTeamKey = window.appConfig.redTeam;
    const kendaiKey = window.appConfig.kendai;
    const haikuCellKey = getHaikuCellKey(redTeamKey, kendaiKey, matchIndex);

    const redHaikuData = data[haikuCellKey] || "データなし";
    console.log("[renderer.js] 送信する紅チームデータ:", redHaikuData, "セル:", haikuCellKey);
    sendContent("red", { [haikuCellKey]: redHaikuData });
}

async function showWhiteHaiku() {
    const data = await window.electron.invoke("get-excel-data");
    const matchIndex = getMatchIndexFromIframe();
    const whiteTeamKey = window.appConfig.whiteTeam;
    const kendaiKey = window.appConfig.kendai;
    const haikuCellKey = getHaikuCellKey(whiteTeamKey, kendaiKey, matchIndex);

    const whiteHaikuData = data[haikuCellKey] || "データなし";
    console.log("[renderer.js] 送信する白チームデータ:", whiteHaikuData, "セル:", haikuCellKey);
    sendContent("white", { [haikuCellKey]: whiteHaikuData });
}

window.addEventListener("message", (event) => {
    const iframe = document.getElementById("slide-frame");
    if (event.source === iframe?.contentWindow && event.data?.type === "ready") {
        sendInitialData();
        applyCurrentCssToIframe();
        return;
    }
    if (event.data?.type === "theme" && window.applyTheme) {
        window.applyTheme(event.data.theme);
    }
});

// --- スプレッドシート関連 ---
const gsModal = document.getElementById("gs-modal");
const openGsModalBtn = document.getElementById("open-gs-modal-btn");
const closeBtn = document.querySelector(".modal .close-btn");

openGsModalBtn.onclick = () => {
    gsModal.style.display = "block";
};
closeBtn.onclick = () => {
    gsModal.style.display = "none";
};
window.onclick = (event) => {
    if (event.target == gsModal) {
        gsModal.style.display = "none";
    }
};

document.getElementById("load-gs-btn").addEventListener("click", async () => {
    const urlInput = document.getElementById("gs-url-input");
    await loadGoogleSheet(urlInput?.value || "", {
        t,
        closeModal: () => {
            if (gsModal) gsModal.style.display = "none";
            if (urlInput) urlInput.value = "";
        },
        onUpdated: refreshMatchSelectorsAfterDataLoad
    });
});

// Documented change: add excel-only reset logic
const excelOnlyBtn = document.getElementById("reset-excel-only-btn");
if (excelOnlyBtn) {
  excelOnlyBtn.addEventListener("click", async () => {
    const ok = await showConfirm("excel-only-reset-confirm");
    if (!ok) { showToast(t("excel-only-reset-cancel"), true); return; }
    try {
      const reset = await window.electron.invoke("reset-data");
      if (!reset.success) throw new Error(reset.error || "reset-data failed");
      let cfg = await window.electron.invoke("get-config");
      const bgm = cfg.bgm || {};
      cfg = { bgm };
      await window.electron.invoke("update-config", cfg);
      const lastExcelFileSpan = document.getElementById("last-excel-file");
      if (lastExcelFileSpan) lastExcelFileSpan.setAttribute("data-lang", "not-selected");
      setLanguage(localStorage.getItem("lang") || "ja");
      await updateExcelData();
      showToastAndReload(t("excel-only-reset-success"));
    } catch (e) {
      console.error("Excel-only reset failed", e);
      showToast(t("excel-only-reset-fail"), true);
    }
  });
}

// --- 汎用確認モーダル ---
function showConfirm(messageKey, paramsOrRaw) {
    return new Promise(resolve => {
        const modal = document.getElementById('confirm-modal');
        const content = modal.querySelector('.confirm-modal-content');
        const msgEl = document.getElementById('confirm-modal-message');
        const okBtn = document.getElementById('confirm-ok-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        let text = '';
        if (typeof paramsOrRaw === 'string') {
            text = paramsOrRaw; // 旧 rawTextOverride 互換
        } else if (messageKey) {
            try { text = t(messageKey); } catch { text = messageKey; }
        }
        if (paramsOrRaw && typeof paramsOrRaw === 'object' && !Array.isArray(paramsOrRaw)) {
            for (const [k, v] of Object.entries(paramsOrRaw)) {
                text = text.replace(new RegExp('\\{' + k + '\\}', 'g'), v);
            }
        }
        if (!text) text = '';
        msgEl.textContent = text;
        modal.style.display = 'block';
        function cleanup(result){
            okBtn.onclick = null; cancelBtn.onclick = null; modal.onclick = null; document.onkeydown = null;
            modal.style.display = 'none';
            resolve(result);
        }
        okBtn.onclick = () => cleanup(true);
        cancelBtn.onclick = () => cleanup(false);
        modal.onclick = (e) => { if (!content.contains(e.target)) cleanup(false); };
        document.onkeydown = (e) => { if (e.key === 'Escape') cleanup(false); };
    });
}
window.showConfirm = showConfirm;
