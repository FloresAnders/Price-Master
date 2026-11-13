// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-require-imports -- Extension modules expose CommonJS test APIs. */

import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";

const extensionDir = path.resolve("extensions/TimeMasterHerramientas");
const settings = require(path.join(extensionDir, "settings-core.js"));
const popup = require(path.join(extensionDir, "popup.js"));
const contica = require(path.join(extensionDir, "contica-content.js"));
let modalPago: {
  createPaymentModalController: (
    documentRef: Document,
    options?: {
      createResizeObserver?: (
        callback: (entries: Array<{ contentRect: { width: number; height: number } }>) => void,
      ) => { observe: (target: Element) => void; disconnect: () => void };
      onSizeChange?: (size: { widthPx: number; heightPx: number }) => void;
      measureDialog?: (dialog: Element) => { width: number; height: number };
      measureInput?: (dialog: Element) => { height: number; fontSizePx: number };
    },
  ) => {
    start: () => void;
    stop: () => void;
    setTextScaleEnabled: (enabled: boolean) => void;
    setInputScaleEnabled: (enabled: boolean) => void;
    setTextFontSizePx: (sizePx: number) => void;
    setInputHeightLevel: (level: string) => void;
    setResizeEnabled: (enabled: boolean) => void;
    setCurrencyFormatEnabled: (enabled: boolean) => void;
    setSavedSize: (size: { widthPx: number; heightPx: number }) => void;
  };
} | null = null;
let modalPagoFormatPage: {
  SETTING_EVENT: string;
  createCurrencyFormatController: (
    windowRef: Window,
    documentRef: Document,
  ) => { start: () => void; stop: () => void };
} | null = null;

try {
  modalPago = require(path.join(extensionDir, "modalpago-core.js"));
} catch {
  modalPago = null;
}

try {
  modalPagoFormatPage = require(
    path.join(extensionDir, "modalpago-format-page.js"),
  );
} catch {
  modalPagoFormatPage = null;
}

