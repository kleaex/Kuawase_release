const fs = require("fs");
const path = require("path");

function createUserDataPaths(app) {
  const userDataPath = app.getPath("userData");

  return {
    userDataPath,
    configPath: path.join(userDataPath, "config.json"),
    excelDataPath: path.join(userDataPath, "excelData.json"),
    musicDir: path.join(userDataPath, "music"),
    userStylesDir: path.join(userDataPath, "userStyles"),
    userTopsDir: path.join(userDataPath, "userTops")
  };
}

function ensureConfigExists({ fsModule = fs, pathModule = path, logger, appDir, userDataPaths }) {
  const userConfigPath = userDataPaths.configPath;
  const defaultConfigPath = pathModule.join(appDir, "data", "default_config.json");

  try {
    if (!fsModule.existsSync(userConfigPath)) {
      const parentDir = pathModule.dirname(userConfigPath);
      if (!fsModule.existsSync(parentDir)) {
        fsModule.mkdirSync(parentDir, { recursive: true });
      }
      if (fsModule.existsSync(defaultConfigPath)) {
        fsModule.copyFileSync(defaultConfigPath, userConfigPath);
      } else {
        fsModule.writeFileSync(userConfigPath, "{}", "utf-8");
      }
      logger.info("初期設定ファイルを作成しました:", userConfigPath);
    } else {
      logger.info("設定ファイルは既に存在しています:", userConfigPath);
    }
  } catch (error) {
    logger.error("初期設定ファイルの作成に失敗しました:", error);
  }
}

module.exports = {
  createUserDataPaths,
  ensureConfigExists
};
