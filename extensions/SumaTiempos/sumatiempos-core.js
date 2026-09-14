(function initializeSumaTiemposCore(root, factory) {
  const api = factory();
  root.SumaTiemposCore = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createSumaTiemposCore() {
  "use strict";

  function parseNumbers(value) {
    return String(value ?? "")
      .trim()
      .split(/[\s,;|/\\-]+/)
      .filter((token) => /^\d{1,2}$/.test(token));
  }

  function parseCurrency(value) {
    let normalized = String(value ?? "").replace(/[^\d,.-]/g, "");
    if (!normalized || !/\d/.test(normalized)) return 0;

    const comma = normalized.lastIndexOf(",");
    const dot = normalized.lastIndexOf(".");

    if (comma >= 0 && dot >= 0) {
      const decimalSeparator = comma > dot ? "," : ".";
      const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
      normalized = normalized
        .replace(thousandsSeparator, "")
        .replace(decimalSeparator, ".");
    } else if (comma >= 0) {
      normalized = /^-?\d{1,3}(,\d{3})+$/.test(normalized)
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function calculateTotals(input) {
    const numberCount = parseNumbers(input.numbersText).length;
    const mainPerNumber = parseCurrency(input.mainAmount);
    const companionPerNumber = input.companionActive
      ? parseCurrency(input.companionAmount)
      : 0;
    const ticketTotal = parseCurrency(input.ticketTotal);
    const captureTotal = numberCount * (mainPerNumber + companionPerNumber);

    return {
      numberCount,
      mainPerNumber,
      companionPerNumber,
      ticketTotal,
      captureTotal,
      grandTotal: ticketTotal + captureTotal,
    };
  }

  return { calculateTotals, parseCurrency, parseNumbers };
});
