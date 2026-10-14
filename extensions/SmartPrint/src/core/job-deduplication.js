(function initializeJobDeduplication(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintJobs = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildJobs() {
  "use strict";

  function stableValue(value) {
    if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
    if (value && typeof value === "object") {
      return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
    }
    return JSON.stringify(value);
  }

  function hashDocument(value) {
    const text = stableValue(value);
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
  }

  function createJobDeduplicator(options = {}) {
    const now = options.now || Date.now;
    const ttlMs = Number.isFinite(options.ttlMs) ? options.ttlMs : 30_000;
    const seen = new Map();
    function accept(documentValue, request = {}) {
      if (request.explicitReprint) return true;
      const timestamp = now();
      for (const [key, recordedAt] of seen) {
        if (timestamp - recordedAt > ttlMs) seen.delete(key);
      }
      const key = hashDocument(documentValue);
      if (seen.has(key)) return false;
      seen.set(key, timestamp);
      return true;
    }
    return { accept, clear: () => seen.clear() };
  }

  return { hashDocument, createJobDeduplicator };
});
