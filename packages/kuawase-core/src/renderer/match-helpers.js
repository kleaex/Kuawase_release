function updateHikouPanelVisibility(src, panel = document.getElementById("hikou-panel")) {
  if (!panel) return;
  const filename = src.split("/").pop().split("\\").pop().split("?")[0];
  const isMatchPage = /^[1-5]\.html$/.test(filename);
  panel.style.display = isMatchPage ? "" : "none";
}

function getMatchIndexFromIframe(iframe = document.getElementById("slide-frame")) {
  if (!iframe || !iframe.src) return null;
  const match = iframe.src.match(/(\d+)\.html(?:\?.*)?$/);
  return match ? parseInt(match[1], 10) : null;
}

function getKendaiNumber(kendaiKey) {
  const match = kendaiKey.match(/^([A-Z]+)1$/);
  if (!match) return 1;
  const col = match[1];
  let colNum = 0;
  for (let i = 0; i < col.length; i += 1) {
    colNum = colNum * 26 + (col.charCodeAt(i) - 65 + 1);
  }
  if (colNum < 8 || (colNum - 8) % 2 !== 0) return null;
  return Math.floor((colNum - 8) / 2) + 1;
}

function getTeamRow(teamKey) {
  const match = teamKey.match(/^B(\d+)$/);
  return match ? match[1] : null;
}

function getKendaiStartCol(kendaiNum) {
  const startColIndex = 3 + (kendaiNum - 1) * 10;
  let col = "";
  let n = startColIndex;
  while (n > 0) {
    const rem = (n - 1) % 26;
    col = String.fromCharCode(65 + rem) + col;
    n = Math.floor((n - 1) / 26);
  }
  return col;
}

function getHaikuCellKey(teamKey, kendaiKey, matchIndex) {
  const teamRow = getTeamRow(teamKey);
  const kendaiNum = getKendaiNumber(kendaiKey);
  if (!teamRow || !kendaiNum || !matchIndex) return null;

  const offset = (matchIndex - 1) * 2;
  const col = getKendaiStartCol(kendaiNum);
  if (!col) return null;

  return `${nextCol(col, offset)}${teamRow}`;
}

function nextCol(col, offset) {
  let code = 0;
  for (let i = 0; i < col.length; i += 1) {
    code = code * 26 + (col.charCodeAt(i) - 65 + 1);
  }
  code += offset;
  let result = "";
  while (code > 0) {
    const rem = (code - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    code = Math.floor((code - 1) / 26);
  }
  return result;
}

function createTitlePayload(appConfig, excelData) {
  return {
    compename: excelData["B1"] || "データなし",
    kendaiName: excelData[appConfig.kendai] || "データなし",
    redTeamName: excelData[appConfig.redTeam] || "データなし",
    whiteTeamName: excelData[appConfig.whiteTeam] || "データなし",
    matchTitle: appConfig.matchTitle || "試合未設定"
  };
}

var api = {
  createTitlePayload,
  getHaikuCellKey,
  getKendaiNumber,
  getKendaiStartCol,
  getMatchIndexFromIframe,
  getTeamRow,
  updateHikouPanelVisibility
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof window !== "undefined") {
  window.KuawaseMatchHelpers = api;
}
