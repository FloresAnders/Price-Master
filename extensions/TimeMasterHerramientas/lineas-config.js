/* eslint-disable @typescript-eslint/no-require-imports -- UMD CommonJS compatibility for tests. */
(function initializeLineConfig(root, factory) {
  const isCommonJs = typeof module === "object" && module.exports;
  const settings = isCommonJs
    ? require("./settings-core.js")
    : root.TimeMasterHerramientasSettings;
  const printLines = isCommonJs
    ? require("./lineasimpresion-core.js")
    : root.TimeMasterHerramientasLineasImpresion;
  const api = factory(settings, printLines);

  root.TimeMasterHerramientasLineasConfig = api;
  if (isCommonJs) {
    module.exports = api;
  } else if (root.document && root.chrome?.storage) {
    const source = new URLSearchParams(root.location?.search || "").get("source");
    if (source === "ticket" || source === "bcr") {
      api.createLineConfigController(root.document, root.chrome, source).start();
    }
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function buildLineConfig(
  settings,
  printLines,
) {
  "use strict";

  const SOURCE_TEXT = Object.freeze({
    ticket: Object.freeze({
      title: "Líneas del tiquete Gente Crystal",
      description: "Seleccione las líneas del tiquete que recibirán el formato común.",
    }),
    bcr: Object.freeze({
      title: "Líneas de impresión BCR",
      description: "Seleccione las líneas lógicas conocidas que recibirán el formato común.",
    }),
  });

  function createLineConfigController(documentRef, chromeApi, source) {
    const definition = printLines.SOURCE_DEFINITIONS[source];
    if (!definition) throw new Error(`Unsupported print-line source: ${source}`);
    const listeners = [];
    let started = false;
    let lines = [];
    let rawSettings = {};

    function element(id) {
      return documentRef.getElementById(id);
    }

    function setStatus(message, type = "") {
      const status = element("lineas-config-status");
      if (!status) return;
      status.textContent = message;
      delete status.dataset.error;
      delete status.dataset.saved;
      if (type) status.dataset[type] = "true";
    }

    function lineInputs() {
      return Array.from(
        documentRef.querySelectorAll("#lineas-config-list [data-line-id]"),
      );
    }

    function mergeKnownLines(catalogValue, currentValue) {
      const currentLines = Array.isArray(currentValue)
        ? currentValue.filter(
          (line) =>
            line &&
            typeof line.id === "string" &&
            typeof line.text === "string",
        )
        : [];
      const currentById = new Map(
        currentLines.map((line) => [line.id, line.text]),
      );
      const merged = [];
      const knownIds = new Set();
      if (Array.isArray(catalogValue)) {
        for (const entry of catalogValue) {
          if (
            !entry ||
            typeof entry.id !== "string" ||
            typeof entry.label !== "string" ||
            knownIds.has(entry.id)
          ) {
            continue;
          }
          knownIds.add(entry.id);
          merged.push({
            id: entry.id,
            text: currentById.get(entry.id) || entry.label,
          });
        }
      }
      for (const line of currentLines) {
        if (knownIds.has(line.id)) continue;
        knownIds.add(line.id);
        merged.push(line);
      }
      return merged;
    }

    function renderLines(selectedLineIds) {
      const list = element("lineas-config-list");
      const empty = element("lineas-config-empty");
      if (!list || !empty) return;
      list.replaceChildren();
      empty.hidden = lines.length > 0;
      const selected = new Set(selectedLineIds);
      for (const line of lines) {
        const label = documentRef.createElement("label");
        label.className = "line-option";
        const input = documentRef.createElement("input");
        input.type = "checkbox";
        input.dataset.lineId = line.id;
        input.checked = selected.has(line.id);
        const text = documentRef.createElement("span");
        text.textContent = line.text;
        label.append(input, text);
        list.append(label);
      }
    }

    function render(configuration) {
      element("lineas-config-title").textContent = SOURCE_TEXT[source].title;
      element("lineas-config-description").textContent =
        SOURCE_TEXT[source].description;
      element("lineas-config-enabled").checked = configuration.enabled;
      element("lineas-config-size").value = String(configuration.font.sizePx);
      element("lineas-config-weight").value = String(configuration.font.weight);
      element("lineas-config-family").value = configuration.font.family;
      renderLines(configuration.selectedLineIds);
      setStatus("");
    }

    function addListener(target, eventName, listener) {
      target?.addEventListener(eventName, listener);
      listeners.push([target, eventName, listener]);
    }

    function setAllLines(checked) {
      for (const input of lineInputs()) input.checked = checked;
      setStatus("Cambios sin guardar");
    }

    function resetDraft() {
      const enabled = element("lineas-config-enabled").checked;
      const resetRaw = { [definition.enabledKey]: enabled };
      const configuration = printLines.normalizeSourceSettings(
        source,
        resetRaw,
        lines,
      );
      render(configuration);
      setStatus("Cambios sin guardar");
    }

    function save() {
      const sizeValue = Number(element("lineas-config-size").value);
      const weightValue = Number(element("lineas-config-weight").value);
      const familyValue = element("lineas-config-family").value;
      const normalizedSize = settings.normalizeTicketFontSizePx(
        sizeValue,
        definition.defaultFont.sizePx,
      );
      const normalizedWeight = settings.normalizeTicketFontWeight(
        weightValue,
        definition.defaultFont.weight,
      );
      const normalizedFamily = settings.normalizeTicketFontFamily(
        familyValue,
        definition.defaultFont.family,
      );
      if (normalizedSize !== sizeValue) {
        setStatus(
          `Use un número entero de ${settings.TICKET_FONT_SIZE_MIN} a ${settings.TICKET_FONT_SIZE_MAX}`,
          "error",
        );
        return;
      }
      if (
        normalizedWeight !== weightValue ||
        normalizedFamily !== familyValue
      ) {
        setStatus("Seleccione valores válidos", "error");
        return;
      }
      const payload = {
        [definition.enabledKey]: element("lineas-config-enabled").checked,
        [definition.selectedKey]: lineInputs()
          .filter((input) => input.checked)
          .map((input) => input.dataset.lineId),
        [definition.initializedKey]: true,
        [definition.sizeKey]: normalizedSize,
        [definition.weightKey]: normalizedWeight,
        [definition.familyKey]: normalizedFamily,
      };
      chromeApi.storage.local.set(payload, () => {
        if (chromeApi.runtime?.lastError) {
          setStatus("Error al guardar", "error");
          return;
        }
        rawSettings = { ...rawSettings, ...payload };
        setStatus("Guardado", "saved");
      });
    }

    function bind() {
      addListener(element("lineas-config-select-all"), "click", () =>
        setAllLines(true),
      );
      addListener(element("lineas-config-select-none"), "click", () =>
        setAllLines(false),
      );
      addListener(element("lineas-config-reset"), "click", resetDraft);
      addListener(element("lineas-config-save"), "click", save);
      for (const id of [
        "lineas-config-enabled",
        "lineas-config-size",
        "lineas-config-weight",
        "lineas-config-family",
        "lineas-config-list",
      ]) {
        addListener(element(id), "change", () => setStatus("Cambios sin guardar"));
      }
    }

    function start() {
      if (started) return;
      started = true;
      chromeApi.storage.local.get({
        ...settings.DEFAULT_SETTINGS,
        [definition.catalogKey]: [],
      }, (stored) => {
        rawSettings = stored || {};
        chromeApi.storage.session.get(
          { [definition.cacheKey]: [] },
          (cached) => {
            lines = mergeKnownLines(
              rawSettings[definition.catalogKey],
              cached?.[definition.cacheKey],
            );
            const configuration = printLines.normalizeSourceSettings(
              source,
              rawSettings,
              lines,
            );
            render(configuration);
            bind();
          },
        );
      });
    }

    function destroy() {
      for (const [target, eventName, listener] of listeners) {
        target?.removeEventListener(eventName, listener);
      }
      listeners.length = 0;
      started = false;
    }

    return { start, destroy };
  }

  return { createLineConfigController };
});
