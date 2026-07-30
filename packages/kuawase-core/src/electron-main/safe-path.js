const path = require("path");

function isReservedWindowsDeviceName(fileName) {
  const base = path.basename(fileName, path.extname(fileName)).toUpperCase();
  return /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(base);
}

function getSafeNamedFilePath({ baseDir, name, pattern, stripPrefix = "" }) {
  if (typeof name !== "string" || !name.trim()) return null;
  let fileName = name.trim();
  if (stripPrefix && fileName.startsWith(stripPrefix)) {
    fileName = fileName.slice(stripPrefix.length);
  }
  if (path.basename(fileName) !== fileName) return null;
  if (!pattern.test(fileName)) return null;
  if (isReservedWindowsDeviceName(fileName)) return null;

  const resolvedBase = path.resolve(baseDir);
  const resolvedFile = path.resolve(resolvedBase, fileName);
  const relative = path.relative(resolvedBase, resolvedFile);
  if (relative.startsWith("..") || path.isAbsolute(relative)) return null;
  return resolvedFile;
}

module.exports = {
  getSafeNamedFilePath
};
