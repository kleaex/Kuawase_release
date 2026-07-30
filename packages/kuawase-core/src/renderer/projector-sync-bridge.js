function installProjectorSyncBridge(windowObject, battleRuntime) {
  if (!windowObject || !battleRuntime) {
    return;
  }

  function replaceButtonHandler(buttonId, handler) {
    const button = document.getElementById(buttonId);
    if (!button || !button.parentNode) {
      return;
    }

    const replacement = button.cloneNode(true);
    replacement.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await handler();
      } catch (error) {
        console.error(`[projector-sync-bridge] ${buttonId} handler failed:`, error);
      }
    });
    button.parentNode.replaceChild(replacement, button);
  }

  windowObject.changeIframeSrc = battleRuntime.changeIframeSrc;
  windowObject.sendContent = battleRuntime.sendContent;
  windowObject.sendInitialData = battleRuntime.sendInitialData;
  windowObject.showRedHaiku = battleRuntime.showRedHaiku;
  windowObject.showWhiteHaiku = battleRuntime.showWhiteHaiku;

  const iframe = document.getElementById("slide-frame");
  if (iframe) {
    iframe.onload = () => battleRuntime.sendInitialData();
  }

  replaceButtonHandler("showRed", async () => {
    if (typeof windowObject.audio_hikou === "function") {
      await windowObject.audio_hikou();
    }
    await battleRuntime.showRedHaiku();
  });

  replaceButtonHandler("showWhite", async () => {
    if (typeof windowObject.audio_hikou === "function") {
      await windowObject.audio_hikou();
    }
    await battleRuntime.showWhiteHaiku();
  });
}

module.exports = {
  installProjectorSyncBridge
};
