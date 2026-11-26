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
  const NAVEDI_URL = "wss://localhost:8181/";
  const NAVEDI_ORIGIN = "wss://localhost:8181";
  const POS_PATH_PATTERN = /^\/app\/modules\/punto_de_venta(?:\/|$)/;
  const ELECTRONIC_TICKET_PATTERN = /TIQUETE ELECTR[ÓO]NICO/i;

  function createNavediPrintGate(windowRef, documentRef, options = {}) {
    const intentTimeoutMs = options.intentTimeoutMs ?? 15_000;
    const now = options.now || (() => Date.now());
    const WebSocketConstructor = windowRef.WebSocket;
    const MessageEventConstructor = windowRef.MessageEvent;
    let enabled = false;
    let armed = false;
    let expiresAt = 0;
    let resetTimer = null;
    let originalSend = null;
    let interceptedSend = null;
    let started = false;

    function isPOS() {
      return POS_PATH_PATTERN.test(windowRef.location?.pathname || "");
    }

    function reset() {
      armed = false;
      expiresAt = 0;
      if (resetTimer !== null) windowRef.clearTimeout?.(resetTimer);
      resetTimer = null;
    }

    function setEnabled(nextEnabled) {
      enabled = nextEnabled === true;
      if (!enabled) reset();
    }

    function handleKeydown(event) {
      if (!enabled) return;
      if (!isPOS()) {
        reset();
        return;
      }
      if (event?.repeat || event?.isComposing) return;
      if (event?.key === "Escape") {
        reset();
        return;
      }
      if (event?.key !== "Enter") return;

      reset();
      if (
        (event.ctrlKey || event.shiftKey) &&
        !event.altKey &&
        !event.metaKey
      ) {
        armed = true;
        expiresAt = now() + intentTimeoutMs;
        resetTimer = windowRef.setTimeout?.(reset, intentTimeoutMs) ?? null;
        console.info("[Contica] Próxima impresión será omitida.");
      }
    }

    function hasActiveIntent() {
      if (!enabled || !armed) return false;
      if (!isPOS()) {
        reset();
        return false;
      }
      if (now() > expiresAt) {
        reset();
        return false;
      }
      return true;
    }

    function isEligibleRequest(data) {
      if (typeof data !== "string") return null;
      let request;
      try {
        request = JSON.parse(data);
      } catch {
        return null;
      }
      const printData = request?.params?.data;
      if (
        request?.call !== "print" ||
        typeof request.uid !== "string" ||
        !request.uid ||
        !Array.isArray(printData) ||
        !ELECTRONIC_TICKET_PATTERN.test(
          printData.filter((item) => typeof item === "string").join(""),
        )
      ) {
        return null;
      }
      return request;
    }

    function installSendInterceptor() {
      const prototype = WebSocketConstructor?.prototype;
      if (!prototype || typeof prototype.send !== "function") return false;
      if (interceptedSend && prototype.send === interceptedSend) return true;

      originalSend = prototype.send;
      interceptedSend = function controlledNavediSend(data) {
        if (
          !hasActiveIntent() ||
          this.url !== NAVEDI_URL ||
          this.readyState !== WebSocketConstructor.OPEN
        ) {
          return originalSend.apply(this, arguments);
        }

        const request = isEligibleRequest(data);
        if (!request) return originalSend.apply(this, arguments);

        reset();
        const socket = this;
        windowRef.setTimeout?.(() => {
          socket.dispatchEvent(
            new MessageEventConstructor("message", {
              data: JSON.stringify({ uid: request.uid }),
              origin: NAVEDI_ORIGIN,
            }),
          );
          console.info("[Contica] Impresión física omitida.", request.uid);
        }, 0);
        return undefined;
      };
      prototype.send = interceptedSend;
      return true;
    }

    function restoreSend() {
      const prototype = WebSocketConstructor?.prototype;
      if (prototype && interceptedSend && prototype.send === interceptedSend) {
        prototype.send = originalSend;
      }
      originalSend = null;
      interceptedSend = null;
    }

    function handleSetting(event) {
      setEnabled(event?.detail?.enabled === true);
    }

    function start() {
      if (started) return;
      started = true;
      documentRef.addEventListener(SETTING_EVENT, handleSetting);
      documentRef.addEventListener("keydown", handleKeydown, true);
      windowRef.addEventListener?.("pagehide", reset);
      installSendInterceptor();
    }

    function stop() {
      if (!started) return;
      started = false;
      documentRef.removeEventListener(SETTING_EVENT, handleSetting);
      documentRef.removeEventListener("keydown", handleKeydown, true);
      windowRef.removeEventListener?.("pagehide", reset);
      setEnabled(false);
      restoreSend();
    }

    return { start, stop, setEnabled };
  }

  return { SETTING_EVENT, createNavediPrintGate };
});
