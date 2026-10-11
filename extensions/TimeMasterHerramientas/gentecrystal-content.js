(function initializeGenteCrystalContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const suma = isCommonJs
    ? require("./sumatiempos-core.js")
    : root.TimeMasterHerramientasSumaTiempos;
  const mover = isCommonJs
    ? require("./moverenter-core.js")
    : root.TimeMasterHerramientasMoverEnter;
  const ingresarVenta = isCommonJs
    ? null
    : root.TimeMasterHerramientasIngresarVenta;
  const api = factory(settings);

  root.TimeMasterHerramientasGenteCrystal = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api
      .createGenteCrystalController({
        storage: root.chrome.storage,
        settings,
        sumaController: suma.createSumaTiemposController(root.document, root),
        moverController: mover.createMoverEnterController(root.document),
        saleShortcutController:
          ingresarVenta.createSaleShortcutController(root.document),
      })
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGenteCrystalContent(
  settingsApi,
) {
  "use strict";

  const SUMA_KEY = "tmhSumaTiemposEnabled";
  const MOVER_KEY = "tmhMoverEnterEnabled";
  const INGRESAR_VENTA_KEY = "tmhIngresarVentaEnabled";

  function safely(label, action) {
    try {
      action();
    } catch (error) {
      console.warn(`[TimeMaster Herramientas] ${label}`, error);
    }
  }

  function createGenteCrystalController({
    storage,
    settings,
    sumaController,
    moverController,
    saleShortcutController,
  }) {
    const settingsCore = settings || settingsApi;
    const shortcutController = saleShortcutController || {
      start() {},
      stop() {},
    };
    const changedDuringInitialLoad = new Set();
    let started = false;
    let settingsLoaded = false;
    let lifecycleEpoch = 0;

    function applySuma(enabled) {
      safely("No se pudo actualizar SumaTiempos.", () => {
        if (enabled) sumaController.start();
        else sumaController.destroy();
      });
    }

    function applyMover(enabled) {
      safely("No se pudo actualizar MoverEnter.", () => {
        moverController.setEnabled(enabled);
        if (enabled) moverController.start();
        else moverController.stop();
      });
    }

    function applyIngresarVenta(enabled) {
      safely("No se pudo actualizar Ctrl+Enter.", () => {
        if (enabled) shortcutController.start();
        else shortcutController.stop();
      });
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const sumaEnabled = settingsCore.readChangedSetting(changes, SUMA_KEY);
      const moverEnabled = settingsCore.readChangedSetting(changes, MOVER_KEY);
      const ingresarVentaEnabled = settingsCore.readChangedSetting(
        changes,
        INGRESAR_VENTA_KEY,
      );
      if (sumaEnabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(SUMA_KEY);
        applySuma(sumaEnabled);
      }
      if (moverEnabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(MOVER_KEY);
        applyMover(moverEnabled);
      }
      if (ingresarVentaEnabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(INGRESAR_VENTA_KEY);
        applyIngresarVenta(ingresarVentaEnabled);
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
        if (!changedDuringInitialLoad.has(SUMA_KEY)) {
          applySuma(normalized[SUMA_KEY]);
        }
        if (!changedDuringInitialLoad.has(MOVER_KEY)) {
          applyMover(normalized[MOVER_KEY]);
        }
        if (!changedDuringInitialLoad.has(INGRESAR_VENTA_KEY)) {
          applyIngresarVenta(normalized[INGRESAR_VENTA_KEY]);
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
      applySuma(false);
      applyMover(false);
      applyIngresarVenta(false);
    }

    return { start, destroy };
  }

  return { createGenteCrystalController };
});
