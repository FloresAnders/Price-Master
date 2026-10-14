(function initializeGenteCrystal(root, factory) {
  const model = typeof module === "object" && module.exports
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ? require("../../core/model-core.js")
    : root.SmartPrintModel;
  const api = factory(model);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintGenteCrystal = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCrystal(model) {
  "use strict";

  const IGNORED_SELECTOR = "script, style, form, button, input, iframe, object, embed, .print-screen-only, #smartprint-page-action";

  function linesFrom(documentRef) {
    const source = documentRef.querySelector("#print-ticket, main, body");
    if (!source) return [];
    const copy = source.cloneNode(true);
    copy.querySelectorAll(IGNORED_SELECTOR).forEach((node) => node.remove());
    const parts = [];
    const blockTags = new Set(["ADDRESS", "ARTICLE", "DIV", "FOOTER", "H1", "H2", "H3", "HEADER", "LI", "MAIN", "P", "PRE", "SECTION", "TR"]);
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
    visit(copy);
    return parts.join("").split(/\r?\n/)
      .map((line) => model.cleanText(line))
      .filter(Boolean);
  }

  function labelValue(lines, pattern) {
    const line = lines.find((value) => pattern.test(value));
    return line ? model.cleanText(line.replace(pattern, "")) : undefined;
  }

  function isDrawLine(line) {
    if (!line || /\d+v\b/i.test(line)) return false;
    if (/^(?=.*[A-Z])(?=.*\d)[A-Z0-9]{8}$/i.test(line)) return false;
    if (!/^[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s\d-]{2,}$/u.test(line)) return false;
    return !/^(GRUPO CAFETERO|TOTAL(?: GENERAL)?|NUMERO\s*(?:->|→)\s*MONTO)$/i.test(line);
  }

  function ticketId(line) {
    const labeled = line.match(/^Tiquete\s*:\s*(.+)$/i);
    if (labeled) return model.cleanText(labeled[1]);
    return /^\d{4,}-\d+-\d+$/.test(line) ? line : undefined;
  }

  function parseEntries(lines) {
    const entries = [];
    for (const line of lines) {
      const match = line.match(/^([\d\s,]+)\s*(?:->|→)\s*([\d.,]+)$/);
      if (!match) continue;
      const amount = match[2];
      for (const number of match[1].split(",").map((value) => value.trim()).filter(Boolean)) {
        entries.push({ number, amount });
      }
    }
    return entries;
  }

  function extract(documentRef) {
    const lines = linesFrom(documentRef);
    const ticketStarts = lines.map((line, index) => (ticketId(line) ? index : -1)).filter((index) => index >= 0);
    const tickets = ticketStarts.map((start, ticketIndex) => {
      const end = ticketStarts[ticketIndex + 1] ?? lines.length;
      const segment = lines.slice(start, end);
      let draw = segment.find((line) => isDrawLine(line)) || "Sorteo";
      if (draw === "Sorteo") {
        for (let index = start - 1; index >= Math.max(0, (ticketStarts[ticketIndex - 1] ?? -1) + 1); index -= 1) {
          if (isDrawLine(lines[index])) {
            draw = lines[index];
            break;
          }
        }
      }
      const id = ticketId(lines[start]);
      const code = labelValue(segment, /^C[oó]digo\s*:\s*/i) ||
        segment.slice(1).find((line) => /^(?=.*[A-Z])[A-Z0-9]{8}$/i.test(line));
      const subtotal = labelValue(segment, /^Subtotal\s*:\s*/i);
      const date = labelValue(segment, /^Fecha\s*:\s*/i) ||
        labelValue(lines.slice(Math.max(0, start - 4), start + 1), /^Fecha\s*:\s*/i);
      return { id, ...(code && { code }), draw, ...(date && { date }), entries: parseEntries(segment), subtotal: subtotal || "" };
    });
    const grandTotal =
      labelValue(lines, /^TOTAL GENERAL\s*:\s*/i) ||
      labelValue([...lines].reverse(), /^TOTAL\s*:\s*/i);
    const businessName = lines.find((line) => /GRUPO CAFETERO/i.test(line));
    const totalIndex = lines.findLastIndex((line) => /^TOTAL(?: GENERAL)?\s*:/i.test(line));
    const legalNotices = [
      ...lines.filter((line) => /\b\d+v\b|n[uú]mero de jugadas/i.test(line)),
      ...(totalIndex >= 0 ? lines.slice(totalIndex + 1) : []),
    ].filter((line, index, all) => !/^[=-]+$/.test(line) && all.indexOf(line) === index);
    return model.validateDocument({
      source: "gentecrystal",
      kind: "lottery",
      header: {
        businessName,
        location: labelValue(lines, /^Puesto\s*:\s*/i),
      },
      documentId: tickets[0]?.id,
      client: { name: labelValue(lines, /^Cliente\s*:\s*/i) },
      tickets,
      totals: grandTotal ? [{ label: "TOTAL", amount: grandTotal }] : [],
      grandTotal,
      currency: "CRC",
      legalNotices,
      sourceText: lines.join("\n"),
      warnings: tickets.some((ticket) => !ticket.id || !ticket.subtotal) || !grandTotal
        ? ["Faltan identificadores, subtotales o total general."]
        : [],
    });
  }

  function matches(documentRef) {
    const text = documentRef.body?.textContent || "";
    return /GRUPO CAFETERO/i.test(text) && /\d{1,2}(?:\s*,\s*\d{1,2})*\s*(?:->|→)\s*[\d.,]+/.test(text) && /TOTAL\s*:/i.test(text);
  }

  return { matches, extract, linesFrom, parseEntries };
});
