// @vitest-environment jsdom

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const ingresarVenta = require(
  "../../extensions/TimeMasterHerramientas/ingresarventa-core.js",
);
const settings = require(
  "../../extensions/TimeMasterHerramientas/settings-core.js",
);
const genteCrystal = require(
  "../../extensions/TimeMasterHerramientas/gentecrystal-content.js",
);
const popup = require("../../extensions/TimeMasterHerramientas/popup.js");

const activeControllers: Array<{ stop: () => void }> = [];

afterEach(() => {
  for (const controller of activeControllers.splice(0)) controller.stop();
  document.body.innerHTML = "";
});

describe("Ingresar venta con Ctrl+Enter", () => {
  it("hace clic en el boton disponible", () => {
    document.body.innerHTML = `
      <input id="ticket-numbers">
      <button type="button" id="btn-submit-sale">Ingresar venta</button>
    `;
    const input = document.getElementById("ticket-numbers") as HTMLInputElement;
    const button = document.getElementById(
      "btn-submit-sale",
    ) as HTMLButtonElement;
    let clickCount = 0;
    button.addEventListener("click", () => {
      clickCount += 1;
    });
    const controller = ingresarVenta.createSaleShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    input.focus();
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Enter",
      ctrlKey: true,
    });
    input.dispatchEvent(event);

    expect(clickCount).toBe(1);
    expect(event.defaultPrevented).toBe(true);
    controller.stop();
  });

  it("acepta Ctrl+Enter del teclado numerico", () => {
    document.body.innerHTML = `
      <button type="button" id="btn-submit-sale">Ingresar venta</button>
    `;
    const button = document.getElementById(
      "btn-submit-sale",
    ) as HTMLButtonElement;
    let clickCount = 0;
    button.addEventListener("click", () => {
      clickCount += 1;
    });
    const controller = ingresarVenta.createSaleShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    document.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        code: "NumpadEnter",
        ctrlKey: true,
      }),
    );

    expect(clickCount).toBe(1);
    controller.stop();
  });

  it.each([
    ["disabled", '<button id="btn-submit-sale" disabled>Ingresar venta</button>'],
    [
      "aria-disabled",
      '<button id="btn-submit-sale" aria-disabled="true">Ingresar venta</button>',
    ],
    ["hidden", '<button id="btn-submit-sale" hidden>Ingresar venta</button>'],
    [
      "display none",
      '<button id="btn-submit-sale" style="display: none">Ingresar venta</button>',
    ],
    [
      "visibility hidden",
      '<button id="btn-submit-sale" style="visibility: hidden">Ingresar venta</button>',
    ],
    [
      "dentro de un ancestro oculto",
      '<div hidden><button id="btn-submit-sale">Ingresar venta</button></div>',
    ],
    [
      "dentro de un fieldset deshabilitado",
      '<fieldset disabled><button id="btn-submit-sale">Ingresar venta</button></fieldset>',
    ],
  ])("no consume el atajo cuando el boton esta %s", (_state, markup) => {
    document.body.innerHTML = markup;
    const button = document.getElementById(
      "btn-submit-sale",
    ) as HTMLButtonElement;
    let clickCount = 0;
    button.addEventListener("click", () => {
      clickCount += 1;
    });
    const controller = ingresarVenta.createSaleShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Enter",
      ctrlKey: true,
    });
    document.dispatchEvent(event);

    expect(clickCount).toBe(0);
    expect(event.defaultPrevented).toBe(false);
    controller.stop();
  });

  it.each([
    ["sin Control", { code: "Enter" }],
    ["con Shift", { code: "Enter", ctrlKey: true, shiftKey: true }],
    ["con Alt", { code: "Enter", ctrlKey: true, altKey: true }],
    ["con Meta", { code: "Enter", ctrlKey: true, metaKey: true }],
    ["repetida", { code: "Enter", ctrlKey: true, repeat: true }],
    ["con otra tecla", { code: "Escape", ctrlKey: true }],
  ])("ignora la combinacion %s", (_description, eventInit) => {
    document.body.innerHTML = `
      <button type="button" id="btn-submit-sale">Ingresar venta</button>
    `;
    const button = document.getElementById(
      "btn-submit-sale",
    ) as HTMLButtonElement;
    let clickCount = 0;
    button.addEventListener("click", () => {
      clickCount += 1;
    });
    const controller = ingresarVenta.createSaleShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, ...eventInit }),
    );

    expect(clickCount).toBe(0);
    controller.stop();
  });

  it("se activa y desactiva inmediatamente desde la configuracion", () => {
    document.body.innerHTML = `
      <button type="button" id="btn-submit-sale">Ingresar venta</button>
    `;
    const button = document.getElementById(
      "btn-submit-sale",
    ) as HTMLButtonElement;
    let clickCount = 0;
    button.addEventListener("click", () => {
      clickCount += 1;
    });
    let storageListener: (
      changes: Record<string, { newValue: boolean }>,
      areaName: string,
    ) => void = () => undefined;
    const storage = {
      local: {
        get: (defaults: object, callback: (value: object) => void) =>
          callback(defaults),
      },
      onChanged: {
        addListener: (listener: typeof storageListener) => {
          storageListener = listener;
        },
        removeListener: () => undefined,
      },
    };
    const shortcutController =
      ingresarVenta.createSaleShortcutController(document);
    const controller = genteCrystal.createGenteCrystalController({
      storage,
      settings,
      sumaController: { start: () => undefined, destroy: () => undefined },
      moverController: {
        setEnabled: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      },
      saleShortcutController: shortcutController,
    });
    const pressShortcut = () =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "Enter",
          ctrlKey: true,
        }),
      );
    controller.start();

    pressShortcut();
    expect(clickCount).toBe(0);

    storageListener(
      { tmhIngresarVentaEnabled: { newValue: true } },
      "local",
    );
    pressShortcut();
    expect(clickCount).toBe(1);

    storageListener(
      { tmhIngresarVentaEnabled: { newValue: false } },
      "local",
    );
    pressShortcut();
    expect(clickCount).toBe(1);

    controller.destroy();
  });

  it("no permite que una lectura inicial antigua revierta la desactivacion", () => {
    document.body.innerHTML = `
      <button type="button" id="btn-submit-sale">Ingresar venta</button>
    `;
    const button = document.getElementById(
      "btn-submit-sale",
    ) as HTMLButtonElement;
    let clickCount = 0;
    button.addEventListener("click", () => {
      clickCount += 1;
    });
    let initialSettingsCallback: (value: object) => void = () => undefined;
    let storageListener: (
      changes: Record<string, { newValue: boolean }>,
      areaName: string,
    ) => void = () => undefined;
    const storage = {
      local: {
        get: (_defaults: object, callback: (value: object) => void) => {
          initialSettingsCallback = callback;
        },
      },
      onChanged: {
        addListener: (listener: typeof storageListener) => {
          storageListener = listener;
        },
        removeListener: () => undefined,
      },
    };
    const controller = genteCrystal.createGenteCrystalController({
      storage,
      settings,
      sumaController: { start: () => undefined, destroy: () => undefined },
      moverController: {
        setEnabled: () => undefined,
        start: () => undefined,
        stop: () => undefined,
      },
      saleShortcutController:
        ingresarVenta.createSaleShortcutController(document),
    });
    controller.start();

    try {
      storageListener(
        { tmhIngresarVentaEnabled: { newValue: false } },
        "local",
      );
      initialSettingsCallback({
        ...settings.DEFAULT_SETTINGS,
        tmhIngresarVentaEnabled: true,
      });
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          code: "Enter",
          ctrlKey: true,
        }),
      );

      expect(clickCount).toBe(0);
    } finally {
      controller.destroy();
    }
  });

  it("permite activar el atajo desde el popup", () => {
    const popupHtml = readFileSync(
      join(process.cwd(), "extensions/TimeMasterHerramientas/popup.html"),
      "utf8",
    );
    document.documentElement.innerHTML = popupHtml;
    const storedValues: Record<string, boolean> = {};
    const chromeApi = {
      runtime: { lastError: null },
      storage: {
        local: {
          get: (defaults: object, callback: (value: object) => void) =>
            callback(defaults),
          set: (value: Record<string, boolean>, callback: () => void) => {
            Object.assign(storedValues, value);
            callback();
          },
        },
      },
    };
    const controller = popup.createPopupController(document, chromeApi);
    controller.start();

    const toggle = document.getElementById(
      "tmhIngresarVentaEnabled-toggle",
    ) as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(false);

    if (!toggle) throw new Error("No se encontro el interruptor");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(storedValues.tmhIngresarVentaEnabled).toBe(true);
    expect(
      document.getElementById("tmhIngresarVentaEnabled-status")?.textContent,
    ).toBe("Activado");
    controller.destroy();
  });

  it("carga el atajo antes del contenido de Gente Crystal", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(process.cwd(), "extensions/TimeMasterHerramientas/manifest.json"),
        "utf8",
      ),
    );
    const genteCrystalScripts = manifest.content_scripts.find(
      (entry: { matches: string[] }) =>
        entry.matches.includes(
          "https://gentecrystal.net/controllers/sales/SalesController.php*",
        ),
    ).js as string[];

    expect(genteCrystalScripts).toContain("ingresarventa-core.js");
    expect(genteCrystalScripts.indexOf("ingresarventa-core.js")).toBeLessThan(
      genteCrystalScripts.indexOf("gentecrystal-content.js"),
    );
  });
});
