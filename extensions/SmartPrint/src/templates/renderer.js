(function initializeRenderer(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildRenderer() {
  "use strict";

  function appendText(documentRef, parent, tag, text, className) {
    if (text === undefined || text === null || String(text).trim() === "") return null;
    const element = documentRef.createElement(tag);
    if (className) element.className = className;
    element.textContent = String(text);
    parent.append(element);
    return element;
  }

  function appendPair(documentRef, parent, label, value, attributes = {}) {
    if (!value) return;
    const row = documentRef.createElement("p");
    row.className = "smartprint-pair";
    for (const [key, attributeValue] of Object.entries(attributes)) row.setAttribute(key, attributeValue);
    appendText(documentRef, row, "span", label);
    appendText(documentRef, row, "strong", value);
    parent.append(row);
  }

  function appendConfiguredHeader(documentRef, receipt, header) {
    if (!header?.enabled) return;
    const section = documentRef.createElement("header");
    section.className = "smartprint-custom-header";
    if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(header.imageDataUrl || "")) {
      const image = documentRef.createElement("img");
      image.src = header.imageDataUrl;
      image.alt = "";
      section.append(image);
    }
    for (const configuredLine of header.lines || []) {
      const line = appendText(documentRef, section, "div", configuredLine.text);
      if (line) {
        line.style.fontFamily = `"${String(configuredLine.fontFamily || "Arial").replace(/["\\]/g, "")}", Arial, sans-serif`;
        line.style.fontSize = `${Number(configuredLine.fontSize) || 14}px`;
      }
    }
    if (section.hasChildNodes()) receipt.append(section);
  }

  function appendOriginalBlocks(documentRef, receipt, blocks) {
    for (const block of blocks) {
      if (block?.type === "heading") {
        appendText(documentRef, receipt, `h${Math.min(3, Math.max(1, Number(block.level) || 2))}`, block.text);
      } else if (block?.type === "text") {
        appendText(documentRef, receipt, "p", block.text);
      } else if (block?.type === "table" && Array.isArray(block.rows)) {
        const table = documentRef.createElement("table");
        for (const values of block.rows) {
          const row = documentRef.createElement("tr");
          for (const value of values) appendText(documentRef, row, "td", value);
          table.append(row);
        }
        receipt.append(table);
      }
    }
  }

  function createPrintView(documentRef, documentValue, settings) {
    const receipt = documentRef.createElement("article");
    receipt.className = "smartprint-receipt";
    receipt.dataset.paperWidth = settings?.paperWidth || "58";
    appendConfiguredHeader(documentRef, receipt, settings?.header);
    if (
      settings?.templateMode === "original" &&
      documentValue.source === "contica" &&
      Array.isArray(documentValue.sourceBlocks) &&
      documentValue.sourceBlocks.length > 0
    ) {
      receipt.dataset.smartprintTemplate = "original";
      appendOriginalBlocks(documentRef, receipt, documentValue.sourceBlocks);
      for (const warning of documentValue.warnings || []) appendText(documentRef, receipt, "p", warning, "smartprint-warning");
      return receipt;
    }
    receipt.dataset.smartprintTemplate = "universal";
    appendText(documentRef, receipt, "h1", documentValue.header?.businessName || documentValue.header?.legalName || "Comprobante");
    appendText(documentRef, receipt, "p", documentValue.header?.legalName, "smartprint-centered");
    appendPair(documentRef, receipt, "Documento", documentValue.documentId);
    appendPair(documentRef, receipt, "Fecha", documentValue.dateTime);
    appendPair(documentRef, receipt, "Cliente", documentValue.client?.name);

    for (const item of documentValue.items || []) {
      const section = documentRef.createElement("section");
      section.className = "smartprint-line-item";
      appendText(documentRef, section, "strong", item.description);
      appendPair(documentRef, section, item.quantity ? `${item.quantity} x` : "Importe", item.total);
      appendText(documentRef, section, "small", item.taxRate ? `IVA: ${item.taxRate}` : "");
      receipt.append(section);
    }

    for (const ticket of documentValue.tickets || []) {
      const section = documentRef.createElement("section");
      section.className = "smartprint-ticket";
      appendText(documentRef, section, "h2", ticket.draw);
      appendPair(documentRef, section, "Tiquete", ticket.id);
      appendPair(documentRef, section, "Código", ticket.code);
      appendPair(documentRef, section, "Fecha", ticket.date);
      for (const entry of ticket.entries || []) appendPair(documentRef, section, entry.number, entry.amount);
      appendPair(documentRef, section, "Subtotal", ticket.subtotal);
      receipt.append(section);
    }

    for (const detail of documentValue.details || []) appendPair(documentRef, receipt, detail.label, detail.value);
    if (documentValue.grandTotal) appendPair(documentRef, receipt, "TOTAL", documentValue.grandTotal, { "data-smartprint-grand-total": "" });
    for (const notice of documentValue.legalNotices || []) appendText(documentRef, receipt, "p", notice, "smartprint-notice");
    for (const warning of documentValue.warnings || []) appendText(documentRef, receipt, "p", warning, "smartprint-warning");
    return receipt;
  }

  return { createPrintView, appendOriginalBlocks };
});
