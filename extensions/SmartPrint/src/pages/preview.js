(function initializePreview(root, factory) {
  const renderer = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../templates/renderer.js")
    : root.SmartPrintRenderer;
  const settings = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../core/settings-adapter.js")
    : root.SmartPrintSettings;
  const api = factory(renderer, settings);
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.SmartPrintPreview = api;
    if (root.document && root.chrome) api.createPreviewController(root.document, root.chrome, root.location).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildPreview(renderer, settings) {
  "use strict";

  async function loadJob(storageArea, jobId) {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(String(jobId || ""))) throw new Error("Identificador de trabajo inválido.");
    const key = `smartPrintJob:${jobId}`;
    const stored = await storageArea.get(key);
    if (!stored?.[key]) throw new Error("El trabajo ya no está disponible. Genere otra vista previa.");
    return stored[key];
  }

  function createPreviewController(documentRef, chromeApi, locationRef) {
    async function start() {
      const status = documentRef.getElementById("preview-status");
      try {
        const jobId = new URL(locationRef.href).searchParams.get("job");
        const [job, preferences] = await Promise.all([
          loadJob(chromeApi.storage.session, jobId),
          settings.readSettings(chromeApi.storage.local),
        ]);
        const host = documentRef.getElementById("print-host");
        host.replaceChildren(renderer.createPrintView(documentRef, job.document, preferences));
        documentRef.documentElement.dataset.paperWidth = preferences.paperWidth;
        documentRef.documentElement.style.setProperty("--smartprint-scale", `${preferences.scale / 100}`);
        if (status) {
          status.textContent = job.recognized
            ? `Origen: ${job.document.source}`
            : "Documento no reconocido: revise o use el original.";
          status.dataset.kind = job.document.confidence === "needs_review" ? "warning" : "success";
        }
        documentRef.getElementById("print")?.addEventListener("click", () => documentRef.defaultView.print());
        documentRef.getElementById("print-original")?.addEventListener("click", () => {
          if (Number.isInteger(job.sourceTabId)) {
            void chromeApi.runtime.sendMessage({ type: "SMARTPRINT_PRINT_ORIGINAL", sourceTabId: job.sourceTabId });
          }
        });
      } catch (error) {
        if (status) {
          status.textContent = error?.message || "No fue posible cargar la vista previa.";
          status.dataset.kind = "error";
        }
        documentRef.getElementById("print").disabled = true;
      }
    }
    return { start };
  }

  return { loadJob, createPreviewController };
});
