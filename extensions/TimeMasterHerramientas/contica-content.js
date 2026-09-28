(function initializeConticaContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const cambioTab = isCommonJs
    ? require("./cambiotab-core.js")
    : root.TimeMasterHerramientasCambioTab;
  const api = factory(settings);

  root.TimeMasterHerramientasContica = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api
      .createConticaController({
        storage: root.chrome.storage,
        tabController: cambioTab.createTabController(root.document),
        settings,
      })
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildConticaContent(
  settingsApi,
) {
  "use strict";

  const SETTING_KEY = "tmhCambioTabEnabled";

  function createConticaController({ storage, tabController, settings }) {
    const settingsCore = settings || settingsApi;
    let started = false;

    function applyEnabled(enabled) {
      if (enabled) tabController.start();
      else tabController.stop();
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      const enabled = settingsCore.readChangedSetting(changes, SETTING_KEY);
      if (enabled === undefined) return;
      applyEnabled(enabled);
    }

    function start() {
      if (started) return;
      started = true;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started) return;
        applyEnabled(settingsCore.normalizeSettings(stored)[SETTING_KEY]);
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      storage.onChanged.removeListener(handleStorageChange);
      tabController.stop();
    }

    return { start, destroy };
  }

  return { createConticaController };
});
