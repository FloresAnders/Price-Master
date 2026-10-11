(function initializeDividirEfectivoCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasDividirEfectivo = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildDividirEfectivoCore() {
  "use strict";

  const CASH_DIVISION_PATTERN = /^\s*(\d+(?:[.,]\d+)?)\s*\/\s*([2-5])\s*$/;

  function calculateCashDivision(value) {
    const match = CASH_DIVISION_PATTERN.exec(String(value ?? ""));
    if (!match) return null;

    const amount = Number(match[1].replace(",", "."));
    const divisor = Number(match[2]);
    if (!Number.isFinite(amount)) return null;

    return String(Math.round((amount / divisor + Number.EPSILON) * 100) / 100);
  }

  function createCashDivisionController(documentRef) {
    const cashInputIds = new Set(["payUSD", "payCRC"]);
    let started = false;

    function handleInput(event) {
      const input = event.target;
      if (!input || !cashInputIds.has(input.id)) return;

      const result = calculateCashDivision(input.value);
      if (result !== null) input.value = result;
    }

    function start() {
      if (started) return;
      started = true;
      documentRef.addEventListener("input", handleInput, true);
    }

    function stop() {
      if (!started) return;
      started = false;
      documentRef.removeEventListener("input", handleInput, true);
    }

    return { start, stop };
  }

  return { calculateCashDivision, createCashDivisionController };
});
