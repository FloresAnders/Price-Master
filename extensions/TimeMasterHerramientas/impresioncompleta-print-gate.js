(function initializeFullPrintGate(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasImpresionCompletaPrintGate = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (
    root.document &&
    root.location?.href === "about:blank" &&
    typeof root.print === "function"
  ) {
    api.installPrintGate(root, root.document);
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFullPrintGate() {
  "use strict";

  const READY_EVENT = "tmh-full-print-font-ready";

  function installPrintGate(windowRef, documentRef, options = {}) {
    const timeoutMs = options.timeoutMs ?? 3000;
    const originalPrint = windowRef.print;
    let ready = false;
    let pendingArguments = null;
    let fallbackTimer = null;

    function release() {
      if (ready) return;
      ready = true;
      if (fallbackTimer !== null) {
        windowRef.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      if (!pendingArguments) return;
      const args = pendingArguments;
      pendingArguments = null;
      originalPrint.apply(windowRef, args);
    }

    function gatedPrint(...args) {
      if (ready) return originalPrint.apply(windowRef, args);
      pendingArguments = args;
      if (fallbackTimer === null) {
        fallbackTimer = windowRef.setTimeout(release, timeoutMs);
      }
      return undefined;
    }

    function destroy() {
      documentRef.removeEventListener(READY_EVENT, release);
      if (fallbackTimer !== null) windowRef.clearTimeout(fallbackTimer);
      fallbackTimer = null;
      pendingArguments = null;
      if (windowRef.print === gatedPrint) windowRef.print = originalPrint;
    }

    documentRef.addEventListener(READY_EVENT, release);
    windowRef.print = gatedPrint;
    return { destroy, release };
  }

  return { READY_EVENT, installPrintGate };
});
