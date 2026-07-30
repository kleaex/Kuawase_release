const path = require("path");

function requireCore(subpath = "") {
  const relativeSubpath = subpath ? subpath.replace(/^[/\\]+/, "") : "";
  const candidates = [
    path.join(__dirname, "../../../packages/kuawase-core/src", relativeSubpath),
    path.join(__dirname, "..", "packages/kuawase-core/src", relativeSubpath)
  ];

  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, "app.asar", "packages/kuawase-core/src", relativeSubpath),
      path.join(process.resourcesPath, "app", "packages/kuawase-core/src", relativeSubpath)
    );
  }

  let lastError;
  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch (error) {
      lastError = error;
      if (error.code !== "MODULE_NOT_FOUND") {
        throw error;
      }
    }
  }
  throw lastError || new Error("Unable to resolve kuawase-core");
}

module.exports = requireCore();
module.exports.requireCore = requireCore;
