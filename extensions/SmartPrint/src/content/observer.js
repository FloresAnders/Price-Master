(function startSmartPrintContent(root) {
  "use strict";
  if (!root.document || !root.chrome?.runtime || !root.SmartPrintContent) return;
  root.SmartPrintContent.createContentController(root.document, root.chrome).start();
})(typeof globalThis !== "undefined" ? globalThis : this);
