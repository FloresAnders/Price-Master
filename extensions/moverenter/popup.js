(function configurePopup() {
  "use strict";

  const toggle = document.getElementById("automation-toggle");
  const status = document.getElementById("automation-status");

  function render(enabled, errorMessage = "") {
    toggle.checked = enabled;
    status.textContent = errorMessage || (enabled ? "Activado" : "Desactivado");
    status.dataset.enabled = String(enabled);

    if (errorMessage) {
      status.dataset.error = "true";
    } else {
      delete status.dataset.error;
    }
  }

  toggle.addEventListener("change", () => {
    const enabled = toggle.checked;
    toggle.disabled = true;

    chrome.storage.local.set({ enabled }, () => {
      toggle.disabled = false;

      if (chrome.runtime.lastError) {
        render(!enabled, "Error al guardar");
        return;
      }

      render(enabled);
    });
  });

  chrome.storage.local.get({ enabled: false }, (settings) => {
    render(settings.enabled === true);
  });
})();
