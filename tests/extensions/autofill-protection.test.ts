/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  canDisableProtection,
  createPasswordRecord,
  detectCredentialFields,
  matchesProtectedUrl,
  shouldProtectPage,
  verifyPassword,
} from "../../extensions/ProteccionAutorrelleno/autofill-core.js";

describe("autofill protection core", () => {
  it("protege la URL configurada y sus query params sin invadir otras rutas", () => {
    const protectedUrls = [
      "https://contica.app/app/login/",
      "https://www.timemaster.es/",
    ];

    expect(
      matchesProtectedUrl(
        "https://contica.app/app/login/?next=/dashboard",
        protectedUrls,
      ),
    ).toBe(true);
    expect(
      matchesProtectedUrl("https://www.timemaster.es/app/login", protectedUrls),
    ).toBe(true);
    expect(
      matchesProtectedUrl("https://contica.app/app/ventas", protectedUrls),
    ).toBe(false);
  });

  it("detecta campos de usuario y contrasena reales en un formulario", () => {
    const form = document.createElement("form");
    form.innerHTML = `
      <input type="email" autocomplete="username">
      <input type="password" autocomplete="current-password">
    `;
    document.body.replaceChildren(form);

    expect(detectCredentialFields(document)).toMatchObject({
      hasUsername: true,
      hasPassword: true,
    });
  });

  it("solo protege cuando la extension esta activa, la pagina coincide y hay credenciales", () => {
    const settings = {
      enabled: true,
      protectedUrls: ["https://contica.app/app/login/"],
      passwordRecord: {
        salt: "salt",
        hash: "hash",
        iterations: 120000,
      },
    };

    expect(
      shouldProtectPage({
        settings,
        pageUrl: "https://contica.app/app/login/",
        fields: { hasUsername: true, hasPassword: true },
      }),
    ).toBe(true);

    expect(
      shouldProtectPage({
        settings: { ...settings, enabled: false },
        pageUrl: "https://contica.app/app/login/",
        fields: { hasUsername: true, hasPassword: true },
      }),
    ).toBe(false);
  });

  it("verifica la contrasena maestra y exige esa contrasena para desactivar", async () => {
    const passwordRecord = await createPasswordRecord("clave-segura");

    await expect(verifyPassword("clave-segura", passwordRecord)).resolves.toBe(
      true,
    );
    await expect(verifyPassword("otra-clave", passwordRecord)).resolves.toBe(
      false,
    );
    await expect(
      canDisableProtection({ passwordRecord }, "clave-segura"),
    ).resolves.toBe(true);
  });

  it("rechaza contrasenas maestras demasiado cortas", async () => {
    await expect(createPasswordRecord("123456789")).rejects.toThrow(
      "al menos 10 caracteres",
    );
  });
});
