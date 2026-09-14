import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);

function loadCore() {
  try {
    return require("../extensions/SumaTiempos/sumatiempos-core.js");
  } catch {
    return {};
  }
}

const {
  calculateTotals,
  createSumaTiemposController,
  parseCurrency,
  parseNumbers,
} = loadCore();

function createFixture(options: { ticketTotal?: string; companionVisible?: boolean } = {}) {
  const {
    ticketTotal = "₡ 0.00",
    companionVisible = true,
  } = options;
  const dom = new JSDOM(`
    <main>
      <section class="sales-capture">
        <input id="ticket-amount" type="text">
        <div id="ticket-companion-wrap" style="display:${companionVisible ? "block" : "none"}">
          <input id="ticket-amount-companion" type="text">
        </div>
        <input id="ticket-numbers" type="text">
        <button id="btn-clear-numbers" type="button">Limpiar</button>
        <button id="btn-add" type="button">Agregar</button>
      </section>
      <footer class="sales-footer">
        <button id="btn-submit-sale" type="button">
          Ingresar venta · <span id="total-amount">${ticketTotal}</span>
        </button>
      </footer>
    </main>
  `, {
    pretendToBeVisual: true,
    url: "https://gentecrystal.net/controllers/sales/SalesController.php",
  });

  Object.defineProperty(dom.window, "innerWidth", {
    configurable: true,
    value: 1920,
  });
  const capture = dom.window.document.querySelector<HTMLElement>(".sales-capture");
  if (capture) {
    capture.getBoundingClientRect = () => ({
      bottom: 600,
      height: 250,
      left: 158,
      right: 1288,
      top: 350,
      width: 1130,
      x: 158,
      y: 350,
      toJSON: () => ({}),
    });
  }

  const controller = createSumaTiemposController?.(dom.window.document, dom.window) ?? {
    destroy() {},
    start() {},
    update() {},
  };
  return { controller, dom };
}

function setValue(dom: JSDOM, selector: string, value: string) {
  const input = dom.window.document.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`Missing input: ${selector}`);
  input.value = value;
  input.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
}

function text(dom: JSDOM, selector: string) {
  return dom.window.document.querySelector(selector)?.textContent?.trim() ?? "";
}

function flushMutations() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("SumaTiempos calculations", () => {
  test("counts valid one and two digit numbers including 00", () => {
    expect(parseNumbers?.("55  22,33; 00 | 66")).toEqual([
      "55",
      "22",
      "33",
      "00",
      "66",
    ]);
    expect(parseNumbers?.("100 foo")).toEqual([]);
  });

  test.each([
    ["₡ 1,250.50", 1250.5],
    ["1250", 1250],
    ["1.250,50", 1250.5],
    ["", 0],
    ["abc", 0],
  ])("parses currency %s", (value, expected) => {
    expect(parseCurrency?.(value)).toBe(expected);
  });

  test("combines ticket, normal and active companion amounts", () => {
    expect(calculateTotals?.({
      numbersText: "55 22 33",
      mainAmount: "100",
      companionAmount: "50",
      companionActive: true,
      ticketTotal: "₡ 200.00",
    })).toEqual({
      numberCount: 3,
      mainPerNumber: 100,
      companionPerNumber: 50,
      ticketTotal: 200,
      captureTotal: 450,
      grandTotal: 650,
    });
  });

  test("ignores a hidden companion amount", () => {
    expect(calculateTotals?.({
      numbersText: "05 06",
      mainAmount: "100",
      companionAmount: "500",
      companionActive: false,
      ticketTotal: "₡ 0.00",
    })?.grandTotal).toBe(200);
  });
});

