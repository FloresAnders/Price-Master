(function initializeIngresarVentaCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasIngresarVenta = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildIngresarVentaCore() {
  "use strict";

  function createSaleShortcutController(documentRef) {
    let started = false;

    function isActionable(button) {
      if (
        !button ||
        typeof button.click !== "function" ||
        button.disabled ||
        button.matches?.(":disabled") ||
        button.getAttribute("aria-disabled") === "true"
      ) {
        return false;
      }

      const windowRef = documentRef.defaultView;
      for (let element = button; element; element = element.parentElement) {
        if (
          element.hidden ||
          element.hasAttribute("inert") ||
          element.getAttribute("aria-hidden") === "true"
        ) {
          return false;
        }
        const style = windowRef?.getComputedStyle?.(element);
        if (
          style?.display === "none" ||
          style?.visibility === "hidden" ||
          style?.visibility === "collapse" ||
          style?.pointerEvents === "none"
        ) {
          return false;
        }
      }

      return true;
    }

    function handleKeydown(event) {
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.repeat ||
        (event.code !== "Enter" && event.code !== "NumpadEnter")
      ) {
        return;
      }
      const button = documentRef.querySelector("#btn-submit-sale");
      if (!isActionable(button)) return;

      event.preventDefault();
      event.stopPropagation();
      button.click();
    }

    function start() {
      if (started) return;
      documentRef.addEventListener("keydown", handleKeydown, true);
      started = true;
    }

    function stop() {
      if (!started) return;
      documentRef.removeEventListener("keydown", handleKeydown, true);
      started = false;
    }

    return { start, stop };
  }

  return { createSaleShortcutController };
});
