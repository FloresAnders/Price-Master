(function initializeBackgroundCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintBackground = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBackground() {
  "use strict";
  const JOB_PREFIX = "smartPrintJob:";
  const MAX_JOB_BYTES = 1_000_000;
  const MAX_SESSION_JOBS = 20;

  function defaultJobId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function byteLength(value) {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  }

  async function pruneJobs(storageArea) {
    if (typeof storageArea.get !== "function" || typeof storageArea.remove !== "function") return;
    const stored = await storageArea.get(null);
    const jobs = Object.entries(stored || {})
      .filter(([key]) => key.startsWith(JOB_PREFIX))
      .sort((left, right) => Date.parse(left[1]?.createdAt || 0) - Date.parse(right[1]?.createdAt || 0));
    const removeCount = Math.max(0, jobs.length - (MAX_SESSION_JOBS - 1));
    if (removeCount > 0) await storageArea.remove(jobs.slice(0, removeCount).map(([key]) => key));
  }

  async function openPreview(chromeApi, payload, sourceTabId, idFactory = defaultJobId) {
    if (!payload?.document || typeof payload.document !== "object") {
      throw new Error("El trabajo de impresión no contiene un documento válido.");
    }
    const jobId = String(idFactory());
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(jobId)) throw new Error("Identificador de trabajo inválido.");
    const job = { ...payload, sourceTabId, createdAt: new Date().toISOString() };
    if (byteLength(job) > MAX_JOB_BYTES) throw new Error("El comprobante es demasiado grande para una vista previa segura.");
    await pruneJobs(chromeApi.storage.session);
    await chromeApi.storage.session.set({ [`${JOB_PREFIX}${jobId}`]: job });
    await chromeApi.tabs.create({
      url: chromeApi.runtime.getURL(`src/pages/preview.html?job=${encodeURIComponent(jobId)}`),
    });
    return { ok: true, jobId };
  }

  function start(chromeApi) {
    chromeApi.runtime.onMessage.addListener((message, sender, respond) => {
      if (message?.type === "SMARTPRINT_OPEN_PREVIEW") {
        openPreview(chromeApi, message.payload, message.sourceTabId ?? sender.tab?.id)
          .then(respond)
          .catch((error) => respond({ ok: false, error: error?.message || "No fue posible abrir la vista previa." }));
        return true;
      }
      if (message?.type === "SMARTPRINT_PRINT_ORIGINAL" && Number.isInteger(message.sourceTabId)) {
        chromeApi.tabs.sendMessage(message.sourceTabId, { type: "SMARTPRINT_PRINT_ORIGINAL" })
          .then(() => respond({ ok: true }))
          .catch((error) => respond({ ok: false, error: error?.message || "No fue posible imprimir el original." }));
        return true;
      }
      return false;
    });
  }

  return { JOB_PREFIX, MAX_JOB_BYTES, MAX_SESSION_JOBS, byteLength, pruneJobs, openPreview, start };
});
