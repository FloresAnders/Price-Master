import { createRequire } from "node:module";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const requireModule = createRequire(import.meta.url);
const settingsPath = resolve(
  "extensions/EncabezadoImpresion/settings-core.js",
);
const accessPath = resolve(
  "extensions/EncabezadoImpresion/site-access.js",
);

type MockOptions = {
  registered?: boolean;
  denyRequest?: boolean;
  registerFailure?: boolean;
  updateFailure?: boolean;
  removeFailure?: boolean;
};

function createChromeApi(options: MockOptions = {}) {
  const calls = {
    request: [] as string[][],
    remove: [] as string[][],
    register: [] as Record<string, unknown>[],
    update: [] as Record<string, unknown>[],
    unregister: [] as string[][],
  };
  const chromeApi = {
    permissions: {
      async request({ origins }: { origins: string[] }) {
        calls.request.push(origins);
        return !options.denyRequest;
      },
      async remove({ origins }: { origins: string[] }) {
        calls.remove.push(origins);
        if (options.removeFailure) throw new Error("remove failed");
        return true;
      },
    },
    scripting: {
      async getRegisteredContentScripts() {
        return options.registered
          ? [{ id: "encabezado-impresion-junta" }]
          : [];
      },
      async registerContentScripts(entries: Record<string, unknown>[]) {
        calls.register.push(...entries);
        if (options.registerFailure) throw new Error("register failed");
      },
      async updateContentScripts(entries: Record<string, unknown>[]) {
        calls.update.push(...entries);
        if (options.updateFailure) throw new Error("update failed");
      },
      async unregisterContentScripts({ ids }: { ids: string[] }) {
        calls.unregister.push(ids);
      },
    },
  };
  return { chromeApi, calls };
}

describe("EncabezadoImpresion site access", () => {
  it("extrae solo el origin de HTTP(S) y descarta otros esquemas", () => {
    const { normalizeJuntaOrigin } = requireModule(settingsPath);

    expect(
      normalizeJuntaOrigin(
        "https://usuario:clave@junta.test:8443/ruta?q=1",
      ),
    ).toBe("https://junta.test:8443");
    expect(normalizeJuntaOrigin("file:///tmp/factura.html")).toBe("");
  });

  it("registra document_start persistente con los tres scripts", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi();

    const result = await updateJuntaAccess(
      chromeApi,
      "",
      "https://junta.test/imprimir/1",
    );

    expect(result).toEqual({ ok: true, origin: "https://junta.test" });
    expect(calls.request).toEqual([["https://junta.test/*"]]);
    expect(calls.register[0]).toMatchObject({
      id: "encabezado-impresion-junta",
      matches: ["https://junta.test/*"],
      js: ["settings-core.js", "print-core.js", "print-content.js"],
      css: ["print-content.css"],
      runAt: "document_start",
      persistAcrossSessions: true,
    });
  });

  it("no cambia el registro cuando el usuario rechaza el permiso", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi({ denyRequest: true });

    const result = await updateJuntaAccess(
      chromeApi,
      "https://viejo.test",
      "https://nuevo.test/factura",
    );

    expect(result).toEqual({
      ok: false,
      origin: "https://viejo.test",
      error: "Chrome no concedió acceso al sitio de Junta.",
    });
    expect(calls.register).toEqual([]);
    expect(calls.update).toEqual([]);
    expect(calls.remove).toEqual([]);
  });

  it("rechaza URL inválida sin solicitar permisos", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi();

    const result = await updateJuntaAccess(
      chromeApi,
      "https://viejo.test",
      "javascript:alert(1)",
    );

    expect(result.ok).toBe(false);
    expect(result.origin).toBe("https://viejo.test");
    expect(calls.request).toEqual([]);
  });

  it("no solicita de nuevo el mismo origen", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi({ registered: true });

    const result = await updateJuntaAccess(
      chromeApi,
      "https://junta.test",
      "https://junta.test/otra-ruta",
    );

    expect(result).toEqual({ ok: true, origin: "https://junta.test" });
    expect(calls.request).toEqual([]);
    expect(calls.update).toEqual([]);
  });

  it("retira el sitio anterior solo después de activar el nuevo", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi({ registered: true });

    const result = await updateJuntaAccess(
      chromeApi,
      "https://viejo.test",
      "https://nuevo.test/factura",
    );

    expect(result).toEqual({ ok: true, origin: "https://nuevo.test" });
    expect(calls.update[0]).toMatchObject({
      matches: ["https://nuevo.test/*"],
    });
    expect(calls.remove).toEqual([["https://viejo.test/*"]]);
  });

  it("retira solo el permiso nuevo cuando falla la actualización", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi({
      registered: true,
      updateFailure: true,
    });

    const result = await updateJuntaAccess(
      chromeApi,
      "https://viejo.test",
      "https://nuevo.test",
    );

    expect(result).toEqual({
      ok: false,
      origin: "https://viejo.test",
      error: "No fue posible activar Junta.",
    });
    expect(calls.remove).toEqual([["https://nuevo.test/*"]]);
  });

  it("desactiva Junta al limpiar la URL", async () => {
    const { updateJuntaAccess } = requireModule(accessPath);
    const { chromeApi, calls } = createChromeApi({ registered: true });

    const result = await updateJuntaAccess(
      chromeApi,
      "https://junta.test",
      "",
    );

    expect(result).toEqual({ ok: true, origin: "" });
    expect(calls.remove).toEqual([["https://junta.test/*"]]);
    expect(calls.unregister).toEqual([["encabezado-impresion-junta"]]);
  });
});
