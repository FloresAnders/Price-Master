/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeFullPrintContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const fullPrint = isCommonJs
    ? null
    : root.TimeMasterHerramientasImpresionCompleta;
  const api = factory(settings);

  root.TimeMasterHerramientasImpresionCompletaContent = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api.createFullPrintContentController({
      storage: root.chrome.storage,
      settings,
      fontController: fullPrint.createFullPrintFontController(root.document),
      locationHref: root.location?.href,
    }).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContent(
  settingsApi,
) {
  "use strict";

  const ENABLED_KEY = "tmhFormatoImpresionCompletaEnabled";
  const FONT_KEYS = {
    sizePx: "tmhFormatoImpresionCompletaFontSizePx",
    weight: "tmhFormatoImpresionCompletaFontWeight",
    family: "tmhFormatoImpresionCompletaFontFamily",
  };

  function createFullPrintContentController({
    storage,
    settings,
    fontController,
    locationHref = globalThis.location?.href,
  }) {
    const settingsCore = settings || settingsApi;
    const changedDuringInitialLoad = new Set();
    let started = false;
    let settingsLoaded = false;
    let lifecycleEpoch = 0;
    let enabled = false;
    let font = defaultFont();

    function defaultFont() {
      return {
        sizePx: settingsCore.DEFAULT_SETTINGS[FONT_KEYS.sizePx],
        weight: settingsCore.DEFAULT_SETTINGS[FONT_KEYS.weight],
        family: settingsCore.DEFAULT_SETTINGS[FONT_KEYS.family],
      };
    }

    function apply() {
      fontController.setFont({ ...font });
      if (enabled) fontController.start();
      else fontController.stop();
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      let changed = false;
      for (const [property, key] of Object.entries(FONT_KEYS)) {
        if (!changes?.[key]) continue;
        if (!settingsLoaded) changedDuringInitialLoad.add(key);
        const normalized = settingsCore.normalizeSettings({
          ...settingsCore.DEFAULT_SETTINGS,
          [key]: changes[key].newValue,
        });
        font[property] = normalized[key];
        changed = true;
      }
      const nextEnabled = settingsCore.readChangedSetting(changes, ENABLED_KEY);
      if (nextEnabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(ENABLED_KEY);
        enabled = nextEnabled;
        changed = true;
      }
      if (changed) apply();
    }

    function start() {
      if (started || locationHref !== "about:blank") return;
      started = true;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      enabled = false;
      font = defaultFont();
      const currentEpoch = ++lifecycleEpoch;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started || currentEpoch !== lifecycleEpoch) return;
        const normalized = settingsCore.normalizeSettings(stored);
        for (const [property, key] of Object.entries(FONT_KEYS)) {
          if (!changedDuringInitialLoad.has(key)) font[property] = normalized[key];
        }
        if (!changedDuringInitialLoad.has(ENABLED_KEY)) {
          enabled = normalized[ENABLED_KEY];
        }
        settingsLoaded = true;
        changedDuringInitialLoad.clear();
        apply();
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      lifecycleEpoch += 1;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      storage.onChanged.removeListener(handleStorageChange);
      fontController.stop();
    }

    return { start, destroy };
  }

  return { createFullPrintContentController };
});
