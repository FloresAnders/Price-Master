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
    const DEFAULT_SETTINGS = Object.freeze({
      schemaVersion: 1,
      imageDataUrl: "",
      maxCharacters: 40,
      lines: [],
      juntaOrigin: "",
    });
    const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,/i;

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
        ? value.lines
            .filter((line) => typeof line === "string")
            .map((line) => line.trim())
            .filter(Boolean)
        : [];

      return {
        schemaVersion: 1,
        imageDataUrl:
          typeof value.imageDataUrl === "string" &&
          IMAGE_DATA_URL.test(value.imageDataUrl)
            ? value.imageDataUrl
            : "",
        maxCharacters,
        lines: lines.filter((line) => line.length <= maxCharacters),
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
          if (String(line).trim().length > limit) {
            errors.push(
              `La línea ${index + 1} supera el límite de ${limit} caracteres.`,
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
      normalizeSettings,
      validateDraft,
      normalizeJuntaOrigin,
      originPattern,
    };
  },
);
