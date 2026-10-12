(function initializeMoverPagoCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasMoverPago = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildMoverPagoCore() {
  "use strict";

  const METHOD_LABELS = Object.freeze({
    E: "EFECTIVO",
    T: "TARJETA",
    S: "SINPE",
  });

  function createPaymentShortcutController(documentRef) {
    let started = false;

    function isAvailable(input) {
      if (
        !input ||
        input.disabled ||
        input.readOnly ||
        input.getAttribute("aria-disabled") === "true" ||
        typeof input.focus !== "function"
      ) {
        return false;
      }

      const windowRef = documentRef.defaultView;
      for (let element = input; element; element = element.parentElement) {
        if (
          element.hidden ||
          element.hasAttribute("inert") ||
          element.getAttribute("aria-hidden") === "true"
        ) {
          return false;
        }
        const style = windowRef?.getComputedStyle?.(element);
        if (
          style?.display === "none" ||
          style?.visibility === "hidden" ||
          style?.visibility === "collapse"
        ) {
          return false;
        }
      }

      return true;
    }

    function normalizedLabel(value) {
      return String(value || "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase();
    }

    function paymentMethod(input) {
      if (input?.id === "payUSD" || input?.id === "payCRC") return "E";
      if (!input?.matches?.("input.pay-input:not(.voucher-input)")) return null;
      const label = normalizedLabel(
        input.closest(".sides-padding")?.querySelector(".pay-label")?.textContent,
      );
      if (label === "TARJETA") return "T";
      if (label === "SINPE") return "S";
      return null;
    }

    function paymentCurrency(input) {
      if (input?.id === "payUSD") return "USD";
      if (input?.id === "payCRC") return "CRC";
      const symbol = input?.parentElement
        ?.querySelector(".pay-input-label")
        ?.textContent?.trim();
      if (symbol?.includes("$") || /USD/i.test(symbol || "")) return "USD";
      if (symbol?.includes("₡") || /CRC/i.test(symbol || "")) return "CRC";
      return null;
    }

    function findMethodInput(method, currency, source) {
      if (method === "E") {
        return documentRef.getElementById(currency === "USD" ? "payUSD" : "payCRC");
      }

      const scope = source.closest?.("#pv-payment-modal") || documentRef;
      const expectedLabel = METHOD_LABELS[method];
      for (const row of scope.querySelectorAll(".sides-padding")) {
        if (
          normalizedLabel(row.querySelector(".pay-label")?.textContent) !==
          expectedLabel
        ) {
          continue;
        }
        const input = row.querySelector(
          "input.pay-input:not(.voucher-input):not(.bank-info)",
        );
        if (input && paymentCurrency(input) === currency) return input;
      }
      return null;
    }

    function dispatchValueEvents(input) {
      const EventClass = documentRef.defaultView?.Event || Event;
      input.dispatchEvent(new EventClass("input", { bubbles: true }));
      input.dispatchEvent(new EventClass("change", { bubbles: true }));
    }

    function handleKeydown(event) {
      const method = String(event.key || "").toUpperCase();
      if (
        !METHOD_LABELS[method] ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.repeat
      ) {
        return;
      }

      const source = event.target;
      const sourceMethod = paymentMethod(source);
      const currency = paymentCurrency(source);
      if (!sourceMethod || !currency || !isAvailable(source)) return;

      const target = findMethodInput(method, currency, source);
      if (!isAvailable(target)) return;

      event.preventDefault();
      event.stopPropagation();

      if (source !== target && source.value !== "") {
        const amount = source.value;
        source.value = "";
        target.value = amount;
        dispatchValueEvents(source);
        dispatchValueEvents(target);
      }
      target.focus();
    }

    function start() {
      if (started) return;
      documentRef.addEventListener("keydown", handleKeydown, true);
      started = true;
    }

    function stop() {
      if (!started) return;
      documentRef.removeEventListener("keydown", handleKeydown, true);
      started = false;
    }

    return { start, stop };
  }

  return { createPaymentShortcutController };
});