describe("SumaTiempos DOM controller", () => {
  test("starts hidden when the ticket is empty", () => {
    const { controller, dom } = createFixture();

    controller.start();

    expect(dom.window.document.querySelector("#sumatiempos-panel")).not.toBeNull();
    expect(dom.window.document.querySelector<HTMLElement>("#sumatiempos-panel")?.hidden).toBe(true);
  });

  test("shows the live total and breakdown while typing", () => {
    const { controller, dom } = createFixture();
    controller.start();

    setValue(dom, "#ticket-amount", "100");
    setValue(dom, "#ticket-amount-companion", "50");
    setValue(dom, "#ticket-numbers", "55 22 33");

    expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 450.00");
    expect(text(dom, "[data-sumatiempos=ticket-total]")).toBe("₡ 0.00");
    expect(text(dom, "[data-sumatiempos=capture-total]")).toBe("₡ 450.00");
    expect(text(dom, "[data-sumatiempos=count]")).toBe("3 números");
  });

  test("ignores the companion input when its wrapper is hidden", () => {
    const { controller, dom } = createFixture({ companionVisible: false });
    controller.start();

    setValue(dom, "#ticket-amount", "100");
    setValue(dom, "#ticket-amount-companion", "500");
    setValue(dom, "#ticket-numbers", "05 06");

    expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 200.00");
  });

  test("keeps the amount through the real footer after Add", async () => {
    const { controller, dom } = createFixture();
    controller.start();
    setValue(dom, "#ticket-amount", "100");
    setValue(dom, "#ticket-numbers", "55 22");

    const numbers = dom.window.document.querySelector<HTMLInputElement>("#ticket-numbers");
    const total = dom.window.document.querySelector("#total-amount");
    if (!numbers || !total) throw new Error("Incomplete fixture");
    numbers.value = "";
    total.textContent = "₡ 200.00";
    await flushMutations();

    expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 200.00");
    expect(dom.window.document.querySelector<HTMLElement>("#sumatiempos-panel")?.hidden).toBe(false);
  });

  test("recalculates when a ticket line is removed", async () => {
    const { controller, dom } = createFixture({ ticketTotal: "₡ 300.00" });
    controller.start();

    const total = dom.window.document.querySelector("#total-amount");
    if (!total) throw new Error("Missing total");
    total.textContent = "₡ 100.00";
    await flushMutations();

    expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 100.00");
  });

  test("resets immediately on submit and ignores the stale footer", async () => {
    const { controller, dom } = createFixture({ ticketTotal: "₡ 300.00" });
    controller.start();

    dom.window.document.querySelector<HTMLButtonElement>("#btn-submit-sale")?.click();
    const total = dom.window.document.querySelector("#total-amount");
    if (!total) throw new Error("Missing total");
    total.textContent = "₡ 300.00";
    await flushMutations();

    expect(dom.window.document.querySelector<HTMLElement>("#sumatiempos-panel")?.hidden).toBe(true);
  });

  test("shows only a new capture while the previous footer is stale", () => {
    const { controller, dom } = createFixture({ ticketTotal: "₡ 300.00" });
    controller.start();
    dom.window.document.querySelector<HTMLButtonElement>("#btn-submit-sale")?.click();

    setValue(dom, "#ticket-amount", "100");
    setValue(dom, "#ticket-numbers", "55");

    expect(text(dom, "[data-sumatiempos=grand-total]")).toBe("₡ 100.00");
  });

  test("start is idempotent", () => {
    const { controller, dom } = createFixture();

    controller.start();
    controller.start();

    expect(dom.window.document.querySelectorAll("#sumatiempos-panel")).toHaveLength(1);
  });

  test("hides the panel while the sales capture section is absent", async () => {
    const { controller, dom } = createFixture({ ticketTotal: "₡ 300.00" });
    controller.start();

    dom.window.document.querySelector(".sales-capture")?.remove();
    await flushMutations();

    expect(dom.window.document.querySelector<HTMLElement>("#sumatiempos-panel")?.hidden).toBe(true);
  });
});

describe("SumaTiempos manifest", () => {
  test("is permissionless and limited to the sales controller", () => {
    let manifest: Record<string, unknown> = {};
    try {
      manifest = JSON.parse(readFileSync(
        new URL("../extensions/SumaTiempos/manifest.json", import.meta.url),
        "utf8",
      ));
    } catch {
      // The first TDD run reaches the assertions before the manifest exists.
    }

    expect(manifest).toMatchObject({
      manifest_version: 3,
      name: "SumaTiempos",
      version: "1.0.0",
    });
    expect(manifest.permissions).toBeUndefined();
    expect(manifest.host_permissions).toBeUndefined();
    expect(manifest.content_scripts).toEqual([{
      matches: ["https://gentecrystal.net/controllers/sales/SalesController.php*"],
      js: ["sumatiempos-core.js", "content.js"],
      css: ["content.css"],
      run_at: "document_idle",
    }]);
  });
});
