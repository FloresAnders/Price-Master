(function initializeGeneric(root, factory) {
  const model = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../../core/model-core.js")
    : root.SmartPrintModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintGeneric = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGeneric(model) {
  "use strict";
  function extract(documentRef) {
    const sourceText = model.cleanText(documentRef.body?.innerText || documentRef.body?.textContent || "");
    return model.validateDocument({
      source: "generic",
      kind: "other",
      header: { businessName: model.cleanText(documentRef.title) || undefined },
      details: [],
      totals: [],
      sourceText,
      warnings: ["Documento no reconocido; use impresión original o revise la vista previa."],
    });
  }
  return { extract };
});
