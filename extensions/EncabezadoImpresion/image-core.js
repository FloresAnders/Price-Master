(function initializeImageCore(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.EncabezadoImpresionImageCore = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildImageCore() {
    "use strict";

    const ACCEPTED_TYPES = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
    ]);
    const MAX_WIDTH = 1200;
    const MAX_BYTES = 2 * 1024 * 1024;

    function isAcceptedImageType(type) {
      return ACCEPTED_TYPES.has(type);
    }

    function calculateScaledSize(width, height) {
      const safeWidth = Number(width);
      const safeHeight = Number(height);
      if (safeWidth <= 0 || safeHeight <= 0) {
        return { width: 0, height: 0 };
      }
      const scale = safeWidth > MAX_WIDTH ? MAX_WIDTH / safeWidth : 1;
      return {
        width: Math.round(safeWidth * scale),
        height: Math.round(safeHeight * scale),
      };
    }

    function estimateDataUrlBytes(dataUrl) {
      const payload = String(dataUrl).split(",")[1] || "";
      const padding = payload.endsWith("==")
        ? 2
        : payload.endsWith("=")
          ? 1
          : 0;
      return Math.max(0, Math.floor((payload.length * 3) / 4) - padding);
    }

    return {
      MAX_BYTES,
      MAX_WIDTH,
      isAcceptedImageType,
      calculateScaledSize,
      estimateDataUrlBytes,
    };
  },
);
