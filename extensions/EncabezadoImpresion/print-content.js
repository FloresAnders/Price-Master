(function startPrintHeader(root) {
  "use strict";

  const core = root.EncabezadoImpresionPrintCore;
  const storage = root.chrome?.storage?.local;
  if (!root.document || !core || !storage) return;

  core.createPrintController(root.document, root, storage).start();
})(typeof globalThis !== "undefined" ? globalThis : this);
