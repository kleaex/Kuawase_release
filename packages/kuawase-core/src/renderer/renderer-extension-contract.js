function createNoopRendererExtension() {
  return {
    initTopHtmlControls() {}
  };
}

module.exports = {
  createNoopRendererExtension
};
