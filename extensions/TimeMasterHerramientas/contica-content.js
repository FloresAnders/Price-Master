(function initializeConticaContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const cambioTab = isCommonJs
    ? require("./cambiotab-core.js")
    : root.TimeMasterHerramientasCambioTab;
  const cerrarImpresionContica = isCommonJs
    ? null
    : root.TimeMasterHerramientasCerrarImpresionContica;
  const api = factory(settings);

  root.TimeMasterHerramientasContica = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api
      .createConticaController({
        storage: root.chrome.storage,
        tabController: cambioTab.createTabController(root.document),
        printInvoiceCloser:
          cerrarImpresionContica.createPrintInvoiceCloser(root.document),
        settings,
      })
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildConticaContent(
  settingsApi,
) {
  "use strict";

  const CAMBIO_TAB_SETTING_KEY = "tmhCambioTabEnabled";
  const CERRAR_IMPRESION_SETTING_KEY = "tmhCerrarImpresionConticaEnabled";

  function createConticaController({
    storage,
    tabController,
    printInvoiceCloser,
    settings,
  }) {
    const settingsCore = settings || settingsApi;
    const modalCloser = printInvoiceCloser || { start() {}, stop() {} };
    let started = false;

    function applyCambioTabEnabled(enabled) {
      if (enabled) tabController.start();
      else tabController.stop();
    }

    function applyCerrarImpresionEnabled(enabled) {
      if (enabled) modalCloser.start();
      else modalCloser.stop();
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const cambioTabEnabled = settingsCore.readChangedSetting(
        changes,
        CAMBIO_TAB_SETTING_KEY,
      );
      if (cambioTabEnabled !== undefined) {
        applyCambioTabEnabled(cambioTabEnabled);
      }

      const cerrarImpresionEnabled = settingsCore.readChangedSetting(
        changes,
        CERRAR_IMPRESION_SETTING_KEY,
      );
      if (cerrarImpresionEnabled !== undefined) {
        applyCerrarImpresionEnabled(cerrarImpresionEnabled);
      }
    }

    function start() {
      if (started) return;
      started = true;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started) return;
        const normalized = settingsCore.normalizeSettings(stored);
        applyCambioTabEnabled(normalized[CAMBIO_TAB_SETTING_KEY]);
        applyCerrarImpresionEnabled(normalized[CERRAR_IMPRESION_SETTING_KEY]);
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      storage.onChanged.removeListener(handleStorageChange);
      tabController.stop();
      modalCloser.stop();
    }

    return { start, destroy };
  }

  return { createConticaController };
});
