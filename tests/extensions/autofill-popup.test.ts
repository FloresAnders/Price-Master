/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  createPasswordRecord,
  verifyPassword,
} from "../../extensions/ProteccionAutorrelleno/autofill-core.js";

const STORAGE_KEY = "autofillProtectionSettings";
const popupHtml = readFileSync(
  "extensions/ProteccionAutorrelleno/popup.html",
  "utf8",
);
const popupScript = readFileSync(
  "extensions/ProteccionAutorrelleno/popup.js",
  "utf8",
);

function popupBody() {
  return popupHtml.match(/<body>([\s\S]*)<\/body>/)?.[1] || "";
}

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}

async function waitForAssertion(assertion: () => void | Promise<void>) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
  throw lastError;
}

async function setupPopup(initialSettings: unknown) {
  document.body.innerHTML = popupBody();

  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
  };

  const store: Record<string, unknown> = {
    [STORAGE_KEY]: initialSettings,
  };

  vi.stubGlobal("browser", undefined);
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn((key: string, callback: (result: object) => void) => {
          callback({ [key]: store[key] });
        }),
        set: vi.fn((value: object, callback?: () => void) => {
          Object.assign(store, value);
          callback?.();
        }),
      },
    },
  });

  new Function(popupScript)();
  await flushAsync();

  return {
    store,
    settings: () => store[STORAGE_KEY] as {
      enabled: boolean;
      protectedUrls: string[];
      passwordRecord: { salt: string; hash: string; iterations: number };
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("autofill protection popup", () => {
  it("pide la contrasena actual antes de eliminar una URL", async () => {
    const passwordRecord = await createPasswordRecord("clave-original");
    const { settings } = await setupPopup({
      enabled: true,
      protectedUrls: ["https://contica.app/app/login/"],
      passwordRecord,
    });

    document.querySelector<HTMLButtonElement>("#url-list button")?.click();
    await flushAsync();

    expect(settings().protectedUrls).toEqual([
      "https://contica.app/app/login/",
    ]);

    const removePassword =
      document.querySelector<HTMLInputElement>("#remove-password");
    expect(removePassword).toBeTruthy();

    removePassword!.value = "clave-original";
    document
      .querySelector<HTMLFormElement>("#remove-form")
      ?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    await waitForAssertion(() => {
      expect(settings().protectedUrls).toEqual([]);
    });
  });

  it("pide la contrasena existente antes de cambiar una contrasena configurada", async () => {
    const passwordRecord = await createPasswordRecord("clave-original");
    const { settings } = await setupPopup({
      enabled: true,
      protectedUrls: ["https://contica.app/app/login/"],
      passwordRecord,
    });

    document
      .querySelector<HTMLButtonElement>("#toggle-password-change")
      ?.click();
    await flushAsync();

    const current =
      document.querySelector<HTMLInputElement>("#current-password");
    const next = document.querySelector<HTMLInputElement>("#master-password");
    const confirmation = document.querySelector<HTMLInputElement>(
      "#master-password-confirm",
    );
    expect(current).toBeTruthy();

    current!.value = "incorrecta";
    next!.value = "clave-nueva-segura";
    confirmation!.value = "clave-nueva-segura";
    document.querySelector<HTMLButtonElement>("#save-password")?.click();
    await flushAsync();

    await expect(
      verifyPassword("clave-original", settings().passwordRecord),
    ).resolves.toBe(true);

    current!.value = "clave-original";
    document.querySelector<HTMLButtonElement>("#save-password")?.click();

    await waitForAssertion(async () => {
      await expect(
        verifyPassword("clave-nueva-segura", settings().passwordRecord),
      ).resolves.toBe(true);
    });
  });
});
