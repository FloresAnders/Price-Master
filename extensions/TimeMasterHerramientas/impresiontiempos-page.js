(function initializeImpresionTiemposPage(root) {
  "use strict";

  if (
    root.location.hostname !== "gentecrystal.net" ||
    root.location.pathname !== "/print_pagos.php"
  ) {
    return;
  }

  const ENABLE_EVENT = "tmh-impresion-tiempos-enable";
  const DISABLE_EVENT = "tmh-impresion-tiempos-disable";
  const PRINTER_NAME_EVENT = "tmh-impresion-tiempos-printer-name";
  const DEFAULT_PRINTER_NAME = "TIEMPOS";
  const QZ_SCRIPT = "https://cdn.jsdelivr.net/npm/qz-tray@2.3.0/qz-tray.js";
  const originalPrint = root.print ? root.print.bind(root) : null;
  let enabled = false;
  let printerName = DEFAULT_PRINTER_NAME;
  let qzLoadPromise = null;
  let printInProgress = false;

  function showStatus(message, isError = false) {
    let box = root.document.getElementById("__gc_qz_status");
    if (!box) {
      box = root.document.createElement("div");
      box.id = "__gc_qz_status";
      box.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "right:14px",
        "top:14px",
        "max-width:360px",
        "padding:12px 16px",
        "border-radius:8px",
        "font:14px/1.4 Arial,sans-serif",
        "color:white",
        "box-shadow:0 3px 14px #0005",
      ].join(";");
      root.document.documentElement.appendChild(box);
    }
    box.style.background = isError ? "#a52828" : "#176b3a";
    box.textContent = message;
    if (!isError) root.setTimeout(() => box.remove(), 5000);
  }

  function loadQZ() {
    if (root.qz) return Promise.resolve(root.qz);
    if (qzLoadPromise) return qzLoadPromise;

    qzLoadPromise = new Promise((resolve, reject) => {
      const script = root.document.createElement("script");
      script.src = QZ_SCRIPT;
      script.onload = () =>
        root.qz
          ? resolve(root.qz)
          : reject(new Error("La biblioteca QZ Tray no se cargó."));
      script.onerror = () =>
        reject(
          new Error(
            "No se pudo descargar qz-tray.js desde jsDelivr. Revise la conexión a Internet o las políticas del sitio.",
          ),
        );
      (root.document.head || root.document.documentElement).appendChild(script);
    }).catch((error) => {
      qzLoadPromise = null;
      throw error;
    });
    return qzLoadPromise;
  }

  function buildPrintableHTML() {
    const copy = root.document.documentElement.cloneNode(true);
    copy.querySelectorAll("script, #__gc_qz_status").forEach((element) => {
      element.remove();
    });
    const base = root.document.createElement("base");
    base.href = root.location.href;
    const head = copy.querySelector("head");
    if (head) head.insertBefore(base, head.firstChild);
    return `<!DOCTYPE html>\n${copy.outerHTML}`;
  }

  async function printToTimes() {
    if (printInProgress) return;
    printInProgress = true;
    const selectedPrinter = printerName;

    try {
      showStatus("Conectando con QZ Tray…");
      const qz = await loadQZ();
      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ retries: 2, delay: 1 });
      }

      const printers = await qz.printers.find();
      if (!printers.includes(selectedPrinter)) {
        throw new Error(
          `QZ Tray no encontró la impresora "${selectedPrinter}". Impresoras detectadas: ${printers.join(", ")}`,
        );
      }

      showStatus(`Enviando comprobante a ${selectedPrinter}…`);
      const config = qz.configs.create(selectedPrinter);
      await qz.print(config, [
        {
          type: "pixel",
          format: "html",
          flavor: "plain",
          data: buildPrintableHTML(),
        },
      ]);
      showStatus(`Comprobante enviado a ${selectedPrinter}.`);
    } catch (error) {
      console.error("[Gente Crystal QZ]", error);
      const detail = error?.message || String(error);
      showStatus(
        `No se pudo imprimir en ${selectedPrinter}: ${detail}. Se abrirá la impresión normal.`,
        true,
      );
      root.setTimeout(() => {
        try {
          originalPrint?.();
        } catch (_) {
          // La impresión normal es solamente el respaldo final.
        }
      }, 900);
    } finally {
      root.setTimeout(() => {
        printInProgress = false;
      }, 1200);
    }
  }

  function controlledPrint(...args) {
    if (!enabled) return originalPrint?.(...args);
    return printToTimes();
  }

  root.document.addEventListener(ENABLE_EVENT, () => {
    enabled = true;
  });
  root.document.addEventListener(DISABLE_EVENT, () => {
    enabled = false;
  });
  root.document.addEventListener(PRINTER_NAME_EVENT, (event) => {
    const nextPrinterName = String(event.detail || "").trim();
    if (nextPrinterName) printerName = nextPrinterName;
  });
  root.addEventListener(
    "keydown",
    (event) => {
      if (
        !enabled ||
        !(event.ctrlKey || event.metaKey) ||
        String(event.key || "").toLowerCase() !== "p"
      ) {
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
      printToTimes();
    },
    true,
  );
  root.print = controlledPrint;
})(window);
