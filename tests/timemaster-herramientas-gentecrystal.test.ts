import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const requireModule = createRequire(import.meta.url);
const extensionPath = (...parts: string[]) =>
  resolve(process.cwd(), "extensions/TimeMasterHerramientas", ...parts);
const loadSuma = () => requireModule(extensionPath("sumatiempos-core.js"));
const loadMover = () => requireModule(extensionPath("moverenter-core.js"));
const loadSettings = () => requireModule(extensionPath("settings-core.js"));
const loadContent = () => requireModule(extensionPath("gentecrystal-content.js"));

function createSalesDom() {
  return new JSDOM(`<!doctype html><body>
    <section class="sales-capture">
      <input id="ticket-numbers" value="01 02 03">
      <input id="ticket-amount" value="100">
      <div id="ticket-companion-wrap">
        <input id="ticket-amount-companion" value="50">
      </div>
      <span id="total-amount">₡ 200.00</span>
      <button id="btn-submit-sale">Guardar</button>
      <button id="btn-add">Agregar</button>
      <button id="btn-clear-numbers">Limpiar</button>
    </section>
  </body>`, { pretendToBeVisual: true });
}

const settleMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

function createStorage(initial: Record<string, unknown> = {}) {
  type Listener = (
    changes: Record<string, { newValue?: unknown }>,
    areaName: string,
  ) => void;
  const listeners = new Set<Listener>();
  return {
    local: {
      get: vi.fn((_defaults, callback) => callback({ ...initial })),
    },
    onChanged: {
      addListener: vi.fn((listener: Listener) => listeners.add(listener)),
      removeListener: vi.fn((listener: Listener) => listeners.delete(listener)),
    },
    emit(changes: Record<string, { newValue?: unknown }>, areaName = "local") {
      for (const listener of listeners) listener(changes, areaName);
    },
  };
}

describe("TimeMaster Herramientas SumaTiempos", () => {
  it("calcula 3 × (100 + 50) + 200 = 650", () => {
    const { calculateTotals } = loadSuma();
    expect(
      calculateTotals({
        numbersText: "01 02 03",
        mainAmount: "100",
        companionAmount: "50",
        companionActive: true,
        ticketTotal: "200",
      }),
    ).toMatchObject({ numberCount: 3, captureTotal: 450, grandTotal: 650 });
  });

  it("interpreta formatos comunes de moneda", () => {
    const { parseCurrency, parseNumbers } = loadSuma();
    expect(parseCurrency("₡ 1.234,50")).toBe(1234.5);
    expect(parseCurrency("$1,234.50")).toBe(1234.5);
    expect(parseCurrency("2.000")).toBe(2000);
    expect(parseCurrency("sin monto")).toBe(0);
    expect(parseNumbers("01 inválido 123 7")).toEqual(["01", "7"]);
  });

  it("ignora el monto compañero oculto o deshabilitado", () => {
    const dom = createSalesDom();
    const { createSumaTiemposController } = loadSuma();
    const wrap = dom.window.document.querySelector<HTMLElement>(
      "#ticket-companion-wrap",
    )!;
    wrap.hidden = true;
    const controller = createSumaTiemposController(
      dom.window.document,
      dom.window,
    );
    controller.start();
    expect(
      dom.window.document.querySelector("[data-sumatiempos=capture-total]")
        ?.textContent,
    ).toBe("₡ 300.00");
    controller.destroy();
    dom.window.close();
  });

  it("crea un solo panel, reinicia al guardar y puede arrancar de nuevo", () => {
    const dom = createSalesDom();
    const { createSumaTiemposController } = loadSuma();
    const controller = createSumaTiemposController(
      dom.window.document,
      dom.window,
    );
    controller.start();
    controller.start();
    expect(dom.window.document.querySelectorAll("#sumatiempos-panel")).toHaveLength(1);
    expect(
      dom.window.document.querySelector("[data-sumatiempos=grand-total]")
        ?.textContent,
    ).toBe("₡ 650.00");

    dom.window.document.querySelector<HTMLButtonElement>("#btn-submit-sale")!.click();
    expect(
      dom.window.document.querySelector<HTMLElement>("#sumatiempos-panel")!
        .hidden,
    ).toBe(true);
    controller.destroy();
    expect(dom.window.document.querySelector("#sumatiempos-panel")).toBeNull();
    controller.start();
    expect(dom.window.document.querySelectorAll("#sumatiempos-panel")).toHaveLength(1);
    controller.destroy();
    dom.window.close();
  });
});

