function bootstrapBattlePage({
  battleRenderer,
  extensionRuntime,
  hooks = {}
}) {
  const runtime = battleRenderer.createRuntime();

  function bindPageControls() {
    const pageControls = document.getElementById("page-controls");
    if (!pageControls) return;

    const buttons = Array.from(pageControls.querySelectorAll("button[onclick]"));
    buttons.forEach((button) => {
      const onclickValue = button.getAttribute("onclick") || "";
      const match = onclickValue.match(/changeIframeSrc\('([^']+)'\)/);
      if (!match) return;

      const targetSrc = match[1];
      button.removeAttribute("onclick");
      button.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await runtime.changeIframeSrc(targetSrc);
        } catch (error) {
          console.error("[bootstrap-battle-page] changeIframeSrc failed", error);
        }
      });
    });
  }

  function bindBattleButtons() {
    const showRedBtn = document.getElementById("showRed");
    if (showRedBtn) {
      showRedBtn.addEventListener("click", async () => {
        try {
          if (typeof window.audio_hikou === "function") {
            await window.audio_hikou();
          }
          await runtime.showRedHaiku();
        } catch (error) {
          console.error("[bootstrap-battle-page] showRed failed", error);
        }
      });
    }

    const showWhiteBtn = document.getElementById("showWhite");
    if (showWhiteBtn) {
      showWhiteBtn.addEventListener("click", async () => {
        try {
          if (typeof window.audio_hikou === "function") {
            await window.audio_hikou();
          }
          await runtime.showWhiteHaiku();
        } catch (error) {
          console.error("[bootstrap-battle-page] showWhite failed", error);
        }
      });
    }
  }

  async function initDomReady() {
    bindPageControls();
    runtime.setupIframeSync();
    bindBattleButtons();

    if (typeof hooks.beforeInitExtensions === "function") {
      await hooks.beforeInitExtensions({ runtime });
    }

    if (extensionRuntime && typeof extensionRuntime.initExtensions === "function") {
      await extensionRuntime.initExtensions({
        showConfirm: hooks.showConfirm,
        showToast: hooks.showToast,
        t: hooks.t
      });
    }

    if (typeof hooks.afterInitExtensions === "function") {
      await hooks.afterInitExtensions({ runtime });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initDomReady);
  } else {
    initDomReady();
  }

  return {
    runtime
  };
}

module.exports = {
  bootstrapBattlePage
};
