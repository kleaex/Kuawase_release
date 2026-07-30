document.addEventListener("DOMContentLoaded", async () => {
    const fileList = document.getElementById("music-file-list");
    const uploadInput = document.getElementById("music-upload-input");
    const saveBtn = document.getElementById("save-bgm-config");
    const selects = {
        hikou: document.getElementById("bgm-hikou"),
        in: document.getElementById("bgm-in"),
        out: document.getElementById("bgm-out"),
        wait: document.getElementById("bgm-wait"),
        timer1: document.getElementById("bgm-timer1"),
        timer2: document.getElementById("bgm-timer2"),
    };

    // --- 追加: BGMプリロード用 ---
    window.bgmAudioElements = {}; // グローバルで参照できるように
    let toastTimer = null;

    function getOrCreateToast() {
        let toast = document.getElementById("toast");
        if (!toast && document.body) {
            toast = document.createElement("div");
            toast.id = "toast";
            toast.style.display = "none";
            toast.style.position = "fixed";
            toast.style.top = "30px";
            toast.style.left = "50%";
            toast.style.transform = "translateX(-50%)";
            toast.style.background = "#222";
            toast.style.color = "#fff";
            toast.style.padding = "12px 32px";
            toast.style.borderRadius = "8px";
            toast.style.zIndex = "9999";
            toast.style.fontSize = "1.1em";
            toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.15)";
            document.body.appendChild(toast);
        }
        return toast;
    }

    function showToastSafe(message, isError = false) {
        if (typeof window.showToast === "function") {
            window.showToast(message, isError);
            return;
        }
        const toast = getOrCreateToast();
        if (!toast) return;
        toast.textContent = message;
        toast.style.background = isError ? "#b22" : "#222";
        toast.style.display = "block";
        if (toastTimer) window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => {
            toast.style.display = "none";
        }, 1500);
    }

    async function ensureLangReady() {
        try {
            if (window.langReady) {
                await window.langReady;
            }
        } catch {}
    }

    async function resolveMessage(key, fallback) {
        await ensureLangReady();
        if (typeof window.t === "function") {
            return window.t(key) || fallback || key;
        }
        return fallback || key;
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

    function releaseBgmAudiosByFile(fileName) {
        if (!fileName) return;
        Object.entries(window.bgmAudioElements || {}).forEach(([type, audio]) => {
            const current = extractFileNameFromUrl(audio?.src || "");
            if (current && current === fileName) {
                releaseAudioElement(audio);
                try { audio.remove(); } catch {}
                delete window.bgmAudioElements[type];
            }
        });
    }

    async function clearBgmConfigForFile(fileName) {
        if (!window.electron?.getBgmConfig || !window.electron?.setBgmConfig) return;
        const bgm = await window.electron.getBgmConfig();
        let changed = false;
        Object.keys(bgm || {}).forEach((key) => {
            if (bgm[key] === fileName) {
                bgm[key] = "";
                changed = true;
            }
        });
        if (changed) {
            await window.electron.setBgmConfig(bgm);
        }
    }

    async function preloadBgmAudios() {
        if (!window.electron?.getBgmConfig) return;
        const bgm = await window.electron.getBgmConfig();
        const types = ["hikou", "in", "out", "wait", "timer1", "timer2"];
        for (const type of types) {
            const file = bgm[type];
            if (!file) {
                const existing = window.bgmAudioElements?.[type];
                if (existing) {
                    releaseAudioElement(existing);
                    try { existing.remove(); } catch {}
                    delete window.bgmAudioElements[type];
                }
                continue;
            }
            const path = await window.electron.invoke('get-music-file-path', file);
            let audio = document.getElementById("audio_dynamic_" + type);
            if (!audio) {
                audio = document.createElement("audio");
                audio.id = "audio_dynamic_" + type;
                audio.preload = "auto";
                document.body.appendChild(audio);
            }
            audio.src = path;
            window.bgmAudioElements[type] = audio;
        }
    }

    async function refreshListAndSelects() {
        await ensureLangReady();
        const files = await window.electron.listMusicFiles();
        fileList.innerHTML = "";
        const deleteLabel = await resolveMessage("bgm-delete", "削除");
        files.forEach(f => {
            const li = document.createElement("li");
            const nameSpan = document.createElement("span");
            nameSpan.className = "music-file-name";
            nameSpan.textContent = f;
            li.appendChild(nameSpan);
            const del = document.createElement("button");
            del.setAttribute("data-lang", "bgm-delete");
            del.textContent = deleteLabel;
            del.onclick = async () => {
                await ensureLangReady();
                let ok = true;
                if (window.showConfirm) {
                    ok = await window.showConfirm('bgm-delete-one-confirm', { name: f });
                } else {
                    const confirmText = await resolveMessage('bgm-delete-one-confirm', `${f} を削除しますか？`);
                    ok = confirm(confirmText.replace('{name}', f));
                }
                if (!ok) {
                    const cancelMsg = await resolveMessage('bgm-delete-one-cancel', '削除をキャンセルしました');
                    showToastSafe(cancelMsg);
                    return;
                }
                releaseBgmAudiosByFile(f);
                const res = await window.electron.deleteMusicFile(f);
                if (!res?.success) {
                    const failMsg = res?.error || await resolveMessage("bgm-delete-fail", "削除に失敗しました");
                    showToastSafe(failMsg, true);
                    return;
                }
                await clearBgmConfigForFile(f);
                await refreshListAndSelects();
                await preloadBgmAudios();
                const successMsg = await resolveMessage('bgm-delete-one-success', '削除しました');
                showToastSafe(successMsg);
            };
            li.appendChild(del);
            fileList.appendChild(li);
        });
        Object.values(selects).forEach(sel => {
            sel.innerHTML = "";
            const defaultOption = document.createElement("option");
            defaultOption.value = "";
            defaultOption.textContent = "";
            resolveMessage("not-selected", "（未設定）").then((text) => {
                defaultOption.textContent = text;
            });
            sel.appendChild(defaultOption);
            
            files.forEach(f => {
                const opt = document.createElement("option");
                opt.value = f;
                opt.textContent = f;
                sel.appendChild(opt);
            });
        });
        // 設定反映
        const bgm = await window.electron.getBgmConfig();
        selects.hikou.value = bgm.hikou || "";
        selects.in.value = bgm.in || "";
        selects.out.value = bgm.out || "";
        selects.wait.value = bgm.wait || "";
        selects.timer1.value = bgm.timer1 || "";
        selects.timer2.value = bgm.timer2 || "";
        await preloadBgmAudios(); // リスト更新時もプリロード
        if (typeof window.applyTranslations === "function") {
            window.applyTranslations();
        }
    }

    // アップロード処理を直接changeイベントで定義
    uploadInput.addEventListener("change", async () => {
        const files = uploadInput.files;
        if (!files || files.length === 0) return;
        for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            await window.electron.uploadMusicFile(file.name, new Uint8Array(arrayBuffer));
        }
        uploadInput.value = "";
        await refreshListAndSelects();
    });

    saveBtn.onclick = async () => {
        const bgmConfig = {
            hikou: selects.hikou.value,
            in: selects.in.value,
            out: selects.out.value,
            wait: selects.wait.value,
            timer1: selects.timer1.value,
            timer2: selects.timer2.value,
        };
        await window.electron.setBgmConfig(bgmConfig);
        const successMsg = await resolveMessage("bgm-save-success", "保存しました");
        showToastSafe(successMsg);
        await preloadBgmAudios(); // 設定保存時もプリロード
    };

    const deleteAllBtn = document.getElementById("delete-all-music-btn");
    if (deleteAllBtn) {
        deleteAllBtn.onclick = async () => {
            await ensureLangReady();
            let ok = true;
            if (window.showConfirm) {
                ok = await window.showConfirm('bgm-delete-all-confirm');
            } else {
                const confirmText = await resolveMessage('bgm-delete-all-confirm', 'すべてのBGMファイルを削除しますか？');
                ok = confirm(confirmText);
            }
            if (!ok) {
                const cancelMsg = await resolveMessage('bgm-delete-all-cancel', 'BGM一括削除はキャンセルしました');
                showToastSafe(cancelMsg, true);
                return;
            }
            window.stopBgm && window.stopBgm(0);
            Object.values(window.bgmAudioElements || {}).forEach(releaseAudioElement);
            window.bgmAudioElements = {};
            const res = await window.electron.invoke("delete-all-bgm-files");
            if (!res?.success) {
                const failMsg = res?.error || await resolveMessage("bgm-delete-fail", "削除に失敗しました");
                showToastSafe(failMsg, true);
                return;
            }
            if (window.electron?.setBgmConfig) {
                await window.electron.setBgmConfig({});
            }
            await refreshListAndSelects();
            await preloadBgmAudios();
            const successMsg = await resolveMessage('bgm-delete-all-success', 'すべてのBGMファイルを削除しました');
            showToastSafe(successMsg);
        };
    }

    await refreshListAndSelects();
});