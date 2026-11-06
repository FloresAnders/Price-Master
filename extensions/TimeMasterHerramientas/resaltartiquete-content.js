/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeTicketHighlightContent(root, factory) {
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

  root.TimeMasterHerramientasResaltarTiqueteContent = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    api.createTicketHighlightContentController({
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
  function buildTicketContent(settingsApi, printLinesApi, contentCoreApi) {
    "use strict";

    const READY_EVENT = "tmh-ticket-highlight-ready";

    function createTicketHighlightContentController(options) {
      const locationHref = options.locationHref || globalThis.location?.href || "";
      return (options.contentCore || contentCoreApi).createPrintLinesContentController({
        ...options,
        settings: options.settings || settingsApi,
        printLines: options.printLines || printLinesApi,
        source: "ticket",
        readyEvent: READY_EVENT,
        shouldStart: () => locationHref.includes("/print_pagos.php"),
      });
    }

    return { READY_EVENT, createTicketHighlightContentController };
  },
);
