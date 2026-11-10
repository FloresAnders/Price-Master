(() => {
  "use strict";

  // Protección adicional: actuar solamente en el comprobante de pagos.
  if (location.hostname !== "gentecrystal.net" ||
      location.pathname !== "/print_pagos.php") return;

  const PRINTER_NAME = "TIEMPOS";
  const QZ_SCRIPT = "https://cdn.jsdelivr.net/npm/qz-tray@2.3.0/qz-tray.js";
  const originalPrint = window.print ? window.print.bind(window) : null;

  let qzLoadPromise = null;
  let printInProgress = false;

  function showStatus(message, isError = false) {
    let box = document.getElementById("__gc_qz_status");
    if (!box) {
      box = document.createElement("div");
      box.id = "__gc_qz_status";
      box.style.cssText = [
        "position:fixed", "z-index:2147483647", "right:14px", "top:14px",
        "max-width:360px", "padding:12px 16px", "border-radius:8px",
        "font:14px/1.4 Arial,sans-serif", "color:white",
        "box-shadow:0 3px 14px #0005"
      ].join(";");
      document.documentElement.appendChild(box);
    }
    box.style.background = isError ? "#a52828" : "#176b3a";
    box.textContent = message;
    if (!isError) setTimeout(() => box.remove(), 5000);
  }

  function loadQZ() {
    if (window.qz) return Promise.resolve(window.qz);
    if (qzLoadPromise) return qzLoadPromise;

    qzLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = QZ_SCRIPT;
      script.onload = () => window.qz ? resolve(window.qz) : reject(new Error("La biblioteca QZ Tray no se cargó."));
      script.onerror = () => reject(new Error("No se pudo descargar qz-tray.js desde jsDelivr. Revise la conexión a Internet o las políticas del sitio."));
      (document.head || document.documentElement).appendChild(script);
    });
    return qzLoadPromise;
  }

  function buildPrintableHTML() {
    const copy = document.documentElement.cloneNode(true);

    // Quitar scripts y el aviso visual de esta extensión del documento impreso.
    copy.querySelectorAll("script, #__gc_qz_status").forEach(el => el.remove());

    // Resolver rutas relativas de CSS, imágenes y otros recursos.
    const base = document.createElement("base");
    base.href = location.href;
    const head = copy.querySelector("head");
    if (head) head.insertBefore(base, head.firstChild);

    return "<!DOCTYPE html>\n" + copy.outerHTML;
  }

  async function printToTimes() {
    if (printInProgress) return;
    printInProgress = true;

    try {
      showStatus("Conectando con QZ Tray…");
      const qz = await loadQZ();

      if (!qz.websocket.isActive()) {
        await qz.websocket.connect({ retries: 2, delay: 1 });
      }

      const printers = await qz.printers.find();
      if (!printers.includes(PRINTER_NAME)) {
        throw new Error('QZ Tray no encontró la impresora "' + PRINTER_NAME + '". Impresoras detectadas: ' + printers.join(", "));
      }

      showStatus("Enviando comprobante a TIEMPOS…");
      const config = qz.configs.create(PRINTER_NAME);
      const html = buildPrintableHTML();
      const data = [{
        type: "pixel",
        format: "html",
        flavor: "plain",
        data: html
      }];

      await qz.print(config, data);
      showStatus("Comprobante enviado a TIEMPOS.");
    } catch (err) {
      console.error("[Gente Crystal QZ]", err);
      showStatus("No se pudo imprimir en TIEMPOS: " + (err && err.message ? err.message : err) + ". Se abrirá la impresión normal.", true);
      // Respaldo seguro: no perder la impresión si QZ falla.
      setTimeout(() => {
        try { if (originalPrint) originalPrint(); } catch (_) {}
      }, 900);
    } finally {
      setTimeout(() => { printInProgress = false; }, 1200);
    }
  }

  // Interceptar el botón de impresión del sitio si llama a window.print().
  window.print = function() {
    return printToTimes();
  };

  // Interceptar Ctrl+P únicamente en esta URL.
  window.addEventListener("keydown", event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "p") {
      event.preventDefault();
      event.stopImmediatePropagation();
      printToTimes();
    }
  }, true);

  console.info("[Gente Crystal] Impresión dirigida a TIEMPOS mediante QZ Tray.");
})();
