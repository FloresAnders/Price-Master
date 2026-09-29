(function initializeSiteAccess(root, factory) {
  const settings =
    typeof module === "object" && module.exports
      // eslint-disable-next-line @typescript-eslint/no-require-imports
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

      if (!next) {
        if (previous) {
          try {
            await chromeApi.permissions.remove({
              origins: [settings.originPattern(previous)],
            });
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
      let nextPermissionWasGranted = false;
      let registered = [];
      try {
        [nextPermissionWasGranted, registered] = await Promise.all([
          chromeApi.permissions.contains({ origins: [nextPattern] }),
          chromeApi.scripting.getRegisteredContentScripts({
            ids: [JUNTA_SCRIPT_ID],
          }),
        ]);
      } catch {
        return {
          ok: false,
          origin: previous,
          error: "No fue posible revisar el acceso al sitio de Junta.",
        };
      }

      const currentRegistration = registered[0] || null;
      const registrationMatches = currentRegistration?.matches?.includes(
        nextPattern,
      );
      if (
        next === previous &&
        nextPermissionWasGranted &&
        registrationMatches
      ) {
        return { ok: true, origin: previous };
      }

      let permissionGrantedNow = false;
      if (!nextPermissionWasGranted) {
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
        permissionGrantedNow = true;
      }

      try {
        const registration = buildJuntaRegistration(next);
        if (currentRegistration) {
          await chromeApi.scripting.updateContentScripts([registration]);
        } else {
          await chromeApi.scripting.registerContentScripts([registration]);
        }
      } catch {
        if (permissionGrantedNow) {
          await chromeApi.permissions
            .remove({ origins: [nextPattern] })
            .catch(() => {});
        }
        return {
          ok: false,
          origin: previous,
          error: "No fue posible activar Junta.",
        };
      }

      if (previous && previous !== next) {
        try {
          await chromeApi.permissions.remove({
            origins: [settings.originPattern(previous)],
          });
        } catch {
          try {
            if (currentRegistration) {
              await chromeApi.scripting.updateContentScripts([
                buildJuntaRegistration(previous),
              ]);
            } else {
              await chromeApi.scripting.unregisterContentScripts({
                ids: [JUNTA_SCRIPT_ID],
              });
            }
            if (permissionGrantedNow) {
              await chromeApi.permissions.remove({ origins: [nextPattern] });
            }
          } catch {
            // Se conserva el error principal; el panel seguirá mostrando el origen anterior.
          }
          return {
            ok: false,
            origin: previous,
            error: "No fue posible reemplazar el sitio de Junta.",
          };
        }
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
