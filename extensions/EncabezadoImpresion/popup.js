(function initializePopup(root, factory) {
  const settings =
    typeof module === "object" && module.exports
      ? require("./settings-core.js")
      : root.EncabezadoImpresionSettings;
  const imageCore =
    typeof module === "object" && module.exports
      ? require("./image-core.js")
      : root.EncabezadoImpresionImageCore;
  const siteAccess =
    typeof module === "object" && module.exports
      ? require("./site-access.js")
      : root.EncabezadoImpresionSiteAccess;
  const api = factory(settings, imageCore, siteAccess);

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
  function buildPopup(settings, imageCore, siteAccess) {
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
      const updateJuntaAccess =
        browserDeps.updateJuntaAccess || siteAccess.updateJuntaAccess;
      let draft = { ...settings.DEFAULT_SETTINGS, lines: [] };
      let started = false;

      const element = (id) => documentRef.getElementById(id);

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

        draft.lines.forEach((text, index) => {
          const row = documentRef.createElement("div");
          row.className = "line-row";

          const field = documentRef.createElement("input");
          field.type = "text";
          field.className = "line-input";
          field.value = text;
          field.maxLength = limit;
          field.dataset.index = String(index);
          field.setAttribute("aria-label", `Línea ${index + 1}`);

          const count = documentRef.createElement("span");
          count.className = "line-count";
          count.textContent = `${text.length}/${limit}`;

          const actions = documentRef.createElement("div");
          actions.className = "line-actions";
          actions.append(
            makeAction("Subir", "up", index),
            makeAction("Bajar", "down", index),
            makeAction("Eliminar", "delete", index),
          );

          row.append(field, count, actions);
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

        for (const text of draft.lines) {
          if (!text.trim()) continue;
          const line = documentRef.createElement("div");
          line.className = "ei-preview-line";
          line.textContent = text;
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
        const juntaUrl = element("junta-url");
        if (limit) limit.value = String(draft.maxCharacters);
        if (juntaUrl) juntaUrl.value = draft.juntaOrigin;
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
        draft = { ...validation.value, lines: [...validation.value.lines] };
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

      async function authorizeJunta() {
        const button = element("authorize-junta");
        const requestedUrl = element("junta-url")?.value || "";
        if (button) button.disabled = true;
        try {
          const result = await updateJuntaAccess(
            chromeApi,
            draft.juntaOrigin,
            requestedUrl,
          );
          if (!result.ok) {
            setMessage(result.error, "error");
            return false;
          }
          draft.juntaOrigin = result.origin;
          await chromeApi.storage.local.set({
            [settings.STORAGE_KEY]: settings.normalizeSettings(draft),
          });
          const juntaUrl = element("junta-url");
          if (juntaUrl) juntaUrl.value = result.origin;
          setMessage(
            result.origin
              ? "Sitio de Junta autorizado."
              : "Sitio de Junta desactivado.",
            "success",
          );
          return true;
        } catch {
          setMessage("No fue posible actualizar el sitio de Junta.", "error");
          return false;
        } finally {
          if (button) button.disabled = false;
        }
      }

      function bindEvents() {
        element("add-line")?.addEventListener("click", () => {
          draft.lines.push("");
          renderLines();
          renderPreview();
        });

        element("lines")?.addEventListener("input", (event) => {
          const field = event.target;
          if (!field?.classList?.contains("line-input")) return;
          const index = Number(field.dataset.index);
          if (!Number.isInteger(index) || !draft.lines[index]) {
            if (draft.lines[index] !== "") return;
          }
          draft.lines[index] = field.value;
          const count = field.parentElement?.querySelector(".line-count");
          if (count) {
            count.textContent = `${field.value.length}/${safeInputLimit()}`;
          }
          renderPreview();
        });

        element("lines")?.addEventListener("click", (event) => {
          const button = event.target?.closest?.("[data-action]");
          if (!button) return;
          const index = Number(button.dataset.index);
          if (!Number.isInteger(index) || !draft.lines[index] && draft.lines[index] !== "") return;
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
        element("authorize-junta")?.addEventListener("click", () => {
          void authorizeJunta();
        });
      }

      async function start() {
        if (started) return;
        started = true;
        bindEvents();
        const stored = await chromeApi.storage.local.get({
          [settings.STORAGE_KEY]: settings.DEFAULT_SETTINGS,
        });
        const value = settings.normalizeSettings(
          stored?.[settings.STORAGE_KEY],
        );
        draft = { ...value, lines: [...value.lines] };
        render();
      }

      function getDraft() {
        return { ...draft, lines: [...draft.lines] };
      }

      return { start, save, selectImage, authorizeJunta, getDraft };
    }

    return { processImageFile, createPopupController };
  },
);
