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

      const junta = documentRef.querySelector(".receipt-container");
      if (
        junta?.querySelector(".header-top-row") &&
        junta.querySelector(".receipt-footer")
      ) {
        return { kind: "junta", target: junta };
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

      for (const configuredLine of value.lines) {
        const line = documentRef.createElement("div");
        line.className = "ei-line";
        line.textContent = configuredLine.text;
        line.style.fontFamily = settings.fontFamilyStack(
          configuredLine.fontFamily,
        );
        line.style.fontSize = `${configuredLine.fontSize}px`;
        section.append(line);
      }

      receipt.target.prepend(section);
      return true;
    }

    function createPrintController(documentRef, windowRef, storageArea) {
      let started = false;
      let observer = null;
      let cachedSettings = null;
      let loadingSettings = null;

      function insertCachedHeader() {
        if (!cachedSettings) return false;
        const inserted = insertHeader(documentRef, cachedSettings);
        if (inserted) observer?.disconnect();
        return inserted;
      }

      function loadSettings() {
        if (!loadingSettings) {
          loadingSettings = storageArea
            .get({
              [settings.STORAGE_KEY]: settings.DEFAULT_SETTINGS,
            })
            .then((stored) => {
              cachedSettings = settings.normalizeSettings(
                stored?.[settings.STORAGE_KEY],
              );
              return cachedSettings;
            })
            .catch(() => {
              loadingSettings = null;
              return null;
            });
        }
        return loadingSettings;
      }

      function sync() {
        if (cachedSettings) {
          return Promise.resolve(insertCachedHeader());
        }
        return loadSettings().then((value) =>
          value ? insertCachedHeader() : false,
        );
      }

      function start() {
        if (started) return;
        started = true;

        observer = new windowRef.MutationObserver(() => {
          if (!insertCachedHeader()) void sync();
        });
        observer.observe(documentRef, { childList: true, subtree: true });
        documentRef.addEventListener("DOMContentLoaded", sync, { once: true });
        windowRef.addEventListener("beforeprint", () => {
          if (!insertCachedHeader()) void sync();
        });
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
