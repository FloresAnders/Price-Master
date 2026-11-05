(function initializeSettingsCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasSettings = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSettingsCore() {
  "use strict";

  const TICKET_FONT_SIZE_MIN = 10;
  const TICKET_FONT_SIZE_MAX = 72;
  const TICKET_FONT_WEIGHTS = Object.freeze([600, 700, 800, 900]);
  const TICKET_FONT_FAMILIES = Object.freeze([
    "inherit",
    "Arial",
    "Courier New",
    "Verdana",
  ]);
  const TICKET_FONT_SIZE_KEYS = new Set([
    "tmhResaltarCodigoTiqueteFontSizePx",
    "tmhResaltarFechaTiqueteFontSizePx",
    "tmhResaltarSorteoTiqueteFontSizePx",
    "tmhFormatoImpresionCompletaFontSizePx",
  ]);
  const TICKET_FONT_WEIGHT_KEYS = new Set([
    "tmhResaltarCodigoTiqueteFontWeight",
    "tmhResaltarFechaTiqueteFontWeight",
    "tmhResaltarSorteoTiqueteFontWeight",
    "tmhFormatoImpresionCompletaFontWeight",
  ]);
  const TICKET_FONT_FAMILY_KEYS = new Set([
    "tmhResaltarCodigoTiqueteFontFamily",
    "tmhResaltarFechaTiqueteFontFamily",
    "tmhResaltarSorteoTiqueteFontFamily",
    "tmhFormatoImpresionCompletaFontFamily",
  ]);

  const DEFAULT_SETTINGS = Object.freeze({
    tmhCambioTabEnabled: true,
    tmhCerrarImpresionConticaEnabled: false,
    tmhCerrarImpresionConticaDelaySeconds: 5,
    tmhCerrarImpresionConticaMessage:
      "Recuerde consultar si desea la factura impresa",
    tmhDividirEfectivoEnabled: false,
    tmhMoverPagoEnabled: false,
    tmhSumaTiemposEnabled: true,
    tmhMoverEnterEnabled: false,
    tmhIngresarVentaEnabled: false,
    tmhResaltarCodigoTiqueteEnabled: false,
    tmhResaltarCodigoTiqueteFontSizePx: 22,
    tmhResaltarCodigoTiqueteFontWeight: 700,
    tmhResaltarCodigoTiqueteFontFamily: "inherit",
    tmhResaltarFechaTiqueteFontSizePx: 22,
    tmhResaltarFechaTiqueteFontWeight: 700,
    tmhResaltarFechaTiqueteFontFamily: "inherit",
    tmhResaltarSorteoTiqueteFontSizePx: 22,
    tmhResaltarSorteoTiqueteFontWeight: 700,
    tmhResaltarSorteoTiqueteFontFamily: "inherit",
    tmhFormatoImpresionCompletaEnabled: false,
    tmhFormatoImpresionCompletaFontSizePx: 21,
    tmhFormatoImpresionCompletaFontWeight: 900,
    tmhFormatoImpresionCompletaFontFamily: "Verdana",
  });

  function normalizeTicketFontSizePx(value, fallback = 22) {
    return Number.isInteger(value) &&
      value >= TICKET_FONT_SIZE_MIN &&
      value <= TICKET_FONT_SIZE_MAX
      ? value
      : fallback;
  }

  function normalizeTicketFontWeight(value, fallback = 700) {
    return TICKET_FONT_WEIGHTS.includes(value)
      ? value
      : fallback;
  }

  function normalizeTicketFontFamily(value, fallback = "inherit") {
    return TICKET_FONT_FAMILIES.includes(value)
      ? value
      : fallback;
  }

  function normalizeSettings(raw = {}) {
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
        key,
        TICKET_FONT_SIZE_KEYS.has(key)
          ? normalizeTicketFontSizePx(raw?.[key], fallback)
          : TICKET_FONT_WEIGHT_KEYS.has(key)
            ? normalizeTicketFontWeight(raw?.[key], fallback)
            : TICKET_FONT_FAMILY_KEYS.has(key)
              ? normalizeTicketFontFamily(raw?.[key], fallback)
              : typeof fallback === "boolean"
          ? typeof raw?.[key] === "boolean"
            ? raw[key]
            : fallback
          : typeof fallback === "number"
            ? Number.isInteger(raw?.[key]) && raw[key] >= 1
              ? raw[key]
              : fallback
            : typeof raw?.[key] === "string" && raw[key].trim()
              ? raw[key].trim()
              : fallback,
      ]),
    );
  }

  function readChangedSetting(changes, key) {
    const next = changes?.[key]?.newValue;
    return typeof next === "boolean" ? next : undefined;
  }

  function readChangedPositiveInteger(changes, key) {
    const next = changes?.[key]?.newValue;
    return Number.isInteger(next) && next >= 1 ? next : undefined;
  }

  function readChangedNonEmptyString(changes, key) {
    const next = changes?.[key]?.newValue;
    return typeof next === "string" && next.trim() ? next.trim() : undefined;
  }

  return {
    DEFAULT_SETTINGS,
    TICKET_FONT_SIZE_MIN,
    TICKET_FONT_SIZE_MAX,
    TICKET_FONT_WEIGHTS,
    TICKET_FONT_FAMILIES,
    normalizeSettings,
    normalizeTicketFontSizePx,
    normalizeTicketFontWeight,
    normalizeTicketFontFamily,
    readChangedSetting,
    readChangedPositiveInteger,
    readChangedNonEmptyString,
  };
});
