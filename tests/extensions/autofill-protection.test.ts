/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import {
  canDisableProtection,
  createMaskedSecretInput,
  createPasswordRecord,
  detectCredentialFields,
  matchesProtectedUrl,
  shouldProtectPage,
  verifyPassword,
} from "../../extensions/ProteccionAutorrelleno/autofill-core.js";

describe("autofill protection core", () => {
  it("captura la clave maestra sin exponer un campo de contrasena al autorrelleno", () => {
    const input = document.createElement("input");
    input.type = "password";
    document.body.replaceChildren(input);

    const secret = createMaskedSecretInput(input);
    const typed = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      data: "clave-segura",
      inputType: "insertText",
    });

    expect(input.dispatchEvent(typed)).toBe(false);
    expect(input.type).toBe("text");
    expect(input.autocomplete).toBe("one-time-code");
    expect(input.value).toBe("•".repeat(12));
    expect(secret.getValue()).toBe("clave-segura");

    secret.clear();
    expect(input.value).toBe("");
    expect(secret.getValue()).toBe("");
  });

  it("permite corregir la clave maestra enmascarada", () => {
    const input = document.createElement("input");
    document.body.replaceChildren(input);
    const secret = createMaskedSecretInput(input);

    input.dispatchEvent(
      new InputEvent("beforeinput", {
        bubbles: true,
        cancelable: true,
        data: "claveX",
        inputType: "insertText",
      }),
    );
    const deleted = new InputEvent("beforeinput", {
      bubbles: true,
      cancelable: true,
      inputType: "deleteContentBackward",
    });

    expect(input.dispatchEvent(deleted)).toBe(false);
    expect(input.value).toBe("•".repeat(5));
    expect(secret.getValue()).toBe("clave");
  });

  it("permite pegar la clave maestra sin mostrarla en el DOM", () => {
    const input = document.createElement("input");
    document.body.replaceChildren(input);
    const secret = createMaskedSecretInput(input);
    const pasted = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(pasted, "clipboardData", {
      value: { getData: () => "clave-pegada" },
    });

    expect(input.dispatchEvent(pasted)).toBe(false);
    expect(input.value).toBe("•".repeat(12));
    expect(secret.getValue()).toBe("clave-pegada");
  });

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
