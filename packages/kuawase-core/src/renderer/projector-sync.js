function createRendererProjectorSync({ getAppConfig, getExcelData, postToProjector, postToIframe, extension }) {
  const rendererExtension = extension || {};

  function sendContent(type, content) {
    const data = { type, content };
    postToIframe(data);
    postToProjector(data);
  }

  function sendInitialData(createTitlePayload) {
    const appConfig = getAppConfig();
    const excelData = getExcelData();
    if (!appConfig || !excelData) return;
    sendContent("config", appConfig);
    sendContent("title", createTitlePayload(appConfig, excelData));
    if (typeof rendererExtension.afterSendInitialData === "function") {
      rendererExtension.afterSendInitialData({ sendContent, appConfig, excelData });
    }
  }

  return {
    sendContent,
    sendInitialData
  };
}

module.exports = {
  createRendererProjectorSync
};
