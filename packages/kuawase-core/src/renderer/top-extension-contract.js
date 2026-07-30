function createNoopTopExtension() {
  return {
    allowMessageEvent() {
      return true;
    },
    handlePayload() {},
    async initBeforeTitleLoad() {},
    async initAfterTitleLoad() {}
  };
}

module.exports = {
  createNoopTopExtension
};
