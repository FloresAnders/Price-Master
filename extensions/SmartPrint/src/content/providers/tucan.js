(function initializeTucan(root, factory) {
  const model = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../../core/model-core.js")
    : root.SmartPrintModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintTucan = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildTucan(model) {
  "use strict";

  function isHidden(node) {
    for (let current = node; current; current = current.parentElement) {
      const style = current.getAttribute("style") || "";
      if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;
      const explicitlyDisplayed = /display\s*:\s*(?!none\b)[a-z-]+/i.test(style);
      if ((current.hidden || current.getAttribute("aria-hidden") === "true") && !explicitlyDisplayed) return true;
    }
    return false;
  }

  function activeReceipt(documentRef) {
    const concentrator = Array.from(documentRef.querySelectorAll("#tablaConcentrador"))
      .find((node) => !isHidden(node) && /DETALLE DE PAGO|MONTO PAGADO/i.test(node.textContent || ""));
    if (concentrator) return concentrator;
    const preferred = documentRef.querySelector("#reciboImpresion");
    if (preferred && !isHidden(preferred)) return preferred;
    return Array.from(documentRef.querySelectorAll("#tablaComprobantePago"))
      .find((table) => !isHidden(table))?.closest("section, article, div") || null;
  }

  function extract(documentRef) {
    const receipt = activeReceipt(documentRef);
    if (!receipt) return null;
    const details = [];
    const directLines = [];
    for (const row of receipt.querySelectorAll("tr")) {
      const cells = Array.from(row.querySelectorAll("th, td")).map((cell) => model.cleanText(cell.textContent));
      if (cells.length >= 2 && cells[0] && cells[1]) {
        details.push({ label: cells[0].replace(/:$/, ""), value: cells.slice(1).join(" ") });
      } else if (cells[0]) {
        directLines.push(cells[0]);
      }
    }
    directLines.push(...Array.from(receipt.querySelectorAll("h1, h2, h3, p"))
      .map((node) => model.cleanText(node.textContent))
      .filter(Boolean));
    for (let index = 0; index < directLines.length; index += 1) {
      const line = directLines[index];
      const embedded = line.match(/^([^:]{1,80}):\s*(?:\.{2,}\s*)?(.*)$/);
      if (!embedded) continue;
      const label = model.cleanText(embedded[1]);
      let value = model.cleanText(embedded[2]).replace(/^\.+\s*/, "");
      if (!value && directLines[index + 1] && !/:/.test(directLines[index + 1])) {
        value = directLines[index + 1];
        index += 1;
      }
      if (label && value) details.push({ label, value });
    }
    const findDetail = (pattern) => details.find((entry) => pattern.test(entry.label))?.value;
    const grandTotal = findDetail(/^Total$/i) || findDetail(/Importe|Monto pagado/i);
    const notices = directLines.filter((line) => /conserve|advertencia|importante/i.test(line));
    const footerDate = model.cleanText(receipt.textContent).match(/\b(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2})\b/)?.[1];
    const currencyValue = findDetail(/^Moneda$/i);
    return model.validateDocument({
      source: "tucan",
      kind: "service_payment",
      header: {
        businessName: findDetail(/Nombre del negocio|Comercio/i),
        legalName: directLines.find((line) => /BANCO DE COSTA RICA/i.test(line)),
      },
      dateTime: findDetail(/^(Fecha(?: y hora)?|Hora)$/i) || footerDate,
      documentId: findDetail(/Transacci[oó]n|Operaci[oó]n|Numero de referencia/i),
      details,
      totals: grandTotal ? [{ label: "TOTAL", amount: grandTotal }] : [],
      grandTotal,
      currency: /COLONES/i.test(currencyValue || "") ? "CRC" : currencyValue || "CRC",
      legalNotices: notices,
      sourceText: [...directLines, ...details.map((entry) => `${entry.label}: ${entry.value}`)].join("\n"),
      warnings: !findDetail(/Servicio|Entidad|Convenio/i) || !grandTotal ? ["Falta servicio o total del comprobante."] : [],
    });
  }

  function matches(documentRef) {
    const receipt = activeReceipt(documentRef);
    return Boolean(receipt && /TUCAN|BANCO DE COSTA RICA/i.test(receipt.textContent || ""));
  }

  return { matches, extract, activeReceipt, isHidden };
});
