const { requireCore } = require("../core");
const {
  createNoopRendererProjectorExtension
} = requireCore("renderer/renderer-projector-extension-contract");

module.exports = {
  ...createNoopRendererProjectorExtension(),
  async transformIframeSrc({ src, cssTheme }) {
    let cssFile = localStorage.getItem("battle-css-file") || "battle.css";
    try {
      if (window.electron?.invoke) {
        const cfg = await window.electron.invoke("get-config");
        if (cfg?.cssTheme) cssFile = cfg.cssTheme;
      }
    } catch {}
    const cssHref = await cssTheme.resolveCssHref(cssFile);
    return cssTheme.buildSrcWithCssParam(src, cssHref);
  }
};
