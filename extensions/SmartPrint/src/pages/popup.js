(function initializePopup(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.SmartPrintPopup = api;
    if (root.document && root.chrome) api.createPopupController(root.document, root.chrome).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildPopup() {
  "use strict";

  async function captureActiveTab(chromeApi) {
    const [tab] = await chromeApi.tabs.query({ active: true, currentWindow: true });
    if (!Number.isInteger(tab?.id)) throw new Error("No hay una pestaña activa disponible.");
    const captured = await chromeApi.tabs.sendMessage(tab.id, { type: "SMARTPRINT_CAPTURE" });
    if (!captured?.ok) throw new Error(captured?.error || "SmartPrint no puede leer esta página.");
    const opened = await chromeApi.runtime.sendMessage({
      type: "SMARTPRINT_OPEN_PREVIEW",
      payload: captured.result,
      sourceTabId: tab.id,
    });
    if (!opened?.ok) throw new Error(opened?.error || "No fue posible abrir la vista previa.");
    return opened;
  }

  function createPopupController(documentRef, chromeApi) {
    let busy = false;
    function setStatus(text, kind = "info") {
      const status = documentRef.getElementById("status");
      if (!status) return;
      status.textContent = text;
      status.dataset.kind = kind;
    }
    async function print() {
      if (busy) return;
      busy = true;
      const button = documentRef.getElementById("print-smartprint");
      if (button) button.disabled = true;
      setStatus("Leyendo comprobante…");
      try {
        await captureActiveTab(chromeApi);
        setStatus("Vista previa abierta.", "success");
      } catch (error) {
        setStatus(error?.message || "No fue posible leer esta página.", "error");
      } finally {
        busy = false;
        if (button) button.disabled = false;
      }
    }
    function start() {
      documentRef.getElementById("print-smartprint")?.addEventListener("click", () => void print());
      documentRef.getElementById("open-options")?.addEventListener("click", () => chromeApi.runtime.openOptionsPage());
    }
    return { start, print };
  }

  return { captureActiveTab, createPopupController };
});
