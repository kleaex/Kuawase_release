const fs = require("fs");
const path = require("path");

function loadProductConfig(configPath) {
  const absolutePath = path.resolve(configPath);
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(absolutePath, "utf-8"));
  } catch (error) {
    throw new Error(`Failed to load product config (${absolutePath}): ${error.message}`);
  }
  return normalizeProductConfig(raw, absolutePath);
}

function normalizeProductConfig(raw, sourcePath = "") {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error(`Product config must be an object (${sourcePath})`);
  }

  const requiredStrings = [
    "id",
    "name",
    "displayName",
    "description",
    "author",
    "appId",
    "iconPath",
    "windowTitlePrefix"
  ];

  for (const key of requiredStrings) {
    if (typeof raw[key] !== "string" || !raw[key].trim()) {
      throw new Error(`Missing required product config field: ${key} (${sourcePath})`);
    }
  }

  if (!raw.repository || typeof raw.repository !== "object" || Array.isArray(raw.repository)) {
    throw new Error(`Missing required product config field: repository (${sourcePath})`);
  }
  for (const key of ["owner", "name"]) {
    if (typeof raw.repository[key] !== "string" || !raw.repository[key].trim()) {
      throw new Error(`Missing required product config field: repository.${key} (${sourcePath})`);
    }
  }

  if (!raw.updater || typeof raw.updater !== "object" || Array.isArray(raw.updater)) {
    throw new Error(`Missing required product config field: updater (${sourcePath})`);
  }

  const updater = raw.updater || {};
  const forge = raw.forge || {};

  const normalizedUpdater = {
    enabled: updater.enabled !== false,
    provider: updater.provider || "github",
    owner: String(updater.owner || raw.repository.owner),
    repo: String(updater.repo || raw.repository.name)
  };
  if (updater.private === true) {
    normalizedUpdater.private = true;
  }

  const normalizedForge = {
    executableName: forge.executableName || `${raw.displayName}.exe`,
    shortcutName: forge.shortcutName || raw.displayName,
    iconUrl: forge.iconUrl || "",
    licenseUrl: forge.licenseUrl || "",
    publisherRepository: {
      owner: String(
        (forge.publisherRepository && forge.publisherRepository.owner) || raw.repository.owner
      ),
      name: String(
        (forge.publisherRepository && forge.publisherRepository.name) || raw.repository.name
      )
    }
  };
  if (forge.setupExecutableName) {
    normalizedForge.setupExecutableName = String(forge.setupExecutableName);
  }

  return {
    id: String(raw.id),
    name: String(raw.name),
    displayName: String(raw.displayName),
    description: String(raw.description),
    author: String(raw.author),
    repository: {
      owner: String(raw.repository.owner),
      name: String(raw.repository.name)
    },
    appId: String(raw.appId),
    iconPath: String(raw.iconPath),
    windowTitlePrefix: String(raw.windowTitlePrefix),
    projectorMode: raw.projectorMode || "plain",
    updater: normalizedUpdater,
    forge: normalizedForge
  };
}

module.exports = {
  loadProductConfig,
  normalizeProductConfig
};
