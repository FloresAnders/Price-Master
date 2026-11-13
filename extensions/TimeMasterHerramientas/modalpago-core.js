(function initializePaymentModalCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasModalPago = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildPaymentModalCore() {
  "use strict";

  const MODAL_SELECTOR = ".modal-dialog.modal-pago-w";
  const MAX_CRC_AMOUNT = 1000000;
  const INPUT_HEIGHT_BY_LEVEL = Object.freeze({
    alto: 52,
    "muy-alto": 64,
  });

  function createPaymentModalController(documentRef, options = {}) {
    const windowRef = documentRef.defaultView;
    const createResizeObserver =
      options.createResizeObserver ||
      (typeof windowRef?.ResizeObserver === "function"
        ? (callback) => new windowRef.ResizeObserver(callback)
        : null);
    const onSizeChange =
      typeof options.onSizeChange === "function" ? options.onSizeChange : () => {};
    const measureDialog =
      options.measureDialog || ((dialog) => dialog.getBoundingClientRect());
    const measureInput =
      options.measureInput ||
      ((dialog) => {
        const input = dialog.querySelector(".pv-pay__field");
        const rect = input?.getBoundingClientRect();
        const fontSizePx = Number.parseFloat(
          input ? windowRef.getComputedStyle(input).fontSize : "",
        );
        return {
          height: rect?.height || 40,
          fontSizePx: Number.isFinite(fontSizePx) ? fontSizePx : 14,
        };
      });
    const inputValueDescriptor = Object.getOwnPropertyDescriptor(
      windowRef.HTMLInputElement.prototype,
      "value",
    );
    const nativeValueGetter = inputValueDescriptor?.get;
    const nativeValueSetter = inputValueDescriptor?.set;
    const originalSizes = new WeakMap();
    const modifiedDialogs = new Set();
    const resizeObservers = new Map();
    const lastSizes = new WeakMap();
    const baseMeasurements = new WeakMap();
    const formattedInputStates = new WeakMap();
    const formattedInputs = new Set();
    const inputsDispatchingNativeValue = new WeakSet();
    let started = false;
    let mutationObserver = null;
    let textScaleEnabled = false;
    let inputScaleEnabled = false;
    let resizeEnabled = false;
    let currencyFormatEnabled = false;
    let textFontSizePx = 18;
    let inputHeightLevel = "alto";
    let savedSize = { widthPx: 0, heightPx: 0 };

    function normalizeDimension(value) {
      return Number.isInteger(value) && value > 0 ? value : 0;
    }

    function rememberOriginalSize(dialog) {
      if (originalSizes.has(dialog)) return;
      originalSizes.set(dialog, {
        width: dialog.style.width,
        height: dialog.style.height,
      });
      modifiedDialogs.add(dialog);
    }

    function restoreSize(dialog) {
      const original = originalSizes.get(dialog);
      if (!original) return;
      dialog.style.width = original.width;
      dialog.style.height = original.height;
      originalSizes.delete(dialog);
      modifiedDialogs.delete(dialog);
      lastSizes.delete(dialog);
      baseMeasurements.delete(dialog);
    }

    function ensureBaseMeasurement(dialog) {
      if (baseMeasurements.has(dialog)) return baseMeasurements.get(dialog);
      const dialogSize = measureDialog(dialog);
      const inputSize = measureInput(dialog);
      const measured = {
        width: dialogSize.width > 0 ? dialogSize.width : 1,
        height: dialogSize.height > 0 ? dialogSize.height : 1,
        inputHeight: inputSize.height > 0 ? inputSize.height : 40,
        inputFontSizePx:
          inputSize.fontSizePx > 0 ? inputSize.fontSizePx : 14,
      };
      baseMeasurements.set(dialog, measured);
      return measured;
    }

    function updateDialogSizing(dialog, currentSize) {
      const base = ensureBaseMeasurement(dialog);
      let scale = 1;
      if (
        started &&
        resizeEnabled &&
        currentSize?.widthPx > 0 &&
        currentSize?.heightPx > 0
      ) {
        const widthScale = currentSize.widthPx / base.width;
        const heightScale = currentSize.heightPx / base.height;
        scale = Math.max(
          1,
          Math.min(2, (widthScale + heightScale) / 2),
        );
      }
      const selectedInputHeight = inputScaleEnabled
        ? INPUT_HEIGHT_BY_LEVEL[inputHeightLevel] || base.inputHeight
        : base.inputHeight;
      const selectedInputFontSize = inputScaleEnabled
        ? inputHeightLevel === "muy-alto"
          ? Math.max(base.inputFontSizePx, 18)
          : inputHeightLevel === "alto"
            ? Math.max(base.inputFontSizePx, 16)
            : base.inputFontSizePx
        : base.inputFontSizePx;
      dialog.style.setProperty(
        "--tmh-payment-modal-resize-font-size",
        `${Math.round(scale * 100)}%`,
      );
      dialog.style.setProperty(
        "--tmh-payment-modal-effective-font-size",
        `${Math.round(textFontSizePx * scale)}px`,
      );
      dialog.style.setProperty(
        "--tmh-payment-modal-effective-input-height",
        `${Math.round(selectedInputHeight * scale)}px`,
      );
      dialog.style.setProperty(
        "--tmh-payment-modal-input-font-size",
        `${Math.round(selectedInputFontSize * scale)}px`,
      );
      dialog.dataset.tmhInputHeightLevel = inputHeightLevel;
    }

    function clearDialogSizing(dialog) {
      dialog.style.removeProperty("--tmh-payment-modal-resize-font-size");
      dialog.style.removeProperty("--tmh-payment-modal-effective-font-size");
      dialog.style.removeProperty("--tmh-payment-modal-effective-input-height");
      dialog.style.removeProperty("--tmh-payment-modal-input-font-size");
      delete dialog.dataset.tmhInputHeightLevel;
    }

    function disconnectResize(dialog) {
      resizeObservers.get(dialog)?.disconnect();
      resizeObservers.delete(dialog);
    }

    function enableResize(dialog) {
      rememberOriginalSize(dialog);
      ensureBaseMeasurement(dialog);
      dialog.classList.add("tmh-payment-modal--resizable");
      if (savedSize.widthPx > 0) dialog.style.width = `${savedSize.widthPx}px`;
      if (savedSize.heightPx > 0) dialog.style.height = `${savedSize.heightPx}px`;
      if (savedSize.widthPx > 0 && savedSize.heightPx > 0) {
        lastSizes.set(dialog, { ...savedSize });
      }
      if (!createResizeObserver || resizeObservers.has(dialog)) return;

      const observer = createResizeObserver((entries) => {
        const entry = entries.find((candidate) => candidate.target === dialog) || entries[0];
        if (!entry || !started || !resizeEnabled) return;
        const next = {
          widthPx: Math.round(entry.contentRect.width),
          heightPx: Math.round(entry.contentRect.height),
        };
        if (next.widthPx <= 0 || next.heightPx <= 0) return;
        const previous = lastSizes.get(dialog);
        if (
          previous?.widthPx === next.widthPx &&
          previous?.heightPx === next.heightPx
        ) {
          return;
        }
        lastSizes.set(dialog, next);
        savedSize = next;
        updateDialogSizing(dialog, next);
        onSizeChange(next);
      });
      observer.observe(dialog);
      resizeObservers.set(dialog, observer);
    }

    function disableResize(dialog) {
      disconnectResize(dialog);
      dialog.classList.remove("tmh-payment-modal--resizable");
      restoreSize(dialog);
    }

    function syncShortfallState(dialog) {
      const amountText = dialog
        .querySelector(".pv-pay__change .pv-pay__figure--change")
        ?.textContent?.trim()
        .replace(/\s/g, "")
        .replace(",", ".");
      const amount = Number(amountText);
      dialog.classList.toggle(
        "tmh-payment-modal--shortfall",
        started && Number.isFinite(amount) && amount < 0,
      );
    }

    function applyDialogFeatures(dialog) {
      syncShortfallState(dialog);
      dialog.classList.toggle(
        "tmh-payment-modal--large-text",
        started && textScaleEnabled,
      );
      dialog.classList.toggle(
        "tmh-payment-modal--large-inputs",
        started && inputScaleEnabled,
      );
      if (started && resizeEnabled) enableResize(dialog);
      else disableResize(dialog);
      updateDialogSizing(
        dialog,
        resizeEnabled && savedSize.widthPx > 0 && savedSize.heightPx > 0
          ? savedSize
          : null,
      );
    }

    function refresh() {
      for (const dialog of documentRef.querySelectorAll(MODAL_SELECTOR)) {
        applyDialogFeatures(dialog);
      }
      syncFormattedInputs();
    }

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
      const separator = compact.includes(",") ? "," : compact.includes(".") ? "." : "";
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
      nativeValueSetter.call(
        input,
        inputsDispatchingNativeValue.has(input)
          ? state.rawValue
          : state.formattedValue,
      );
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
        enumerable: inputValueDescriptor.enumerable,
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
      if (!started || !currencyFormatEnabled) {
        for (const input of [...formattedInputs]) uninstallValueProxy(input);
        return;
      }
      for (const input of documentRef.querySelectorAll("input.pv-pay__amount")) {
        if (isCrcAmountInput(input)) installValueProxy(input);
      }
    }

    function handleInput(event) {
      if (!started || !currencyFormatEnabled || !isCrcAmountInput(event.target)) {
        return;
      }
      const input = event.target;
      installValueProxy(input);
      inputsDispatchingNativeValue.add(input);
      applyInputValue(input, nativeValueGetter.call(input));
      const state = formattedInputStates.get(input);
      Promise.resolve().then(() => {
        inputsDispatchingNativeValue.delete(input);
        if (
          !started ||
          !currencyFormatEnabled ||
          formattedInputStates.get(input) !== state
        ) {
          return;
        }
        nativeValueSetter.call(input, state.formattedValue);
        input.setSelectionRange?.(
          state.formattedValue.length,
          state.formattedValue.length,
        );
      });
    }

    function start() {
      if (started) return;
      started = true;
      documentRef.addEventListener("input", handleInput, true);
      if (typeof windowRef?.MutationObserver === "function") {
        mutationObserver = new windowRef.MutationObserver(refresh);
        mutationObserver.observe(documentRef.documentElement, {
          childList: true,
          characterData: true,
          subtree: true,
        });
      }
      refresh();
    }

    function stop() {
      if (!started) return;
      started = false;
      documentRef.removeEventListener("input", handleInput, true);
      mutationObserver?.disconnect();
      mutationObserver = null;
      for (const dialog of [...resizeObservers.keys()]) disconnectResize(dialog);
      for (const dialog of documentRef.querySelectorAll(MODAL_SELECTOR)) {
        dialog.classList.remove(
          "tmh-payment-modal--large-text",
          "tmh-payment-modal--large-inputs",
          "tmh-payment-modal--resizable",
          "tmh-payment-modal--shortfall",
        );
        clearDialogSizing(dialog);
      }
      for (const dialog of [...modifiedDialogs]) restoreSize(dialog);
      for (const input of [...formattedInputs]) uninstallValueProxy(input);
    }

    function setTextScaleEnabled(enabled) {
      textScaleEnabled = enabled === true;
      refresh();
    }

    function setInputScaleEnabled(enabled) {
      inputScaleEnabled = enabled === true;
      refresh();
    }

    function setTextFontSizePx(sizePx) {
      if (Number.isInteger(sizePx) && sizePx >= 12 && sizePx <= 36) {
        textFontSizePx = sizePx;
        refresh();
      }
    }

    function setInputHeightLevel(level) {
      if (["normal", "alto", "muy-alto"].includes(level)) {
        inputHeightLevel = level;
        refresh();
      }
    }

    function setResizeEnabled(enabled) {
      resizeEnabled = enabled === true;
      refresh();
    }

    function setCurrencyFormatEnabled(enabled) {
      currencyFormatEnabled = enabled === true;
      syncFormattedInputs();
    }

    function setSavedSize(size = {}) {
      savedSize = {
        widthPx: normalizeDimension(size.widthPx),
        heightPx: normalizeDimension(size.heightPx),
      };
      if (started && resizeEnabled) {
        for (const dialog of documentRef.querySelectorAll(MODAL_SELECTOR)) {
          if (savedSize.widthPx > 0) dialog.style.width = `${savedSize.widthPx}px`;
          if (savedSize.heightPx > 0) dialog.style.height = `${savedSize.heightPx}px`;
          if (savedSize.widthPx > 0 && savedSize.heightPx > 0) {
            lastSizes.set(dialog, { ...savedSize });
          }
          updateDialogSizing(dialog, savedSize);
        }
      }
    }

    return {
      start,
      stop,
      setTextScaleEnabled,
      setInputScaleEnabled,
      setTextFontSizePx,
      setInputHeightLevel,
      setResizeEnabled,
      setCurrencyFormatEnabled,
      setSavedSize,
    };
  }

  return { createPaymentModalController };
});
