(function initializePopup(root, factory) {
  const settings =
    typeof module === "object" && module.exports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? require("./settings-core.js")
      : root.EncabezadoImpresionSettings;
  const imageCore =
    typeof module === "object" && module.exports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      ? require("./image-core.js")
      : root.EncabezadoImpresionImageCore;
  const api = factory(settings, imageCore);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.EncabezadoImpresionPopup = api;
  if (root.document && root.chrome) {
    api.createPopupController(root.document, root.chrome).start().catch(() => {});
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildPopup(settings, imageCore) {
    "use strict";

    function readFileAsDataUrl(file, windowRef) {
      return new Promise((resolve, reject) => {
        const reader = new windowRef.FileReader();
        reader.addEventListener("load", () => resolve(String(reader.result)));
        reader.addEventListener("error", () =>
          reject(new Error("No fue posible leer la imagen.")),
        );
        reader.readAsDataURL(file);
      });
    }

    function decodeImage(dataUrl, windowRef) {
      return new Promise((resolve, reject) => {
        const image = new windowRef.Image();
        image.addEventListener("load", () => resolve(image), { once: true });
        image.addEventListener(
          "error",
          () => reject(new Error("El archivo no contiene una imagen válida.")),
          { once: true },
        );
        image.src = dataUrl;
      });
    }

    async function processImageFile(file, documentRef) {
      if (!file || !imageCore.isAcceptedImageType(file.type)) {
        throw new Error("Seleccione una imagen PNG, JPEG o WebP.");
      }

      const windowRef = documentRef.defaultView;
      const source = await readFileAsDataUrl(file, windowRef);
      const image = await decodeImage(source, windowRef);
      const size = imageCore.calculateScaledSize(
        image.naturalWidth,
        image.naturalHeight,
      );
      if (!size.width || !size.height) {
        throw new Error("La imagen no tiene dimensiones válidas.");
      }

      const canvas = documentRef.createElement("canvas");
      canvas.width = size.width;
      canvas.height = size.height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("No fue posible procesar la imagen.");
      context.drawImage(image, 0, 0, size.width, size.height);

      const quality = file.type === "image/png" ? undefined : 0.9;
      const result = canvas.toDataURL(file.type, quality);
      if (imageCore.estimateDataUrlBytes(result) > imageCore.MAX_BYTES) {
        throw new Error("La imagen procesada supera 2 MB.");
      }
      return result;
    }

    function createPopupController(documentRef, chromeApi, browserDeps = {}) {
      const processSelectedImage =
        browserDeps.processImageFile ||
        ((file) => processImageFile(file, documentRef));
      let draft = { ...settings.DEFAULT_SETTINGS, lines: [] };
      let installedFonts = [
        {
          fontId: settings.DEFAULT_FONT_FAMILY,
          displayName: settings.DEFAULT_FONT_FAMILY,
        },
      ];
      let started = false;

      const element = (id) => documentRef.getElementById(id);

      function cloneLines(lines) {
        return lines.map((line) => ({ ...line }));
      }

      function availableFontFallback() {
        return installedFonts.some(
          (font) => font.fontId === settings.DEFAULT_FONT_FAMILY,
        )
          ? settings.DEFAULT_FONT_FAMILY
          : installedFonts[0]?.fontId || settings.DEFAULT_FONT_FAMILY;
      }

      function keepAvailableFonts(lines) {
        const available = new Set(installedFonts.map((font) => font.fontId));
        const fallback = availableFontFallback();
        return lines.map((line) => ({
          ...line,
          fontFamily: available.has(line.fontFamily)
            ? line.fontFamily
            : fallback,
        }));
      }

      async function loadInstalledFonts() {
        try {
          const result = await chromeApi.fontSettings.getFontList();
          const seen = new Set();
          const fonts = (Array.isArray(result) ? result : []).filter((font) => {
            if (
              !font ||
              typeof font.fontId !== "string" ||
              !font.fontId.trim() ||
              seen.has(font.fontId)
            ) {
              return false;
            }
            seen.add(font.fontId);
            return true;
          });
          if (fonts.length > 0) installedFonts = fonts;
        } catch {
          // Arial remains available as a safe fallback if Chrome cannot list fonts.
        }
      }

      function setMessage(message, kind = "info") {
        const target = element("message");
        if (!target) return;
        target.textContent = message;
        target.dataset.kind = kind;
      }

      function safeInputLimit() {
        return Number.isInteger(draft.maxCharacters) &&
          draft.maxCharacters >= 1 &&
          draft.maxCharacters <= 200
          ? draft.maxCharacters
          : 200;
      }

      function makeAction(label, action, index) {
        const button = documentRef.createElement("button");
        button.type = "button";
        button.className = "line-action";
        button.textContent = label;
        button.dataset.action = action;
        button.dataset.index = String(index);
        button.setAttribute("aria-label", `${label} línea ${index + 1}`);
        return button;
      }

      function renderLines() {
        const container = element("lines");
        if (!container) return;
        container.replaceChildren();
        const limit = safeInputLimit();

        draft.lines.forEach((configuredLine, index) => {
          const row = documentRef.createElement("div");
          row.className = "line-row";

          const field = documentRef.createElement("input");
          field.type = "text";
          field.className = "line-input";
          field.value = configuredLine.text;
          field.maxLength = limit;
          field.dataset.index = String(index);
          field.setAttribute("aria-label", `Línea ${index + 1}`);

          const count = documentRef.createElement("span");
          count.className = "line-count";
          count.textContent = `${configuredLine.text.length}/${limit}`;

          const styleControls = documentRef.createElement("div");
          styleControls.className = "line-style-controls";

          const fontLabel = documentRef.createElement("label");
          fontLabel.className = "line-style-field line-font-field";
          fontLabel.textContent = "Fuente";
          const font = documentRef.createElement("select");
          font.className = "line-font";
          font.dataset.index = String(index);
          font.setAttribute("aria-label", `Fuente de la línea ${index + 1}`);
          for (const installedFont of installedFonts) {
            const option = documentRef.createElement("option");
            option.value = installedFont.fontId;
            option.textContent = installedFont.displayName || installedFont.fontId;
            option.style.fontFamily = settings.fontFamilyStack(
              installedFont.fontId,
            );
            font.append(option);
          }
          font.value = configuredLine.fontFamily;
          font.style.fontFamily = settings.fontFamilyStack(
            configuredLine.fontFamily,
          );
          fontLabel.append(font);

          const sizeLabel = documentRef.createElement("label");
          sizeLabel.className = "line-style-field line-size-field";
          sizeLabel.textContent = "Tamaño (px)";
          const size = documentRef.createElement("input");
          size.type = "number";
          size.className = "line-font-size";
          size.min = String(settings.MIN_FONT_SIZE);
          size.max = String(settings.MAX_FONT_SIZE);
          size.step = "1";
          size.value = String(configuredLine.fontSize);
          size.dataset.index = String(index);
          size.setAttribute("aria-label", `Tamaño de la línea ${index + 1}`);
          sizeLabel.append(size);
          styleControls.append(fontLabel, sizeLabel);

          const actions = documentRef.createElement("div");
          actions.className = "line-actions";
          actions.append(
            makeAction("Subir", "up", index),
            makeAction("Bajar", "down", index),
            makeAction("Eliminar", "delete", index),
          );

          row.append(field, count, styleControls, actions);
          container.append(row);
        });
      }

      function renderPreview() {
        const preview = element("preview");
        if (!preview) return;
        preview.replaceChildren();

        if (draft.imageDataUrl) {
          const image = documentRef.createElement("img");
          image.className = "ei-preview-image";
          image.alt = "Vista previa de la imagen seleccionada";
          image.src = draft.imageDataUrl;
          preview.append(image);
        }

        for (const configuredLine of draft.lines) {
          if (!configuredLine.text.trim()) continue;
          const line = documentRef.createElement("div");
          line.className = "ei-preview-line";
          line.textContent = configuredLine.text;
          line.style.fontFamily = settings.fontFamilyStack(
            configuredLine.fontFamily,
          );
          line.style.fontSize = `${configuredLine.fontSize}px`;
          preview.append(line);
        }

        if (!preview.hasChildNodes()) {
          const empty = documentRef.createElement("span");
          empty.className = "preview-empty";
          empty.textContent = "La vista previa aparecerá aquí.";
          preview.append(empty);
        }
      }

      function render() {
        const limit = element("max-characters");
        if (limit) limit.value = String(draft.maxCharacters);
        renderLines();
        renderPreview();
      }

      async function save() {
        const validation = settings.validateDraft(draft);
        if (!validation.ok) {
          setMessage(validation.errors[0], "error");
          return false;
        }

        await chromeApi.storage.local.set({
          [settings.STORAGE_KEY]: validation.value,
        });
        draft = {
          ...validation.value,
          lines: cloneLines(validation.value.lines),
        };
        render();
        setMessage("Configuración guardada.", "success");
        return true;
      }

      async function selectImage(file) {
        try {
          const imageDataUrl = await processSelectedImage(file);
          draft.imageDataUrl = imageDataUrl;
          renderPreview();
          setMessage("Imagen lista para guardar.", "success");
          return true;
        } catch (error) {
          setMessage(error?.message || "No fue posible procesar la imagen.", "error");
          return false;
        }
      }

      function bindEvents() {
        element("add-line")?.addEventListener("click", () => {
          draft.lines.push({
            text: "",
            fontFamily: availableFontFallback(),
            fontSize: settings.DEFAULT_FONT_SIZE,
          });
          renderLines();
          renderPreview();
        });

        element("lines")?.addEventListener("input", (event) => {
          const field = event.target;
          if (!field?.classList) return;
          const index = Number(field.dataset.index);
          if (!Number.isInteger(index) || !draft.lines[index]) return;

          if (field.classList.contains("line-input")) {
            draft.lines[index].text = field.value;
            const count = field.parentElement?.querySelector(".line-count");
            if (count) {
              count.textContent = `${field.value.length}/${safeInputLimit()}`;
            }
          } else if (field.classList.contains("line-font-size")) {
            draft.lines[index].fontSize = Number(field.value);
          } else {
            return;
          }
          renderPreview();
        });

        element("lines")?.addEventListener("change", (event) => {
          const field = event.target;
          if (!field?.classList?.contains("line-font")) return;
          const index = Number(field.dataset.index);
          if (!Number.isInteger(index) || !draft.lines[index]) return;
          draft.lines[index].fontFamily = field.value;
          field.style.fontFamily = settings.fontFamilyStack(field.value);
          renderPreview();
        });

        element("lines")?.addEventListener("click", (event) => {
          const button = event.target?.closest?.("[data-action]");
          if (!button) return;
          const index = Number(button.dataset.index);
          if (!Number.isInteger(index) || !draft.lines[index]) return;
          if (button.dataset.action === "delete") draft.lines.splice(index, 1);
          if (button.dataset.action === "up" && index > 0) {
            [draft.lines[index - 1], draft.lines[index]] = [
              draft.lines[index],
              draft.lines[index - 1],
            ];
          }
          if (button.dataset.action === "down" && index < draft.lines.length - 1) {
            [draft.lines[index + 1], draft.lines[index]] = [
              draft.lines[index],
              draft.lines[index + 1],
            ];
          }
          renderLines();
          renderPreview();
        });

        element("max-characters")?.addEventListener("input", (event) => {
          draft.maxCharacters = Number(event.target.value);
          renderLines();
          renderPreview();
        });

        element("image-file")?.addEventListener("change", (event) => {
          const file = event.target.files?.[0];
          if (file) void selectImage(file);
        });

        element("remove-image")?.addEventListener("click", () => {
          draft.imageDataUrl = "";
          const input = element("image-file");
          if (input) input.value = "";
          renderPreview();
          setMessage("Imagen eliminada; guarde para confirmar.");
        });

        element("save")?.addEventListener("click", () => {
          void save().catch(() =>
            setMessage("No fue posible guardar la configuración.", "error"),
          );
        });
      }

      async function start() {
        if (started) return;
        started = true;
        bindEvents();
        await loadInstalledFonts();
        const stored = await chromeApi.storage.local.get({
          [settings.STORAGE_KEY]: settings.DEFAULT_SETTINGS,
        });
        const value = settings.normalizeSettings(
          stored?.[settings.STORAGE_KEY],
        );
        draft = { ...value, lines: keepAvailableFonts(value.lines) };
        render();
      }

      function getDraft() {
        return { ...draft, lines: cloneLines(draft.lines) };
      }

      return { start, save, selectImage, getDraft };
    }

    return { processImageFile, createPopupController };
  },
);
