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

  const keys = Object.keys(settings.DEFAULT_SETTINGS);

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

    function start() {
      if (started) return;
      started = true;
      for (const key of keys) bind(key);
      chromeApi.storage.local.get(settings.DEFAULT_SETTINGS, (stored) => {
        const normalized = settings.normalizeSettings(stored);
        for (const key of keys) {
          values[key] = normalized[key];
          render(key, normalized[key]);
        }
      });
    }

    function destroy() {
      if (!started) return;
      for (const [key, listener] of listeners) {
        elements(key).toggle?.removeEventListener("change", listener);
      }
      listeners.clear();
      started = false;
    }

    return { start, destroy };
  }

  return { createPopupController };
});
