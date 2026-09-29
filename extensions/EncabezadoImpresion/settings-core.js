(function initializeSettings(root, factory) {
  const api = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.EncabezadoImpresionSettings = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildSettings() {
    "use strict";

    const STORAGE_KEY = "encabezadoImpresionSettingsV1";
    const DEFAULT_FONT_FAMILY = "Arial";
    const DEFAULT_FONT_SIZE = 14;
    const MIN_FONT_SIZE = 8;
    const MAX_FONT_SIZE = 48;
    const DEFAULT_SETTINGS = Object.freeze({
      schemaVersion: 1,
      imageDataUrl: "",
      maxCharacters: 40,
      lines: [],
      juntaOrigin: "",
    });
    const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,/i;

    function normalizeFontFamily(value) {
      return typeof value === "string" && value.trim()
        ? value.trim().slice(0, 200)
        : DEFAULT_FONT_FAMILY;
    }

    function normalizeLine(value) {
      const source =
        typeof value === "string"
          ? { text: value }
          : value && typeof value === "object"
            ? value
            : null;
      if (!source) return null;

      const text = typeof source.text === "string" ? source.text.trim() : "";
      if (!text) return null;
      const fontSize =
        Number.isInteger(source.fontSize) &&
        source.fontSize >= MIN_FONT_SIZE &&
        source.fontSize <= MAX_FONT_SIZE
          ? source.fontSize
          : DEFAULT_FONT_SIZE;

      return {
        text,
        fontFamily: normalizeFontFamily(source.fontFamily),
        fontSize,
      };
    }

    function fontFamilyStack(value) {
      const escaped = normalizeFontFamily(value)
        .replace(/\\/g, "\\\\")
        .replace(/"/g, '\\"');
      return `"${escaped}", Arial, sans-serif`;
    }

    function normalizeJuntaOrigin(value) {
      if (typeof value !== "string" || !value.trim()) return "";

      try {
        const url = new URL(value.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") return "";
        return url.origin;
      } catch {
        return "";
      }
    }

    function originPattern(origin) {
      const normalized = normalizeJuntaOrigin(origin);
      return normalized ? `${normalized}/*` : "";
    }

    function normalizeSettings(raw) {
      const value = raw && typeof raw === "object" ? raw : {};
      if (
        Object.prototype.hasOwnProperty.call(value, "schemaVersion") &&
        value.schemaVersion !== 1
      ) {
        return { ...DEFAULT_SETTINGS, lines: [] };
      }

      const maxCharacters =
        Number.isInteger(value.maxCharacters) &&
        value.maxCharacters >= 1 &&
        value.maxCharacters <= 200
          ? value.maxCharacters
          : DEFAULT_SETTINGS.maxCharacters;
      const lines = Array.isArray(value.lines)
        ? value.lines.map(normalizeLine).filter(Boolean)
        : [];

      return {
        schemaVersion: 1,
        imageDataUrl:
          typeof value.imageDataUrl === "string" &&
          IMAGE_DATA_URL.test(value.imageDataUrl)
            ? value.imageDataUrl
            : "",
        maxCharacters,
        lines: lines.filter((line) => line.text.length <= maxCharacters),
        juntaOrigin: normalizeJuntaOrigin(value.juntaOrigin),
      };
    }

    function validateDraft(raw) {
      const errors = [];
      const limit = Number(raw?.maxCharacters);

      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        errors.push("El límite debe ser un entero entre 1 y 200.");
      }

      const lines = Array.isArray(raw?.lines) ? raw.lines : [];
      if (Number.isInteger(limit)) {
        lines.forEach((line, index) => {
          const text =
            typeof line === "string" ? line : String(line?.text || "");
          if (text.trim().length > limit) {
            errors.push(
              `La línea ${index + 1} supera el límite de ${limit} caracteres.`,
            );
          }
          if (
            line &&
            typeof line === "object" &&
            (!Number.isInteger(line.fontSize) ||
              line.fontSize < MIN_FONT_SIZE ||
              line.fontSize > MAX_FONT_SIZE)
          ) {
            errors.push(
              `El tamaño de la línea ${index + 1} debe estar entre ${MIN_FONT_SIZE} y ${MAX_FONT_SIZE} px.`,
            );
          }
        });
      }

      return {
        ok: errors.length === 0,
        errors,
        value: errors.length === 0 ? normalizeSettings(raw) : null,
      };
    }

    return {
      STORAGE_KEY,
      DEFAULT_SETTINGS,
      DEFAULT_FONT_FAMILY,
      DEFAULT_FONT_SIZE,
      MIN_FONT_SIZE,
      MAX_FONT_SIZE,
      normalizeSettings,
      validateDraft,
      fontFamilyStack,
      normalizeJuntaOrigin,
      originPattern,
    };
  },
);
