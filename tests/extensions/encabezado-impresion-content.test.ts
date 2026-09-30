import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const requireModule = createRequire(import.meta.url);
const corePath = resolve(
  "extensions/EncabezadoImpresion/print-core.js",
);
const tucanHtml = readFileSync(
  resolve("src/data/ImpresionTucan.md"),
  "utf8",
);
const juntaHtml = readFileSync(
  resolve("src/data/ImpresionJunta.md"),
  "utf8",
);
const settings = {
  schemaVersion: 1,
  imageDataUrl: "data:image/png;base64,iVBORw0KGgo=",
  maxCharacters: 40,
  lines: ["Paga tus servicios", "8565-5655"],
  juntaOrigin: "",
};

describe("EncabezadoImpresion print core", () => {
  it.each([
    ["Tucán", tucanHtml, "#tablaComprobantePago"],
    ["Junta", juntaHtml, ".receipt-container"],
  ])(
    "inserta imagen y líneas al inicio de %s",
    (_name, html, selector) => {
      const dom = new JSDOM(html);
      const { insertHeader, HEADER_ID } = requireModule(corePath);

      expect(insertHeader(dom.window.document, settings)).toBe(true);
      const target = dom.window.document.querySelector(selector)!;
      expect(target.firstElementChild?.id).toBe(HEADER_ID);
      expect(target.querySelectorAll(`#${HEADER_ID}`)).toHaveLength(1);
      expect(target.querySelector("img")?.getAttribute("src")).toBe(
        settings.imageDataUrl,
      );
      expect(
        [...target.querySelectorAll(".ei-line")].map(
          (node) => node.textContent,
        ),
      ).toEqual(settings.lines);

      dom.window.close();
    },
  );

  it("permanece idempotente ante activaciones concurrentes", async () => {
    const dom = new JSDOM(tucanHtml);
    const { insertHeader, HEADER_ID } = requireModule(corePath);

    await Promise.all([
      Promise.resolve().then(() =>
        insertHeader(dom.window.document, settings),
      ),
      Promise.resolve().then(() =>
        insertHeader(dom.window.document, settings),
      ),
    ]);

    expect(dom.window.document.querySelectorAll(`#${HEADER_ID}`)).toHaveLength(
      1,
    );
    dom.window.close();
  });

  it("aplica la fuente y el tamaño configurados a cada línea", () => {
    const dom = new JSDOM(tucanHtml);
    const { insertHeader } = requireModule(corePath);

    insertHeader(dom.window.document, {
      ...settings,
      lines: [
        { text: "Título", fontFamily: "Courier New", fontSize: 24 },
        { text: "Detalle", fontFamily: "Arial", fontSize: 12 },
      ],
    });

    const lines = [
      ...dom.window.document.querySelectorAll<HTMLElement>(".ei-line"),
    ];
    expect(lines.map((line) => line.textContent)).toEqual([
      "Título",
      "Detalle",
    ]);
    expect(lines[0].style.fontFamily).toContain("Courier New");
    expect(lines[0].style.fontSize).toBe("24px");
    expect(lines[1].style.fontFamily).toContain("Arial");
    expect(lines[1].style.fontSize).toBe("12px");
    dom.window.close();
  });

  it("no modifica documentos desconocidos ni crea bloques vacíos", () => {
    const unknown = new JSDOM("<main>otro sitio</main>");
    const empty = new JSDOM(tucanHtml);
    const { insertHeader } = requireModule(corePath);

    expect(insertHeader(unknown.window.document, settings)).toBe(false);
    expect(
      insertHeader(empty.window.document, {
        ...settings,
        imageDataUrl: "",
        lines: [],
      }),
    ).toBe(false);

    unknown.window.close();
    empty.window.close();
  });

  it("detecta un comprobante agregado después de document_start sin duplicarlo en beforeprint", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const { createPrintController, HEADER_ID } = requireModule(corePath);
    const storage = {
      get: vi.fn().mockResolvedValue({
        encabezadoImpresionSettingsV1: settings,
      }),
    };
    const controller = createPrintController(
      dom.window.document,
      dom.window,
      storage,
    );

    controller.start();
    const receipt = dom.window.document.createElement("div");
    receipt.id = "tablaComprobantePago";
    dom.window.document.body.append(receipt);

    await vi.waitFor(() => {
      expect(dom.window.document.querySelectorAll(`#${HEADER_ID}`)).toHaveLength(
        1,
      );
    });

    dom.window.dispatchEvent(new dom.window.Event("beforeprint"));
    await vi.waitFor(() => {
      expect(dom.window.document.querySelectorAll(`#${HEADER_ID}`)).toHaveLength(
        1,
      );
    });

    dom.window.close();
  });

  it("inserta Junta sincrónicamente en beforeprint cuando la configuración ya está cargada", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const { createPrintController, HEADER_ID } = requireModule(corePath);
    const storage = {
      get: vi.fn().mockResolvedValue({
        encabezadoImpresionSettingsV1: settings,
      }),
    };
    const controller = createPrintController(
      dom.window.document,
      dom.window,
      storage,
    );

    controller.start();
    await controller.sync();

    const receipt = dom.window.document.createElement("div");
    receipt.className = "receipt-container";
    receipt.innerHTML = `
      <div class="header-top-row"></div>
      <div class="receipt-footer"></div>
    `;
    dom.window.document.body.append(receipt);
    dom.window.dispatchEvent(new dom.window.Event("beforeprint"));

    expect(receipt.firstElementChild?.id).toBe(HEADER_ID);
    expect(storage.get).toHaveBeenCalledOnce();
    dom.window.close();
  });
});
