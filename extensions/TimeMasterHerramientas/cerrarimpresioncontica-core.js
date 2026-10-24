(function initializeCerrarImpresionConticaCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasCerrarImpresionContica = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildCore() {
  "use strict";

  const DEFAULT_CLOSE_DELAY_SECONDS = 5;
  const MODAL_SELECTOR = "#printInvoice";
  const CLOSE_BUTTON_SELECTOR =
    '.esc-button[data-dismiss="modal"]';

  function isOpen(modal) {
    return Boolean(
      modal?.isConnected &&
        !modal.hidden &&
        modal.getAttribute("aria-hidden") !== "true" &&
        modal.style.display !== "none" &&
        (modal.classList.contains("in") ||
          modal.getAttribute("aria-modal") === "true" ||
          modal.style.display === "block"),
    );
  }

  function createPrintInvoiceCloser(documentRef) {
    let closeDelayMs = DEFAULT_CLOSE_DELAY_SECONDS * 1_000;
    let timerId = null;
    let activeModal = null;
    let observer = null;

    function cancelTimer() {
      if (timerId === null) return;
      clearTimeout(timerId);
      timerId = null;
    }

    function evaluate() {
      const modal = documentRef.querySelector(MODAL_SELECTOR);
      if (modal === activeModal && isOpen(modal)) return;

      cancelTimer();
      activeModal = null;
      if (!isOpen(modal)) return;

      activeModal = modal;
      timerId = setTimeout(() => {
        timerId = null;
        if (activeModal !== modal || !isOpen(modal)) return;
        modal.querySelector(CLOSE_BUTTON_SELECTOR)?.click();
      }, closeDelayMs);
    }

    function setDelaySeconds(seconds) {
      if (!Number.isInteger(seconds) || seconds < 1) return;
      const nextDelayMs = seconds * 1_000;
      if (nextDelayMs === closeDelayMs) return;
      closeDelayMs = nextDelayMs;

      if (!observer || timerId === null || !isOpen(activeModal)) return;
      cancelTimer();
      activeModal = null;
      evaluate();
    }

    function start() {
      if (observer) return;
      const MutationObserverCtor = documentRef.defaultView?.MutationObserver;
      if (!MutationObserverCtor) return;
      observer = new MutationObserverCtor(evaluate);
      observer.observe(documentRef.documentElement, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      evaluate();
    }

    function stop() {
      observer?.disconnect();
      observer = null;
      cancelTimer();
      activeModal = null;
    }

    return { start, stop, setDelaySeconds };
  }

  return { createPrintInvoiceCloser };
});
