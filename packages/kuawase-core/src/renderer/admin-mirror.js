'use strict';

(function () {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.__adminMirrorInstalled) return;
  window.__adminMirrorInstalled = true;

  function mirrorText(srcId, destId, formatFn) {
    const src = document.getElementById(srcId);
    const dest = document.getElementById(destId);

    function update() {
      let content = src.innerHTML;
      if (formatFn && typeof formatFn === "function") {
        content = formatFn(content);
      }
      dest.innerHTML = content;
    }

    if (src && dest) {
      update();
      const obs = new MutationObserver(update);
      obs.observe(src, { childList: true, subtree: true, characterData: true });
    } else {
      console.warn(`[admin-mirror] Mirroring failed. Source(#${srcId}): ${!!src}, Dest(#${destId}): ${!!dest}`);
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    mirrorText("Compe-name", "m-Compe-name");
    mirrorText("gameid", "m-gameid");
    mirrorText("matchid", "m-matchid");
    mirrorText("kendai", "m-kendai", (val) => `兼題${val}`);
    mirrorText("redTeam", "m-redTeam");
    mirrorText("whiteTeam", "m-whiteTeam");
  });
})();