function loadPaymentModal() {
  const html = fs.readFileSync(path.resolve("data/MODAL.md"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.innerHTML = parsed.documentElement.innerHTML;
}

function loadPopupDocument() {
  const html = fs.readFileSync(path.join(extensionDir, "popup.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.innerHTML = parsed.documentElement.innerHTML;
  return document;
}

function createStorage(initial: Record<string, unknown> = {}) {
  const listeners = new Set<(changes: Record<string, unknown>, area: string) => void>();
  const setCalls: Record<string, unknown>[] = [];
  let getCallback: ((stored: Record<string, unknown>) => void) | null = null;
  return {
    setCalls,
    local: {
      get: vi.fn((_defaults, callback) => {
        getCallback = callback;
      }),
      set: vi.fn((values, callback) => {
        Object.assign(initial, values);
        setCalls.push(values);
        callback?.();
      }),
    },
    onChanged: {
      addListener: vi.fn((listener) => listeners.add(listener)),
      removeListener: vi.fn((listener) => listeners.delete(listener)),
      emit(changes: Record<string, unknown>) {
        for (const listener of listeners) listener(changes, "local");
      },
    },
    finishGet(values = initial) {
      getCallback?.({ ...values });
    },
  };
}

describe("modal de monto de pago de Contica", () => {
  beforeEach(() => {
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  test("expone el controlador que modifica el modal actual", () => {
    expect(modalPago).not.toBeNull();
  });

  test("expone el formateador que corre en el mismo mundo JavaScript de Contica", () => {
    expect(modalPagoFormatPage).not.toBeNull();
  });

  test("el formateador MAIN muestra 1 000 pero Contica recibe 1000", () => {
    if (!modalPagoFormatPage) return;
    loadPaymentModal();
    const controller = modalPagoFormatPage.createCurrencyFormatController(
      window,
      document,
    );
    controller.start();
    document.dispatchEvent(
      new CustomEvent(modalPagoFormatPage.SETTING_EVENT, {
        detail: { enabled: true },
      }),
    );
    const cashCrc = document.getElementById("payCRC") as HTMLInputElement;
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    let amountSeenByContica = 0;
    cashCrc.addEventListener("input", () => {
      amountSeenByContica = Number.parseFloat(cashCrc.value);
    });

    valueDescriptor?.set?.call(cashCrc, "1000");
    cashCrc.dispatchEvent(new Event("input", { bubbles: true }));

    expect(amountSeenByContica).toBe(1000);
    expect(cashCrc.value).toBe("1000");
    expect(valueDescriptor?.get?.call(cashCrc)).toBe("1 000");
    controller.stop();
  });

  test("agranda texto e inputs solamente mientras sus opciones estan activas", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;
    const controller = modalPago.createPaymentModalController(document);

    controller.setTextScaleEnabled(true);
    controller.setInputScaleEnabled(true);
    controller.start();

    expect(dialog.classList.contains("tmh-payment-modal--large-text")).toBe(true);
    expect(dialog.classList.contains("tmh-payment-modal--large-inputs")).toBe(true);

    controller.setTextScaleEnabled(false);
    controller.setInputScaleEnabled(false);
    expect(dialog.classList.contains("tmh-payment-modal--large-text")).toBe(false);
    expect(dialog.classList.contains("tmh-payment-modal--large-inputs")).toBe(false);
    controller.stop();
  });

  test("resalta Faltante negativo con rojo intenso", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const style = document.createElement("style");
    style.textContent = fs.readFileSync(
      path.join(extensionDir, "contica-content.css"),
      "utf8",
    );
    document.head.append(style);
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;
    const changeRow = dialog.querySelector(".pv-pay__change") as HTMLElement;
    const label = changeRow.querySelector(".pv-pay__label") as HTMLElement;
    const symbol = changeRow.querySelector(".pv-pay__symbol") as HTMLElement;
    const amount = changeRow.querySelector(".pv-pay__figure--change") as HTMLElement;
    label.textContent = "Faltante";
    amount.textContent = "-99.00";

    const controller = modalPago.createPaymentModalController(document);
    controller.setTextScaleEnabled(true);
    expect(dialog.classList.contains("tmh-payment-modal--shortfall")).toBe(false);
    controller.start();

    expect(dialog.classList.contains("tmh-payment-modal--shortfall")).toBe(true);
    expect(getComputedStyle(label).color).toBe("rgb(255, 51, 71)");
    expect(getComputedStyle(symbol).color).toBe("rgb(255, 51, 71)");
    expect(getComputedStyle(amount).fontWeight).toBe("800");
    controller.stop();
  });

  test("quita el rojo intenso cuando Faltante cambia a Vuelto", async () => {
    if (!modalPago) return;
    loadPaymentModal();
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;
    const label = dialog.querySelector(".pv-pay__change .pv-pay__label") as HTMLElement;
    const amount = dialog.querySelector(".pv-pay__figure--change") as HTMLElement;
    label.textContent = "Faltante";
    amount.textContent = "-99.00";
    const controller = modalPago.createPaymentModalController(document);
    controller.start();
    expect(dialog.classList.contains("tmh-payment-modal--shortfall")).toBe(true);

    label.textContent = "Vuelto";
    amount.textContent = "0.00";
    await Promise.resolve();

    expect(dialog.classList.contains("tmh-payment-modal--shortfall")).toBe(false);
    controller.stop();
  });

  test("aplica el tamano de fuente y los tres niveles de altura configurables", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;
    const controller = modalPago.createPaymentModalController(document);

    controller.setTextFontSizePx(24);
    controller.setInputHeightLevel("muy-alto");
    controller.setTextScaleEnabled(true);
    controller.setInputScaleEnabled(true);
    controller.start();

    expect(dialog.style.getPropertyValue("--tmh-payment-modal-effective-font-size")).toBe(
      "24px",
    );
    expect(
      dialog.style.getPropertyValue("--tmh-payment-modal-effective-input-height"),
    ).toBe("64px");
    expect(dialog.dataset.tmhInputHeightLevel).toBe("muy-alto");

    controller.setInputHeightLevel("normal");
    expect(dialog.dataset.tmhInputHeightLevel).toBe("normal");
    controller.stop();
  });

  test("formatea montos CRC sin entregar espacios al manejador de Contica", async () => {
    if (!modalPago) return;
    loadPaymentModal();
    const controller = modalPago.createPaymentModalController(document);
    controller.setCurrencyFormatEnabled(true);
    controller.start();

    const cashCrc = document.getElementById("payCRC") as HTMLInputElement;
    const cashUsd = document.getElementById("payUSD") as HTMLInputElement;
    const card = document.getElementById("pay-card") as HTMLInputElement;
    const voucher = document.getElementById("pay-card-voucher") as HTMLInputElement;
    const nativeValueGetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )?.get;
    let valueSeenByContica = "";
    cashCrc.addEventListener("input", () => {
      valueSeenByContica = cashCrc.value;
    });

    cashCrc.value = "1234.50";
    cashCrc.dispatchEvent(new Event("input", { bubbles: true }));
    expect(valueSeenByContica).toBe("1234.50");
    await Promise.resolve();
    card.value = "1234567";
    card.dispatchEvent(new Event("input", { bubbles: true }));
    await Promise.resolve();
    cashUsd.value = "1234";
    cashUsd.dispatchEvent(new Event("input", { bubbles: true }));
    voucher.value = "1234";
    voucher.dispatchEvent(new Event("input", { bubbles: true }));

    expect(cashCrc.value).toBe("1234.50");
    expect(nativeValueGetter?.call(cashCrc)).toBe("1 234.50");
    expect(card.value).toBe("1000000");
    expect(nativeValueGetter?.call(card)).toBe("1 000 000");
    expect(cashUsd.value).toBe("1234");
    expect(voucher.value).toBe("1234");

    controller.stop();
    expect(cashCrc.value).toBe("1234.50");
    expect(nativeValueGetter?.call(cashCrc)).toBe("1234.50");
  });

  test("Contica recibe 1000 durante el evento aunque el campo muestre 1 000", async () => {
    if (!modalPago) return;
    loadPaymentModal();
    const controller = modalPago.createPaymentModalController(document);
    controller.setCurrencyFormatEnabled(true);
    controller.start();
    const cashCrc = document.getElementById("payCRC") as HTMLInputElement;
    const valueDescriptor = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    );
    let amountSeenByContica = 0;
    cashCrc.addEventListener("input", () => {
      amountSeenByContica = Number.parseFloat(
        String(valueDescriptor?.get?.call(cashCrc)),
      );
    });

    valueDescriptor?.set?.call(cashCrc, "1000");
    cashCrc.dispatchEvent(new Event("input", { bubbles: true }));

    expect(amountSeenByContica).toBe(1000);
    await Promise.resolve();
    expect(valueDescriptor?.get?.call(cashCrc)).toBe("1 000");
    expect(cashCrc.value).toBe("1000");
    controller.stop();
  });

  test("conserva expresiones de division para que la otra herramienta pueda resolverlas", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const controller = modalPago.createPaymentModalController(document);
    controller.setCurrencyFormatEnabled(true);
    controller.start();
    const cashCrc = document.getElementById("payCRC") as HTMLInputElement;

    cashCrc.value = "7500/2";
    cashCrc.dispatchEvent(new Event("input", { bubbles: true }));

    expect(cashCrc.value).toBe("7500/2");
    controller.stop();
  });

  test("aplica el tamano guardado y reporta un cambio hecho desde la esquina", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const resizeCallbacks: Array<
      (entries: Array<{ contentRect: { width: number; height: number } }>) => void
    > = [];
    const observe = vi.fn();
    const disconnect = vi.fn();
    const onSizeChange = vi.fn();
    const controller = modalPago.createPaymentModalController(document, {
      createResizeObserver(callback) {
        resizeCallbacks.push(callback);
        return { observe, disconnect };
      },
      onSizeChange,
    });

    controller.setSavedSize({ widthPx: 640, heightPx: 720 });
    controller.setResizeEnabled(true);
    controller.start();
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;

    expect(dialog.classList.contains("tmh-payment-modal--resizable")).toBe(true);
    expect(dialog.style.width).toBe("640px");
    expect(dialog.style.height).toBe("720px");
    expect(observe).toHaveBeenCalledWith(dialog);

    resizeCallbacks[0]([{ contentRect: { width: 700, height: 760 } }]);
    expect(onSizeChange).toHaveBeenCalledWith({ widthPx: 700, heightPx: 760 });

    controller.stop();
    expect(dialog.classList.contains("tmh-payment-modal--resizable")).toBe(false);
    expect(dialog.style.width).toBe("");
    expect(dialog.style.height).toBe("");
    expect(disconnect).toHaveBeenCalled();
  });

  test("redimensionar aumenta texto y campos en la misma proporcion", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const resizeCallbacks: Array<
      (entries: Array<{ contentRect: { width: number; height: number } }>) => void
    > = [];
    const controller = modalPago.createPaymentModalController(document, {
      createResizeObserver(callback) {
        resizeCallbacks.push(callback);
        return { observe() {}, disconnect() {} };
      },
      measureDialog: () => ({ width: 500, height: 600 }),
      measureInput: () => ({ height: 40, fontSizePx: 14 }),
    });
    controller.setResizeEnabled(true);
    controller.start();
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;

    resizeCallbacks[0]([{ contentRect: { width: 750, height: 900 } }]);

    expect(dialog.style.getPropertyValue("--tmh-payment-modal-resize-font-size")).toBe(
      "150%",
    );
    expect(
      dialog.style.getPropertyValue("--tmh-payment-modal-effective-input-height"),
    ).toBe("60px");
    expect(dialog.style.getPropertyValue("--tmh-payment-modal-input-font-size")).toBe(
      "21px",
    );
    controller.stop();
  });

  test("aumentar solo la altura tambien escala texto y campos", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const resizeCallbacks: Array<
      (entries: Array<{ contentRect: { width: number; height: number } }>) => void
    > = [];
    const controller = modalPago.createPaymentModalController(document, {
      createResizeObserver(callback) {
        resizeCallbacks.push(callback);
        return { observe() {}, disconnect() {} };
      },
      measureDialog: () => ({ width: 500, height: 600 }),
      measureInput: () => ({ height: 40, fontSizePx: 14 }),
    });
    controller.setResizeEnabled(true);
    controller.start();
    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;

    resizeCallbacks[0]([{ contentRect: { width: 500, height: 1200 } }]);

    expect(dialog.style.getPropertyValue("--tmh-payment-modal-resize-font-size")).toBe(
      "150%",
    );
    expect(
      dialog.style.getPropertyValue("--tmh-payment-modal-effective-input-height"),
    ).toBe("60px");
    expect(dialog.style.getPropertyValue("--tmh-payment-modal-input-font-size")).toBe(
      "21px",
    );
    controller.stop();
  });

  test("el contenido y las filas llenan verticalmente el modal redimensionado", () => {
    if (!modalPago) return;
    loadPaymentModal();
    const style = document.createElement("style");
    style.textContent = fs.readFileSync(
      path.join(extensionDir, "contica-content.css"),
      "utf8",
    );
    document.head.append(style);
    const controller = modalPago.createPaymentModalController(document);
    controller.setResizeEnabled(true);
    controller.start();

    const dialog = document.querySelector(".modal-dialog.modal-pago-w") as HTMLElement;
    const content = dialog.querySelector(":scope > .modal-content") as HTMLElement;
    const body = dialog.querySelector(".pv-pay__body") as HTMLElement;
    const form = body.querySelector(":scope > form") as HTMLElement;
    const sheet = form.querySelector(".pv-pay__sheet") as HTMLElement;
    const methods = sheet.querySelector(".pv-pay__methods") as HTMLElement;
    const row = methods.querySelector(":scope > .pv-pay__row") as HTMLElement;

    expect(getComputedStyle(content).display).toBe("flex");
    expect(getComputedStyle(content).flexDirection).toBe("column");
    expect(getComputedStyle(body).flexGrow).toBe("1");
    expect(getComputedStyle(form).display).toBe("flex");
    expect(getComputedStyle(sheet).flexGrow).toBe("1");
    expect(getComputedStyle(methods).display).toBe("flex");
    expect(getComputedStyle(methods).justifyContent).toBe("space-evenly");
    expect(getComputedStyle(row).flexGrow).toBe("1");
    controller.stop();
  });

  test("guarda todas las opciones desactivadas y dimensiones sin seleccionar", () => {
    expect(settings.DEFAULT_SETTINGS).toMatchObject({
      tmhModalPagoEnabled: false,
      tmhModalPagoTextoGrandeEnabled: false,
      tmhModalPagoInputsGrandesEnabled: false,
      tmhModalPagoRedimensionarEnabled: false,
      tmhModalPagoFormatoColonesEnabled: false,
      tmhModalPagoFontSizePx: 18,
      tmhModalPagoInputHeightLevel: "alto",
      tmhModalPagoWidthPx: 0,
      tmhModalPagoHeightPx: 0,
    });
    expect(
      settings.normalizeSettings({
        tmhModalPagoEnabled: true,
        tmhModalPagoWidthPx: 640,
        tmhModalPagoHeightPx: 720,
        tmhModalPagoFontSizePx: 24,
        tmhModalPagoInputHeightLevel: "muy-alto",
      }),
    ).toMatchObject({
      tmhModalPagoEnabled: true,
      tmhModalPagoWidthPx: 640,
      tmhModalPagoHeightPx: 720,
      tmhModalPagoFontSizePx: 24,
      tmhModalPagoInputHeightLevel: "muy-alto",
    });
    expect(
      settings.normalizeSettings({
        tmhModalPagoFontSizePx: 99,
        tmhModalPagoInputHeightLevel: "gigante",
      }),
    ).toMatchObject({
      tmhModalPagoFontSizePx: 18,
      tmhModalPagoInputHeightLevel: "alto",
    });
  });

  test("muestra la lista y habilita sus interruptores solo con la principal activa", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: false,
      tmhModalPagoTextoGrandeEnabled: true,
    });
    const chromeApi = {
      storage,
      runtime: { lastError: null },
      windows: { create: vi.fn() },
    };
    popup.createPopupController(popupDocument, chromeApi).start();
    storage.finishGet();

    const panel = popupDocument.getElementById("tmhModalPago-options") as HTMLElement;
    const master = popupDocument.getElementById(
      "tmhModalPagoEnabled-toggle",
    ) as HTMLInputElement;
    const child = popupDocument.getElementById(
      "tmhModalPagoTextoGrandeEnabled-toggle",
    ) as HTMLInputElement;

    expect(panel.hidden).toBe(true);
    expect(child.checked).toBe(true);
    expect(child.disabled).toBe(true);

    master.checked = true;
    master.dispatchEvent(new Event("change"));
    expect(storage.setCalls).toContainEqual({ tmhModalPagoEnabled: true });
    expect(panel.hidden).toBe(false);
    expect(child.disabled).toBe(false);
  });

  test("guarda el tamano de fuente y el nivel de altura desde la lista", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: true,
      tmhModalPagoTextoGrandeEnabled: true,
      tmhModalPagoInputsGrandesEnabled: true,
    });
    const chromeApi = {
      storage,
      runtime: { lastError: null },
      windows: { create: vi.fn() },
    };
    popup.createPopupController(popupDocument, chromeApi).start();
    storage.finishGet();
    const fontSize = popupDocument.getElementById(
      "tmhModalPagoFontSizePx-input",
    ) as HTMLInputElement;
    const inputHeight = popupDocument.getElementById(
      "tmhModalPagoInputHeightLevel-input",
    ) as HTMLSelectElement;

    expect(fontSize.disabled).toBe(false);
    expect(fontSize.value).toBe("18");
    expect(inputHeight.disabled).toBe(false);
    expect(inputHeight.value).toBe("alto");

    fontSize.value = "24";
    fontSize.dispatchEvent(new Event("change"));
    inputHeight.value = "muy-alto";
    inputHeight.dispatchEvent(new Event("change"));

    expect(storage.setCalls).toContainEqual({ tmhModalPagoFontSizePx: 24 });
    expect(storage.setCalls).toContainEqual({
      tmhModalPagoInputHeightLevel: "muy-alto",
    });
  });

  test("una lectura inicial atrasada no revierte la opcion principal recien activada", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: false,
    });
    const chromeApi = {
      storage,
      runtime: { lastError: null },
      windows: { create: vi.fn() },
    };
    popup.createPopupController(popupDocument, chromeApi).start();
    const master = popupDocument.getElementById(
      "tmhModalPagoEnabled-toggle",
    ) as HTMLInputElement;

    master.checked = true;
    master.dispatchEvent(new Event("change"));
    storage.finishGet({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: false,
    });

    expect(master.checked).toBe(true);
    expect(
      (popupDocument.getElementById("tmhModalPago-options") as HTMLElement).hidden,
    ).toBe(false);
  });

  test("el controlador Contica evita que una lectura inicial vieja revierta la activacion", () => {
    const storage = createStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: false,
    });
    const paymentModalController = {
      start: vi.fn(),
      stop: vi.fn(),
      setTextScaleEnabled: vi.fn(),
      setInputScaleEnabled: vi.fn(),
      setTextFontSizePx: vi.fn(),
      setInputHeightLevel: vi.fn(),
      setResizeEnabled: vi.fn(),
      setCurrencyFormatEnabled: vi.fn(),
      setSavedSize: vi.fn(),
    };
    const controller = contica.createConticaController({
      storage,
      tabController: { start() {}, stop() {} },
      paymentModalController,
      settings,
    });
    controller.start();

    storage.onChanged.emit({
      tmhModalPagoEnabled: { oldValue: false, newValue: true },
    });
    storage.finishGet({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: false,
    });

    expect(paymentModalController.start).toHaveBeenCalledTimes(1);
    expect(paymentModalController.stop).not.toHaveBeenCalled();
    controller.destroy();
  });

  test("envia el formato CRC al puente MAIN y no al controlador aislado", () => {
    const storage = createStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhModalPagoEnabled: true,
      tmhModalPagoFormatoColonesEnabled: true,
    });
    const paymentModalController = {
      start: vi.fn(),
      stop: vi.fn(),
      setTextScaleEnabled: vi.fn(),
      setInputScaleEnabled: vi.fn(),
      setTextFontSizePx: vi.fn(),
      setInputHeightLevel: vi.fn(),
      setResizeEnabled: vi.fn(),
      setCurrencyFormatEnabled: vi.fn(),
      setSavedSize: vi.fn(),
    };
    const paymentModalFormatBridge = { setEnabled: vi.fn() };
    const controller = contica.createConticaController({
      storage,
      tabController: { start() {}, stop() {} },
      paymentModalController,
      paymentModalFormatBridge,
      settings,
    });
    controller.start();
    storage.finishGet();

    expect(paymentModalFormatBridge.setEnabled).toHaveBeenCalledWith(true);
    expect(paymentModalController.setCurrencyFormatEnabled).not.toHaveBeenCalled();
    controller.destroy();
  });

  test("manifest carga el nucleo del modal antes del controlador Contica", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"),
    );
    const entry = manifest.content_scripts.find((candidate: { js?: string[] }) =>
      candidate.js?.includes("contica-content.js"),
    );
    expect(entry.js.indexOf("modalpago-core.js")).toBeGreaterThan(-1);
    expect(entry.js.indexOf("modalpago-core.js")).toBeLessThan(
      entry.js.indexOf("contica-content.js"),
    );
  });

  test("manifest carga el formateador CRC en MAIN world", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"),
    );
    const entry = manifest.content_scripts.find(
      (candidate: { js?: string[]; world?: string }) =>
        candidate.world === "MAIN" &&
        candidate.js?.includes("modalpago-format-page.js"),
    );
    expect(entry).toBeDefined();
  });
});
