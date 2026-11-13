/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializePopup(root, factory) {
  const settings =
    typeof module === "object" && module.exports
      ? require("./settings-core.js")
      : root.TimeMasterHerramientasSettings;
  const api = factory(settings);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.TimeMasterHerramientasPopup = api;
  if (root.document && root.chrome) {
    api.createPopupController(root.document, root.chrome).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildPopup(settings) {
  "use strict";

  const keys = Object.entries(settings.DEFAULT_SETTINGS)
    .filter(
      ([key, fallback]) =>
        typeof fallback === "boolean" &&
        ![
          "tmhResaltarCodigoTiqueteEnabled",
          "tmhFormatoImpresionCompletaEnabled",
        ].includes(key),
    )
    .map(([key]) => key);
  const CLOSE_ENABLED_KEY = "tmhCerrarImpresionConticaEnabled";
  const CLOSE_DELAY_KEY = "tmhCerrarImpresionConticaDelaySeconds";
  const CLOSE_MESSAGE_KEY = "tmhCerrarImpresionConticaMessage";
  const PRINT_TIMES_ENABLED_KEY = "tmhImpresionTiemposEnabled";
  const PRINTER_NAME_KEY = "tmhImpresionTiemposPrinterName";
  const PAYMENT_MODAL_ENABLED_KEY = "tmhModalPagoEnabled";
  const PAYMENT_MODAL_OPTION_KEYS = Object.freeze([
    "tmhModalPagoTextoGrandeEnabled",
    "tmhModalPagoInputsGrandesEnabled",
    "tmhModalPagoRedimensionarEnabled",
    "tmhModalPagoFormatoColonesEnabled",
  ]);
  const PAYMENT_MODAL_FONT_SIZE_KEY = "tmhModalPagoFontSizePx";
  const PAYMENT_MODAL_INPUT_HEIGHT_KEY = "tmhModalPagoInputHeightLevel";
  const TICKET_ENABLED_KEY = "tmhResaltarCodigoTiqueteEnabled";
  const TICKET_SIZE_KEY = "tmhResaltarCodigoTiqueteFontSizePx";
  const TICKET_WEIGHT_KEY = "tmhResaltarCodigoTiqueteFontWeight";
  const TICKET_FAMILY_KEY = "tmhResaltarCodigoTiqueteFontFamily";
  const TICKET_LINES = [
    {
      size: TICKET_SIZE_KEY,
      weight: TICKET_WEIGHT_KEY,
      family: TICKET_FAMILY_KEY,
    },
    {
      size: "tmhResaltarFechaTiqueteFontSizePx",
      weight: "tmhResaltarFechaTiqueteFontWeight",
      family: "tmhResaltarFechaTiqueteFontFamily",
    },
    {
      size: "tmhResaltarSorteoTiqueteFontSizePx",
      weight: "tmhResaltarSorteoTiqueteFontWeight",
      family: "tmhResaltarSorteoTiqueteFontFamily",
    },
  ];
  const TICKET_FONT_KEYS = TICKET_LINES.flatMap((line) => Object.values(line));
  const FULL_PRINT_ENABLED_KEY = "tmhFormatoImpresionCompletaEnabled";
  const FULL_PRINT_FONT = {
    size: "tmhFormatoImpresionCompletaFontSizePx",
    weight: "tmhFormatoImpresionCompletaFontWeight",
    family: "tmhFormatoImpresionCompletaFontFamily",
  };
  const FULL_PRINT_FONT_KEYS = Object.values(FULL_PRINT_FONT);
  const LINE_CONFIG_LAUNCHERS = Object.freeze([
    { source: "ticket", enabledKey: TICKET_ENABLED_KEY },
    { source: "bcr", enabledKey: FULL_PRINT_ENABLED_KEY },
  ]);

  function createPopupController(documentRef, chromeApi) {
    const values = { ...settings.DEFAULT_SETTINGS };
    const listeners = new Map();
    const changedDuringInitialLoad = new Set();
    let started = false;
    let settingsLoaded = false;
    let lifecycleEpoch = 0;

    function elements(key) {
      return {
        toggle: documentRef.getElementById(`${key}-toggle`),
        status: documentRef.getElementById(`${key}-status`),
      };
    }

    function render(key, enabled, errorMessage = "") {
      const { toggle, status } = elements(key);
      if (!toggle || !status) return;
      toggle.checked = enabled;
      status.textContent = errorMessage || (enabled ? "Activado" : "Desactivado");
      status.dataset.enabled = String(enabled);
      if (errorMessage) status.dataset.error = "true";
      else delete status.dataset.error;
      if (key === CLOSE_ENABLED_KEY) {
        renderDelay(values[CLOSE_DELAY_KEY]);
        renderMessage(values[CLOSE_MESSAGE_KEY]);
      }
      if (key === PRINT_TIMES_ENABLED_KEY) {
        renderPrinterName(values[PRINTER_NAME_KEY]);
      }
      if (
        key === PAYMENT_MODAL_ENABLED_KEY ||
        PAYMENT_MODAL_OPTION_KEYS.includes(key)
      ) {
        renderPaymentModalOptions();
      }
    }

    function renderPaymentModalOptions() {
      const panel = documentRef.getElementById("tmhModalPago-options");
      if (!panel) return;
      const enabled = values[PAYMENT_MODAL_ENABLED_KEY] === true;
      panel.hidden = !enabled;
      for (const key of PAYMENT_MODAL_OPTION_KEYS) {
        const { toggle } = elements(key);
        if (toggle) toggle.disabled = !enabled;
      }
      const fontSize = documentRef.getElementById(
        `${PAYMENT_MODAL_FONT_SIZE_KEY}-input`,
      );
      const inputHeight = documentRef.getElementById(
        `${PAYMENT_MODAL_INPUT_HEIGHT_KEY}-input`,
      );
      if (fontSize) {
        fontSize.value = String(values[PAYMENT_MODAL_FONT_SIZE_KEY]);
        fontSize.disabled =
          !enabled || values.tmhModalPagoTextoGrandeEnabled !== true;
      }
      if (inputHeight) {
        inputHeight.value = values[PAYMENT_MODAL_INPUT_HEIGHT_KEY];
        inputHeight.disabled =
          !enabled || values.tmhModalPagoInputsGrandesEnabled !== true;
      }
    }

    function bindPaymentModalEditors() {
      const fontSize = documentRef.getElementById(
        `${PAYMENT_MODAL_FONT_SIZE_KEY}-input`,
      );
      const inputHeight = documentRef.getElementById(
        `${PAYMENT_MODAL_INPUT_HEIGHT_KEY}-input`,
      );
      if (fontSize) {
        const handleFontSizeChange = () => {
          const previous = values[PAYMENT_MODAL_FONT_SIZE_KEY];
          const requested = Number(fontSize.value);
          const next = settings.normalizeModalPaymentFontSizePx(
            requested,
            previous,
          );
          if (next !== requested) {
            renderPaymentModalOptions();
            return;
          }
          if (!settingsLoaded) {
            changedDuringInitialLoad.add(PAYMENT_MODAL_FONT_SIZE_KEY);
          }
          fontSize.disabled = true;
          chromeApi.storage.local.set({ [PAYMENT_MODAL_FONT_SIZE_KEY]: next }, () => {
            if (!chromeApi.runtime.lastError) values[PAYMENT_MODAL_FONT_SIZE_KEY] = next;
            renderPaymentModalOptions();
          });
        };
        fontSize.addEventListener("change", handleFontSizeChange);
        listeners.set(PAYMENT_MODAL_FONT_SIZE_KEY, handleFontSizeChange);
      }
      if (inputHeight) {
        const handleInputHeightChange = () => {
          const previous = values[PAYMENT_MODAL_INPUT_HEIGHT_KEY];
          const requested = inputHeight.value;
          const next = settings.normalizeModalPaymentInputHeightLevel(
            requested,
            previous,
          );
          if (next !== requested) {
            renderPaymentModalOptions();
            return;
          }
          if (!settingsLoaded) {
            changedDuringInitialLoad.add(PAYMENT_MODAL_INPUT_HEIGHT_KEY);
          }
          inputHeight.disabled = true;
          chromeApi.storage.local.set(
            { [PAYMENT_MODAL_INPUT_HEIGHT_KEY]: next },
            () => {
              if (!chromeApi.runtime.lastError) {
                values[PAYMENT_MODAL_INPUT_HEIGHT_KEY] = next;
              }
              renderPaymentModalOptions();
            },
          );
        };
        inputHeight.addEventListener("change", handleInputHeightChange);
        listeners.set(PAYMENT_MODAL_INPUT_HEIGHT_KEY, handleInputHeightChange);
      }
    }

    function delayElements() {
      return {
        input: documentRef.getElementById(`${CLOSE_DELAY_KEY}-input`),
        status: documentRef.getElementById(`${CLOSE_DELAY_KEY}-status`),
      };
    }

    function renderDelay(seconds, errorMessage = "") {
      const { input, status } = delayElements();
      if (!input || !status) return;
      input.value = String(seconds);
      input.disabled = values[CLOSE_ENABLED_KEY] !== true;
      status.textContent = errorMessage;
    }

    function messageElements() {
      return {
        input: documentRef.getElementById(`${CLOSE_MESSAGE_KEY}-input`),
        status: documentRef.getElementById(`${CLOSE_MESSAGE_KEY}-status`),
      };
    }

    function renderMessage(message, errorMessage = "") {
      const { input, status } = messageElements();
      if (!input || !status) return;
      input.value = message;
      input.disabled = values[CLOSE_ENABLED_KEY] !== true;
      status.textContent = errorMessage;
    }

    function printerNameElements() {
      return {
        field: documentRef.getElementById(`${PRINTER_NAME_KEY}-field`),
        input: documentRef.getElementById(`${PRINTER_NAME_KEY}-input`),
        status: documentRef.getElementById(`${PRINTER_NAME_KEY}-status`),
      };
    }

    function renderPrinterName(printerName, errorMessage = "") {
      const { field, input, status } = printerNameElements();
      if (!field || !input || !status) return;
      const enabled = values[PRINT_TIMES_ENABLED_KEY] === true;
      field.hidden = !enabled;
      input.value = printerName;
      input.disabled = !enabled;
      status.textContent = errorMessage;
    }

    function ticketFontElements() {
      return {
        panel: documentRef.getElementById("tmhResaltarLineasTiquete-settings"),
        status: documentRef.getElementById("tmhResaltarCodigoTiqueteFont-status"),
        reset: documentRef.getElementById("tmhResaltarCodigoTiquete-reset"),
        save: documentRef.getElementById("tmhResaltarCodigoTiquete-save"),
      };
    }

    function ticketFontControl(key) {
      return documentRef.getElementById(`${key}-input`);
    }

    function fullPrintElements() {
      return {
        panel: documentRef.getElementById("tmhFormatoImpresionCompleta-settings"),
        status: documentRef.getElementById("tmhFormatoImpresionCompletaFont-status"),
        reset: documentRef.getElementById("tmhFormatoImpresionCompleta-reset"),
        save: documentRef.getElementById("tmhFormatoImpresionCompleta-save"),
      };
    }

    function fullPrintControl(key) {
      return documentRef.getElementById(`${key}-input`);
    }

    function updateTicketDraftState(message = "Cambios sin guardar", isError = false) {
      const { toggle, status: enabledStatus } = elements(TICKET_ENABLED_KEY);
      const { panel, status, reset } = ticketFontElements();
      if (!toggle || !panel || !status || !enabledStatus) {
        return;
      }
      const enabled = toggle.checked === true;
      enabledStatus.textContent = enabled ? "Activado" : "Desactivado";
      enabledStatus.dataset.enabled = String(enabled);
      panel.hidden = !enabled;
      for (const key of TICKET_FONT_KEYS) {
        const control = ticketFontControl(key);
        if (control) control.disabled = !enabled;
      }
      if (reset) reset.disabled = !enabled;
      status.textContent = message;
      if (isError) status.dataset.error = "true";
      else delete status.dataset.error;
      if (!isError && message === "Guardado") status.dataset.saved = "true";
      else delete status.dataset.saved;
    }

    function renderTicketSettings(message = "") {
      const { toggle } = elements(TICKET_ENABLED_KEY);
      const { save } = ticketFontElements();
      if (!toggle || !save) return;
      toggle.checked = values[TICKET_ENABLED_KEY] === true;
      for (const key of TICKET_FONT_KEYS) {
        const control = ticketFontControl(key);
        if (control) control.value = String(values[key]);
      }
      toggle.disabled = false;
      save.disabled = false;
      updateTicketDraftState(message);
    }

    function updateFullPrintDraftState(
      message = "Cambios sin guardar",
      isError = false,
    ) {
      const { toggle, status: enabledStatus } = elements(FULL_PRINT_ENABLED_KEY);
      const { panel, status, reset } = fullPrintElements();
      if (!toggle || !panel || !status || !enabledStatus) return;
      const enabled = toggle.checked === true;
      enabledStatus.textContent = enabled ? "Activado" : "Desactivado";
      enabledStatus.dataset.enabled = String(enabled);
      panel.hidden = !enabled;
      for (const key of FULL_PRINT_FONT_KEYS) {
        const control = fullPrintControl(key);
        if (control) control.disabled = !enabled;
      }
      if (reset) reset.disabled = !enabled;
      status.textContent = message;
      if (isError) status.dataset.error = "true";
      else delete status.dataset.error;
      if (!isError && message === "Guardado") status.dataset.saved = "true";
      else delete status.dataset.saved;
    }

    function renderFullPrintSettings(message = "") {
      const { toggle } = elements(FULL_PRINT_ENABLED_KEY);
      const { save } = fullPrintElements();
      if (!toggle || !save) return;
      toggle.checked = values[FULL_PRINT_ENABLED_KEY] === true;
      for (const key of FULL_PRINT_FONT_KEYS) {
        const control = fullPrintControl(key);
        if (control) control.value = String(values[key]);
      }
      toggle.disabled = false;
      save.disabled = false;
      updateFullPrintDraftState(message);
    }

    function bind(key) {
      const { toggle } = elements(key);
      if (!toggle) return;

      const handleChange = () => {
        const previous = values[key];
        const next = toggle.checked === true;
        if (!settingsLoaded) changedDuringInitialLoad.add(key);
        toggle.disabled = true;
        chromeApi.storage.local.set({ [key]: next }, () => {
          toggle.disabled = false;
          if (chromeApi.runtime.lastError) {
            render(key, previous, "Error al guardar");
            return;
          }
          values[key] = next;
          render(key, next);
        });
      };

      toggle.addEventListener("change", handleChange);
      listeners.set(key, handleChange);
    }

    function bindDelay() {
      const { input } = delayElements();
      if (!input) return;

      const handleChange = () => {
        const previous = values[CLOSE_DELAY_KEY];
        const next = Number(input.value);
        if (!Number.isInteger(next) || next < 1) {
          renderDelay(previous, "Usa un número entero desde 1");
          return;
        }

        input.disabled = true;
        chromeApi.storage.local.set({ [CLOSE_DELAY_KEY]: next }, () => {
          if (chromeApi.runtime.lastError) {
            renderDelay(previous, "Error al guardar");
            return;
          }
          values[CLOSE_DELAY_KEY] = next;
          renderDelay(next);
        });
      };

      input.addEventListener("change", handleChange);
      listeners.set(CLOSE_DELAY_KEY, handleChange);
    }

    function bindMessage() {
      const { input } = messageElements();
      if (!input) return;

      const handleChange = () => {
        const previous = values[CLOSE_MESSAGE_KEY];
        const next = input.value.trim();
        if (!next) {
          renderMessage(previous, "Escriba un mensaje");
          return;
        }

        input.disabled = true;
        chromeApi.storage.local.set({ [CLOSE_MESSAGE_KEY]: next }, () => {
          if (chromeApi.runtime.lastError) {
            renderMessage(previous, "Error al guardar");
            return;
          }
          values[CLOSE_MESSAGE_KEY] = next;
          renderMessage(next);
        });
      };

      input.addEventListener("change", handleChange);
      listeners.set(CLOSE_MESSAGE_KEY, handleChange);
    }

    function bindPrinterName() {
      const { input } = printerNameElements();
      if (!input) return;

      const handleChange = () => {
        const previous = values[PRINTER_NAME_KEY];
        const next = input.value.trim();
        if (!next) {
          renderPrinterName(previous, "Escriba un nombre de impresora");
          return;
        }

        input.disabled = true;
        chromeApi.storage.local.set({ [PRINTER_NAME_KEY]: next }, () => {
          if (chromeApi.runtime.lastError) {
            renderPrinterName(previous, "Error al guardar");
            return;
          }
          values[PRINTER_NAME_KEY] = next;
          renderPrinterName(next);
        });
      };

      input.addEventListener("change", handleChange);
      listeners.set(PRINTER_NAME_KEY, handleChange);
    }

    function bindTicketSettings() {
      const { toggle } = elements(TICKET_ENABLED_KEY);
      const { reset, save } = ticketFontElements();
      if (!toggle || !reset || !save) return;

      const handleDraftChange = () => updateTicketDraftState();
      const handleReset = () => {
        for (const key of TICKET_FONT_KEYS) {
          const control = ticketFontControl(key);
          if (control) control.value = String(settings.DEFAULT_SETTINGS[key]);
        }
        updateTicketDraftState();
      };
      const handleSave = () => {
        const next = {
          [TICKET_ENABLED_KEY]: toggle.checked === true,
        };
        for (const line of TICKET_LINES) {
          const sizeValue = Number(ticketFontControl(line.size)?.value);
          const weightValue = Number(ticketFontControl(line.weight)?.value);
          const familyValue = ticketFontControl(line.family)?.value;
          const normalizedSize = settings.normalizeTicketFontSizePx(sizeValue);
          const normalizedWeight = settings.normalizeTicketFontWeight(weightValue);
          const normalizedFamily = settings.normalizeTicketFontFamily(familyValue);
          if (normalizedSize !== sizeValue) {
            updateTicketDraftState(
              `Usa un número entero de ${settings.TICKET_FONT_SIZE_MIN} a ${settings.TICKET_FONT_SIZE_MAX}`,
              true,
            );
            return;
          }
          if (
            normalizedWeight !== weightValue ||
            normalizedFamily !== familyValue
          ) {
            updateTicketDraftState("Seleccione valores válidos", true);
            return;
          }
          next[line.size] = normalizedSize;
          next[line.weight] = normalizedWeight;
          next[line.family] = normalizedFamily;
        }
        toggle.disabled = true;
        for (const key of TICKET_FONT_KEYS) {
          const control = ticketFontControl(key);
          if (control) control.disabled = true;
        }
        reset.disabled = true;
        save.disabled = true;
        chromeApi.storage.local.set(next, () => {
          if (chromeApi.runtime.lastError) {
            toggle.disabled = false;
            reset.disabled = false;
            save.disabled = false;
            updateTicketDraftState("Error al guardar", true);
            return;
          }
          Object.assign(values, next);
          renderTicketSettings("Guardado");
        });
      };

      toggle.addEventListener("change", handleDraftChange);
      for (const key of TICKET_FONT_KEYS) {
        const control = ticketFontControl(key);
        control?.addEventListener("change", handleDraftChange);
        listeners.set(key, handleDraftChange);
      }
      reset.addEventListener("click", handleReset);
      save.addEventListener("click", handleSave);
      listeners.set(TICKET_ENABLED_KEY, handleDraftChange);
      listeners.set("tmhResaltarCodigoTiqueteReset", handleReset);
      listeners.set("tmhResaltarCodigoTiqueteSave", handleSave);
    }

    function bindFullPrintSettings() {
      const { toggle } = elements(FULL_PRINT_ENABLED_KEY);
      const { reset, save } = fullPrintElements();
      if (!toggle || !reset || !save) return;

      const handleDraftChange = () => updateFullPrintDraftState();
      const handleReset = () => {
        for (const key of FULL_PRINT_FONT_KEYS) {
          const control = fullPrintControl(key);
          if (control) control.value = String(settings.DEFAULT_SETTINGS[key]);
        }
        updateFullPrintDraftState();
      };
      const handleSave = () => {
        const sizeValue = Number(fullPrintControl(FULL_PRINT_FONT.size)?.value);
        const weightValue = Number(
          fullPrintControl(FULL_PRINT_FONT.weight)?.value,
        );
        const familyValue = fullPrintControl(FULL_PRINT_FONT.family)?.value;
        const normalizedSize = settings.normalizeTicketFontSizePx(
          sizeValue,
          settings.DEFAULT_SETTINGS[FULL_PRINT_FONT.size],
        );
        const normalizedWeight = settings.normalizeTicketFontWeight(
          weightValue,
          settings.DEFAULT_SETTINGS[FULL_PRINT_FONT.weight],
        );
        const normalizedFamily = settings.normalizeTicketFontFamily(
          familyValue,
          settings.DEFAULT_SETTINGS[FULL_PRINT_FONT.family],
        );
        if (normalizedSize !== sizeValue) {
          updateFullPrintDraftState(
            `Usa un nÃºmero entero de ${settings.TICKET_FONT_SIZE_MIN} a ${settings.TICKET_FONT_SIZE_MAX}`,
            true,
          );
          return;
        }
        if (
          normalizedWeight !== weightValue ||
          normalizedFamily !== familyValue
        ) {
          updateFullPrintDraftState("Seleccione valores vÃ¡lidos", true);
          return;
        }
        const next = {
          [FULL_PRINT_ENABLED_KEY]: toggle.checked === true,
          [FULL_PRINT_FONT.size]: normalizedSize,
          [FULL_PRINT_FONT.weight]: normalizedWeight,
          [FULL_PRINT_FONT.family]: normalizedFamily,
        };
        toggle.disabled = true;
        for (const key of FULL_PRINT_FONT_KEYS) {
          const control = fullPrintControl(key);
          if (control) control.disabled = true;
        }
        reset.disabled = true;
        save.disabled = true;
        chromeApi.storage.local.set(next, () => {
          if (chromeApi.runtime.lastError) {
            toggle.disabled = false;
            reset.disabled = false;
            save.disabled = false;
            updateFullPrintDraftState("Error al guardar", true);
            return;
          }
          Object.assign(values, next);
          renderFullPrintSettings("Guardado");
        });
      };

      toggle.addEventListener("change", handleDraftChange);
      for (const key of FULL_PRINT_FONT_KEYS) {
        fullPrintControl(key)?.addEventListener("change", handleDraftChange);
        listeners.set(key, handleDraftChange);
      }
      reset.addEventListener("click", handleReset);
      save.addEventListener("click", handleSave);
      listeners.set(FULL_PRINT_ENABLED_KEY, handleDraftChange);
      listeners.set("tmhFormatoImpresionCompletaReset", handleReset);
      listeners.set("tmhFormatoImpresionCompletaSave", handleSave);
    }

    function renderLineConfigLauncher(enabledKey) {
      render(enabledKey, values[enabledKey] === true);
    }

    function bindLineConfigLaunchers() {
      for (const { source, enabledKey } of LINE_CONFIG_LAUNCHERS) {
        const { toggle } = elements(enabledKey);
        if (!toggle) continue;
        const handleChange = () => {
          renderLineConfigLauncher(enabledKey);
          const url = chromeApi.runtime.getURL(
            `lineas-config.html?source=${source}`,
          );
          chromeApi.windows?.create({
            url,
            type: "popup",
            width: 540,
            height: 720,
          });
        };
        toggle.addEventListener("change", handleChange);
        listeners.set(`lineConfig:${source}`, handleChange);
      }
    }

    function handleStorageChange(changes, areaName) {
      if (areaName !== "local") return;
      for (const key of [PAYMENT_MODAL_ENABLED_KEY, ...PAYMENT_MODAL_OPTION_KEYS]) {
        const next = changes?.[key]?.newValue;
        if (typeof next !== "boolean") continue;
        if (!settingsLoaded) changedDuringInitialLoad.add(key);
        values[key] = next;
        render(key, next);
      }
      const nextFontSize = settings.readChangedModalPaymentFontSizePx(
        changes,
        PAYMENT_MODAL_FONT_SIZE_KEY,
      );
      if (nextFontSize !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(PAYMENT_MODAL_FONT_SIZE_KEY);
        values[PAYMENT_MODAL_FONT_SIZE_KEY] = nextFontSize;
        renderPaymentModalOptions();
      }
      const nextInputHeight = settings.readChangedModalPaymentInputHeightLevel(
        changes,
        PAYMENT_MODAL_INPUT_HEIGHT_KEY,
      );
      if (nextInputHeight !== undefined) {
        if (!settingsLoaded) changedDuringInitialLoad.add(PAYMENT_MODAL_INPUT_HEIGHT_KEY);
        values[PAYMENT_MODAL_INPUT_HEIGHT_KEY] = nextInputHeight;
        renderPaymentModalOptions();
      }
      for (const { enabledKey } of LINE_CONFIG_LAUNCHERS) {
        const next = changes?.[enabledKey]?.newValue;
        if (typeof next !== "boolean") continue;
        values[enabledKey] = next;
        renderLineConfigLauncher(enabledKey);
      }
    }

    function start() {
      if (started) return;
      started = true;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      const currentEpoch = ++lifecycleEpoch;
      for (const key of keys) bind(key);
      bindDelay();
      bindMessage();
      bindPrinterName();
      bindPaymentModalEditors();
      bindTicketSettings();
      bindFullPrintSettings();
      bindLineConfigLaunchers();
      chromeApi.storage.onChanged.addListener(handleStorageChange);
      chromeApi.storage.local.get(settings.DEFAULT_SETTINGS, (stored) => {
        if (!started || currentEpoch !== lifecycleEpoch) return;
        const normalized = settings.normalizeSettings(stored);
        for (const [key, value] of Object.entries(normalized)) {
          if (!changedDuringInitialLoad.has(key)) values[key] = value;
        }
        for (const key of keys) {
          render(key, values[key]);
        }
        renderDelay(values[CLOSE_DELAY_KEY]);
        renderMessage(values[CLOSE_MESSAGE_KEY]);
        renderPrinterName(values[PRINTER_NAME_KEY]);
        renderTicketSettings();
        renderFullPrintSettings();
        for (const { enabledKey } of LINE_CONFIG_LAUNCHERS) {
          renderLineConfigLauncher(enabledKey);
        }
        settingsLoaded = true;
        changedDuringInitialLoad.clear();
      });
    }

    function destroy() {
      if (!started) return;
      for (const [key, listener] of listeners) {
        if (key === CLOSE_DELAY_KEY) {
          delayElements().input?.removeEventListener("change", listener);
        } else if (key === CLOSE_MESSAGE_KEY) {
          messageElements().input?.removeEventListener("change", listener);
        } else if (key === PRINTER_NAME_KEY) {
          printerNameElements().input?.removeEventListener("change", listener);
        } else if (key === PAYMENT_MODAL_FONT_SIZE_KEY) {
          documentRef
            .getElementById(`${PAYMENT_MODAL_FONT_SIZE_KEY}-input`)
            ?.removeEventListener("change", listener);
        } else if (key === PAYMENT_MODAL_INPUT_HEIGHT_KEY) {
          documentRef
            .getElementById(`${PAYMENT_MODAL_INPUT_HEIGHT_KEY}-input`)
            ?.removeEventListener("change", listener);
        } else if (key === TICKET_ENABLED_KEY) {
          elements(TICKET_ENABLED_KEY).toggle?.removeEventListener(
            "change",
            listener,
          );
        } else if (key === FULL_PRINT_ENABLED_KEY) {
          elements(FULL_PRINT_ENABLED_KEY).toggle?.removeEventListener(
            "change",
            listener,
          );
        } else if (TICKET_FONT_KEYS.includes(key)) {
          ticketFontControl(key)?.removeEventListener("change", listener);
        } else if (FULL_PRINT_FONT_KEYS.includes(key)) {
          fullPrintControl(key)?.removeEventListener("change", listener);
        } else if (key === "tmhResaltarCodigoTiqueteReset") {
          ticketFontElements().reset?.removeEventListener("click", listener);
        } else if (key === "tmhResaltarCodigoTiqueteSave") {
          ticketFontElements().save?.removeEventListener("click", listener);
        } else if (key === "tmhFormatoImpresionCompletaReset") {
          fullPrintElements().reset?.removeEventListener("click", listener);
        } else if (key === "tmhFormatoImpresionCompletaSave") {
          fullPrintElements().save?.removeEventListener("click", listener);
        } else if (key.startsWith("lineConfig:")) {
          const source = key.split(":")[1];
          const launcher = LINE_CONFIG_LAUNCHERS.find(
            (candidate) => candidate.source === source,
          );
          if (launcher) {
            elements(launcher.enabledKey).toggle?.removeEventListener(
              "change",
              listener,
            );
          }
        } else {
          elements(key).toggle?.removeEventListener("change", listener);
        }
      }
      listeners.clear();
      chromeApi.storage.onChanged.removeListener(handleStorageChange);
      lifecycleEpoch += 1;
      settingsLoaded = false;
      changedDuringInitialLoad.clear();
      started = false;
    }

    return { start, destroy };
  }

  return { createPopupController };
});
