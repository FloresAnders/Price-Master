(function initializeSmartPrintSettings(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SmartPrintSettings = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function buildSettings() {
  "use strict";

  const LEGACY_STORAGE_KEY = "encabezadoImpresionSettingsV1";
  const STORAGE_KEY = "smartPrintSettingsV1";
  const DEFAULT_SETTINGS = Object.freeze({
    schemaVersion: 1,
    paperWidth: "58",
    scale: 100,
    templateMode: "universal",
    confirmAmbiguous: true,
    rememberPreferences: true,
    profile: "default",
    header: Object.freeze({ enabled: true, imageDataUrl: "", lines: Object.freeze([]) }),
  });
  const IMAGE_DATA_URL = /^data:image\/(?:png|jpeg|webp);base64,/i;

  function normalizeHeader(raw) {
    const value = raw && typeof raw === "object" ? raw : {};
    return {
      enabled: value.enabled !== false,
      imageDataUrl:
        typeof value.imageDataUrl === "string" && IMAGE_DATA_URL.test(value.imageDataUrl)
          ? value.imageDataUrl
          : "",
      lines: Array.isArray(value.lines)
        ? value.lines
            .map((line) => {
              const source = typeof line === "string" ? { text: line } : line;
              const text = typeof source?.text === "string" ? source.text.trim() : "";
              if (!text) return null;
              const fontSize = Number(source.fontSize);
              return {
                text: text.slice(0, 200),
                fontFamily:
                  typeof source.fontFamily === "string" && source.fontFamily.trim()
                    ? source.fontFamily.trim().slice(0, 200)
                    : "Arial",
                fontSize: Number.isInteger(fontSize) && fontSize >= 8 && fontSize <= 48 ? fontSize : 14,
              };
            })
            .filter(Boolean)
        : [],
    };
  }

  function normalizeSettings(raw, legacyHeader) {
    const value = raw && typeof raw === "object" && raw.schemaVersion === 1 ? raw : {};
    return {
      schemaVersion: 1,
      paperWidth: ["48", "58", "80"].includes(String(value.paperWidth))
        ? String(value.paperWidth)
        : DEFAULT_SETTINGS.paperWidth,
      scale:
        Number.isInteger(value.scale) && value.scale >= 50 && value.scale <= 150
          ? value.scale
          : DEFAULT_SETTINGS.scale,
      templateMode: value.templateMode === "original" ? "original" : "universal",
      confirmAmbiguous: value.confirmAmbiguous !== false,
      rememberPreferences: value.rememberPreferences !== false,
      profile:
        typeof value.profile === "string" && value.profile.trim()
          ? value.profile.trim().slice(0, 80)
          : DEFAULT_SETTINGS.profile,
      header: normalizeHeader(value.header || legacyHeader),
    };
  }

  async function readSettings(storageArea) {
    const stored = await storageArea.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
    const legacy = stored?.[LEGACY_STORAGE_KEY];
    const legacyHeader = legacy && legacy.schemaVersion === 1
      ? { enabled: true, imageDataUrl: legacy.imageDataUrl, lines: legacy.lines }
      : DEFAULT_SETTINGS.header;
    return normalizeSettings(stored?.[STORAGE_KEY], legacyHeader);
  }

  async function saveSettings(storageArea, raw) {
    const current = await readSettings(storageArea);
    const value = normalizeSettings({ ...current, ...raw, schemaVersion: 1 }, current.header);
    await storageArea.set({ [STORAGE_KEY]: value });
    return value;
  }

  return {
    LEGACY_STORAGE_KEY,
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    normalizeHeader,
    normalizeSettings,
    readSettings,
    saveSettings,
  };
});
