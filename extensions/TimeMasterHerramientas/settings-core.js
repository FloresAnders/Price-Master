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
    tmhSumaTiemposEnabled: true,
    tmhMoverEnterEnabled: false,
  });

  function normalizeSettings(raw = {}) {
    return Object.fromEntries(
      Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [
        key,
        typeof raw?.[key] === "boolean" ? raw[key] : fallback,
      ]),
    );
  }

  function readChangedSetting(changes, key) {
    const next = changes?.[key]?.newValue;
    return typeof next === "boolean" ? next : undefined;
  }

  return { DEFAULT_SETTINGS, normalizeSettings, readChangedSetting };
});