describe("TimeMaster Herramientas MoverEnter", () => {
  it("solo imprime una vez por apertura y reconoce cerrar y reabrir", async () => {
    const dom = new JSDOM(`<!doctype html><body>
      <dialog id="sales-success-dialog" open data-sales-opened-at="same">
        <button id="sales-success-dialog-print">Imprimir</button>
      </dialog>
    </body>`, { pretendToBeVisual: true });
    const button = dom.window.document.querySelector<HTMLButtonElement>("button")!;
    const clicked = vi.fn((event: Event) => event.preventDefault());
    button.addEventListener("click", clicked);
    const controller = loadMover().createMoverEnterController(dom.window.document);

    controller.start();
    expect(clicked).not.toHaveBeenCalled();
    controller.setEnabled(true);
    expect(clicked).toHaveBeenCalledTimes(1);
    button.setAttribute("title", "cambio irrelevante");
    await settleMutations();
    expect(clicked).toHaveBeenCalledTimes(1);

    const dialog = dom.window.document.querySelector("dialog")!;
    dialog.removeAttribute("open");
    await settleMutations();
    dialog.setAttribute("open", "");
    await settleMutations();
    expect(clicked).toHaveBeenCalledTimes(2);
    controller.stop();
    dom.window.close();
  });

  it("activar abierto imprime; desactivar, reactivar o reiniciar no duplica", async () => {
    const dom = new JSDOM(`<!doctype html><body>
      <dialog id="sales-success-dialog" open>
        <button id="sales-success-dialog-print">Imprimir</button>
      </dialog>
    </body>`, { pretendToBeVisual: true });
    const button = dom.window.document.querySelector<HTMLButtonElement>("button")!;
    const clicked = vi.fn((event: Event) => event.preventDefault());
    button.addEventListener("click", clicked);
    const controller = loadMover().createMoverEnterController(dom.window.document);

    controller.start();
    controller.setEnabled(true);
    controller.setEnabled(false);
    controller.setEnabled(true);
    controller.stop();
    controller.start();
    expect(clicked).toHaveBeenCalledTimes(1);
    const dialog = dom.window.document.querySelector("dialog")!;
    controller.stop();
    dialog.removeAttribute("open");
    await settleMutations();
    controller.start();
    dialog.setAttribute("open", "");
    await settleMutations();
    expect(clicked).toHaveBeenCalledTimes(2);
    controller.stop();
    dom.window.close();
  });
});

describe("TimeMaster Herramientas en Gente Crystal", () => {
  it("aplica valores iniciales y cambios independientes", () => {
    const storage = createStorage({
      tmhSumaTiemposEnabled: false,
      tmhMoverEnterEnabled: true,
    });
    const sumaController = { start: vi.fn(), destroy: vi.fn() };
    const moverController = {
      setEnabled: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const controller = loadContent().createGenteCrystalController({
      storage,
      settings: loadSettings(),
      sumaController,
      moverController,
    });

    controller.start();
    controller.start();
    expect(sumaController.destroy).toHaveBeenCalledTimes(1);
    expect(moverController.setEnabled).toHaveBeenNthCalledWith(1, true);
    expect(moverController.start).toHaveBeenCalledTimes(1);
    expect(moverController.setEnabled.mock.invocationCallOrder[0]).toBeLessThan(
      moverController.start.mock.invocationCallOrder[0],
    );
    storage.emit({ tmhSumaTiemposEnabled: { newValue: true } });
    storage.emit({ tmhMoverEnterEnabled: { newValue: false } });
    expect(sumaController.start).toHaveBeenCalledTimes(1);
    expect(moverController.setEnabled).toHaveBeenLastCalledWith(false);
    expect(moverController.stop).toHaveBeenCalledTimes(1);
    expect(storage.onChanged.addListener).toHaveBeenCalledTimes(1);

    controller.destroy();
    storage.emit({ tmhSumaTiemposEnabled: { newValue: true } });
    expect(sumaController.start).toHaveBeenCalledTimes(1);
    expect(storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });

  it("un error en una función no impide configurar la otra", () => {
    const storage = createStorage();
    const sumaController = {
      start: vi.fn(() => {
        throw new Error("fallo aislado");
      }),
      destroy: vi.fn(),
    };
    const moverController = {
      setEnabled: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const controller = loadContent().createGenteCrystalController({
      storage,
      settings: loadSettings(),
      sumaController,
      moverController,
    });

    expect(() => controller.start()).not.toThrow();
    expect(moverController.setEnabled).toHaveBeenCalledWith(false);
    expect(moverController.stop).toHaveBeenCalledTimes(1);
    controller.destroy();
    warn.mockRestore();
  });
});
