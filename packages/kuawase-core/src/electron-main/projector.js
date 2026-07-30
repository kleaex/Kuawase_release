const path = require("path");
const { getSafeNamedFilePath } = require("./safe-path");

function createProjectorState({ appDir, configPath, userStylesDir, mode }) {
  return {
    appDir,
    configPath,
    userStylesDir,
    mode: mode || "plain",
    adminWindow: null,
    projectorWindow: null,
    lastKnownData: null
  };
}

function getCssThemeFromConfig(fs, configPath, logger) {
  try {
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      if (config && typeof config.cssTheme === "string" && config.cssTheme.trim()) {
        return config.cssTheme.trim();
      }
    }
  } catch (error) {
    logger?.warn?.("[projector] failed to read cssTheme from config:", error);
  }
  return "battle.css";
}

function resolveCssThemeToHref(fs, userStylesDir, cssTheme) {
  let theme = typeof cssTheme === "string" && cssTheme.trim() ? cssTheme.trim() : "battle.css";
  if (theme.startsWith("user:")) {
    const filePath = getSafeNamedFilePath({
      baseDir: userStylesDir,
      name: theme,
      pattern: /^[\w.-]+\.css$/i,
      stripPrefix: "user:"
    });
    if (filePath) {
      if (fs.existsSync(filePath)) {
        return `file://${filePath.replace(/\\/g, "/")}`;
      }
    }
    return "css/battle.css";
  }
  if (/^[\w.-]+\.css$/.test(theme)) return `css/${theme}`;
  return "css/battle.css";
}

function resolveProjectorFile(appDir, src) {
  if (typeof src !== "string" || !src.trim()) {
    return null;
  }
  const [filePart] = src.split("?");
  const fileName = path.basename(filePart);
  if (!/^[\w.-]+\.html$/i.test(fileName)) {
    return null;
  }
  const resolvedAppDir = path.resolve(appDir);
  const resolvedFile = path.isAbsolute(filePart)
    ? path.resolve(filePart)
    : path.resolve(resolvedAppDir, filePart);
  const relative = path.relative(resolvedAppDir, resolvedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolvedFile;
}

function buildProjectorUrl({ fs, projectorState, src }) {
  const [filePart, queryPart] = String(src || "").split("?");
  const full = resolveProjectorFile(projectorState.appDir, filePart);
  if (!full) return null;

  if (projectorState.mode !== "query-href") {
    return `file://${full.replace(/\\/g, "/")}`;
  }

  const params = new URLSearchParams(queryPart || "");
  const cssHref = resolveCssThemeToHref(
    fs,
    projectorState.userStylesDir,
    params.has("css") ? params.get("css") : getCssThemeFromConfig(fs, projectorState.configPath, projectorState.logger)
  );
  if (cssHref) {
    params.set("css", cssHref);
  }
  const query = params.toString();
  return `file://${full.replace(/\\/g, "/")}` + (query ? `?${query}` : "");
}

function createProjectorReadyHandler({ fs, projectorState }) {
  return function onProjectorReady(projectorWindow) {
    sendCssTheme(fs, projectorState, projectorWindow);
    sendLastKnownData(projectorState, projectorWindow);
  };
}

function createProjectorReloadHandler({ fs, projectorState }) {
  return createProjectorReadyHandler({ fs, projectorState });
}

function sendCssTheme(fs, projectorState, projectorWindow) {
  try {
    const theme = getCssThemeFromConfig(fs, projectorState.configPath, projectorState.logger);
    // raw テーマ値を送る。受信側（common-theme.js / css-theme-runtime.js）が
    // それぞれ自前で解決するため、解決済み href を送る必要はない。
    projectorWindow.webContents.send("update-content", { type: "css-theme", content: theme });
  } catch (error) {
    projectorState.logger?.warn?.("[projector] failed to send cssTheme:", error);
  }
}

function sendLastKnownData(projectorState, projectorWindow) {
  if (projectorState.lastKnownData) {
    projectorWindow.webContents.send("update-content", projectorState.lastKnownData);
  }
}

module.exports = {
  buildProjectorUrl,
  createProjectorReadyHandler,
  createProjectorReloadHandler,
  createProjectorState,
  sendCssTheme
};
