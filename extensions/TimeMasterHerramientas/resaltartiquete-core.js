(function initializeTicketCodeCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasResaltarTiquete = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildTicketCodeCore() {
  "use strict";

  const TICKET_CODE_PATTERN = /^\d{5}-\d{4}-\d{8}$/;
  const TICKET_DATE_PATTERN = /^Fecha:\s*\d{2}\/\d{2}\/\d{4}$/i;
  const ALLOWED_WEIGHTS = new Set([600, 700, 800, 900]);
  const ALLOWED_FAMILIES = new Set(["inherit", "Arial", "Courier New", "Verdana"]);
  const LINE_TYPES = ["code", "date", "draw"];

  function createTicketCodeController(documentRef) {
    const markers = { code: null, date: null, draw: null };
    let observer = null;
    let started = false;
    let fonts = {
      code: { sizePx: 22, weight: 700, family: "inherit" },
      date: { sizePx: 22, weight: 700, family: "inherit" },
      draw: { sizePx: 22, weight: 700, family: "inherit" },
    };

    function eligibleTextNodes() {
      if (!documentRef?.body || !documentRef.createTreeWalker) return [];
      const nodeFilter = documentRef.defaultView?.NodeFilter || globalThis.NodeFilter;
      if (!nodeFilter) return [];
      const walker = documentRef.createTreeWalker(
        documentRef.body,
        nodeFilter.SHOW_TEXT,
      );
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        const parentTag = node.parentElement?.tagName;
        if (
          !["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"].includes(parentTag) &&
          !node.parentElement?.closest?.("[data-tmh-ticket-line]") &&
          node.nodeValue?.trim()
        ) {
          nodes.push(node);
        }
        node = walker.nextNode();
      }
      return nodes;
    }

    function findLineNodes() {
      const nodes = eligibleTextNodes();
      const dateIndex = nodes.findIndex((node) =>
        TICKET_DATE_PATTERN.test(node.nodeValue.trim()),
      );
      return {
        code: nodes.find((node) =>
          TICKET_CODE_PATTERN.test(node.nodeValue.trim()),
        ),
        date: dateIndex >= 0 ? nodes[dateIndex] : null,
        draw: dateIndex >= 0 ? nodes[dateIndex + 1] || null : null,
      };
    }

    function applyFont(type) {
      const marker = markers[type];
      const font = fonts[type];
      if (!marker || !font) return;
      marker.style.setProperty("--tmh-ticket-font-size", `${font.sizePx}px`);
      marker.style.setProperty("--tmh-ticket-font-weight", String(font.weight));
      marker.style.setProperty("--tmh-ticket-font-family", font.family);
    }

    function normalizeFont(next, current) {
      return {
        sizePx:
          Number.isInteger(next?.sizePx) && next.sizePx >= 10 && next.sizePx <= 72
            ? next.sizePx
            : current.sizePx,
        weight: ALLOWED_WEIGHTS.has(next?.weight) ? next.weight : current.weight,
        family: ALLOWED_FAMILIES.has(next?.family) ? next.family : current.family,
      };
    }

    function setFonts(next = {}) {
      fonts = Object.fromEntries(
        LINE_TYPES.map((type) => [type, normalizeFont(next[type], fonts[type])]),
      );
      for (const type of LINE_TYPES) applyFont(type);
    }

    function ensureMarkers() {
      const nodes = findLineNodes();
      for (const type of LINE_TYPES) {
        if (markers[type]?.isConnected || !nodes[type]) continue;
        const marker = documentRef.createElement("span");
        marker.setAttribute("data-tmh-ticket-line", type);
        marker.setAttribute(`data-tmh-ticket-${type}`, "");
        marker.textContent = nodes[type].nodeValue;
        nodes[type].replaceWith(marker);
        markers[type] = marker;
        applyFont(type);
      }
    }

    function start() {
      if (started) return;
      started = true;
      ensureMarkers();
      const MutationObserverClass =
        documentRef.defaultView?.MutationObserver || globalThis.MutationObserver;
      if (!MutationObserverClass) return;
      observer = new MutationObserverClass(ensureMarkers);
      observer.observe(documentRef.documentElement || documentRef, {
        childList: true,
        subtree: true,
      });
    }

    function stop() {
      observer?.disconnect();
      observer = null;
      started = false;
      for (const type of LINE_TYPES) {
        const marker = markers[type];
        if (marker?.isConnected) {
          marker.replaceWith(documentRef.createTextNode(marker.textContent || ""));
        }
        markers[type] = null;
      }
    }

    return { start, stop, setFonts };
  }

  return { createTicketCodeController };
});
