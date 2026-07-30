const path = require("path");
const { createForgeConfig, loadProductConfig } = require("../../packages/kuawase-core/src");
const appPackage = require("./package.json");

module.exports = createForgeConfig(
  loadProductConfig(path.join(__dirname, "product.config.json")),
  { packageVersion: appPackage.version }
);
