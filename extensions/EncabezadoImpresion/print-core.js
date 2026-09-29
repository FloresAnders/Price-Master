(function initializePrintCore(root, factory) {
  const settings =
    typeof module === "object" && module.exports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? require("./settings-core.js")
      : root.EncabezadoImpresionSettings;
  const api = factory(settings);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.EncabezadoImpresionPrintCore = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildPrintCore(settings) {
    "use strict";

    const HEADER_ID = "encabezado-impresion-extension";

    function detectReceipt(documentRef) {
      const tucan = documentRef.querySelector("#tablaComprobantePago");
      if (tucan) return { kind: "tucan", target: tucan };

      const page = documentRef.querySelector(".page");
      if (
        page?.querySelector(".print-container") &&
        page.querySelector(".table-receipt")
      ) {
        return { kind: "junta", target: page };
      }

      return null;
    }

    function insertHeader(documentRef, rawSettings) {
      const receipt = detectReceipt(documentRef);
      const existing = documentRef.getElementById(HEADER_ID);
      if (!receipt || existing) return Boolean(existing);

      const value = settings.normalizeSettings(rawSettings);
      if (!value.imageDataUrl && value.lines.length === 0) return false;

      const section = documentRef.createElement("section");
      section.id = HEADER_ID;
      section.className = "ei-header";

      if (value.imageDataUrl) {
        const image = documentRef.createElement("img");
        image.className = "ei-image";
        image.alt = "";
        image.src = value.imageDataUrl;
        image.addEventListener(
          "error",
          () => {
            image.hidden = true;
          },
          { once: true },
        );
        section.append(image);
      }

      for (const text of value.lines) {
        const line = documentRef.createElement("div");
        line.className = "ei-line";
        line.textContent = text;
        section.append(line);
      }

      receipt.target.prepend(section);
      return true;
    }

    function createPrintController(documentRef, windowRef, storageArea) {
      let started = false;
      let observer = null;
      let pending = Promise.resolve(false);

      function sync() {
        pending = pending
          .catch(() => false)
          .then(async () => {
            const stored = await storageArea.get({
              [settings.STORAGE_KEY]: settings.DEFAULT_SETTINGS,
            });
            const inserted = insertHeader(
              documentRef,
              stored?.[settings.STORAGE_KEY],
            );
            if (inserted) observer?.disconnect();
            return inserted;
          });
        return pending;
      }

      function start() {
        if (started) return;
        started = true;

        observer = new windowRef.MutationObserver(() => {
          void sync();
        });
        observer.observe(documentRef, { childList: true, subtree: true });
        documentRef.addEventListener("DOMContentLoaded", sync, { once: true });
        windowRef.addEventListener("beforeprint", sync);
        void sync();
      }

      return { start, sync };
    }

    return {
      HEADER_ID,
      detectReceipt,
      insertHeader,
      createPrintController,
    };
  },
);
