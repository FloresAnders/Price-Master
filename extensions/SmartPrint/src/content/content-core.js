(function initializeContentCore(root, factory) {
  const classifier = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../core/classifier.js")
    : root.SmartPrintClassifier;
  const api = factory(classifier);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintContent = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContentCore(defaultClassifier) {
  "use strict";
  const ACTION_ID = "smartprint-page-action";

  function isAuthorizedLocation(locationRef) {
    const protocol = locationRef?.protocol;
    if (["about:", "data:", "blob:"].includes(protocol)) return true;
    if (protocol !== "https:") return false;
    const host = locationRef.hostname;
    const path = locationRef.pathname || "/";
    if (host === "contica.app") return path.startsWith("/app/modules/punto_de_venta/");
    if (host === "gentecrystal.net") return true;
    if (host === "www.bcrcorresponsal.bancobcr.com") return path.startsWith("/BCRCorresponsalesExterno/");
    if (host === "puntosventa.jpsenlinea.go.cr") return path.startsWith("/PS.ODB.ODBHandlers/Receipt/Generate");
    return false;
  }

  function createContentController(documentRef, chromeApi, classifier = defaultClassifier, options = {}) {
    let started = false;
    let observer = null;
    let busy = false;
    const isTopFrame = options.isTopFrame ?? (() => {
      try {
        const windowRef = documentRef.defaultView;
        return !windowRef || windowRef.top === windowRef;
      } catch {
        return false;
      }
    })();
    const isAuthorized = options.isAuthorized ?? isAuthorizedLocation(documentRef.location);

    function capture() {
      return classifier.classifyAndExtract(documentRef);
    }

    async function openPreview() {
      if (busy) return;
      busy = true;
      const button = documentRef.getElementById(ACTION_ID);
      if (button) button.disabled = true;
      try {
        await chromeApi.runtime.sendMessage({
          type: "SMARTPRINT_OPEN_PREVIEW",
          payload: capture(),
        });
      } finally {
        busy = false;
        if (button) button.disabled = false;
      }
    }

    function ensureAction() {
      if (!isTopFrame || !documentRef.body || documentRef.getElementById(ACTION_ID)) return;
      const button = documentRef.createElement("button");
      button.id = ACTION_ID;
      button.type = "button";
      button.textContent = "Imprimir con SmartPrint";
      button.setAttribute("aria-label", "Abrir vista previa de SmartPrint");
      button.addEventListener("click", () => void openPreview());
      documentRef.body.append(button);
    }

    function onMessage(message, _sender, respond) {
      if (message?.type === "SMARTPRINT_CAPTURE") {
        try {
          respond({ ok: true, result: capture() });
        } catch (error) {
          respond({ ok: false, error: error?.message || "No fue posible leer el comprobante." });
        }
        return;
      }
      if (message?.type === "SMARTPRINT_PRINT_ORIGINAL") {
        documentRef.defaultView?.print();
        respond({ ok: true });
      }
    }

    function start() {
      if (started || !isAuthorized) return;
      started = true;
      ensureAction();
      chromeApi.runtime.onMessage.addListener(onMessage);
      if (documentRef.defaultView?.MutationObserver) {
        observer = new documentRef.defaultView.MutationObserver(ensureAction);
        observer.observe(documentRef.documentElement, { childList: true, subtree: true });
      }
    }

    function stop() {
      if (!started) return;
      started = false;
      observer?.disconnect();
      observer = null;
      chromeApi.runtime.onMessage.removeListener?.(onMessage);
      documentRef.getElementById(ACTION_ID)?.remove();
    }

    return { start, stop, capture, openPreview };
  }

  return { ACTION_ID, isAuthorizedLocation, createContentController };
});
