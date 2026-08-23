/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

import {
  CLIENT_STORAGE_KEY,
  createAutocompleteController,
  findClienteInput,
  isForbiddenField,
  normalizeClientName,
  registerClientUse,
  sortClients,
} from "../../extensions/AutoRelleno/content.js";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("cliente autocomplete extension", () => {
  it("detecta unicamente el input Cliente de Gente Cristal", () => {
    document.body.innerHTML = `
      <div class="form-group">
        <label for="cliente">Cliente</label>
        <input type="text" class="form-control" name="cliente" id="cliente" value="" placeholder="Telefono/Nombre (opcional)">
      </div>
      <div class="form-group">
        <label for="numero">Numero</label>
        <input type="text" name="numero" id="numero">
      </div>
    `;

    expect(findClienteInput(document)?.id).toBe("cliente");
    expect(isForbiddenField(document.getElementById("numero"))).toBe(true);
  });

  it("normaliza nombres y evita duplicados ignorando mayusculas", () => {
    const now = 1000;
    const first = registerClientUse([], "  Cocho  ", now);
    const second = registerClientUse(first, "cocho", now + 500);

    expect(normalizeClientName("  Cocho  ")).toBe("Cocho");
    expect(second).toEqual([
      {
        name: "Cocho",
        usageCount: 2,
        createdAt: now,
        lastUsedAt: now + 500,
      },
    ]);
  });

  it("ordena primero por mas usados y luego por mas recientes", () => {
    expect(
      sortClients([
        { name: "Juan", usageCount: 1, createdAt: 1, lastUsedAt: 10 },
        { name: "Carlos", usageCount: 3, createdAt: 1, lastUsedAt: 20 },
        { name: "Maria", usageCount: 3, createdAt: 1, lastUsedAt: 30 },
      ]).map((client) => client.name),
    ).toEqual(["Maria", "Carlos", "Juan"]);
  });

  it("usa una llave de storage dedicada solo a clientes", () => {
    expect(CLIENT_STORAGE_KEY).toBe("genteCrystalClienteHistory");
  });

  it("permite filtrar y seleccionar con flechas mas Enter sin doble conteo", async () => {
    document.body.innerHTML = `
      <form>
        <label for="cliente">Cliente</label>
        <input type="text" name="cliente" id="cliente" placeholder="Telefono/Nombre (opcional)">
      </form>
    `;
    const input = document.getElementById("cliente") as HTMLInputElement;
    let storedClients = [
      { name: "Cocho", usageCount: 1, createdAt: 1, lastUsedAt: 1 },
      { name: "Carlos", usageCount: 1, createdAt: 1, lastUsedAt: 1 },
    ];

    createAutocompleteController({
      document,
      input,
      now: () => 50,
      readClients: async () => storedClients,
      writeClients: async (clients: typeof storedClients) => {
        storedClients = clients;
      },
    });

    input.dispatchEvent(new Event("focus"));
    await flushAsync();
    input.value = "co";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    input.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );

    await waitForAssertion(() => {
      expect(input.value).toBe("Cocho");
      expect(storedClients.find((client) => client.name === "Cocho")).toMatchObject({
        usageCount: 2,
        lastUsedAt: 50,
      });
    });

    input.form?.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    await flushAsync();

    expect(storedClients.find((client) => client.name === "Cocho")).toMatchObject({
      usageCount: 2,
      lastUsedAt: 50,
    });
  });

  it("permite borrar un cliente guardado desde el popup", async () => {
    const popupHtml = readFileSync("extensions/AutoRelleno/popup.html", "utf8");
    const popupScript = readFileSync("extensions/AutoRelleno/popup.js", "utf8");
    const body = popupHtml.match(/<body>([\s\S]*)<\/body>/)?.[1] || "";
    const store = {
      [CLIENT_STORAGE_KEY]: [
        { name: "Cocho", usageCount: 2, createdAt: 1, lastUsedAt: 2 },
      ],
    };

    document.body.innerHTML = body;
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn((key: string, callback: (result: object) => void) => {
            callback({ [key]: store[key as keyof typeof store] });
          }),
          set: vi.fn((value: object, callback?: () => void) => {
            Object.assign(store, value);
            callback?.();
          }),
        },
      },
    });

    new Function(popupScript)();
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await flushAsync();

    expect(document.querySelector(".client-name")?.textContent).toBe("Cocho");
    document.querySelector<HTMLButtonElement>(".delete-client")?.click();

    await waitForAssertion(() => {
      expect(store[CLIENT_STORAGE_KEY]).toEqual([]);
      expect(document.getElementById("empty")?.dataset.visible).toBe("true");
    });
  });
});
