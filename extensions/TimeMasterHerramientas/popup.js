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
    .filter(([, fallback]) => typeof fallback === "boolean")
    .map(([key]) => key);
  const CLOSE_ENABLED_KEY = "tmhCerrarImpresionConticaEnabled";
  const CLOSE_DELAY_KEY = "tmhCerrarImpresionConticaDelaySeconds";
  const CLOSE_MESSAGE_KEY = "tmhCerrarImpresionConticaMessage";

  function createPopupController(documentRef, chromeApi) {
    const values = { ...settings.DEFAULT_SETTINGS };
    const listeners = new Map();
    let started = false;

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

    function bind(key) {
      const { toggle } = elements(key);
      if (!toggle) return;

      const handleChange = () => {
        const previous = values[key];
        const next = toggle.checked === true;
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

    function start() {
      if (started) return;
      started = true;
      for (const key of keys) bind(key);
      bindDelay();
      bindMessage();
      chromeApi.storage.local.get(settings.DEFAULT_SETTINGS, (stored) => {
        const normalized = settings.normalizeSettings(stored);
        Object.assign(values, normalized);
        for (const key of keys) {
          render(key, normalized[key]);
        }
        renderDelay(normalized[CLOSE_DELAY_KEY]);
        renderMessage(normalized[CLOSE_MESSAGE_KEY]);
      });
    }

    function destroy() {
      if (!started) return;
      for (const [key, listener] of listeners) {
        if (key === CLOSE_DELAY_KEY) {
          delayElements().input?.removeEventListener("change", listener);
        } else if (key === CLOSE_MESSAGE_KEY) {
          messageElements().input?.removeEventListener("change", listener);
        } else {
          elements(key).toggle?.removeEventListener("change", listener);
        }
      }
      listeners.clear();
      started = false;
    }

    return { start, destroy };
  }

  return { createPopupController };
});
