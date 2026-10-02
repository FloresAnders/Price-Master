import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

type PrintInvoiceCloser = {
  start: () => void;
  stop: () => void;
};

type PrintInvoiceCore = {
  createPrintInvoiceCloser: (document: Document) => PrintInvoiceCloser;
};

const requireModule = createRequire(import.meta.url);
const corePath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/cerrarimpresioncontica-core.js",
);

function createOpenModal() {
  return new JSDOM(openModalMarkup);
}

const openModalMarkup = `
    <div id="printInvoice" class="modal in" aria-modal="true" style="display: block">
      <button class="btn btn-danger esc-button" data-dismiss="modal">X [ESC]</button>
    </div>
  `;

afterEach(() => {
  vi.useRealTimers();
});

describe("TimeMaster Herramientas cierre de impresión en Contica", () => {
  it("pulsa X una vez solo al completar cinco segundos desde la apertura", () => {
    vi.useFakeTimers();
    const dom = createOpenModal();
    const { createPrintInvoiceCloser } = requireModule(corePath) as PrintInvoiceCore;
    const closeButton = dom.window.document.querySelector(".esc-button")!;
    let clicks = 0;
    closeButton.addEventListener("click", () => {
      clicks += 1;
    });
    const controller = createPrintInvoiceCloser(dom.window.document);

    controller.start();
    vi.advanceTimersByTime(4_999);
    expect(clicks).toBe(0);

    vi.advanceTimersByTime(1);
    expect(clicks).toBe(1);

    vi.advanceTimersByTime(5_000);
    expect(clicks).toBe(1);

    controller.stop();
    dom.window.close();
  });

  it("empieza la espera cuando el modal aparece después de iniciar", async () => {
    vi.useFakeTimers();
    const dom = new JSDOM("<main></main>");
    const { createPrintInvoiceCloser } = requireModule(corePath) as PrintInvoiceCore;
    const controller = createPrintInvoiceCloser(dom.window.document);
    controller.start();
    vi.advanceTimersByTime(2_000);

    dom.window.document.body.insertAdjacentHTML("beforeend", openModalMarkup);
    await Promise.resolve();
    const closeButton = dom.window.document.querySelector(".esc-button")!;
    let clicks = 0;
    closeButton.addEventListener("click", () => {
      clicks += 1;
    });

    vi.advanceTimersByTime(4_999);
    expect(clicks).toBe(0);
    vi.advanceTimersByTime(1);
    expect(clicks).toBe(1);

    controller.stop();
    dom.window.close();
  });

  it("cancela el cierre si el modal desaparece y cuenta de nuevo al reabrirse", async () => {
    vi.useFakeTimers();
    const dom = createOpenModal();
    const { createPrintInvoiceCloser } = requireModule(corePath) as PrintInvoiceCore;
    const modal = dom.window.document.getElementById("printInvoice")!;
    const closeButton = dom.window.document.querySelector(".esc-button")!;
    let clicks = 0;
    closeButton.addEventListener("click", () => {
      clicks += 1;
    });
    const controller = createPrintInvoiceCloser(dom.window.document);
    controller.start();

    vi.advanceTimersByTime(2_000);
    modal.classList.remove("in");
    modal.setAttribute("aria-modal", "false");
    modal.setAttribute("aria-hidden", "true");
    modal.style.display = "none";
    await Promise.resolve();
    vi.advanceTimersByTime(5_000);
    expect(clicks).toBe(0);

    modal.classList.add("in");
    modal.setAttribute("aria-modal", "true");
    modal.removeAttribute("aria-hidden");
    modal.style.display = "block";
    await Promise.resolve();
    vi.advanceTimersByTime(4_999);
    expect(clicks).toBe(0);
    vi.advanceTimersByTime(1);
    expect(clicks).toBe(1);

    controller.stop();
    dom.window.close();
  });

  it("cancela cualquier espera pendiente al desactivarse", () => {
    vi.useFakeTimers();
    const dom = createOpenModal();
    const { createPrintInvoiceCloser } = requireModule(corePath) as PrintInvoiceCore;
    const closeButton = dom.window.document.querySelector(".esc-button")!;
    let clicks = 0;
    closeButton.addEventListener("click", () => {
      clicks += 1;
    });
    const controller = createPrintInvoiceCloser(dom.window.document);

    controller.start();
    vi.advanceTimersByTime(4_999);
    controller.stop();
    vi.advanceTimersByTime(10_000);

    expect(clicks).toBe(0);
    dom.window.close();
  });
});
