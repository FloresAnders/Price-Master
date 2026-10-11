// @vitest-environment jsdom

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const dividirEfectivo = require(
  "../../extensions/TimeMasterHerramientas/dividirefectivo-core.js",
);
const settings = require(
  "../../extensions/TimeMasterHerramientas/settings-core.js",
);
const contica = require(
  "../../extensions/TimeMasterHerramientas/contica-content.js",
);
const popup = require("../../extensions/TimeMasterHerramientas/popup.js");

describe("Dividir efectivo de TimeMaster Herramientas", () => {
  it.each([
    ["7500/2", "3750"],
    ["7500/3", "2500"],
    ["7500/4", "1875"],
    ["7500/5", "1500"],
    ["10/3", "3.33"],
  ])("convierte %s en %s", (expression, expected) => {
    expect(dividirEfectivo.calculateCashDivision(expression)).toBe(expected);
  });

  it.each(["7500", "7500/", "7500/0", "7500/6", "texto/2"])(
    "ignora el valor no compatible %s",
    (value) => {
      expect(dividirEfectivo.calculateCashDivision(value)).toBeNull();
    },
  );

  describe("controlador de los campos de efectivo", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <input id="payUSD" type="text">
        <input id="payCRC" type="text">
        <input id="cardCRC" class="pay-input" type="text">
      `;
    });

    it.each(["payUSD", "payCRC"])(
      "reemplaza la operacion escrita en #%s",
      (id) => {
        const controller = dividirEfectivo.createCashDivisionController(document);
        const input = document.getElementById(id) as HTMLInputElement;
        let valueObservedByContica = "";
        input.addEventListener("input", () => {
          valueObservedByContica = input.value;
        });
        controller.start();

        input.value = "7500/2";
        input.dispatchEvent(new Event("input", { bubbles: true }));

        expect(input.value).toBe("3750");
        expect(valueObservedByContica).toBe("3750");
        controller.stop();
      },
    );

    it("no altera otros campos de pago", () => {
      const controller = dividirEfectivo.createCashDivisionController(document);
      const input = document.getElementById("cardCRC") as HTMLInputElement;
      controller.start();

      input.value = "7500/2";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(input.value).toBe("7500/2");
      controller.stop();
    });

    it("deja de calcular al desactivarse", () => {
      const controller = dividirEfectivo.createCashDivisionController(document);
      const input = document.getElementById("payCRC") as HTMLInputElement;
      controller.start();
      controller.stop();

      input.value = "7500/3";
      input.dispatchEvent(new Event("input", { bubbles: true }));

      expect(input.value).toBe("7500/3");
    });
  });

  it("se activa y desactiva inmediatamente desde la configuracion guardada", () => {
    document.body.innerHTML = '<input id="payCRC" type="text">';
    const input = document.getElementById("payCRC") as HTMLInputElement;
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
    const cashDivisionController =
      dividirEfectivo.createCashDivisionController(document);
    const noopController = { start: () => undefined, stop: () => undefined };
    const controller = contica.createConticaController({
      storage,
      tabController: noopController,
      printInvoiceCloser: noopController,
      cashDivisionController,
      settings,
    });
    controller.start();

    input.value = "7500/2";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.value).toBe("7500/2");

    storageListener(
      { tmhDividirEfectivoEnabled: { newValue: true } },
      "local",
    );
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.value).toBe("3750");

    storageListener(
      { tmhDividirEfectivoEnabled: { newValue: false } },
      "local",
    );
    input.value = "7500/3";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(input.value).toBe("7500/3");

    controller.destroy();
  });

  it("no revierte una activacion ocurrida mientras carga la configuracion", () => {
    document.body.innerHTML = '<input id="payCRC" type="text">';
    const input = document.getElementById("payCRC") as HTMLInputElement;
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
    const controller = contica.createConticaController({
      storage,
      tabController: { start: () => undefined, stop: () => undefined },
      printInvoiceCloser: { start: () => undefined, stop: () => undefined },
      cashDivisionController:
        dividirEfectivo.createCashDivisionController(document),
      settings,
    });
    controller.start();

    try {
      storageListener(
        { tmhDividirEfectivoEnabled: { newValue: true } },
        "local",
      );
      initialSettingsCallback(settings.DEFAULT_SETTINGS);

      input.value = "7500/3";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(input.value).toBe("2500");
    } finally {
      controller.destroy();
    }
  });

  it("no revierte una desactivacion ocurrida mientras carga la configuracion", () => {
    document.body.innerHTML = '<input id="payUSD" type="text">';
    const input = document.getElementById("payUSD") as HTMLInputElement;
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
    const controller = contica.createConticaController({
      storage,
      tabController: { start: () => undefined, stop: () => undefined },
      printInvoiceCloser: { start: () => undefined, stop: () => undefined },
      cashDivisionController:
        dividirEfectivo.createCashDivisionController(document),
      settings,
    });
    controller.start();

    try {
      storageListener(
        { tmhDividirEfectivoEnabled: { newValue: false } },
        "local",
      );
      initialSettingsCallback({
        ...settings.DEFAULT_SETTINGS,
        tmhDividirEfectivoEnabled: true,
      });

      input.value = "7500/2";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(input.value).toBe("7500/2");
    } finally {
      controller.destroy();
    }
  });

  it("ignora la lectura pendiente de un ciclo anterior", () => {
    document.body.innerHTML = '<input id="payCRC" type="text">';
    const input = document.getElementById("payCRC") as HTMLInputElement;
    const initialSettingsCallbacks: Array<(value: object) => void> = [];
    let storageListener: (
      changes: Record<string, { newValue: boolean }>,
      areaName: string,
    ) => void = () => undefined;
    const storage = {
      local: {
        get: (_defaults: object, callback: (value: object) => void) => {
          initialSettingsCallbacks.push(callback);
        },
      },
      onChanged: {
        addListener: (listener: typeof storageListener) => {
          storageListener = listener;
        },
        removeListener: () => undefined,
      },
    };
    const controller = contica.createConticaController({
      storage,
      tabController: { start: () => undefined, stop: () => undefined },
      printInvoiceCloser: { start: () => undefined, stop: () => undefined },
      cashDivisionController:
        dividirEfectivo.createCashDivisionController(document),
      settings,
    });

    controller.start();
    controller.destroy();
    controller.start();

    try {
      storageListener(
        { tmhDividirEfectivoEnabled: { newValue: true } },
        "local",
      );
      initialSettingsCallbacks[0](settings.DEFAULT_SETTINGS);
      initialSettingsCallbacks[1](settings.DEFAULT_SETTINGS);

      input.value = "7500/5";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      expect(input.value).toBe("1500");
    } finally {
      controller.destroy();
    }
  });

  it("permite activar la herramienta desde el popup", () => {
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
      "tmhDividirEfectivoEnabled-toggle",
    ) as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(false);

    if (!toggle) throw new Error("No se encontro el interruptor");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(storedValues.tmhDividirEfectivoEnabled).toBe(true);
    expect(
      document.getElementById("tmhDividirEfectivoEnabled-status")?.textContent,
    ).toBe("Activado");
    controller.destroy();
  });

  it("carga el controlador antes del contenido de Contica", () => {
    const manifest = JSON.parse(
      readFileSync(
        join(process.cwd(), "extensions/TimeMasterHerramientas/manifest.json"),
        "utf8",
      ),
    );
    const conticaScripts = manifest.content_scripts.find(
      (entry: { matches: string[] }) =>
        entry.matches.includes("https://contica.app/app/modules/punto_de_venta/*"),
    ).js as string[];

    expect(conticaScripts).toContain("dividirefectivo-core.js");
    expect(conticaScripts.indexOf("dividirefectivo-core.js")).toBeLessThan(
      conticaScripts.indexOf("contica-content.js"),
    );
  });
});
