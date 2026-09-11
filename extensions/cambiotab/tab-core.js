(function initializeCambioTabCore(root, factory) {
  const api = factory();
  root.CambioTabCore = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCambioTabCore() {
  "use strict";

  const TAB_SELECTOR = "#tabs a[data-tab]";

  function isAvailable(anchor) {
    const item = anchor.closest("li");
    return !(
      anchor.getAttribute("aria-disabled") === "true" ||
      item?.getAttribute("aria-disabled") === "true" ||
      item?.classList.contains("disabled")
    );
  }

  function readAvailableTabs(document) {
    return Array.from(document.querySelectorAll(TAB_SELECTOR)).filter(isAvailable);
  }

  function readNumericShortcut(event) {
    const match = String(event.code || "").match(/^(?:Digit|Numpad)([1-7])$/);
    return match ? match[1] : null;
  }

  function createTabController(document) {
    let started = false;

    function activate(anchor, event) {
      if (!anchor) return false;
      event.preventDefault();
      event.stopPropagation();
      anchor.click();
      return true;
    }

    function activateRelative(direction, event) {
      const tabs = readAvailableTabs(document);
      if (!tabs.length) return false;

      const activeItem = document.querySelector("#tabs li.active");
      const activeIndex = tabs.findIndex((anchor) => anchor.closest("li") === activeItem);
      const baseIndex = activeIndex >= 0 ? activeIndex : direction > 0 ? -1 : 0;
      const targetIndex = (baseIndex + direction + tabs.length) % tabs.length;
      return activate(tabs[targetIndex], event);
    }

    function handleKeydown(event) {
      if (
        !event.ctrlKey ||
        !event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.repeat
      ) {
        return;
      }

      if (event.code === "ArrowRight") {
        activateRelative(1, event);
        return;
      }

      if (event.code === "ArrowLeft") {
        activateRelative(-1, event);
        return;
      }

      const tabNumber = readNumericShortcut(event);
      if (!tabNumber) return;
      const target = readAvailableTabs(document).find(
        (anchor) => anchor.dataset.tab === tabNumber,
      );
      activate(target, event);
    }

    return {
      start() {
        if (started) return;
        document.addEventListener("keydown", handleKeydown, true);
        started = true;
      },
    };
  }

  return { createTabController };
});
