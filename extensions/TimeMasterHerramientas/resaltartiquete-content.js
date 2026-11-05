/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeTicketHighlightContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const ticketCode = isCommonJs
    ? null
    : root.TimeMasterHerramientasResaltarTiquete;
  const api = factory(settings);

  root.TimeMasterHerramientasResaltarTiqueteContent = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api
      .createTicketHighlightContentController({
        storage: root.chrome.storage,
        settings,
        ticketCodeController: ticketCode.createTicketCodeController(root.document),
        documentRef: root.document,
      })
      .start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContent(
  settingsApi,
) {
  "use strict";

  const ENABLED_KEY = "tmhResaltarCodigoTiqueteEnabled";
  const LINE_SETTINGS = {
    code: {
      size: "tmhResaltarCodigoTiqueteFontSizePx",
      weight: "tmhResaltarCodigoTiqueteFontWeight",
      family: "tmhResaltarCodigoTiqueteFontFamily",
    },
    date: {
      size: "tmhResaltarFechaTiqueteFontSizePx",
      weight: "tmhResaltarFechaTiqueteFontWeight",
      family: "tmhResaltarFechaTiqueteFontFamily",
    },
    draw: {
      size: "tmhResaltarSorteoTiqueteFontSizePx",
      weight: "tmhResaltarSorteoTiqueteFontWeight",
      family: "tmhResaltarSorteoTiqueteFontFamily",
    },
  };
  const FONT_KEYS = Object.values(LINE_SETTINGS).flatMap((line) =>
    Object.values(line),
  );
  const READY_EVENT = "tmh-ticket-highlight-ready";

  function createTicketHighlightContentController({
    storage,
    settings,
    ticketCodeController,
    documentRef = globalThis.document,
  }) {
    const settingsCore = settings || settingsApi;
    const changedDuringInitialLoad = new Set();
    let started = false;
    let settingsLoaded = false;
    let lifecycleEpoch = 0;
    let fonts = defaultFonts();
    let readyListener = null;
    let readySignaled = false;

    function defaultFonts() {
      return Object.fromEntries(
        Object.entries(LINE_SETTINGS).map(([type, keys]) => [
          type,
          {
            sizePx: settingsCore.DEFAULT_SETTINGS[keys.size],
            weight: settingsCore.DEFAULT_SETTINGS[keys.weight],
            family: settingsCore.DEFAULT_SETTINGS[keys.family],
          },
        ]),
      );
    }

    function fontTargetForKey(key) {
      for (const [type, keys] of Object.entries(LINE_SETTINGS)) {
        if (key === keys.size) return { type, property: "sizePx" };
        if (key === keys.weight) return { type, property: "weight" };
        if (key === keys.family) return { type, property: "family" };
      }
      return null;
    }

    function readChangedFontValue(changes, key) {
      const raw = changes?.[key]?.newValue;
      const target = fontTargetForKey(key);
      const normalized =
        target?.property === "sizePx"
          ? settingsCore.normalizeTicketFontSizePx(raw)
          : target?.property === "weight"
            ? settingsCore.normalizeTicketFontWeight(raw)
            : settingsCore.normalizeTicketFontFamily(raw);
      return normalized === raw ? raw : undefined;
    }

    function applyFonts() {
      ticketCodeController.setFonts(
        Object.fromEntries(
          Object.entries(fonts).map(([type, font]) => [type, { ...font }]),
        ),
      );
    }

    function applyEnabled(enabled) {
      if (enabled) ticketCodeController.start();
      else ticketCodeController.stop();
    }

    function dispatchReady() {
      if (readySignaled || !documentRef) return;
      readySignaled = true;
      const EventClass = documentRef.defaultView?.CustomEvent || globalThis.CustomEvent;
      documentRef.dispatchEvent(new EventClass(READY_EVENT));
    }

    function signalReadyWhenDocumentComplete() {
      if (!documentRef || documentRef.readyState !== "loading") {
        dispatchReady();
        return;
      }
      readyListener = dispatchReady;
      documentRef.addEventListener("DOMContentLoaded", readyListener, {
        once: true,
      });
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      let fontsChanged = false;
      for (const key of FONT_KEYS) {
        const next = readChangedFontValue(changes, key);
        if (next === undefined) continue;
        if (!settingsLoaded) changedDuringInitialLoad.add(key);
        const target = fontTargetForKey(key);
        fonts[target.type][target.property] = next;
        fontsChanged = true;
      }
      if (fontsChanged) applyFonts();

      const enabled = settingsCore.readChangedSetting(changes, ENABLED_KEY);
      if (enabled !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(ENABLED_KEY);
        applyEnabled(enabled);
      }
    }

    function start() {
      if (started) return;
      started = true;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      fonts = defaultFonts();
      readySignaled = false;
      const currentEpoch = ++lifecycleEpoch;
      storage.onChanged.addListener(handleStorageChange);
      storage.local.get(settingsCore.DEFAULT_SETTINGS, (stored) => {
        if (!started || currentEpoch !== lifecycleEpoch) return;
        const normalized = settingsCore.normalizeSettings(stored);
        for (const key of FONT_KEYS) {
          if (changedDuringInitialLoad.has(key)) continue;
          const target = fontTargetForKey(key);
          fonts[target.type][target.property] = normalized[key];
        }
        applyFonts();
        if (!changedDuringInitialLoad.has(ENABLED_KEY)) {
          applyEnabled(normalized[ENABLED_KEY]);
        }
        settingsLoaded = true;
        changedDuringInitialLoad.clear();
        signalReadyWhenDocumentComplete();
      });
    }

    function destroy() {
      if (!started) return;
      started = false;
      lifecycleEpoch += 1;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      storage.onChanged.removeListener(handleStorageChange);
      if (readyListener) {
        documentRef?.removeEventListener("DOMContentLoaded", readyListener);
        readyListener = null;
      }
      applyEnabled(false);
    }

    return { start, destroy };
  }

  return { createTicketHighlightContentController };
});
