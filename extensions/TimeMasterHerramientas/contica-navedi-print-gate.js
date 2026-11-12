(function initializeConticaNavediPrintGate(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasConticaNavediPrintGate = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else if (root.document) {
    api.createNavediPrintGate(root, root.document).start();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildGate() {
  "use strict";

  const SETTING_EVENT = "tmh-contica-navedi-print-shortcut-setting";
  const PAYMENT_MODAL_SELECTOR = "#pv-payment-modal";
  const PAYMENT_SUBMIT_SELECTOR = "#pay-submit";
  const WRAPPED_MARKER = "__tmhConticaNavediPrintGate";

  function createNavediPrintGate(windowRef, documentRef, options = {}) {
    const intentTimeoutMs = options.intentTimeoutMs ?? 45_000;
    const pollIntervalMs = options.pollIntervalMs ?? 250;
    const now = options.now || (() => Date.now());
    let enabled = false;
    let pendingIntent = null;
    let expiresAt = 0;
    let pollTimer = null;
    let wrappedQz = null;
    let originalPrintDescriptor = null;
    let originalPrint = null;
    let gatedPrint = null;
    let printAssignmentHooked = false;
    let originalQzDescriptor = null;
    let qzValue;
    let qzAssignmentHooked = false;
    let started = false;

    function clearIntent() {
      pendingIntent = null;
      expiresAt = 0;
    }

    function setEnabled(nextEnabled) {
      enabled = nextEnabled === true;
      if (!enabled) clearIntent();
    }

    function isInsideOpenPaymentModal(target) {
      const element = target?.nodeType === 1 ? target : target?.parentElement;
      const modal = element?.closest?.(PAYMENT_MODAL_SELECTOR);
      if (!modal || modal.hidden || modal.getAttribute?.("aria-hidden") === "true") {
        return false;
      }
      const style = windowRef.getComputedStyle?.(modal);
      return style?.display !== "none" && style?.visibility !== "hidden";
    }

    function handleKeydown(event) {
      const isEnter =
        event?.key === "Enter" ||
        event?.code === "Enter" ||
        event?.code === "NumpadEnter";
      if (
        !enabled ||
        !isEnter ||
        event.repeat ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        !isInsideOpenPaymentModal(event.target)
      ) {
        return;
      }

      pendingIntent = event.ctrlKey ? "allow" : "block";
      expiresAt = now() + intentTimeoutMs;
      if (!event.ctrlKey) return;

      const submitButton = documentRef.querySelector(PAYMENT_SUBMIT_SELECTOR);
      if (
        !submitButton ||
        typeof submitButton.click !== "function" ||
        submitButton.disabled ||
        submitButton.matches?.(":disabled") ||
        submitButton.getAttribute?.("aria-disabled") === "true"
      ) {
        clearIntent();
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation?.();
      submitButton.click();
    }

    function takeIntent() {
      if (!enabled || !pendingIntent) return null;
      if (now() > expiresAt) {
        clearIntent();
        return null;
      }
      const intent = pendingIntent;
      clearIntent();
      return intent;
    }

    function createGatedPrint(printFunction) {
      const controlledPrint = function controlledNavediPrint(...args) {
        const intent = takeIntent();
        if (intent === "block") return Promise.resolve(undefined);
        return Reflect.apply(printFunction, this, args);
      };
      Object.defineProperty(controlledPrint, WRAPPED_MARKER, { value: true });
      return controlledPrint;
    }

    function restorePrint() {
      if (wrappedQz && printAssignmentHooked) {
        const latestPrint = originalPrint;
        if (originalPrintDescriptor) {
          Object.defineProperty(wrappedQz, "print", {
            ...originalPrintDescriptor,
            value: latestPrint,
          });
        } else {
          delete wrappedQz.print;
          if (latestPrint !== undefined) {
            Object.defineProperty(wrappedQz, "print", {
              configurable: true,
              enumerable: true,
              writable: true,
              value: latestPrint,
            });
          }
        }
      } else if (wrappedQz?.print === gatedPrint && originalPrint) {
        wrappedQz.print = originalPrint;
      }
      wrappedQz = null;
      originalPrintDescriptor = null;
      originalPrint = null;
      gatedPrint = null;
      printAssignmentHooked = false;
    }

    function observeQz(qz) {
      if (!qz || (typeof qz !== "object" && typeof qz !== "function")) {
        restorePrint();
        return false;
      }
      if (qz === wrappedQz && printAssignmentHooked) {
        return typeof originalPrint === "function";
      }

      restorePrint();
      const descriptor = Object.getOwnPropertyDescriptor(qz, "print");
      if (!descriptor || ("value" in descriptor && descriptor.configurable)) {
        originalPrintDescriptor = descriptor || null;
        originalPrint = descriptor?.value;
        gatedPrint =
          typeof originalPrint === "function"
            ? createGatedPrint(originalPrint)
            : null;
        wrappedQz = qz;
        printAssignmentHooked = true;
        Object.defineProperty(qz, "print", {
          configurable: true,
          enumerable: descriptor?.enumerable ?? true,
          get() {
            return gatedPrint || originalPrint;
          },
          set(nextPrint) {
            if (nextPrint?.[WRAPPED_MARKER] === true) return;
            originalPrint = nextPrint;
            gatedPrint =
              typeof nextPrint === "function"
                ? createGatedPrint(nextPrint)
                : null;
          },
        });
        return typeof originalPrint === "function";
      }

      const currentPrint = qz.print;
      if (typeof currentPrint !== "function") return false;
      if (currentPrint[WRAPPED_MARKER] === true) return true;

      originalPrint = currentPrint;
      wrappedQz = qz;
      gatedPrint = createGatedPrint(currentPrint);
      qz.print = gatedPrint;
      return true;
    }

    function installQzAssignmentHook() {
      const descriptor = Object.getOwnPropertyDescriptor(windowRef, "qz");
      if (descriptor && (!descriptor.configurable || !("value" in descriptor))) {
        return false;
      }

      originalQzDescriptor = descriptor || null;
      qzValue = descriptor?.value ?? windowRef.qz;
      Object.defineProperty(windowRef, "qz", {
        configurable: true,
        enumerable: descriptor?.enumerable ?? true,
        get() {
          return qzValue;
        },
        set(nextQz) {
          qzValue = nextQz;
          observeQz(nextQz);
        },
      });
      qzAssignmentHooked = true;
      observeQz(qzValue);
      return true;
    }

    function restoreQzAssignment() {
      if (!qzAssignmentHooked) return;
      const latestQz = qzValue;
      delete windowRef.qz;
      if (originalQzDescriptor) {
        Object.defineProperty(windowRef, "qz", {
          ...originalQzDescriptor,
          value: latestQz,
        });
      } else if (latestQz !== undefined) {
        Object.defineProperty(windowRef, "qz", {
          configurable: true,
          enumerable: true,
          writable: true,
          value: latestQz,
        });
      }
      originalQzDescriptor = null;
      qzValue = undefined;
      qzAssignmentHooked = false;
    }

    function installPrintWrapper() {
      return observeQz(windowRef.qz);
    }

    function handleSetting(event) {
      setEnabled(event?.detail?.enabled === true);
    }

    function start() {
      if (started) return;
      started = true;
      documentRef.addEventListener(SETTING_EVENT, handleSetting);
      documentRef.addEventListener("keydown", handleKeydown, true);
      if (!installQzAssignmentHook()) installPrintWrapper();
      pollTimer = windowRef.setInterval?.(installPrintWrapper, pollIntervalMs) ?? null;
    }

    function stop() {
      if (!started) return;
      started = false;
      documentRef.removeEventListener(SETTING_EVENT, handleSetting);
      documentRef.removeEventListener("keydown", handleKeydown, true);
      if (pollTimer !== null) windowRef.clearInterval?.(pollTimer);
      pollTimer = null;
      setEnabled(false);
      restorePrint();
      restoreQzAssignment();
    }

    return { start, stop, setEnabled, installPrintWrapper };
  }

  return { SETTING_EVENT, createNavediPrintGate };
});
