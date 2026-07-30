const { getSafeNamedFilePath } = require("../safe-path");

const MAX_EXCEL_FILE_BYTES = 25 * 1024 * 1024;

function registerCommonIpcHandlers({
  ipcMain,
  app,
  fs,
  path,
  axios,
  xlsx,
  userDataPaths,
  dialog,
  uiState,
  projectorState,
  logger
}) {
  registerConfigHandlers({ ipcMain, fs, path, userDataPaths });
  registerExcelHandlers({ ipcMain, app, fs, path, axios, xlsx, userDataPaths, dialog, uiState, logger });
  registerMusicHandlers({ ipcMain, app, fs, path, userDataPaths });
  registerUserStyleHandlers({ ipcMain, fs, path, userDataPaths });
  registerProjectorHandlers({ ipcMain, fs, projectorState });
  registerAppHandlers({ ipcMain, app });
}

function registerConfigHandlers({ ipcMain, fs, path, userDataPaths }) {
  ipcMain.handle("update-config", async (_event, newConfig) => {
    try {
      let existing = {};
      if (fs.existsSync(userDataPaths.configPath)) {
        existing = JSON.parse(fs.readFileSync(userDataPaths.configPath, "utf-8"));
      }
      const bgm = existing.bgm || {};
      const merged = { ...existing, ...newConfig, bgm };
      fs.writeFileSync(userDataPaths.configPath, JSON.stringify(merged, null, 2), "utf-8");
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("get-config", async () => {
    try {
      return JSON.parse(fs.readFileSync(userDataPaths.configPath, "utf-8"));
    } catch {
      return {};
    }
  });
}

function registerExcelHandlers({ ipcMain, app, fs, path, axios, xlsx, userDataPaths, dialog, uiState, logger }) {
  ipcMain.handle("get-excel-data", () => {
    try {
      if (!fs.existsSync(userDataPaths.excelDataPath)) {
        logger?.info?.("[excel] excelData.json does not exist yet:", userDataPaths.excelDataPath);
        return {};
      }
      return JSON.parse(fs.readFileSync(userDataPaths.excelDataPath, "utf-8"));
    } catch (error) {
      logger?.error?.("[excel] failed to read excelData.json:", error);
      return {};
    }
  });

  ipcMain.handle("reset-data", async () => {
    try {
      fs.writeFileSync(userDataPaths.configPath, "{}", "utf-8");
      fs.writeFileSync(userDataPaths.excelDataPath, "{}", "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("set-excel-file", async (_event, { filePath, numProblems, numTeams }) => {
    if (!filePath || !fs.existsSync(filePath)) {
      logger?.warn?.("[excel] set-excel-file rejected missing path:", filePath);
      return { success: false, error: "ファイルが存在しません" };
    }
    const validation = validateExcelFilePath({ fs, path, filePath });
    if (!validation.success) {
      logger?.warn?.("[excel] set-excel-file rejected invalid path:", filePath, validation.error);
      return validation;
    }
    try {
      logger?.info?.("[excel] set-excel-file started:", filePath);
      const ok = saveExcelData({
        app,
        fs,
        path,
        xlsx,
        excelDataPath: userDataPaths.excelDataPath,
        filePath,
        numProblems,
        numTeams
      });
      if (ok) {
        logger?.info?.("[excel] set-excel-file saved:", userDataPaths.excelDataPath);
        return { success: true };
      }
      logger?.warn?.("[excel] set-excel-file save returned false:", filePath);
      return { success: false, error: "Excelデータ保存に失敗しました" };
    } catch (error) {
      logger?.error?.("[excel] set-excel-file threw:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("select-excel-file", async () => {
    const result = await dialog.showOpenDialog(uiState.adminWindow, {
      title: "Excelファイル選択",
      properties: ["openFile"],
      filters: [{ name: "Excel", extensions: ["xlsx"] }]
    });
    if (result.canceled || result.filePaths.length === 0) {
      logger?.info?.("[excel] select-excel-file canceled");
      return { canceled: true };
    }
    logger?.info?.("[excel] select-excel-file selected:", result.filePaths[0]);
    return { canceled: false, filePath: result.filePaths[0] };
  });

  ipcMain.handle("load-from-google-sheet", async (_event, url) => {
    try {
      if (typeof url !== "string" || !url.startsWith("https://docs.google.com/spreadsheets/")) {
        return { success: false, error: "Invalid Google Sheets URL" };
      }
      logger?.info?.("[excel] load-from-google-sheet started:", url);
      const match = url.match(/\/d\/([A-Za-z0-9_-]+)\//);
      if (!match) {
        return { success: false, error: "Invalid Google Sheets URL" };
      }
      const sheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=xlsx`;

      const response = await axios.get(exportUrl, { responseType: "arraybuffer" });
      const workbook = xlsx.read(response.data, { type: "buffer" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const excelData = createExcelJsonFromSheet(sheet);
      fs.writeFileSync(userDataPaths.excelDataPath, JSON.stringify(excelData, null, 4), "utf8");
      logger?.info?.("[excel] load-from-google-sheet saved:", userDataPaths.excelDataPath);

      return { success: true, sheetName };
    } catch (error) {
      logger?.error?.("[excel] load-from-google-sheet failed:", error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-music-file-path", async (_event, filename) => {
    const filePath = getSafeNamedFilePath({
      baseDir: path.join(app.getPath("userData"), "music"),
      name: filename,
      pattern: /^[^<>:"/\\|?*\x00-\x1F]+\.(?:mp3|wav|ogg|aac|flac|m4a)$/i
    });
    if (!filePath) return null;
    return `file://${filePath.replace(/\\/g, "/")}`;
  });
}

function validateExcelFilePath({ fs, path, filePath }) {
  if (typeof filePath !== "string" || !filePath.trim()) {
    return { success: false, error: "Excelファイルのパスが不正です" };
  }
  if (path.extname(filePath).toLowerCase() !== ".xlsx") {
    return { success: false, error: "Excelファイル（.xlsx）を選択してください" };
  }

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    return { success: false, error: error.message };
  }
  if (!stat.isFile()) {
    return { success: false, error: "ファイルを選択してください" };
  }
  if (stat.size > MAX_EXCEL_FILE_BYTES) {
    return { success: false, error: "Excelファイルのサイズが大きすぎます" };
  }

  return { success: true };
}

function registerProjectorHandlers({ ipcMain, fs, projectorState }) {
  const {
    buildProjectorUrl,
    sendCssTheme
  } = require("../projector");

  ipcMain.handle("change-projector-src", async (_event, src) => {
    if (!projectorState.projectorWindow) return;
    const url = buildProjectorUrl({ fs, projectorState, src });
    if (!url) return;
    await projectorState.projectorWindow.loadURL(url);
    sendCssTheme(fs, projectorState, projectorState.projectorWindow);
    if (projectorState.lastKnownData) {
      projectorState.projectorWindow.webContents.send("update-content", projectorState.lastKnownData);
    }
    projectorState.adminWindow?.webContents.send("change-iframe-src", src);
  });

  ipcMain.handle("send-data-to-projector", (_event, data) => {
    projectorState.lastKnownData = data;
    if (projectorState.projectorWindow) {
      projectorState.projectorWindow.webContents.send("update-content", data);
    }
  });
}

function registerMusicHandlers({ ipcMain, fs, path, userDataPaths }) {
  const supportedAudioExts = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".m4a"];

  ipcMain.handle("list-music-files", async () => {
    try {
      return fs
        .readdirSync(userDataPaths.musicDir)
        .filter((file) => supportedAudioExts.includes(path.extname(file).toLowerCase()));
    } catch {
      return [];
    }
  });

  ipcMain.handle("upload-music-file", async (_event, payload = {}) => {
    try {
      const { name, buffer } = payload;
      const filePath = getSafeNamedFilePath({
        baseDir: userDataPaths.musicDir,
        name,
        pattern: /^[^<>:"/\\|?*\x00-\x1F]+\.(?:mp3|wav|ogg|aac|flac|m4a)$/i
      });
      if (!filePath) {
        return { success: false, error: "Invalid music file name" };
      }
      fs.mkdirSync(userDataPaths.musicDir, { recursive: true });
      fs.writeFileSync(filePath, Buffer.from(buffer));
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("delete-music-file", async (_event, name) => {
    try {
      const filePath = getSafeNamedFilePath({
        baseDir: userDataPaths.musicDir,
        name,
        pattern: /^[^<>:"/\\|?*\x00-\x1F]+\.(?:mp3|wav|ogg|aac|flac|m4a)$/i
      });
      if (!filePath) {
        return { success: false, error: "Invalid music file name" };
      }
      fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("reset-bgm-settings", async () => {
    try {
      let config = {};
      if (fs.existsSync(userDataPaths.configPath)) {
        config = JSON.parse(fs.readFileSync(userDataPaths.configPath, "utf-8"));
      }
      config.bgm = {};
      fs.writeFileSync(userDataPaths.configPath, JSON.stringify(config, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("delete-all-bgm-files", async () => {
    try {
      if (!fs.existsSync(userDataPaths.musicDir)) {
        return { success: true };
      }

      const files = fs.readdirSync(userDataPaths.musicDir);
      const failed = [];

      for (const file of files) {
        const ext = path.extname(file).toLowerCase();
        if (!supportedAudioExts.includes(ext)) continue;
        try {
          fs.unlinkSync(path.join(userDataPaths.musicDir, file));
        } catch (error) {
          failed.push(`${file}: ${error.message}`);
        }
      }

      if (failed.length > 0) {
        return { success: false, error: failed.join("\n") };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-bgm-config", async () => {
    try {
      const config = JSON.parse(fs.readFileSync(userDataPaths.configPath, "utf-8"));
      return config.bgm || {};
    } catch {
      return {};
    }
  });

  ipcMain.handle("set-bgm-config", async (_event, bgmConfig) => {
    try {
      let config = {};
      if (fs.existsSync(userDataPaths.configPath)) {
        config = JSON.parse(fs.readFileSync(userDataPaths.configPath, "utf-8"));
      }
      config.bgm = bgmConfig;
      fs.writeFileSync(userDataPaths.configPath, JSON.stringify(config, null, 2), "utf-8");
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

function registerUserStyleHandlers({ ipcMain, fs, path, userDataPaths }) {
  ipcMain.handle("list-user-styles", async () => {
    try {
      if (!fs.existsSync(userDataPaths.userStylesDir)) return [];
      return fs.readdirSync(userDataPaths.userStylesDir).filter((file) => file.toLowerCase().endsWith(".css"));
    } catch {
      return [];
    }
  });

  ipcMain.handle("save-user-style", async (_event, { name, content }) => {
    try {
      if (!name) return { success: false, error: "name is required" };
      const requestedName = name.toLowerCase().endsWith(".css") ? name : `${name}.css`;
      const filePath = getSafeNamedFilePath({
        baseDir: userDataPaths.userStylesDir,
        name: requestedName,
        pattern: /^[\w.-]+\.css$/i
      });
      if (!filePath) return { success: false, error: "Invalid style file name" };
      fs.mkdirSync(userDataPaths.userStylesDir, { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
      return { success: true, file: path.basename(filePath) };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("get-user-style-path", async (_event, name) => {
    try {
      if (!name) return null;
      const filePath = getSafeNamedFilePath({
        baseDir: userDataPaths.userStylesDir,
        name,
        pattern: /^[\w.-]+\.css$/i
      });
      if (!filePath) return null;
      if (!fs.existsSync(filePath)) return null;
      return `file://${filePath.replace(/\\/g, "/")}`;
    } catch {
      return null;
    }
  });

  ipcMain.handle("delete-user-style", async (_event, name) => {
    try {
      if (!name) return { success: false, error: "name required" };
      const filePath = getSafeNamedFilePath({
        baseDir: userDataPaths.userStylesDir,
        name,
        pattern: /^[\w.-]+\.css$/i
      });
      if (!filePath) return { success: false, error: "Invalid style file name" };
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });
}

function registerAppHandlers({ ipcMain, app }) {
  ipcMain.handle("get-app-version", () => app.getVersion());
}

function createExcelJsonFromSheet(sheet) {
  const excelData = {};
  const cellB1 = "B1";
  excelData[cellB1] = sheet[cellB1] ? sheet[cellB1].v : "";
  const numTeams = sheet.D1 ? sheet.D1.v : 0;
  const numProblems = sheet.F1 ? sheet.F1.v : 0;

  for (let k = 8; k <= numProblems * 2 + 6; k += 2) {
    const cell = `${getColumnLetter(k)}1`;
    excelData[cell] = sheet[cell] ? sheet[cell].v : "";
  }

  for (let i = 3; i <= numTeams + 2; i += 1) {
    const teamCell = `B${i}`;
    excelData[teamCell] = sheet[teamCell] ? sheet[teamCell].v : "";
    for (let j = 3; j <= numProblems * 10 + 2; j += 2) {
      const cellKey = `${getColumnLetter(j)}${i}`;
      excelData[cellKey] = sheet[cellKey] ? sheet[cellKey].v : "";
    }
  }

  return excelData;
}

function saveExcelData({ app, fs, path, xlsx, excelDataPath, filePath, numProblems = 0, numTeams = 0 }) {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }

  const workbook = xlsx.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const excelData = {};
  const cellB1 = "B1";
  excelData[cellB1] = sheet[cellB1] ? sheet[cellB1].v : "";
  const cellD1 = "D1";
  numTeams = sheet[cellD1] ? sheet[cellD1].v : numTeams;
  const cellF1 = "F1";
  numProblems = sheet[cellF1] ? sheet[cellF1].v : numProblems;

  for (let k = 8; k <= numProblems * 2 + 6; k += 2) {
    const cell = `${getColumnLetter(k)}1`;
    excelData[cell] = sheet[cell] ? sheet[cell].v : "";
  }
  for (let i = 3; i <= numTeams + 2; i += 1) {
    const cell = `B${i}`;
    excelData[cell] = sheet[cell] ? sheet[cell].v : "";
    for (let j = 3; j <= numProblems * 10 + 2; j += 2) {
      const cellKey = `${getColumnLetter(j)}${i}`;
      excelData[cellKey] = sheet[cellKey] ? sheet[cellKey].v : "";
    }
  }

  const jsonContent = JSON.stringify(excelData, null, 4);
  if (!fs.existsSync(path.dirname(excelDataPath))) {
    fs.mkdirSync(path.dirname(excelDataPath), { recursive: true });
  }
  fs.writeFileSync(excelDataPath, jsonContent, "utf8");
  return true;
}

function getColumnLetter(colIndex) {
  let letter = "";
  while (colIndex > 0) {
    const mod = (colIndex - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    colIndex = Math.floor((colIndex - mod) / 26);
  }
  return letter;
}

module.exports = {
  registerCommonIpcHandlers
};
