const {
  populateMatchSelectors,
  restoreMatchConfig,
  updateExcelData
} = require("./battle-page-ui");

function installMatchSelectorBridge(windowObject) {
  if (!windowObject) {
    return;
  }

  async function refreshMatchSelectors() {
    const excelData = await updateExcelData();
    populateMatchSelectors(excelData || {});
    await restoreMatchConfig();
  }

  function installAutoRefresh() {
    const onReady = async () => {
      try {
        await refreshMatchSelectors();
      } catch (error) {
        console.error("[match-selector-bridge] failed to refresh selectors:", error);
      }
    };

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", onReady, { once: true });
    } else {
      onReady();
    }
  }

  windowObject.KuawaseMatchSelectorBridge = {
    populateMatchSelectors,
    restoreMatchConfig,
    updateExcelData,
    refreshMatchSelectors,
    installAutoRefresh
  };
}

module.exports = {
  installMatchSelectorBridge
};
