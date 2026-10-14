(function initializeSmartPrintModel(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintModel = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildModel() {
  "use strict";

  function cleanText(value) {
    return typeof value === "string"
      ? value.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim()
      : "";
  }

  function parseMoneyToMinorUnits(value) {
    let text = cleanText(String(value ?? "")).replace(/[^\d,.-]/g, "");
    if (!text || !/\d/.test(text)) return null;
    const negative = text.startsWith("-");
    text = text.replace(/-/g, "");
    const comma = text.lastIndexOf(",");
    const dot = text.lastIndexOf(".");
    let decimalIndex = -1;
    if (comma >= 0 && dot >= 0) decimalIndex = Math.max(comma, dot);
    else if (comma >= 0 && text.length - comma - 1 <= 2) decimalIndex = comma;
    else if (dot >= 0 && text.length - dot - 1 <= 2) decimalIndex = dot;

    let whole = decimalIndex >= 0 ? text.slice(0, decimalIndex) : text;
    let fraction = decimalIndex >= 0 ? text.slice(decimalIndex + 1) : "";
    whole = whole.replace(/\D/g, "") || "0";
    fraction = fraction.replace(/\D/g, "").slice(0, 2).padEnd(2, "0");
    try {
      const units = BigInt(whole) * 100n + BigInt(fraction || "0");
      return `${negative ? "-" : ""}${units.toString()}`;
    } catch {
      return null;
    }
  }

  function sumMoney(values) {
    let total = 0n;
    for (const value of values) {
      const parsed = parseMoneyToMinorUnits(value);
      if (parsed === null) return null;
      total += BigInt(parsed);
    }
    return total.toString();
  }

  function validateDocument(raw) {
    const documentValue = raw && typeof raw === "object" ? raw : {};
    const warnings = Array.isArray(documentValue.warnings)
      ? documentValue.warnings.map(cleanText).filter(Boolean)
      : [];
    if (!documentValue.source || !documentValue.kind) {
      warnings.push("No fue posible identificar el tipo de comprobante.");
    }

    if (documentValue.source === "gentecrystal") {
      const tickets = Array.isArray(documentValue.tickets)
        ? documentValue.tickets
        : [];
      if (tickets.length === 0) warnings.push("No se encontraron tiquetes.");
      for (const ticket of tickets) {
        const calculated = sumMoney(
          Array.isArray(ticket.entries)
            ? ticket.entries.map((entry) => entry.amount)
            : [],
        );
        const expected = parseMoneyToMinorUnits(ticket.subtotal);
        if (calculated !== null && expected !== null && calculated !== expected) {
          warnings.push(`El subtotal del tiquete ${ticket.id || "sin ID"} no coincide con sus jugadas.`);
        }
      }
      const subtotalSum = sumMoney(tickets.map((ticket) => ticket.subtotal));
      const grandTotal = parseMoneyToMinorUnits(documentValue.grandTotal);
      if (subtotalSum !== null && grandTotal !== null && subtotalSum !== grandTotal) {
        warnings.push("La suma de subtotales no coincide con el total general.");
      }
    }

    return {
      ...documentValue,
      warnings,
      confidence: warnings.length > 0 ? "needs_review" : "verified",
    };
  }

  return { cleanText, parseMoneyToMinorUnits, sumMoney, validateDocument };
});
