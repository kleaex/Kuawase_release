window.appConfig = window.appConfig || {};
let lastTitleData = null;
let titleWaiters = [];

if (window.CommonTheme) {
    window.CommonTheme.setupThemeHandlers();
}
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
    waiters.forEach(resolve => resolve(true));
}

function waitForTitlePayload(timeoutMs = 500) {
    if (lastTitleData) return Promise.resolve(true);
    return new Promise(resolve => {
        const timer = window.setTimeout(() => {
            titleWaiters = titleWaiters.filter(waiter => waiter !== complete);
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
    } catch (e) {
        console.error("[top.js] fallback Excel データ取得エラー:", e);
    }
    if (!compename) compename = "データなし";
    renderTitle({ compename });
}

// ────────────────────────────────────
// 1) 管理画面（adminWindow）からの postMessage を受け取って描画
window.addEventListener("message", event => {
    if (!event.data) return;
    const { type, content } = event.data;
    if (type === "title" && content) {
        lastTitleData = content;
        renderTitle(content);
        notifyTitleWaiters();
    }
});

// ────────────────────────────────────
// 2) Electron IPC（send-data-to-projector）で飛んでくる update-content イベントにも対応
if (window.electron?.receive) {
    window.electron.receive("update-content", data => {
        const { type, content } = data;
        if (type === "title" && content) {
            lastTitleData = content;
            renderTitle(content);
            notifyTitleWaiters();
        }
    });
}

// ────────────────────────────────────
// 3) 初回ロード時はまず title payload を要求し、届かない場合のみ Excel を fallback として読む
document.addEventListener("DOMContentLoaded", async () => {
    window.parent.postMessage({ type: "ready" }, "*");
    const receivedTitle = await waitForTitlePayload();
    if (!receivedTitle && !lastTitleData) {
        await loadFallbackTitle();
    }
    // cssTheme 初期適用は main.js からの初回 'update-content' (css-theme) 送信に一本化
});

if (window.CommonTheme) {
    window.CommonTheme.initThemeFromStorage({ defaultTheme: "yellow", applyCssFromConfig: true });
}
