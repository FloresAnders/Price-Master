(function initializeImpresionTiemposContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const api = factory(settings);

  root.TimeMasterHerramientasImpresionTiemposContent = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api
      .createImpresionTiemposBridge(root.document, root.chrome.storage, settings)
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildImpresionTiemposContent(
  settingsApi,
) {
  "use strict";

  const SETTING_KEY = "tmhImpresionTiemposEnabled";
  const PRINTER_NAME_KEY = "tmhImpresionTiemposPrinterName";
  const ENABLE_EVENT = "tmh-impresion-tiempos-enable";
  const DISABLE_EVENT = "tmh-impresion-tiempos-disable";
  const PRINTER_NAME_EVENT = "tmh-impresion-tiempos-printer-name";

  function createImpresionTiemposBridge(documentRef, storage, settings) {
    const settingsCore = settings || settingsApi;
    let started = false;
    let settingsLoaded = false;
    const changedDuringInitialLoad = new Set();
    let lifecycleEpoch = 0;

    function applyEnabled(enabled) {
      documentRef.dispatchEvent(
        new CustomEvent(enabled ? ENABLE_EVENT : DISABLE_EVENT),
      );
    }

    function applyPrinterName(printerName) {
      documentRef.dispatchEvent(
        new CustomEvent(PRINTER_NAME_EVENT, { detail: printerName }),
      );
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const enabled = settingsCore.readChangedSetting(changes, SETTING_KEY);
      if (enabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(SETTING_KEY);
        applyEnabled(enabled);
      }
      const printerName = settingsCore.readChangedNonEmptyString(
        changes,
        PRINTER_NAME_KEY,
      );
      if (printerName !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(PRINTER_NAME_KEY);
        applyPrinterName(printerName);
      }
    }

    function start() {
      if (started) return;
      started = true;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      const currentEpoch = ++lifecycleEpoch;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started || currentEpoch !== lifecycleEpoch) return;
        const normalized = settingsCore.normalizeSettings(stored);
        if (!changedDuringInitialLoad.has(PRINTER_NAME_KEY)) {
          applyPrinterName(normalized[PRINTER_NAME_KEY]);
        }
        if (!changedDuringInitialLoad.has(SETTING_KEY)) {
          applyEnabled(normalized[SETTING_KEY]);
        }
        settingsLoaded = true;
        changedDuringInitialLoad.clear();
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      lifecycleEpoch += 1;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      storage.onChanged.removeListener(handleStorageChange);
      applyEnabled(false);
    }

    return { start, destroy };
  }

  return {
    DISABLE_EVENT,
    ENABLE_EVENT,
    PRINTER_NAME_EVENT,
    PRINTER_NAME_KEY,
    SETTING_KEY,
    createImpresionTiemposBridge,
  };
});
