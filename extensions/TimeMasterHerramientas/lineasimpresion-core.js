(function initializePrintLinesCore(root, factory) {
  const api = factory();
  root.TimeMasterHerramientasLineasImpresion = api;
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildPrintLinesCore() {
  "use strict";

  const TICKET_CODE_PATTERN = /^\d{5}-\d{4}-\d{8}$/;
  const TICKET_DATE_PATTERN = /^Fecha:\s*\d{2}\/\d{2}\/\d{4}$/i;
  const BCR_DATE_PATTERN = /^BCR\s+\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}$/i;
  const BCR_FIXED_TEXTS = new Set([
    "tucan",
    "banco-de-costa-rica",
    "reimpresion-de-facturas",
    "comprobante-de-pago",
    "comprobante-de-deposito",
    "detalle-de-pago",
    "datos-cuenta-destino",
  ]);
  const ALLOWED_WEIGHTS = new Set([600, 700, 800, 900]);
  const ALLOWED_FAMILIES = new Set(["inherit", "Arial", "Courier New", "Verdana"]);
  const EXCLUDED_TAGS = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);
  const SOURCE_DEFINITIONS = Object.freeze({
    ticket: Object.freeze({
      enabledKey: "tmhResaltarCodigoTiqueteEnabled",
      selectedKey: "tmhResaltarLineasTiqueteSelectedLineIds",
      initializedKey: "tmhResaltarLineasTiqueteSelectionInitialized",
      sizeKey: "tmhResaltarLineasTiqueteFontSizePx",
      weightKey: "tmhResaltarLineasTiqueteFontWeight",
      familyKey: "tmhResaltarLineasTiqueteFontFamily",
      legacySizeKey: "tmhResaltarCodigoTiqueteFontSizePx",
      legacyWeightKey: "tmhResaltarCodigoTiqueteFontWeight",
      legacyFamilyKey: "tmhResaltarCodigoTiqueteFontFamily",
      cacheKey: "tmhDetectedPrintLinesTicket",
      catalogKey: "tmhKnownPrintLinesTicket",
      defaultFont: Object.freeze({ sizePx: 22, weight: 700, family: "inherit" }),
    }),
    bcr: Object.freeze({
      enabledKey: "tmhFormatoImpresionCompletaEnabled",
      selectedKey: "tmhFormatoImpresionCompletaSelectedLineIds",
      initializedKey: "tmhFormatoImpresionCompletaSelectionInitialized",
      sizeKey: "tmhFormatoImpresionCompletaFontSizePx",
      weightKey: "tmhFormatoImpresionCompletaFontWeight",
      familyKey: "tmhFormatoImpresionCompletaFontFamily",
      cacheKey: "tmhDetectedPrintLinesBcr",
      catalogKey: "tmhKnownPrintLinesBcr",
      defaultFont: Object.freeze({ sizePx: 21, weight: 900, family: "Verdana" }),
    }),
  });

  function sourceDefinition(source) {
    const definition = SOURCE_DEFINITIONS[source];
    if (!definition) throw new Error(`Unsupported print-line source: ${source}`);
    return definition;
  }

  function normalizeSize(value, fallback) {
    return Number.isInteger(value) && value >= 10 && value <= 72
      ? value
      : fallback;
  }

  function normalizeWeight(value, fallback) {
    return ALLOWED_WEIGHTS.has(value) ? value : fallback;
  }

  function normalizeFamily(value, fallback) {
    return ALLOWED_FAMILIES.has(value) ? value : fallback;
  }

  function logicalToken(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizeSourceSettings(source, raw = {}, lines = []) {
    const definition = sourceDefinition(source);
    const initialized = raw[definition.initializedKey] === true;
    const availableIds = new Set(lines.map((line) => line.id));
    const storedSelection = Array.isArray(raw[definition.selectedKey])
      ? raw[definition.selectedKey].filter(
        (id) => typeof id === "string" && availableIds.has(id),
      )
      : [];
    const selectedLineIds = initialized
      ? [...new Set(storedSelection)]
      : source === "ticket"
        ? ["ticket:code", "ticket:date", "ticket:draw"].filter((id) =>
          availableIds.has(id),
        )
        : lines.map((line) => line.id);
    const legacyFont = !initialized && source === "ticket";
    const sizeValue = legacyFont
      ? raw[definition.legacySizeKey]
      : raw[definition.sizeKey];
    const weightValue = legacyFont
      ? raw[definition.legacyWeightKey]
      : raw[definition.weightKey];
    const familyValue = legacyFont
      ? raw[definition.legacyFamilyKey]
      : raw[definition.familyKey];

    return {
      enabled: raw[definition.enabledKey] === true,
      selectedLineIds,
      font: {
        sizePx: normalizeSize(sizeValue, definition.defaultFont.sizePx),
        weight: normalizeWeight(weightValue, definition.defaultFont.weight),
        family: normalizeFamily(familyValue, definition.defaultFont.family),
      },
    };
  }

  function createLineStyleController(documentRef, options) {
    const source = options?.source;
    sourceDefinition(source);
    const onLinesChanged = options?.onLinesChanged || (() => {});
    let started = false;
    let observer = null;
    let configuration = {
      enabled: false,
      selectedLineIds: [],
      font: { ...SOURCE_DEFINITIONS[source].defaultFont },
    };

    function rootNode() {
      if (source === "bcr") {
        const concentrator = Array.from(
          documentRef.querySelectorAll("#tablaConcentrador"),
        ).find(
          (node) =>
            !isElementHidden(node) &&
            /DETALLE DE PAGO|MONTO PAGADO|COMPROBANTE DE PAGO/i.test(
              node.textContent || "",
            ),
        );
        if (concentrator) return concentrator;
        const preferred = documentRef.querySelector("#reciboImpresion");
        if (preferred && !isElementHidden(preferred)) return preferred;
        return Array.from(
          documentRef.querySelectorAll("#tablaComprobantePago"),
        ).find((node) => !isElementHidden(node)) || null;
      }
      return documentRef.body || documentRef.documentElement;
    }

    function unwrapMarkers() {
      for (const marker of Array.from(
        documentRef.querySelectorAll("[data-tmh-print-line]"),
      )) {
        marker.replaceWith(documentRef.createTextNode(marker.textContent || ""));
      }
    }

    function isElementHidden(element) {
      for (let current = element; current; current = current.parentElement) {
        const style = current.getAttribute("style") || "";
        if (/display\s*:\s*none|visibility\s*:\s*hidden/i.test(style)) return true;
        const explicitlyDisplayed = /display\s*:\s*(?!none\b)[a-z-]+/i.test(style);
        if (
          (current.hidden || current.getAttribute("aria-hidden") === "true") &&
          !explicitlyDisplayed
        ) {
          return true;
        }
      }
      return false;
    }

    function isHidden(node) {
      return isElementHidden(node.parentElement);
    }

    function scanRecords() {
      const root = rootNode();
      if (!root || !documentRef.createTreeWalker) return [];
      const NodeFilterClass =
        documentRef.defaultView?.NodeFilter || globalThis.NodeFilter;
      if (!NodeFilterClass) return [];
      const walker = documentRef.createTreeWalker(root, NodeFilterClass.SHOW_TEXT);
      const nodes = [];
      let node = walker.nextNode();
      while (node) {
        const text = node.nodeValue?.trim();
        if (
          text &&
          !EXCLUDED_TAGS.has(node.parentElement?.tagName) &&
          !isHidden(node)
        ) {
          nodes.push(node);
        }
        node = walker.nextNode();
      }
      const dateIndex = source === "ticket"
        ? nodes.findIndex((candidate) =>
          TICKET_DATE_PATTERN.test(candidate.nodeValue.trim()),
        )
        : -1;
      const usedIds = new Map();
      let pendingBcrField = null;
      return nodes.map((textNode, index) => {
        const text = textNode.nodeValue.trim();
        let baseId;
        if (source === "bcr") {
          const embeddedField = text.match(/^([^:]{1,120}):\s*(.*)$/);
          if (BCR_DATE_PATTERN.test(text)) {
            baseId = "bcr:date";
            pendingBcrField = null;
          } else if (embeddedField) {
            const field = logicalToken(embeddedField[1]);
            const value = embeddedField[2].replace(/^[.\s]+/, "").trim();
            baseId = value
              ? `bcr:field:${field}`
              : `bcr:field:${field}:label`;
            pendingBcrField = value ? null : field;
          } else if (pendingBcrField) {
            baseId = `bcr:field:${pendingBcrField}:value`;
            pendingBcrField = null;
          } else {
            const token = logicalToken(text);
            const closestWithId = textNode.parentElement?.closest("[id]");
            const elementId = closestWithId === root ? null : closestWithId?.id;
            baseId = BCR_FIXED_TEXTS.has(token)
              ? `bcr:text:${token}`
              : elementId
                ? `bcr:id:${elementId}`
                : `bcr:line:${index}`;
          }
        } else if (TICKET_CODE_PATTERN.test(text)) {
          baseId = "ticket:code";
        } else if (index === dateIndex) {
          baseId = "ticket:date";
        } else if (index === dateIndex + 1) {
          baseId = "ticket:draw";
        } else {
          const closestWithId = textNode.parentElement?.closest("[id]");
          const elementId = closestWithId === root ? null : closestWithId?.id;
          baseId = elementId
            ? `${source}:id:${elementId}`
            : `${source}:line:${index}`;
        }
        const occurrence = usedIds.get(baseId) || 0;
        usedIds.set(baseId, occurrence + 1);
        return {
          id: occurrence === 0 ? baseId : `${baseId}:${occurrence}`,
          text,
          textNode,
          rawText: textNode.nodeValue,
        };
      });
    }

    function connectObserver() {
      if (!started || observer) return;
      const MutationObserverClass =
        documentRef.defaultView?.MutationObserver || globalThis.MutationObserver;
      if (!MutationObserverClass) return;
      observer = new MutationObserverClass(refresh);
      observer.observe(documentRef, { childList: true, subtree: true });
    }

    function refresh() {
      if (!started) return;
      observer?.disconnect();
      observer = null;
      unwrapMarkers();
      const records = scanRecords();
      onLinesChanged(records.map(({ id, text }) => ({ id, text })));
      if (configuration.enabled) {
        const selectedIds = new Set(configuration.selectedLineIds);
        for (const record of records) {
          if (!selectedIds.has(record.id)) continue;
          const marker = documentRef.createElement("span");
          marker.setAttribute("data-tmh-print-line", record.id);
          marker.textContent = record.rawText;
          marker.style.setProperty(
            "--tmh-line-font-size",
            `${configuration.font.sizePx}px`,
          );
          marker.style.setProperty(
            "--tmh-line-font-weight",
            String(configuration.font.weight),
          );
          marker.style.setProperty(
            "--tmh-line-font-family",
            configuration.font.family,
          );
          marker.style.setProperty(
            "font-size",
            `${configuration.font.sizePx}px`,
            "important",
          );
          marker.style.setProperty(
            "font-weight",
            String(configuration.font.weight),
            "important",
          );
          marker.style.setProperty(
            "font-family",
            configuration.font.family,
            "important",
          );
          record.textNode.replaceWith(marker);
        }
      }
      connectObserver();
    }

    function setConfiguration(next) {
      configuration = {
        enabled: next?.enabled === true,
        selectedLineIds: Array.isArray(next?.selectedLineIds)
          ? [...new Set(next.selectedLineIds.filter((id) => typeof id === "string"))]
          : [],
        font: {
          sizePx: normalizeSize(
            next?.font?.sizePx,
            SOURCE_DEFINITIONS[source].defaultFont.sizePx,
          ),
          weight: normalizeWeight(
            next?.font?.weight,
            SOURCE_DEFINITIONS[source].defaultFont.weight,
          ),
          family: normalizeFamily(
            next?.font?.family,
            SOURCE_DEFINITIONS[source].defaultFont.family,
          ),
        },
      };
      refresh();
    }

    function start() {
      if (started) return;
      started = true;
      documentRef.defaultView?.addEventListener("beforeprint", refresh);
      refresh();
    }

    function stop() {
      if (!started) return;
      started = false;
      observer?.disconnect();
      observer = null;
      documentRef.defaultView?.removeEventListener("beforeprint", refresh);
      unwrapMarkers();
    }

    return { setConfiguration, start, stop, refresh };
  }

  return {
    SOURCE_DEFINITIONS,
    createLineStyleController,
    normalizeSourceSettings,
  };
});
