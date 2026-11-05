(function initializeFullPrintFontCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasImpresionCompleta = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFullPrintFontCore() {
  "use strict";

  const STYLE_ID = "tmh-full-print-font-style";
  const ALLOWED_WEIGHTS = new Set([600, 700, 800, 900]);
  const ALLOWED_FAMILIES = new Set(["inherit", "Arial", "Courier New", "Verdana"]);
  const DEFAULT_FONT = Object.freeze({
    sizePx: 21,
    weight: 900,
    family: "Verdana",
  });

  function createFullPrintFontController(documentRef) {
    let font = { ...DEFAULT_FONT };
    let started = false;

    function normalizeFont(next = {}) {
      return {
        sizePx:
          Number.isInteger(next.sizePx) && next.sizePx >= 10 && next.sizePx <= 72
            ? next.sizePx
            : font.sizePx,
        weight: ALLOWED_WEIGHTS.has(next.weight) ? next.weight : font.weight,
        family: ALLOWED_FAMILIES.has(next.family) ? next.family : font.family,
      };
    }

    function ensureStyle() {
      let style = documentRef.getElementById(STYLE_ID);
      if (style) return style;
      style = documentRef.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
html[data-tmh-full-print-font="true"] body,
html[data-tmh-full-print-font="true"] body * {
  font-family: var(--tmh-full-print-font-family) !important;
  font-size: var(--tmh-full-print-font-size) !important;
  font-weight: var(--tmh-full-print-font-weight) !important;
}`;
      (documentRef.head || documentRef.documentElement).appendChild(style);
      return style;
    }

    function applyFont() {
      const rootElement = documentRef.documentElement;
      if (!rootElement) return;
      rootElement.style.setProperty(
        "--tmh-full-print-font-size",
        `${font.sizePx}px`,
      );
      rootElement.style.setProperty(
        "--tmh-full-print-font-weight",
        String(font.weight),
      );
      rootElement.style.setProperty("--tmh-full-print-font-family", font.family);
    }

    function setFont(next) {
      font = normalizeFont(next);
      if (started) applyFont();
    }

    function start() {
      if (started) return;
      started = true;
      ensureStyle();
      documentRef.documentElement.dataset.tmhFullPrintFont = "true";
      applyFont();
    }

    function stop() {
      started = false;
      documentRef.getElementById(STYLE_ID)?.remove();
      const rootElement = documentRef.documentElement;
      if (!rootElement) return;
      delete rootElement.dataset.tmhFullPrintFont;
      rootElement.style.removeProperty("--tmh-full-print-font-size");
      rootElement.style.removeProperty("--tmh-full-print-font-weight");
      rootElement.style.removeProperty("--tmh-full-print-font-family");
    }

    return { start, stop, setFont };
  }

  return { createFullPrintFontController };
});
