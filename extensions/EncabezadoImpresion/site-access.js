(function initializeSiteAccess(root, factory) {
  const settings =
    typeof module === "object" && module.exports
      ? require("./settings-core.js")
      : root.EncabezadoImpresionSettings;
  const api = factory(settings);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
    return;
  }

  root.EncabezadoImpresionSiteAccess = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function buildSiteAccess(settings) {
    "use strict";

    const JUNTA_SCRIPT_ID = "encabezado-impresion-junta";

    function buildJuntaRegistration(origin) {
      return {
        id: JUNTA_SCRIPT_ID,
        matches: [settings.originPattern(origin)],
        js: ["settings-core.js", "print-core.js", "print-content.js"],
        css: ["print-content.css"],
        runAt: "document_start",
        persistAcrossSessions: true,
      };
    }

    async function updateJuntaAccess(
      chromeApi,
      previousOrigin,
      requestedUrl,
    ) {
      const previous = settings.normalizeJuntaOrigin(previousOrigin);
      const requested =
        typeof requestedUrl === "string" ? requestedUrl.trim() : "";
      const next = settings.normalizeJuntaOrigin(requested);

      if (requested && !next) {
        return {
          ok: false,
          origin: previous,
          error: "Ingrese una URL HTTP o HTTPS válida.",
        };
      }

      if (next === previous) return { ok: true, origin: previous };

      if (!next) {
        if (previous) {
          try {
            const removed = await chromeApi.permissions.remove({
              origins: [settings.originPattern(previous)],
            });
            if (!removed) throw new Error("permission not removed");
          } catch {
            return {
              ok: false,
              origin: previous,
              error: "No fue posible desactivar Junta.",
            };
          }
        }

        try {
          await chromeApi.scripting.unregisterContentScripts({
            ids: [JUNTA_SCRIPT_ID],
          });
        } catch {
          // Un registro inexistente ya equivale al estado solicitado.
        }
        return { ok: true, origin: "" };
      }

      const nextPattern = settings.originPattern(next);
      const granted = await chromeApi.permissions.request({
        origins: [nextPattern],
      });
      if (!granted) {
        return {
          ok: false,
          origin: previous,
          error: "Chrome no concedió acceso al sitio de Junta.",
        };
      }

      try {
        const registered =
          await chromeApi.scripting.getRegisteredContentScripts({
            ids: [JUNTA_SCRIPT_ID],
          });
        const registration = buildJuntaRegistration(next);
        if (registered.length > 0) {
          await chromeApi.scripting.updateContentScripts([registration]);
        } else {
          await chromeApi.scripting.registerContentScripts([registration]);
        }
      } catch {
        await chromeApi.permissions
          .remove({ origins: [nextPattern] })
          .catch(() => {});
        return {
          ok: false,
          origin: previous,
          error: "No fue posible activar Junta.",
        };
      }

      if (previous) {
        await chromeApi.permissions.remove({
          origins: [settings.originPattern(previous)],
        });
      }

      return { ok: true, origin: next };
    }

    return {
      JUNTA_SCRIPT_ID,
      buildJuntaRegistration,
      updateJuntaAccess,
    };
  },
);
