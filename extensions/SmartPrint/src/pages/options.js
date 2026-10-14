(function startOptions(root) {
  "use strict";
  if (!root.document || !root.chrome?.storage?.local || !root.SmartPrintSettings) return;
  const documentRef = root.document;
  const api = root.SmartPrintSettings;
  const field = (id) => documentRef.getElementById(id);

  async function start() {
    const value = await api.readSettings(root.chrome.storage.local);
    field("profile").value = value.profile;
    field("paper-width").value = value.paperWidth;
    field("scale").value = String(value.scale);
    field("template-mode").value = value.templateMode;
    field("confirm-ambiguous").checked = value.confirmAmbiguous;
    field("remember-preferences").checked = value.rememberPreferences;
    field("header-enabled").checked = value.header.enabled;
    field("legacy-summary").textContent = value.header.lines.length > 0 || value.header.imageDataUrl
      ? `Encabezado importado: ${value.header.lines.length} línea(s)${value.header.imageDataUrl ? " e imagen" : ""}.`
      : "No hay encabezado previo configurado.";
  }

  documentRef.getElementById("settings-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const current = await api.readSettings(root.chrome.storage.local);
    await api.saveSettings(root.chrome.storage.local, {
      profile: field("profile").value,
      paperWidth: field("paper-width").value,
      scale: Number(field("scale").value),
      templateMode: field("template-mode").value,
      confirmAmbiguous: field("confirm-ambiguous").checked,
      rememberPreferences: field("remember-preferences").checked,
      header: { ...current.header, enabled: field("header-enabled").checked },
    });
    field("options-status").textContent = "Configuración guardada.";
  });
  void start();
})(typeof globalThis !== "undefined" ? globalThis : this);
