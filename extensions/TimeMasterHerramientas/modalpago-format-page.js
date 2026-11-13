(function initializePaymentModalFormatPage(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasModalPagoFormatPage = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    api.createCurrencyFormatController(root, root.document).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildFormatPage() {
  "use strict";

  const SETTING_EVENT = "tmh-contica-modal-pago-format-setting";
  const MAX_CRC_AMOUNT = 1000000;

  function createCurrencyFormatController(windowRef, documentRef) {
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      windowRef.HTMLInputElement.prototype,
      "value",
    );
    const nativeValueGetter = valueDescriptor?.get;
    const nativeValueSetter = valueDescriptor?.set;
    const formattedInputStates = new WeakMap();
    const formattedInputs = new Set();
    let enabled = false;
    let started = false;
    let mutationObserver = null;

    function isCrcAmountInput(input) {
      if (!(input instanceof windowRef.HTMLInputElement)) return false;
      if (!input.matches("input.pv-pay__amount") || input.id === "payUSD") {
        return false;
      }
      const symbol = input
        .closest(".pv-pay__money-cell")
        ?.querySelector(".pv-pay__symbol")
        ?.textContent?.trim();
      return symbol?.includes("₡") || /CRC/i.test(symbol || "");
    }

    function normalizeCrcValue(value) {
      if (!value || value.includes("/")) return null;
      const compact = value.replace(/\s+/g, "");
      if (!/^\d*(?:[.,]\d*)?$/.test(compact)) return null;
      const separator = compact.includes(",")
        ? ","
        : compact.includes(".")
          ? "."
          : "";
      const [integerPart = "", decimalPart] = separator
        ? compact.split(separator, 2)
        : [compact, undefined];
      const amount = Number(compact.replace(",", "."));
      if (!Number.isFinite(amount)) return null;
      if (amount > MAX_CRC_AMOUNT) {
        return { rawValue: "1000000", formattedValue: "1 000 000" };
      }

      const normalizedInteger = String(Number(integerPart || "0"));
      const grouped = normalizedInteger.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
      const decimalSuffix =
        decimalPart === undefined ? "" : `${separator}${decimalPart}`;
      return {
        rawValue: `${normalizedInteger}${decimalSuffix}`,
        formattedValue: `${grouped}${decimalSuffix}`,
      };
    }

    function applyInputValue(input, value) {
      const state = formattedInputStates.get(input);
      if (!state || !nativeValueSetter) return;
      const next = String(value ?? "");
      const normalized = normalizeCrcValue(next);
      state.rawValue = normalized?.rawValue ?? next;
      state.formattedValue = normalized?.formattedValue ?? next;
      nativeValueSetter.call(input, state.formattedValue);
    }

    function installValueProxy(input) {
      if (
        formattedInputStates.has(input) ||
        !nativeValueGetter ||
        !nativeValueSetter
      ) {
        return;
      }
      const initialValue = nativeValueGetter.call(input);
      const state = { rawValue: initialValue, formattedValue: initialValue };
      formattedInputStates.set(input, state);
      formattedInputs.add(input);
      Object.defineProperty(input, "value", {
        configurable: true,
        enumerable: valueDescriptor.enumerable,
        get() {
          const displayedValue = nativeValueGetter.call(input);
          if (displayedValue !== state.formattedValue) {
            applyInputValue(input, displayedValue);
          }
          return state.rawValue;
        },
        set(value) {
          applyInputValue(input, value);
        },
      });
      applyInputValue(input, initialValue);
    }

    function uninstallValueProxy(input) {
      const state = formattedInputStates.get(input);
      if (!state || !nativeValueSetter) return;
      delete input.value;
      nativeValueSetter.call(input, state.rawValue);
      formattedInputStates.delete(input);
      formattedInputs.delete(input);
    }

    function syncFormattedInputs() {
      if (!started || !enabled) {
        for (const input of [...formattedInputs]) uninstallValueProxy(input);
        return;
      }
      for (const input of documentRef.querySelectorAll("input.pv-pay__amount")) {
        if (isCrcAmountInput(input)) installValueProxy(input);
      }
    }

    function handleInput(event) {
      if (!started || !enabled || !isCrcAmountInput(event.target)) return;
      const input = event.target;
      installValueProxy(input);
      applyInputValue(input, nativeValueGetter.call(input));
      const state = formattedInputStates.get(input);
      input.setSelectionRange?.(
        state.formattedValue.length,
        state.formattedValue.length,
      );
    }

    function handleSetting(event) {
      enabled = event?.detail?.enabled === true;
      syncFormattedInputs();
    }

    function start() {
      if (started) return;
      started = true;
      documentRef.addEventListener(SETTING_EVENT, handleSetting);
      documentRef.addEventListener("input", handleInput, true);
      if (typeof windowRef.MutationObserver === "function") {
        mutationObserver = new windowRef.MutationObserver(syncFormattedInputs);
        mutationObserver.observe(documentRef.documentElement, {
          childList: true,
          subtree: true,
        });
      }
    }

    function stop() {
      if (!started) return;
      started = false;
      enabled = false;
      documentRef.removeEventListener(SETTING_EVENT, handleSetting);
      documentRef.removeEventListener("input", handleInput, true);
      mutationObserver?.disconnect();
      mutationObserver = null;
      syncFormattedInputs();
    }

    return { start, stop };
  }

  return { SETTING_EVENT, createCurrencyFormatController };
});
