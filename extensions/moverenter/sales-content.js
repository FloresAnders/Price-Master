(function startMoverEnter() {
  "use strict";

  const controller = globalThis.MoverEnterCore.createMoverEnterController(
    document,
  );
  controller.start();

  chrome.storage.local.get({ enabled: false }, (settings) => {
    controller.setEnabled(settings.enabled === true);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.enabled) return;
    controller.setEnabled(changes.enabled.newValue === true);
  });
})();
