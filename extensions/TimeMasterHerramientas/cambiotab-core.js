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
  const OBSERVATION_CONTROL_SELECTOR = [
    'textarea[id*="observ" i]',
    'textarea[name*="observ" i]',
    'textarea[placeholder*="observ" i]',
    'textarea[aria-label*="observ" i]',
    'input[id*="observ" i]',
    'input[name*="observ" i]',
    'input[placeholder*="observ" i]',
    'input[aria-label*="observ" i]',
  ].join(",");

  function normalizeObservation(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
  }

  function readShortcutCharacter(event) {
    const key = String(event.key || "");
    if (/^\p{L}$/u.test(key)) return normalizeObservation(key);
    if (key === " " || key === "Spacebar") return " ";
    return null;
  }

  function isEditableTarget(target) {
    return Boolean(
      target?.closest?.(
        "input, textarea, select, [contenteditable='true'], [contenteditable='']",
      ),
    );
  }

  function labelObservationScore(label) {
    const text = normalizeObservation(label.textContent);
    if (!text.includes("OBSERVACION")) return 0;
    return text.includes("FACTURA") ? 2 : 1;
  }

  function controlForLabel(documentRef, label) {
    const forId = label.getAttribute("for");
    const associated = forId ? documentRef.getElementById(forId) : null;
    if (associated?.matches?.("input, textarea, [contenteditable='true']")) {
      return associated;
    }
    return (
      label.querySelector("input, textarea, [contenteditable='true']") ||
      label.parentElement?.querySelector(
        "input, textarea, [contenteditable='true']",
      ) ||
      null
    );
  }

  function findObservationControl(documentRef) {
    const labels = Array.from(documentRef.querySelectorAll("label"))
      .map((label) => ({ label, score: labelObservationScore(label) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score);
    for (const { label } of labels) {
      const control = controlForLabel(documentRef, label);
      if (control) return control;
    }
    return documentRef.querySelector(OBSERVATION_CONTROL_SELECTOR);
  }

  function readControlValue(control) {
    if (!control) return "";
    if ("value" in control) return control.value;
    return control.textContent;
  }

  function readActiveTabNumber(documentRef) {
    const activeAnchor = documentRef.querySelector(
      "#tabs li.active > a[data-tab]",
    );
    if (activeAnchor?.dataset.tab) return activeAnchor.dataset.tab;
    const extraTabs = documentRef.querySelector(EXTRA_TABS_SELECTOR);
    return extraTabs?.value || null;
  }

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
    let observationShortcut = "";
    let pendingExactTarget = null;
    let observationObserver = null;
    const observationsByTab = new Map();
    const pendingObservationReads = new Set();

    function clearObservationShortcut() {
      observationShortcut = "";
      pendingExactTarget = null;
    }

    function rememberActiveObservation() {
      const tabNumber = readActiveTabNumber(documentRef);
      const control = findObservationControl(documentRef);
      if (!tabNumber || !control) return;
      const observation = normalizeObservation(readControlValue(control));
      if (observation) observationsByTab.set(tabNumber, observation);
      else observationsByTab.delete(tabNumber);
    }

    function scheduleObservationRead() {
      if (pendingObservationReads.size) return;
      const setTimeoutRef = documentRef.defaultView?.setTimeout;
      if (typeof setTimeoutRef !== "function") {
        rememberActiveObservation();
        return;
      }
      const timeoutId = setTimeoutRef(() => {
        pendingObservationReads.delete(timeoutId);
        if (started) rememberActiveObservation();
      }, 0);
      pendingObservationReads.add(timeoutId);
    }

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

    function handleObservationShortcut(event) {
      const shortcutCharacter = readShortcutCharacter(event);
      if (
        !event.ctrlKey ||
        event.altKey ||
        event.shiftKey ||
        event.metaKey ||
        event.repeat ||
        shortcutCharacter === null
      ) {
        if (!event.ctrlKey) clearObservationShortcut();
        return false;
      }

      if (
        !observationShortcut &&
        isEditableTarget(event.target) &&
        ["A", "C", "V", "X", "Y", "Z"].includes(shortcutCharacter)
      ) {
        clearObservationShortcut();
        return false;
      }

      rememberActiveObservation();
      const tabs = readAvailableTabs(documentRef).filter((tab) =>
        observationsByTab.has(tab.number),
      );
      let nextShortcut = observationShortcut + shortcutCharacter;
      let candidates = tabs.filter((tab) =>
        observationsByTab.get(tab.number).startsWith(nextShortcut),
      );
      if (!candidates.length) {
        nextShortcut = shortcutCharacter;
        candidates = tabs.filter((tab) =>
          observationsByTab.get(tab.number).startsWith(nextShortcut),
        );
      }
      if (!candidates.length) {
        clearObservationShortcut();
        return false;
      }

      observationShortcut = nextShortcut;
      const exactMatch = candidates.find(
        (tab) => observationsByTab.get(tab.number) === observationShortcut,
      );
      if (exactMatch) {
        const hasLongerMatch = candidates.some(
          (tab) => observationsByTab.get(tab.number) !== observationShortcut,
        );
        if (!hasLongerMatch) {
          clearObservationShortcut();
          return activate(exactMatch, event);
        }
        pendingExactTarget = exactMatch;
      } else {
        pendingExactTarget = null;
      }

      event.preventDefault();
      event.stopPropagation();
      return true;
    }

    function handleKeydown(event) {
      if (!event.ctrlKey || event.shiftKey || event.metaKey || event.repeat) {
        handleObservationShortcut(event);
        return;
      }

      if (event.altKey && event.code === "ArrowRight") {
        clearObservationShortcut();
        activateRelative(1, event);
        return;
      }

      if (event.altKey && event.code === "ArrowLeft") {
        clearObservationShortcut();
        activateRelative(-1, event);
        return;
      }

      if (event.altKey) {
        clearObservationShortcut();
        const tabNumber = readNumericShortcut(event);
        if (!tabNumber) return;
        const target = readAvailableTabs(documentRef).find(
          (tab) => tab.number === tabNumber,
        );
        activate(target, event);
        return;
      }

      handleObservationShortcut(event);
    }

    function handleKeyup(event) {
      if (
        event.key === "Control" ||
        String(event.code || "").startsWith("Control")
      ) {
        const target = pendingExactTarget;
        clearObservationShortcut();
        if (target) activate(target, event);
      }
    }

    function handleObservationInput(event) {
      if (event.target === findObservationControl(documentRef)) {
        rememberActiveObservation();
      }
    }

    function handlePotentialTabChange(event) {
      const target = event.target;
      if (
        target?.closest?.(TAB_SELECTOR) ||
        target?.matches?.(EXTRA_TABS_SELECTOR)
      ) {
        rememberActiveObservation();
        scheduleObservationRead();
      }
    }

    function start() {
      if (started) return;
      documentRef.addEventListener("keydown", handleKeydown, true);
      documentRef.addEventListener("keyup", handleKeyup, true);
      documentRef.addEventListener("input", handleObservationInput, true);
      documentRef.addEventListener("change", handleObservationInput, true);
      documentRef.addEventListener("click", handlePotentialTabChange, true);
      documentRef.addEventListener("change", handlePotentialTabChange, true);
      started = true;
      const MutationObserverConstructor =
        documentRef.defaultView?.MutationObserver;
      if (MutationObserverConstructor && documentRef.documentElement) {
        observationObserver = new MutationObserverConstructor(
          scheduleObservationRead,
        );
        observationObserver.observe(documentRef.documentElement, {
          attributes: true,
          childList: true,
          subtree: true,
          attributeFilter: ["aria-selected", "class", "value"],
        });
      }
      rememberActiveObservation();
    }

    function stop() {
      if (!started) return;
      documentRef.removeEventListener("keydown", handleKeydown, true);
      documentRef.removeEventListener("keyup", handleKeyup, true);
      documentRef.removeEventListener("input", handleObservationInput, true);
      documentRef.removeEventListener("change", handleObservationInput, true);
      documentRef.removeEventListener("click", handlePotentialTabChange, true);
      documentRef.removeEventListener("change", handlePotentialTabChange, true);
      observationObserver?.disconnect();
      observationObserver = null;
      const clearTimeoutRef = documentRef.defaultView?.clearTimeout;
      if (typeof clearTimeoutRef === "function") {
        for (const timeoutId of pendingObservationReads) {
          clearTimeoutRef(timeoutId);
        }
      }
      pendingObservationReads.clear();
      observationsByTab.clear();
      clearObservationShortcut();
      started = false;
    }

    return { start, stop };
  }

  return { createTabController };
});
