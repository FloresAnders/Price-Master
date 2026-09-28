(function initializeSumaTiemposCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasSumaTiempos = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createSumaTiemposCore() {
  "use strict";

  function parseNumbers(value) {
    return String(value ?? "")
      .trim()
      .split(/[\s,;|/\\-]+/)
      .filter((token) => /^\d{1,2}$/.test(token));
  }

  function parseCurrency(value) {
    let normalized = String(value ?? "").replace(/[^\d,.-]/g, "");
    if (!normalized || !/\d/.test(normalized)) return 0;

    const comma = normalized.lastIndexOf(",");
    const dot = normalized.lastIndexOf(".");
    if (comma >= 0 && dot >= 0) {
      const decimalSeparator = comma > dot ? "," : ".";
      const thousandsSeparator = decimalSeparator === "," ? /\./g : /,/g;
      normalized = normalized
        .replace(thousandsSeparator, "")
        .replace(decimalSeparator, ".");
    } else if (comma >= 0) {
      normalized = /^-?\d{1,3}(,\d{3})+$/.test(normalized)
        ? normalized.replace(/,/g, "")
        : normalized.replace(",", ".");
    } else if (/^-?\d{1,3}(\.\d{3})+$/.test(normalized)) {
      normalized = normalized.replace(/\./g, "");
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  function calculateTotals(input) {
    const numberCount = parseNumbers(input.numbersText).length;
    const mainPerNumber = parseCurrency(input.mainAmount);
    const companionPerNumber = input.companionActive
      ? parseCurrency(input.companionAmount)
      : 0;
    const ticketTotal = parseCurrency(input.ticketTotal);
    const captureTotal = numberCount * (mainPerNumber + companionPerNumber);
    return {
      numberCount,
      mainPerNumber,
      companionPerNumber,
      ticketTotal,
      captureTotal,
      grandTotal: ticketTotal + captureTotal,
    };
  }

  function formatCurrency(amount) {
    return `₡ ${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function createSumaTiemposController(documentRef, windowRef) {
    const watchedInputs = [
      "#ticket-amount",
      "#ticket-amount-companion",
      "#ticket-numbers",
    ].join(",");
    let ignoredTicketTotal = 0;
    let observer = null;
    let panel = null;
    let started = false;
    let suppressOldTicket = false;

    function ensurePanel() {
      panel = documentRef.querySelector("#sumatiempos-panel");
      if (panel) return panel;
      panel = documentRef.createElement("aside");
      panel.id = "sumatiempos-panel";
      panel.className = "sumatiempos-panel--compact";
      panel.hidden = true;
      panel.setAttribute("role", "status");
      panel.setAttribute("aria-live", "polite");
      panel.setAttribute("aria-label", "Suma total de la venta");
      panel.innerHTML = `
        <span class="sumatiempos-panel__title">Suma total</span>
        <strong class="sumatiempos-panel__total" data-sumatiempos="grand-total">₡ 0.00</strong>
        <div class="sumatiempos-panel__breakdown">
          <span>Tiquete <strong data-sumatiempos="ticket-total">₡ 0.00</strong></span>
          <span>En captura <strong data-sumatiempos="capture-total">₡ 0.00</strong></span>
        </div>
        <span class="sumatiempos-panel__count" data-sumatiempos="count">0 números</span>
      `;
      documentRef.body.append(panel);
      return panel;
    }

    function companionIsActive(input) {
      const wrap = documentRef.querySelector("#ticket-companion-wrap");
      if (!input || input.disabled || !wrap || wrap.hidden) return false;
      return (
        wrap.style.display !== "none" &&
        windowRef.getComputedStyle(wrap).display !== "none"
      );
    }

    function readTotals() {
      const companion = documentRef.querySelector("#ticket-amount-companion");
      const rawTicketTotal = parseCurrency(
        documentRef.querySelector("#total-amount")?.textContent,
      );
      if (suppressOldTicket && rawTicketTotal === 0) {
        suppressOldTicket = false;
        ignoredTicketTotal = 0;
      }
      const effectiveTicketTotal = suppressOldTicket
        ? Math.max(0, rawTicketTotal - ignoredTicketTotal)
        : rawTicketTotal;
      return calculateTotals({
        numbersText: documentRef.querySelector("#ticket-numbers")?.value,
        mainAmount: documentRef.querySelector("#ticket-amount")?.value,
        companionAmount: companion?.value,
        companionActive: companionIsActive(companion),
        ticketTotal: effectiveTicketTotal,
      });
    }

    function setText(selector, value) {
      const target = panel?.querySelector(selector);
      if (target && target.textContent !== value) target.textContent = value;
    }

    function positionPanel() {
      const capture = documentRef.querySelector(".sales-capture");
      if (!panel || !capture) return;
      const rect = capture.getBoundingClientRect();
      const gap = 32;
      const margin = 16;
      const availableWidth = windowRef.innerWidth - rect.right - gap - margin;
      if (availableWidth >= 280) {
        panel.classList.add("sumatiempos-panel--side");
        panel.classList.remove("sumatiempos-panel--compact");
        panel.style.left = `${Math.round(rect.right + gap)}px`;
        panel.style.top = `${Math.max(margin, Math.round(rect.top))}px`;
        panel.style.width = `${Math.min(320, availableWidth)}px`;
        panel.style.right = "";
        panel.style.bottom = "";
        return;
      }
      panel.classList.remove("sumatiempos-panel--side");
      panel.classList.add("sumatiempos-panel--compact");
      panel.style.left = "";
      panel.style.top = "";
      panel.style.width = "";
      panel.style.right = "";
      panel.style.bottom = "";
    }

    function render(totals) {
      ensurePanel();
      setText("[data-sumatiempos=grand-total]", formatCurrency(totals.grandTotal));
      setText("[data-sumatiempos=ticket-total]", formatCurrency(totals.ticketTotal));
      setText("[data-sumatiempos=capture-total]", formatCurrency(totals.captureTotal));
      setText(
        "[data-sumatiempos=count]",
        `${totals.numberCount} ${totals.numberCount === 1 ? "número" : "números"}`,
      );
      panel.hidden = totals.numberCount === 0 && totals.grandTotal === 0;
      positionPanel();
    }

    function update() {
      if (!documentRef.querySelector(".sales-capture")) {
        ensurePanel().hidden = true;
        return;
      }
      render(readTotals());
    }

    function reset() {
      ignoredTicketTotal = parseCurrency(
        documentRef.querySelector("#total-amount")?.textContent,
      );
      suppressOldTicket = true;
      render(calculateTotals({
        numbersText: "",
        mainAmount: 0,
        companionAmount: 0,
        companionActive: false,
        ticketTotal: 0,
      }));
    }

    function handleInput(event) {
      if (event.target?.matches?.(watchedInputs)) update();
    }

    function handleClick(event) {
      if (event.target?.closest?.("#btn-submit-sale")) {
        reset();
        return;
      }
      if (event.target?.closest?.("#btn-add, #btn-clear-numbers")) {
        windowRef.setTimeout(update, 0);
      }
    }

    function handleMutations(mutations) {
      const externalMutation = mutations.some(
        (mutation) => !panel || !panel.contains(mutation.target),
      );
      if (externalMutation) update();
    }

    function start() {
      if (started) return;
      started = true;
      ensurePanel();
      documentRef.addEventListener("input", handleInput, true);
      documentRef.addEventListener("change", handleInput, true);
      documentRef.addEventListener("click", handleClick, true);
      windowRef.addEventListener("resize", positionPanel);
      windowRef.addEventListener("scroll", positionPanel, true);
      observer = new windowRef.MutationObserver(handleMutations);
      observer.observe(documentRef.body, {
        attributes: true,
        attributeFilter: ["class", "disabled", "hidden", "style"],
        characterData: true,
        childList: true,
        subtree: true,
      });
      update();
    }

    function destroy() {
      if (!started) return;
      observer?.disconnect();
      documentRef.removeEventListener("input", handleInput, true);
      documentRef.removeEventListener("change", handleInput, true);
      documentRef.removeEventListener("click", handleClick, true);
      windowRef.removeEventListener("resize", positionPanel);
      windowRef.removeEventListener("scroll", positionPanel, true);
      panel?.remove();
      observer = null;
      panel = null;
      started = false;
    }

    return { destroy, start, update };
  }

  return {
    calculateTotals,
    createSumaTiemposController,
    parseCurrency,
    parseNumbers,
  };
});
