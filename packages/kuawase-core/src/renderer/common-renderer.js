function createRendererRuntime({ extension }) {
  const rendererExtension = extension || {};

  return {
    async initExtensions(context) {
      if (typeof rendererExtension.initTopHtmlControls === "function") {
        return rendererExtension.initTopHtmlControls(context);
      }
      return undefined;
    },
    getExtension() {
      return rendererExtension;
    },
    createTopHtmlContext(baseContext) {
      return {
        ...baseContext,
        extension: rendererExtension
      };
    }
  };
}

module.exports = {
  createRendererRuntime
};
