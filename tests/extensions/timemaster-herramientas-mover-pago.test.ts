// @vitest-environment jsdom

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const moverPago = require(
  "../../extensions/TimeMasterHerramientas/moverpago-core.js",
);
const settings = require(
  "../../extensions/TimeMasterHerramientas/settings-core.js",
);
const contica = require(
  "../../extensions/TimeMasterHerramientas/contica-content.js",
);
const popup = require("../../extensions/TimeMasterHerramientas/popup.js");

const activeControllers: Array<{ stop: () => void }> = [];

function renderPaymentInputs(symbol = "₡") {
  document.body.innerHTML = `
    <div id="pv-payment-modal">
      <div class="sides-padding">
        <label class="pay-label">Efectivo</label>
        <span class="pay-input-label">$</span>
        <input id="payUSD" class="pay-input" type="text">
        <span class="pay-input-label">₡</span>
        <input id="payCRC" class="pay-input" type="text">
      </div>
      <div class="sides-padding">
        <label class="pay-label">Tarjeta</label>
        <input class="pay-input voucher-input" placeholder="No. de autorización">
        <div>
          <span class="pay-input-label">${symbol}</span>
          <input class="pay-input" type="text">
        </div>
      </div>
      <div class="sides-padding">
        <label class="pay-label">SINPE</label>
        <input class="pay-input voucher-input" placeholder="No. de referencia">
        <div>
          <span class="pay-input-label">${symbol}</span>
          <input class="pay-input" type="text">
        </div>
      </div>
    </div>
  `;
}

function paymentAmount(label: "Tarjeta" | "SINPE") {
  const row = [...document.querySelectorAll(".sides-padding")].find(
    (candidate) =>
      candidate.querySelector(".pay-label")?.textContent?.trim() === label,
  );
  return row?.querySelector(
    "input.pay-input:not(.voucher-input)",
  ) as HTMLInputElement;
}

function pressLetter(input: HTMLInputElement, key: string) {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    code: `Key${key.toUpperCase()}`,
    key,
  });
  input.dispatchEvent(event);
  return event;
}

