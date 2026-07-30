function populateMatchSelectors(excelData) {
  const teams = Object.entries(excelData).filter(([key]) => /^B\d+$/.test(key) && key !== "B1");
  const kendais = Object.entries(excelData)
    .filter(([key]) => /^[A-Z]+1$/.test(key))
    .filter(([key]) => isKendaiHeaderKey(key));

  const redSel = document.getElementById("redTeamSelect");
  const whiteSel = document.getElementById("whiteTeamSelect");
  const kendaiSel = document.getElementById("kendaiSelect");

  if (!redSel || !whiteSel || !kendaiSel) {
    return;
  }

  redSel.innerHTML = "";
  whiteSel.innerHTML = "";
  kendaiSel.innerHTML = "";

  teams.forEach(([key, name]) => {
    const redOption = document.createElement("option");
    redOption.value = key;
    redOption.textContent = name;
    redSel.appendChild(redOption);

    const whiteOption = document.createElement("option");
    whiteOption.value = key;
    whiteOption.textContent = name;
    whiteSel.appendChild(whiteOption);
  });

  kendais.forEach(([key, name]) => {
    const kendaiOption = document.createElement("option");
    kendaiOption.value = key;
    kendaiOption.textContent = name;
    kendaiSel.appendChild(kendaiOption);
  });
}

function isKendaiHeaderKey(key) {
  const match = key.match(/^([A-Z]+)1$/);
  if (!match) return false;
  let colNum = 0;
  for (let i = 0; i < match[1].length; i += 1) {
    colNum = colNum * 26 + (match[1].charCodeAt(i) - 65 + 1);
  }
  return colNum >= 8 && (colNum - 8) % 2 === 0;
}

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

async function resolveMessage(key, t) {
  try {
    if (typeof window !== "undefined" && window.langReady) {
      await window.langReady;
    }
  } catch {}

  if (typeof t === "function") {
    return t(key) || key;
  }
  return key;
}

function showToast(message, isError = false) {
  const toast = getOrCreateToast();
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? "#b22" : "#222";
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 1500);
}

function showToastAndReload(message, isError = false) {
  const toast = getOrCreateToast();
  if (!toast) return;
  toast.textContent = message;
  toast.style.background = isError ? "#b22" : "#222";
  toast.style.display = "block";
  setTimeout(() => {
    window.location.reload();
  }, 1500);
}

async function updateExcelData() {
  window.excelData = await window.electron.invoke("get-excel-data");
  return window.excelData;
}

async function restoreMatchConfig() {
  try {
    const config = await window.electron.invoke("get-config");
    window.appConfig = config || {};
    const redTeamSelect = document.getElementById("redTeamSelect");
    const whiteTeamSelect = document.getElementById("whiteTeamSelect");
    const kendaiSelect = document.getElementById("kendaiSelect");
    const matchTitleInput = document.getElementById("matchTitleInput");

    if (redTeamSelect) redTeamSelect.value = config.redTeam || "";
    if (whiteTeamSelect) whiteTeamSelect.value = config.whiteTeam || "";
    if (kendaiSelect) kendaiSelect.value = config.kendai || "";
    if (matchTitleInput) matchTitleInput.value = config.matchTitle || "";
  } catch {}
}

async function saveMatchConfig(appConfig) {
  const nextConfig = {
    ...appConfig,
    redTeam: document.getElementById("redTeamSelect")?.value || "",
    whiteTeam: document.getElementById("whiteTeamSelect")?.value || "",
    kendai: document.getElementById("kendaiSelect")?.value || "",
    matchTitle: document.getElementById("matchTitleInput")?.value || ""
  };
  const success = await window.electron.invoke("update-config", nextConfig);
  if (success) {
    window.appConfig = nextConfig;
  }
  return { success, config: nextConfig };
}

async function loadExcelFile(filePath, { t, onUpdated } = {}) {
  if (!filePath) return;
  try {
    const fileName = filePath.split("/").pop().split("\\").pop();
    const result = await window.electron.invoke("set-excel-file", { filePath });
    if (!result.success) {
      throw new Error(result.error);
    }

    const config = await window.electron.invoke("get-config");
    config.lastExcelFile = fileName;
    await window.electron.invoke("update-config", config);

    const lastExcelFileSpan = document.getElementById("last-excel-file");
    if (lastExcelFileSpan) {
      lastExcelFileSpan.textContent = config.lastExcelFile;
      lastExcelFileSpan.removeAttribute("data-lang");
    }

    await updateExcelData();
    if (typeof onUpdated === "function") {
      await onUpdated();
    }
    const successMsg = await resolveMessage("excel-success", t);
    showToastAndReload(successMsg);
  } catch (error) {
    console.error("Excelファイルの読み込みに失敗しました:", error);
    const failMsg = await resolveMessage("excel-fail", t);
    showToastAndReload(`${failMsg}\n${error.message}`, true);
  }
}

async function loadGoogleSheet(url, { t, onUpdated, closeModal } = {}) {
  if (!url || !url.startsWith("https://docs.google.com/spreadsheets/")) {
    const invalidMsg = await resolveMessage("gs-invalid-url", t);
    showToast(invalidMsg, true);
    return;
  }

  try {
    const result = await window.electron.invoke("load-from-google-sheet", url);
    if (!result.success) {
      throw new Error(result.error);
    }

    const config = await window.electron.invoke("get-config");
    config.lastExcelFile = url;
    await window.electron.invoke("update-config", config);

    const lastExcelFileSpan = document.getElementById("last-excel-file");
    if (lastExcelFileSpan) {
      lastExcelFileSpan.textContent = url;
      lastExcelFileSpan.removeAttribute("data-lang");
    }

    await updateExcelData();
    if (typeof closeModal === "function") closeModal();
    if (typeof onUpdated === "function") {
      await onUpdated();
    }
    const successMsg = await resolveMessage("gs-success", t);
    showToastAndReload(successMsg);
  } catch (error) {
    console.error("Google Sheetの読み込みに失敗しました:", error);
    const failMsg = await resolveMessage("gs-fail", t);
    showToast(`${failMsg}\n${error.message}`, true);
  }
}

var api = {
  loadExcelFile,
  loadGoogleSheet,
  populateMatchSelectors,
  restoreMatchConfig,
  saveMatchConfig,
  showToast,
  showToastAndReload,
  updateExcelData
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof window !== "undefined") {
  window.KuawaseBattlePageUi = api;
}
