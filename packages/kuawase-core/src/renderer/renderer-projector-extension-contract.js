function createNoopRendererProjectorExtension() {
  return {
    async afterSendInitialData() {},
    async transformIframeSrc({ src }) {
      return src;
    }
  };
}

module.exports = {
  createNoopRendererProjectorExtension
};
