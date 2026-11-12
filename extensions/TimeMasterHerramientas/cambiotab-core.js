(function initializeCambioTabCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasCambioTab = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function createCambioTabCore() {
  "use strict";

  const TAB_SELECTOR = "#tabs a[data-tab]";
  const EXTRA_TABS_SELECTOR = "#tabs select#extra-tabs";

  function isAvailable(anchor) {
    const item = anchor.closest("li");
    return !(
      anchor.getAttribute("aria-disabled") === "true" ||
      item?.getAttribute("aria-disabled") === "true" ||
      item?.classList.contains("disabled")
    );
  }

  function isAvailableOption(option, generatedAnchor) {
    return !(
      option.disabled ||
      option.closest("optgroup")?.disabled ||
      generatedAnchor?.getAttribute("aria-disabled") === "true" ||
      generatedAnchor?.closest("li")?.classList.contains("disabled")
    );
  }

  function generatedAnchorForOption(select, optionIndex) {
    return select
      .closest(".bootstrap-select")
      ?.querySelector(
        `li[data-original-index="${optionIndex}"] a[role="option"]`,
      );
  }

  function readAvailableTabs(documentRef) {
    const tabs = Array.from(documentRef.querySelectorAll(TAB_SELECTOR))
      .filter(isAvailable)
      .map((anchor) => ({
        number: anchor.dataset.tab,
        anchor,
      }));
    const extraTabs = documentRef.querySelector(EXTRA_TABS_SELECTOR);
    if (!extraTabs) return tabs;

    Array.from(extraTabs.options).forEach((option, optionIndex) => {
      const generatedAnchor = generatedAnchorForOption(extraTabs, optionIndex);
      if (!isAvailableOption(option, generatedAnchor)) return;
      tabs.push({
        number: option.value,
        select: extraTabs,
        option,
        generatedAnchor,
      });
    });
    return tabs;
  }

  function readNumericShortcut(event) {
    const match = String(event.code || "").match(/^(?:Digit|Numpad)([1-9])$/);
    return match ? match[1] : null;
  }

  function clickWithoutJavascriptUrl(anchor) {
    const href = anchor.getAttribute("href");
    if (!/^\s*javascript:/i.test(href || "")) {
      anchor.click();
      return;
    }

    anchor.removeAttribute("href");
    try {
      anchor.click();
    } finally {
      anchor.setAttribute("href", href);
    }
  }

  function createTabController(documentRef) {
    let started = false;

    function activate(target, event) {
      if (!target) return false;
      event.preventDefault();
      event.stopPropagation();
      if (target.anchor) {
        clickWithoutJavascriptUrl(target.anchor);
        return true;
      }

      if (target.generatedAnchor) {
        clickWithoutJavascriptUrl(target.generatedAnchor);
        return true;
      }

      target.select.value = target.option.value;
      target.option.selected = true;
      const EventConstructor =
        documentRef.defaultView?.Event || globalThis.Event;
      target.select.dispatchEvent(
        new EventConstructor("change", { bubbles: true }),
      );
      return true;
    }

    function activateRelative(direction, event) {
      const tabs = Array.from(documentRef.querySelectorAll(TAB_SELECTOR))
        .filter(isAvailable)
        .filter((anchor) => {
          const tabNumber = Number(anchor.dataset.tab);
          return Number.isInteger(tabNumber) && tabNumber >= 1 && tabNumber <= 7;
        })
        .map((anchor) => ({
          number: anchor.dataset.tab,
          anchor,
        }));
      if (!tabs.length) return false;

      const activeNumber = documentRef.querySelector(
        "#tabs li.active > a[data-tab]",
      )?.dataset.tab;
      const activeIndex = tabs.findIndex((tab) => tab.number === activeNumber);
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
      const target = readAvailableTabs(documentRef).find(
        (tab) => tab.number === tabNumber,
      );
      activate(target, event);
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

  return { createTabController };
});
