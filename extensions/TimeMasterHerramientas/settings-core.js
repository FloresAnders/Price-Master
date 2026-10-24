(function initializeSettingsCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasSettings = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSettingsCore() {
  "use strict";

  const DEFAULT_SETTINGS = Object.freeze({
    tmhCambioTabEnabled: true,
    tmhCerrarImpresionConticaEnabled: false,
    tmhCerrarImpresionConticaDelaySeconds: 5,
    tmhDividirEfectivoEnabled: false,
    tmhMoverPagoEnabled: false,
    tmhSumaTiemposEnabled: true,
    tmhMoverEnterEnabled: false,
    tmhIngresarVentaEnabled: false,
  });

  function normalizeSettings(raw = {}) {
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
        key,
        typeof fallback === "boolean"
          ? typeof raw?.[key] === "boolean"
            ? raw[key]
            : fallback
          : Number.isInteger(raw?.[key]) && raw[key] >= 1
            ? raw[key]
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

  return {
    DEFAULT_SETTINGS,
    normalizeSettings,
    readChangedSetting,
    readChangedPositiveInteger,
  };
});
