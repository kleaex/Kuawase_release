function createMainProcessConfig(product) {
  return {
    appName: product.displayName,
    iconPath: product.iconPath,
    updater: product.updater,
    windows: {
      adminTitle: `${product.windowTitlePrefix} - AdminWindow`,
      projectorTitle: `${product.windowTitlePrefix} - ProjectorWindow`
    }
  };
}

module.exports = {
  createMainProcessConfig
};
