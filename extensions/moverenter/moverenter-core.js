(function initMoverEnterCore(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    root.MoverEnterCore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildApi() {
  "use strict";

  function createMoverEnterController(documentRef) {
    let enabled = false;
    let observer = null;
    let started = false;
    let wasOpen = false;
    let currentOpeningKey = null;
    let currentOpenedAt = null;
    let clickedOpeningKey = null;
    let fallbackOpeningId = 0;

    function getOpeningKey(dialog) {
      const isOpen = dialog.hasAttribute("open") && !dialog.hidden;

      if (!isOpen) {
        wasOpen = false;
        currentOpeningKey = null;
        currentOpenedAt = null;
        return null;
      }

      const openedAt = dialog.getAttribute("data-sales-opened-at")?.trim();

      if (!wasOpen || (openedAt && currentOpenedAt !== openedAt)) {
        fallbackOpeningId += 1;
        currentOpenedAt = openedAt || null;
        currentOpeningKey = openedAt
          ? `opening:${fallbackOpeningId}:timestamp:${openedAt}`
          : `opening:${fallbackOpeningId}`;
      } else if (!currentOpeningKey) {
        fallbackOpeningId += 1;
        currentOpenedAt = openedAt || null;
        currentOpeningKey = `opening:${fallbackOpeningId}`;
      }

      wasOpen = true;
      return currentOpeningKey;
    }

    function tryPrint() {
      const dialog = documentRef.querySelector("#sales-success-dialog");

      if (!dialog) {
        wasOpen = false;
        currentOpeningKey = null;
        currentOpenedAt = null;
        return false;
      }

      const openingKey = getOpeningKey(dialog);
      if (!enabled || !openingKey || clickedOpeningKey === openingKey) {
        return false;
      }

      const printButton = dialog.querySelector("#sales-success-dialog-print");
      if (
        !printButton ||
        printButton.disabled ||
        printButton.hidden ||
        typeof printButton.click !== "function"
      ) {
        return false;
      }

      clickedOpeningKey = openingKey;
      printButton.click();
      return true;
    }

    function start() {
      if (started) return;

      const MutationObserverClass =
        documentRef.defaultView?.MutationObserver || globalThis.MutationObserver;
      observer = new MutationObserverClass(tryPrint);
      observer.observe(documentRef.documentElement || documentRef, {
        attributes: true,
        attributeFilter: [
          "open",
          "data-sales-opened-at",
          "hidden",
          "disabled",
        ],
        childList: true,
        subtree: true,
      });
      started = true;
      tryPrint();
    }

    function stop() {
      observer?.disconnect();
      observer = null;
      started = false;
    }

    function setEnabled(nextEnabled) {
      enabled = nextEnabled === true;
      if (enabled) tryPrint();
    }

    return { setEnabled, start, stop };
  }

  return { createMoverEnterController };
});