afterEach(() => {
  for (const controller of activeControllers.splice(0)) controller.stop();
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("Mover montos entre medios de pago en Contica", () => {
  it.each([
    ["T", "Tarjeta"],
    ["t", "Tarjeta"],
    ["S", "SINPE"],
    ["s", "SINPE"],
  ] as const)("mueve el monto en colones al destino de %s", (key, label) => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const target = paymentAmount(label);
    target.value = "250";
    const inputEvents: string[] = [];
    const changeEvents: string[] = [];
    cash.addEventListener("input", () => inputEvents.push("cash"));
    target.addEventListener("input", () => inputEvents.push("target"));
    cash.addEventListener("change", () => changeEvents.push("cash"));
    target.addEventListener("change", () => changeEvents.push("target"));
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    cash.value = "5000";
    cash.focus();
    const event = pressLetter(cash, key);

    expect(cash.value).toBe("");
    expect(target.value).toBe("5000");
    expect(document.activeElement).toBe(target);
    expect(inputEvents).toEqual(["cash", "target"]);
    expect(changeEvents).toEqual(["cash", "target"]);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each([
    ["E", "Efectivo"],
    ["T", "Tarjeta"],
    ["S", "SINPE"],
  ] as const)("mueve el monto en dolares al destino de %s", (key, label) => {
    renderPaymentInputs("$");
    const source = paymentAmount("Tarjeta");
    const target =
      label === "Efectivo"
        ? (document.getElementById("payUSD") as HTMLInputElement)
        : paymentAmount(label);
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    source.value = "12.50";
    source.focus();
    pressLetter(source, key);

    if (source === target) {
      expect(source.value).toBe("12.50");
    } else {
      expect(source.value).toBe("");
      expect(target.value).toBe("12.50");
    }
    expect(document.activeElement).toBe(target);
  });

  it("solo enfoca el destino cuando el origen esta vacio", () => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const card = paymentAmount("Tarjeta");
    const cardInputListener = vi.fn();
    card.value = "700";
    card.addEventListener("input", cardInputListener);
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    cash.focus();
    const event = pressLetter(cash, "T");

    expect(cash.value).toBe("");
    expect(card.value).toBe("700");
    expect(cardInputListener).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(card);
    expect(event.defaultPrevented).toBe(true);
  });

  it("E conserva el monto cuando el origen ya es efectivo", () => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();

    cash.value = "5000";
    cash.focus();
    pressLetter(cash, "E");

    expect(cash.value).toBe("5000");
    expect(document.activeElement).toBe(cash);
  });

  it("no interpreta las letras escritas en el comprobante", () => {
    renderPaymentInputs();
    const voucher = document.querySelector(
      'input[placeholder="No. de autorización"]',
    ) as HTMLInputElement;
    const sinpe = paymentAmount("SINPE");
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();
    voucher.value = "12345";
    voucher.focus();

    const event = pressLetter(voucher, "S");

    expect(voucher.value).toBe("12345");
    expect(sinpe.value).toBe("");
    expect(event.defaultPrevented).toBe(false);
  });

  it("no mueve un monto entre campos de monedas diferentes", () => {
    renderPaymentInputs("₡");
    const cashUsd = document.getElementById("payUSD") as HTMLInputElement;
    const card = paymentAmount("Tarjeta");
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();
    cashUsd.value = "10";
    cashUsd.focus();

    const event = pressLetter(cashUsd, "T");

    expect(cashUsd.value).toBe("10");
    expect(card.value).toBe("");
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ["Ctrl", { ctrlKey: true }],
    ["Alt", { altKey: true }],
    ["Meta", { metaKey: true }],
    ["repeticion", { repeat: true }],
  ])("ignora T con %s", (_description, modifiers) => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const card = paymentAmount("Tarjeta");
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();
    cash.value = "5000";
    cash.focus();

    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "KeyT",
      key: "t",
      ...modifiers,
    });
    cash.dispatchEvent(event);

    expect(cash.value).toBe("5000");
    expect(card.value).toBe("");
    expect(event.defaultPrevented).toBe(false);
  });

  it.each([
    ["fuera de un campo de pago", '<input id="otro" value="5000">'],
    ["sin destino", '<input id="payCRC" value="5000">'],
    [
      "con destino deshabilitado",
      '<input id="payCRC" value="5000"><div class="sides-padding"><label class="pay-label">Tarjeta</label><span class="pay-input-label">₡</span><input class="pay-input" disabled></div>',
    ],
  ])("no consume la tecla %s", (_description, markup) => {
    document.body.innerHTML = markup;
    const source = document.querySelector("input") as HTMLInputElement;
    const controller = moverPago.createPaymentShortcutController(document);
    activeControllers.push(controller);
    controller.start();
    source.focus();

    const event = pressLetter(source, "T");

    expect(source.value).toBe("5000");
    expect(event.defaultPrevented).toBe(false);
  });

  it("deja de responder al desactivarse", () => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const card = paymentAmount("Tarjeta");
    const controller = moverPago.createPaymentShortcutController(document);
    controller.start();
    controller.stop();
    cash.value = "5000";
    cash.focus();

    pressLetter(cash, "T");

    expect(cash.value).toBe("5000");
    expect(card.value).toBe("");
  });

  it("se activa y desactiva inmediatamente desde la configuracion", () => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const card = paymentAmount("Tarjeta");
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
    const paymentShortcutController =
      moverPago.createPaymentShortcutController(document);
    const noopController = { start: () => undefined, stop: () => undefined };
    const controller = contica.createConticaController({
      storage,
      tabController: noopController,
      printInvoiceCloser: noopController,
      cashDivisionController: noopController,
      paymentShortcutController,
      settings,
    });
    const moveToCard = () => {
      cash.focus();
      return pressLetter(cash, "T");
    };
    controller.start();

    cash.value = "1000";
    moveToCard();
    expect(cash.value).toBe("1000");

    storageListener(
      { tmhMoverPagoEnabled: { newValue: true } },
      "local",
    );
    moveToCard();
    expect(card.value).toBe("1000");

    storageListener(
      { tmhMoverPagoEnabled: { newValue: false } },
      "local",
    );
    cash.value = "2000";
    moveToCard();
    expect(cash.value).toBe("2000");
    expect(card.value).toBe("1000");

    controller.destroy();
  });

  it("no revierte un cambio ocurrido mientras carga la configuracion", () => {
    renderPaymentInputs();
    const cash = document.getElementById("payCRC") as HTMLInputElement;
    const card = paymentAmount("Tarjeta");
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
    const noopController = { start: () => undefined, stop: () => undefined };
    const controller = contica.createConticaController({
      storage,
      tabController: noopController,
      printInvoiceCloser: noopController,
      cashDivisionController: noopController,
      paymentShortcutController:
        moverPago.createPaymentShortcutController(document),
      settings,
    });
    controller.start();

    storageListener(
      { tmhMoverPagoEnabled: { newValue: true } },
      "local",
    );
    initialSettingsCallback(settings.DEFAULT_SETTINGS);
    cash.value = "5000";
    cash.focus();
    pressLetter(cash, "T");

    expect(card.value).toBe("5000");
    controller.destroy();
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
      "tmhMoverPagoEnabled-toggle",
    ) as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(false);

    if (!toggle) throw new Error("No se encontro el interruptor");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));

    expect(storedValues.tmhMoverPagoEnabled).toBe(true);
    expect(
      document.getElementById("tmhMoverPagoEnabled-status")?.textContent,
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

    expect(conticaScripts).toContain("moverpago-core.js");
    expect(conticaScripts.indexOf("moverpago-core.js")).toBeLessThan(
      conticaScripts.indexOf("contica-content.js"),
    );
  });
});
