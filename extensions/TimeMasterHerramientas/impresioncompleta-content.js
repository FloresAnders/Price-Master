/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeFullPrintContent(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const printLines = isCommonJs
    ? require("./lineasimpresion-core.js")
    : root.TimeMasterHerramientasLineasImpresion;
  const contentCore = isCommonJs
    ? require("./lineasimpresion-content-core.js")
    : root.TimeMasterHerramientasLineasImpresionContent;
  const api = factory(settings, printLines, contentCore);

  root.TimeMasterHerramientasImpresionCompletaContent = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api.createFullPrintContentController({
      storage: root.chrome.storage,
      settings,
      printLines,
      documentRef: root.document,
      locationHref: root.location?.href,
      cacheDetectedLines: (cacheKey, lines) => {
        root.chrome.runtime.sendMessage({
          type: "tmh-cache-print-lines",
          cacheKey,
          lines,
        }, () => void root.chrome.runtime.lastError);
      },
    }).start();
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildFullPrintContent(settingsApi, printLinesApi, contentCoreApi) {
    "use strict";

    const READY_EVENT = "tmh-full-print-font-ready";

    function createFullPrintContentController(options) {
      const locationHref = options.locationHref || globalThis.location?.href || "";
      return (options.contentCore || contentCoreApi).createPrintLinesContentController({
        ...options,
        settings: options.settings || settingsApi,
        printLines: options.printLines || printLinesApi,
        source: "bcr",
        readyEvent: READY_EVENT,
        shouldStart: () => locationHref === "about:blank",
      });
    }

    return { READY_EVENT, createFullPrintContentController };
  },
);
