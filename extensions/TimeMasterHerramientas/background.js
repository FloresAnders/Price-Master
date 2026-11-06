(function initializeBackground(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasBackground = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.chrome?.runtime?.onMessage && root.chrome?.storage?.session) {
    api.createBackgroundController(root.chrome).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildBackground() {
  "use strict";

  const MESSAGE_TYPE = "tmh-cache-print-lines";
  const ALLOWED_CACHE_KEYS = new Set([
    "tmhDetectedPrintLinesTicket",
    "tmhDetectedPrintLinesBcr",
  ]);
  const CATALOG_KEYS = Object.freeze({
    tmhDetectedPrintLinesTicket: "tmhKnownPrintLinesTicket",
    tmhDetectedPrintLinesBcr: "tmhKnownPrintLinesBcr",
  });

  function normalizeLines(lines) {
    if (!Array.isArray(lines)) return [];
    const seen = new Set();
    const normalized = [];
    for (const line of lines.slice(0, 500)) {
      if (
        !line ||
        typeof line.id !== "string" ||
        typeof line.text !== "string" ||
        !line.id ||
        seen.has(line.id)
      ) {
        continue;
      }
      seen.add(line.id);
      normalized.push({
        id: line.id.slice(0, 500),
        text: line.text.slice(0, 5000),
      });
    }
    return normalized;
  }

  function wordsFromToken(token) {
    return token.replace(/-/g, " ").toUpperCase();
  }

  function logicalLabelForId(id) {
    const parts = id.split(":");
    if (parts[0] === "bcr" && parts[1] === "field") {
      const suffix = parts[3];
      const label = wordsFromToken(parts[2] || "LINEA");
      if (suffix === "label") return `${label} (ETIQUETA)`;
      if (suffix === "value") return `${label} (VALOR)`;
      return label;
    }
    if (id === "bcr:date") return "FECHA BCR";
    if (parts[0] === "bcr" && parts[1] === "text") {
      return wordsFromToken(parts[2] || "LINEA");
    }
    if (parts[0] === "ticket") {
      if (parts[1] === "code") return "CODIGO";
      if (parts[1] === "date") return "FECHA";
      if (parts[1] === "draw") return "SORTEO";
    }
    return `LINEA ${parts.at(-1) || ""}`.trim();
  }

  function normalizeCatalog(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.filter((entry) => {
      if (
        !entry ||
        typeof entry.id !== "string" ||
        typeof entry.label !== "string" ||
        !entry.id ||
        !entry.label ||
        seen.has(entry.id)
      ) {
        return false;
      }
      seen.add(entry.id);
      return true;
    }).map((entry) => ({ id: entry.id, label: entry.label }));
  }

  function createBackgroundController(chromeApi) {
    let started = false;
    const catalogQueue = [];
    let catalogUpdateRunning = false;

    function processCatalogQueue() {
      if (catalogUpdateRunning || catalogQueue.length === 0) return;
      catalogUpdateRunning = true;
      const current = catalogQueue.shift();
      const catalogKey = CATALOG_KEYS[current.cacheKey];
      chromeApi.storage.local.get({ [catalogKey]: [] }, (stored) => {
        const catalog = normalizeCatalog(stored?.[catalogKey]);
        const knownIds = new Set(catalog.map((entry) => entry.id));
        for (const line of current.lines) {
          if (knownIds.has(line.id)) continue;
          knownIds.add(line.id);
          catalog.push({ id: line.id, label: logicalLabelForId(line.id) });
        }
        chromeApi.storage.local.set({ [catalogKey]: catalog }, () => {
          const failed = Boolean(chromeApi.runtime.lastError);
          catalogUpdateRunning = false;
          current.done(failed);
          processCatalogQueue();
        });
      });
    }

    function enqueueCatalogUpdate(cacheKey, lines, done) {
      catalogQueue.push({ cacheKey, lines, done });
      processCatalogQueue();
    }

    function handleMessage(message, _sender, sendResponse) {
      if (
        message?.type !== MESSAGE_TYPE ||
        !ALLOWED_CACHE_KEYS.has(message.cacheKey) ||
        !Array.isArray(message.lines)
      ) {
        return false;
      }
      const lines = normalizeLines(message.lines);
      const payload = { [message.cacheKey]: lines };
      let pending = 2;
      let failed = false;
      const complete = (operationFailed) => {
        failed ||= operationFailed;
        pending -= 1;
        if (pending === 0) sendResponse(failed ? { ok: false } : { ok: true });
      };
      chromeApi.storage.session.set(payload, () => {
        complete(Boolean(chromeApi.runtime.lastError));
      });
      enqueueCatalogUpdate(message.cacheKey, lines, complete);
      return true;
    }

    function start() {
      if (started) return;
      started = true;
      chromeApi.runtime.onMessage.addListener(handleMessage);
    }

    function destroy() {
      if (!started) return;
      started = false;
      chromeApi.runtime.onMessage.removeListener(handleMessage);
    }

    return { start, destroy };
  }

  return {
    createBackgroundController,
    logicalLabelForId,
    normalizeCatalog,
    normalizeLines,
  };
});
