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
      })
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGenteCrystalContent(
  settingsApi,
) {
  "use strict";

  const SUMA_KEY = "tmhSumaTiemposEnabled";
  const MOVER_KEY = "tmhMoverEnterEnabled";

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
  }) {
    const settingsCore = settings || settingsApi;
    let started = false;

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

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const sumaEnabled = settingsCore.readChangedSetting(changes, SUMA_KEY);
      const moverEnabled = settingsCore.readChangedSetting(changes, MOVER_KEY);
      if (sumaEnabled !== undefined) applySuma(sumaEnabled);
      if (moverEnabled !== undefined) applyMover(moverEnabled);
    }

    function start() {
      if (started) return;
      started = true;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started) return;
        const normalized = settingsCore.normalizeSettings(stored);
        applySuma(normalized[SUMA_KEY]);
        applyMover(normalized[MOVER_KEY]);
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      storage.onChanged.removeListener(handleStorageChange);
      applySuma(false);
      applyMover(false);
    }

    return { start, destroy };
  }

  return { createGenteCrystalController };
});
