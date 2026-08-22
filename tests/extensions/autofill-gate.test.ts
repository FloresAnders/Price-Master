/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import "../../extensions/ProteccionAutorrelleno/autofill-core.js";
import {
  createCredentialGate,
  waitForDocumentRoot,
} from "../../extensions/ProteccionAutorrelleno/content-gate.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("autofill credential gate", () => {
  it("limpia credenciales detectadas y bloquea submit hasta validar la contrasena", async () => {
    document.body.innerHTML = `
      <form id="login-form">
        <input id="email" type="email" value="usuario@empresa.com">
        <input id="password" type="password" value="autofilled-secret">
        <button type="submit">Entrar</button>
      </form>
    `;

    const form = document.getElementById("login-form") as HTMLFormElement;
    const email = document.getElementById("email") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    const gate = createCredentialGate({
      document,
      pageUrl: "https://contica.app/app/login/",
      settings: {
        enabled: true,
        protectedUrls: ["https://contica.app/app/login/"],
        passwordRecord: { salt: "salt", hash: "hash", iterations: 120000 },
      },
      verifyPassword: async (candidate: string) => candidate === "clave",
    });

    await gate.start();

    expect(gate.isLocked()).toBe(true);
    expect(email.value).toBe("");
    expect(password.value).toBe("");
    expect(form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))).toBe(false);

    await expect(gate.attemptUnlock("incorrecta")).resolves.toBe(false);
    expect(gate.isLocked()).toBe(true);

    await expect(gate.attemptUnlock("clave")).resolves.toBe(true);
    expect(gate.isLocked()).toBe(false);
    expect(form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))).toBe(true);
  });

  it("mantiene campos vacios si el navegador autorrellena despues del bloqueo", async () => {
    vi.useFakeTimers();
    document.body.innerHTML = `
      <form>
        <input id="email" type="email">
        <input id="password" type="password">
      </form>
    `;

    const email = document.getElementById("email") as HTMLInputElement;
    const password = document.getElementById("password") as HTMLInputElement;
    const gate = createCredentialGate({
      document,
      pageUrl: "https://contica.app/app/login/",
      settings: {
        enabled: true,
        protectedUrls: ["https://contica.app/app/login/"],
        passwordRecord: { salt: "salt", hash: "hash", iterations: 120000 },
      },
      scrubIntervalMs: 50,
      verifyPassword: async () => false,
    });

    await gate.start();
    email.value = "relleno@tarde.com";
    password.value = "secret-tardio";

    await vi.advanceTimersByTimeAsync(60);

    expect(email.value).toBe("");
    expect(password.value).toBe("");
    expect(email.readOnly).toBe(true);
    expect(password.autocomplete).toBe("new-password");
  });

  it("espera un nodo raiz antes de observar en document_start", async () => {
    vi.useFakeTimers();
    const lateDocument = {
      documentElement: null,
      body: null,
    } as unknown as Document;
    const waiting = waitForDocumentRoot(lateDocument, 25);

    vi.advanceTimersByTime(25);
    lateDocument.documentElement = document.createElement("html");
    await vi.advanceTimersByTimeAsync(25);

    await expect(waiting).resolves.toBe(lateDocument.documentElement);
  });
});
