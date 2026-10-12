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
  const dividirEfectivo = isCommonJs
    ? null
    : root.TimeMasterHerramientasDividirEfectivo;
  const moverPago = isCommonJs
    ? null
    : root.TimeMasterHerramientasMoverPago;
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
        cashDivisionController:
          dividirEfectivo.createCashDivisionController(root.document),
        paymentShortcutController:
          moverPago.createPaymentShortcutController(root.document),
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
  const DIVIDIR_EFECTIVO_SETTING_KEY = "tmhDividirEfectivoEnabled";
  const MOVER_PAGO_SETTING_KEY = "tmhMoverPagoEnabled";

  function createConticaController({
    storage,
    tabController,
    printInvoiceCloser,
    cashDivisionController,
    paymentShortcutController,
    settings,
  }) {
    const settingsCore = settings || settingsApi;
    const modalCloser = printInvoiceCloser || { start() {}, stop() {} };
    const cashDivider = cashDivisionController || { start() {}, stop() {} };
    const paymentShortcut = paymentShortcutController || {
      start() {},
      stop() {},
    };
    const changedDuringInitialLoad = new Set();
    let started = false;
    let settingsLoaded = false;
    let lifecycleEpoch = 0;

    function applyCambioTabEnabled(enabled) {
      if (enabled) tabController.start();
      else tabController.stop();
    }

    function applyCerrarImpresionEnabled(enabled) {
      if (enabled) modalCloser.start();
      else modalCloser.stop();
    }

    function applyDividirEfectivoEnabled(enabled) {
      if (enabled) cashDivider.start();
      else cashDivider.stop();
    }

    function applyMoverPagoEnabled(enabled) {
      if (enabled) paymentShortcut.start();
      else paymentShortcut.stop();
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const cambioTabEnabled = settingsCore.readChangedSetting(
        changes,
        CAMBIO_TAB_SETTING_KEY,
      );
      if (cambioTabEnabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(CAMBIO_TAB_SETTING_KEY);
        applyCambioTabEnabled(cambioTabEnabled);
      }

      const cerrarImpresionEnabled = settingsCore.readChangedSetting(
        changes,
        CERRAR_IMPRESION_SETTING_KEY,
      );
      if (cerrarImpresionEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(CERRAR_IMPRESION_SETTING_KEY);
        }
        applyCerrarImpresionEnabled(cerrarImpresionEnabled);
      }

      const dividirEfectivoEnabled = settingsCore.readChangedSetting(
        changes,
        DIVIDIR_EFECTIVO_SETTING_KEY,
      );
      if (dividirEfectivoEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(DIVIDIR_EFECTIVO_SETTING_KEY);
        }
        applyDividirEfectivoEnabled(dividirEfectivoEnabled);
      }

      const moverPagoEnabled = settingsCore.readChangedSetting(
        changes,
        MOVER_PAGO_SETTING_KEY,
      );
      if (moverPagoEnabled !== undefined) {
        if (!settingsLoaded) {
          changedDuringInitialLoad.add(MOVER_PAGO_SETTING_KEY);
        }
        applyMoverPagoEnabled(moverPagoEnabled);
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
        if (!changedDuringInitialLoad.has(CAMBIO_TAB_SETTING_KEY)) {
          applyCambioTabEnabled(normalized[CAMBIO_TAB_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(CERRAR_IMPRESION_SETTING_KEY)) {
          applyCerrarImpresionEnabled(normalized[CERRAR_IMPRESION_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(DIVIDIR_EFECTIVO_SETTING_KEY)) {
          applyDividirEfectivoEnabled(normalized[DIVIDIR_EFECTIVO_SETTING_KEY]);
        }
        if (!changedDuringInitialLoad.has(MOVER_PAGO_SETTING_KEY)) {
          applyMoverPagoEnabled(normalized[MOVER_PAGO_SETTING_KEY]);
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
      tabController.stop();
      modalCloser.stop();
      cashDivider.stop();
      paymentShortcut.stop();
    }

    return { start, destroy };
  }

  return { createConticaController };
});
