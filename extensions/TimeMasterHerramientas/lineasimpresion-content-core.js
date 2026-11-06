(function initializePrintLinesContentCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasLineasImpresionContent = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildPrintLinesContentCore() {
    "use strict";

    function createPrintLinesContentController(options) {
      const {
        storage,
        settings,
        printLines,
        documentRef = globalThis.document,
        source,
        readyEvent,
        shouldStart = () => true,
      } = options;
      const definition = printLines.SOURCE_DEFINITIONS[source];
      if (!definition) throw new Error(`Unsupported print-line source: ${source}`);

      const relevantKeys = [
        definition.enabledKey,
        definition.selectedKey,
        definition.initializedKey,
        definition.sizeKey,
        definition.weightKey,
        definition.familyKey,
        definition.legacySizeKey,
        definition.legacyWeightKey,
        definition.legacyFamilyKey,
      ].filter(Boolean);
      const changedDuringInitialLoad = new Set();
      let started = false;
      let settingsLoaded = false;
      let lifecycleEpoch = 0;
      let readyListener = null;
      let readySignaled = false;
      let lines = [];
      let lineSignature = "";
      let rawSettings = settings.normalizeSettings({});
      const writeSessionCache =
        options.cacheDetectedLines ||
        ((cacheKey, detectedLines) => {
          storage.session?.set?.({ [cacheKey]: detectedLines });
        });

      function apply() {
        const configuration = printLines.normalizeSourceSettings(
          source,
          rawSettings,
          lines,
        );
        lineStyleController.setConfiguration(configuration);
      }

      function cacheLines(nextLines) {
        const signature = JSON.stringify(nextLines);
        if (signature === lineSignature) return;
        lineSignature = signature;
        lines = nextLines;
        writeSessionCache(definition.cacheKey, nextLines);
        apply();
      }

      const lineStyleController =
        options.lineStyleController ||
        printLines.createLineStyleController(documentRef, {
          source,
          onLinesChanged: cacheLines,
        });

      function dispatchReady() {
        if (readySignaled || !documentRef) return;
        readySignaled = true;
        const EventClass =
          documentRef.defaultView?.CustomEvent || globalThis.CustomEvent;
        documentRef.dispatchEvent(new EventClass(readyEvent));
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
        let changed = false;
        for (const key of relevantKeys) {
          if (!Object.prototype.hasOwnProperty.call(changes || {}, key)) continue;
          if (!settingsLoaded) changedDuringInitialLoad.add(key);
          rawSettings[key] = changes[key]?.newValue;
          changed = true;
        }
        if (changed) apply();
      }

      function start() {
        if (started || !shouldStart()) return;
        started = true;
        settingsLoaded = false;
        readySignaled = false;
        changedDuringInitialLoad.clear();
        rawSettings = settings.normalizeSettings({});
        lineSignature = "";
        lines = [];
        const currentEpoch = ++lifecycleEpoch;
        storage.onChanged.addListener(handleStorageChange);
        lineStyleController.start();
        storage.local.get(settings.DEFAULT_SETTINGS, (stored) => {
          if (!started || currentEpoch !== lifecycleEpoch) return;
          const normalized = settings.normalizeSettings(stored);
          for (const key of relevantKeys) {
            if (!changedDuringInitialLoad.has(key)) {
              rawSettings[key] = normalized[key];
            }
          }
          settingsLoaded = true;
          changedDuringInitialLoad.clear();
          apply();
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
        lineStyleController.stop();
      }

      return { start, destroy };
    }

    return { createPrintLinesContentController };
  },
);
