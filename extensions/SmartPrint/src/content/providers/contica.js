(function initializeContica(root, factory) {
  const model = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../../core/model-core.js")
    : root.SmartPrintModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintContica = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildContica(model) {
  "use strict";

  function lineValue(lines, labels) {
    for (const line of lines) {
      for (const label of labels) {
        const match = line.match(new RegExp(`^${label}\\s*:\\s*(.+)$`, "i"));
        if (match) return model.cleanText(match[1]);
      }
    }
    return undefined;
  }

  function documentFromInvoice(documentRef) {
    const frame = documentRef.querySelector("#printInvoice iframe#invoice, iframe#invoice");
    if (!frame) return null;
    const source = frame.getAttribute("srcdoc");
    if (source) return new documentRef.defaultView.DOMParser().parseFromString(source, "text/html");
    try {
      return frame.contentDocument || null;
    } catch {
      return null;
    }
  }

  function textLines(root) {
    if (!root) return [];
    const parts = [];
    const blockTags = new Set(["ADDRESS", "ARTICLE", "DIV", "FOOTER", "H1", "H2", "H3", "HEADER", "LI", "P", "PRE", "SECTION", "TR"]);
    function visit(node) {
      if (node.nodeType === 3) {
        parts.push(node.nodeValue || "");
        return;
      }
      if (node.nodeType !== 1) return;
      if (node.tagName === "BR") {
        parts.push("\n");
        return;
      }
      const block = blockTags.has(node.tagName);
      if (block) parts.push("\n");
      for (const child of node.childNodes) visit(child);
      if (block) parts.push("\n");
    }
    visit(root);
    return parts.join("").split(/\r?\n/).map(model.cleanText).filter(Boolean);
  }

  function tableRows(table) {
    return Array.from(table.querySelectorAll("tr"))
      .map((row) => Array.from(row.querySelectorAll(":scope > th, :scope > td")).map((cell) => model.cleanText(cell.textContent)))
      .filter((row) => row.some(Boolean));
  }

  function extractSourceBlocks(invoice) {
    const blocks = [];
    const ignored = new Set(["SCRIPT", "STYLE", "FORM", "BUTTON", "INPUT", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "BASE"]);
    function visit(node) {
      if (!node || node.nodeType !== 1 || ignored.has(node.tagName)) return;
      if (node.tagName === "TABLE") {
        const rows = tableRows(node);
        if (rows.length > 0) blocks.push({ type: "table", rows });
        return;
      }
      if (/^H[1-3]$/.test(node.tagName)) {
        const text = model.cleanText(node.textContent);
        if (text) blocks.push({ type: "heading", level: Number(node.tagName[1]), text });
        return;
      }
      if (["P", "LI", "PRE"].includes(node.tagName)) {
        const text = model.cleanText(node.textContent);
        if (text) blocks.push({ type: "text", text });
        return;
      }
      for (const child of node.children) visit(child);
    }
    visit(invoice.body);
    return blocks;
  }

  function extract(documentRef) {
    const sourceInvoice = documentFromInvoice(documentRef);
    if (!sourceInvoice) return null;
    const invoice = new documentRef.defaultView.DOMParser().parseFromString(sourceInvoice.documentElement.outerHTML, "text/html");
    invoice.querySelectorAll("script, style, form, button, input").forEach((node) => node.remove());
    const lines = textLines(invoice.body);
    const tables = Array.from(invoice.querySelectorAll("table"));
    const itemTable = tables.find((table) => /descripci[oó]n|producto/i.test(table.textContent || ""));
    const items = [];
    if (itemTable) {
      const rows = tableRows(itemTable);
      const headerRowIndex = rows.findIndex((row) => row.some((cell) => /descripci[oó]n|producto/i.test(cell)));
      const headers = (headerRowIndex >= 0 ? rows[headerRowIndex] : []).map((cell) => cell.toLowerCase());
      const indexOf = (pattern) => headers.findIndex((header) => pattern.test(header));
      const quantityIndex = indexOf(/cantidad|cant/);
      const descriptionIndex = indexOf(/descripci[oó]n|producto/);
      const taxIndex = indexOf(/iva|impuesto/);
      const totalIndex = indexOf(/total|precio/);
      for (const cells of rows.slice(headerRowIndex + 1)) {
        const description = descriptionIndex >= 0 ? cells[descriptionIndex] : undefined;
        if (!description) continue;
        items.push({
          description,
          ...(quantityIndex >= 0 && { quantity: cells[quantityIndex] }),
          ...(taxIndex >= 0 && { taxRate: cells[taxIndex] }),
          ...(totalIndex >= 0 && { total: cells[totalIndex] }),
        });
      }
    }
    const businessName = model.cleanText(invoice.querySelector("h1")?.textContent);
    const rowPairs = tables.flatMap(tableRows)
      .filter((row) => row.length >= 2 && row[0] && row.slice(1).some(Boolean))
      .map((row) => ({ label: row[0].replace(/:$/, ""), amount: row.slice(1).filter(Boolean).join(" ") }));
    const grandTotal = lineValue(lines, ["TOTAL"]) || rowPairs.find((entry) => /^TOTAL$/i.test(entry.label))?.amount;
    const lineTotals = lines
      .map((line) => line.match(/^(Subtotal|IVA|Impuestos?|Descuento|TOTAL)\s*:\s*(.+)$/i))
      .filter(Boolean)
      .map((match) => ({ label: match[1], amount: model.cleanText(match[2]) }));
    const rowTotals = rowPairs.filter((entry) => /^(Subtotal|IVA|Impuestos?|Descuento|TOTAL)$/i.test(entry.label));
    const totals = [...lineTotals, ...rowTotals].filter((entry, index, all) =>
      all.findIndex((candidate) => candidate.label.toLowerCase() === entry.label.toLowerCase() && candidate.amount === entry.amount) === index);
    const legalNotices = lines.filter((line) => /resoluci[oó]n|fiscal|tribut/i.test(line));
    return model.validateDocument({
      source: "contica",
      kind: "invoice",
      header: {
        businessName,
        taxId: lineValue(lines, ["C[eé]dula jur[ií]dica", "C[eé]dula", "Identificaci[oó]n"]),
      },
      dateTime: lineValue(lines, ["Fecha"]),
      documentId: lineValue(lines, ["Consecutivo", "Factura", "Documento"]),
      client: { name: lineValue(lines, ["Cliente"]) },
      items,
      details: [
        ["Condición", lineValue(lines, ["Condici[oó]n"])],
        ["Vendedor", lineValue(lines, ["Vendedor"])],
        ["Forma de pago", lineValue(lines, ["Forma de pago"])],
      ].filter((entry) => entry[1]).map(([label, value]) => ({ label, value })),
      totals,
      grandTotal,
      currency: lines.some((line) => line.includes("$") && !line.includes("₡")) ? "USD" : "CRC",
      legalNotices,
      sourceBlocks: extractSourceBlocks(invoice),
      sourceText: lines.join("\n"),
      warnings: items.length === 0 || !grandTotal ? ["Faltan líneas o total de la factura."] : [],
    });
  }

  function matches(documentRef) {
    return Boolean(documentRef.querySelector("#printInvoice iframe#invoice, iframe#invoice"));
  }

  return { matches, extract, documentFromInvoice, extractSourceBlocks, textLines, tableRows };
});
