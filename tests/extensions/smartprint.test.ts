// @vitest-environment jsdom

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const extensionRoot = join(process.cwd(), "extensions/SmartPrint");

function load(relativePath: string) {
  try {
    return require(join(extensionRoot, relativePath));
  } catch {
    return null;
  }
}

const model = load("src/core/model-core.js");
const settings = load("src/core/settings-adapter.js");
const deduplication = load("src/core/job-deduplication.js");
const contica = load("src/content/providers/contica.js");
const crystal = load("src/content/providers/gentecrystal.js");
const tucan = load("src/content/providers/tucan.js");
const classifier = load("src/core/classifier.js");
const renderer = load("src/templates/renderer.js");
const contentCore = load("src/content/content-core.js");
const backgroundCore = load("src/background/background-core.js");
const popupCore = load("src/pages/popup.js");
const previewCore = load("src/pages/preview.js");

function fixture(name: string) {
  return readFileSync(
    join(process.cwd(), "tests/fixtures/smartprint", name),
    "utf8",
  );
}

function setDocument(html: string) {
  document.open();
  document.write(html);
  document.close();
}

beforeEach(() => setDocument("<!doctype html><html><body></body></html>"));

describe("SmartPrint MVP", () => {
  it("expone todos los módulos funcionales", () => {
    expect(Object.values({ model, settings, deduplication, contica, crystal, tucan, classifier, renderer }))
      .not.toContain(null);
  });

  it("extrae factura Contica desde iframe srcdoc sin ejecutar scripts", () => {
    setDocument(fixture("contica.html"));
    const result = contica.extract(document);

    expect(result.source).toBe("contica");
    expect(result.kind).toBe("invoice");
    expect(result.header.businessName).toBe("DELIKOR PALMARES");
    expect(result.documentId).toBe("00100001010000000001");
    expect(result.items).toEqual([
      { description: "Coca Cola 250 ml", quantity: "1", taxRate: "13 %", total: "300" },
    ]);
    expect(result.grandTotal).toBe("300,00");
    expect(result.sourceText).not.toContain("parent.setInvoice");
  });

  it("extrae Contica cuando encabezados y total están en filas sin thead", () => {
    setDocument(fixture("contica-flexible.html"));
    const result = contica.extract(document);

    expect(result.header.businessName).toBe("DELIKÖR - PZ (Palmares)");
    expect(result.documentId).toBe("25833729");
    expect(result.items).toEqual([
      { description: "Café frío", quantity: "2", taxRate: "13 %", total: "2.000,00" },
    ]);
    expect(result.grandTotal).toBe("2.000,00");
    expect(result.warnings).toEqual([]);
  });

  it("extrae Crystal individual interpretando monto por número", () => {
    setDocument(fixture("crystal-individual.html"));
    const result = crystal.extract(document);

    expect(result.tickets).toHaveLength(1);
    expect(result.tickets[0]).toMatchObject({
      id: "43848-2204-60880045",
      code: "031D4731",
      draw: "TICA TARDE",
      subtotal: "600",
      entries: [
        { number: "44", amount: "200" },
        { number: "53", amount: "200" },
        { number: "75", amount: "200" },
      ],
    });
    expect(result.legalNotices).toContain("Tica 1ro 80v");
    expect(result.grandTotal).toBe("600");
  });

  it("extrae Crystal consolidado con dos IDs, dos códigos y un total", () => {
    setDocument(fixture("crystal-consolidated.html"));
    const result = crystal.extract(document);

    expect(result.tickets.map((ticket: { id: string }) => ticket.id)).toEqual([
      "43848-2204-60880045",
      "43847-2204-60880046",
    ]);
    expect(result.tickets.map((ticket: { code: string }) => ticket.code)).toEqual([
      "031D4731",
      "B4A5FED8",
    ]);
    expect(result.tickets.map((ticket: { subtotal: string }) => ticket.subtotal)).toEqual(["50", "50"]);
    expect(result.grandTotal).toBe("100");
  });

  it("extrae el HTML real de Crystal con texto suelto y tickets sin etiqueta", () => {
    setDocument(fixture("crystal-real.html"));
    const classified = classifier.classifyAndExtract(document);
    const result = classified.document;

    expect(classified.recognized).toBe(true);
    expect(result.header.location).toBe("Tiempos Delikor Palmares");
    expect(result.tickets).toEqual([
      {
        id: "43844-2204-60880981",
        code: "E40A9430",
        draw: "NICA DE LA TARDE",
        date: "13/10/2026",
        entries: [{ number: "00", amount: "50" }],
        subtotal: "50",
      },
      {
        id: "43843-2204-60880983",
        code: "B3EF1AD9",
        draw: "NICA ESPECIAL TARDE",
        date: "13/10/2026",
        entries: [{ number: "00", amount: "50" }],
        subtotal: "50",
      },
    ]);
    expect(result.grandTotal).toBe("100");
    expect(result.legalNotices).toEqual(expect.arrayContaining([
      "Tica 1ro 80v",
      "Revise su tiquete",
      "7 Dias para cambio de premios",
    ]));
    expect(result.sourceText).not.toContain("Imprimir con SmartPrint");
    expect(result.warnings).toEqual([]);
  });

  it("preserva 00, 01 y centavos en Crystal", () => {
    setDocument(fixture("crystal-leading-zero.html"));
    const result = crystal.extract(document);

    expect(result.tickets[0].entries).toEqual([
      { number: "00", amount: "25,50" },
      { number: "01", amount: "25,50" },
    ]);
    expect(result.tickets[0].subtotal).toBe("51,00");
  });

  it("extrae Crystal cuando el comprobante completo viene en un pre multilinea", () => {
    setDocument(`<!doctype html><html><body><pre>GRUPO CAFETERO
Puesto: 2204
MONAZO
Tiquete: 00001-2204-00000001
Código: ABCD0001
00, 01 -> 25,50
Subtotal: 51,00
TOTAL: 51,00</pre></body></html>`);
    const result = crystal.extract(document);

    expect(result.tickets[0].entries).toEqual([
      { number: "00", amount: "25,50" },
      { number: "01", amount: "25,50" },
    ]);
    expect(result.grandTotal).toBe("51,00");
  });

  it("extrae solo el recibo Tucán activo y conserva pares adicionales", () => {
    setDocument(fixture("tucan.html"));
    const result = tucan.extract(document);

    expect(result.source).toBe("tucan");
    expect(result.header.businessName).toBe("DELIKOR PALMARES");
    expect(result.documentId).toBe("0000123456");
    expect(result.grandTotal).toBe("₡12.345,67");
    expect(result.details).toContainEqual({ label: "Convenio", value: "ICE-001" });
    expect(result.sourceText).not.toContain("OCULTA-999");
  });

  it("extrae el comprobante Tucán real aunque hidden conviva con display block", () => {
    setDocument(fixture("tucan-real.html"));
    const classified = classifier.classifyAndExtract(document);
    const result = classified.document;

    expect(classified.recognized).toBe(true);
    expect(result.header.businessName).toBe("DELIKOR");
    expect(result.header.legalName).toBe("BANCO DE COSTA RICA");
    expect(result.documentId).toBe("08527821");
    expect(result.dateTime).toBe("13/10/2026 08:52");
    expect(result.grandTotal).toBe("35,548.78");
    expect(result.details).toContainEqual({ label: "ENTIDAD", value: "ICE TELEFONICO" });
    expect(result.details).toContainEqual({ label: "PERIODO", value: "0000202609" });
    expect(result.details).toContainEqual({ label: "LECTURA ANTERIOR", value: "00000000" });
    expect(result.sourceText).not.toContain("RECIBO VIEJO");
    expect(result.warnings).toEqual([]);
  });

  it("calcula dinero sin coma flotante y marca discrepancias", () => {
    expect(model.parseMoneyToMinorUnits("₡1.234,50")).toBe("123450");
    expect(model.parseMoneyToMinorUnits("25,50")).toBe("2550");

    const value = model.validateDocument({
      source: "gentecrystal",
      kind: "lottery",
      tickets: [{ id: "1", draw: "TICA", entries: [], subtotal: "50" }],
      totals: [],
      grandTotal: "100",
    });
    expect(value.confidence).toBe("needs_review");
    expect(value.warnings[0]).toMatch(/no coincide/i);
  });

  it("clasifica por contenido y deja desconocidos en impresión original", () => {
    setDocument(fixture("crystal-individual.html"));
    expect(classifier.classifyAndExtract(document).document.source).toBe("gentecrystal");

    setDocument("<!doctype html><html><body><article>Documento libre</article></body></html>");
    const unknown = classifier.classifyAndExtract(document);
    expect(unknown.recognized).toBe(false);
    expect(unknown.canPrintOriginal).toBe(true);
  });

  it("renderiza texto hostil sin HTML ejecutable y un solo total general", () => {
    const view = renderer.createPrintView(document, {
      source: "gentecrystal",
      kind: "lottery",
      header: { businessName: '<img src=x onerror="alert(1)">' },
      tickets: [
        { id: "1", draw: "TICA", entries: [{ number: "00", amount: "50" }], subtotal: "50" },
        { id: "2", draw: "REVENTADO", entries: [{ number: "01", amount: "50" }], subtotal: "50" },
      ],
      totals: [],
      grandTotal: "100",
      warnings: [],
    }, { paperWidth: "58", header: { enabled: false, lines: [], imageDataUrl: "" } });

    expect(view.querySelector("img")).toBeNull();
    expect(view.textContent).toContain('<img src=x onerror="alert(1)">');
    expect(view.querySelectorAll("[data-smartprint-grand-total]")).toHaveLength(1);
  });

  it("mantiene estructura original Contica sin scripts cuando se solicita", () => {
    setDocument(fixture("contica.html"));
    const result = contica.extract(document);
    const view = renderer.createPrintView(document, result, {
      paperWidth: "58",
      templateMode: "original",
      header: { enabled: false, lines: [], imageDataUrl: "" },
    });

    expect(view.dataset.smartprintTemplate).toBe("original");
    expect(view.textContent).toContain("Coca Cola 250 ml");
    expect(view.querySelector("script")).toBeNull();
    expect(JSON.stringify(result.sourceBlocks)).not.toContain("parent.setInvoice");
  });

  it("lee encabezado V1 sin modificarlo y guarda SmartPrint aparte", async () => {
    const legacyValue = {
      schemaVersion: 1,
      imageDataUrl: "data:image/png;base64,AAAA",
      maxCharacters: 40,
      lines: [{ text: "Mi comercio", fontFamily: "Arial", fontSize: 14 }],
    };
    const state: Record<string, unknown> = {
      encabezadoImpresionSettingsV1: legacyValue,
    };
    const storageArea = {
      async get(keys: string[]) {
        return Object.fromEntries(keys.filter((key) => key in state).map((key) => [key, state[key]]));
      },
      async set(value: Record<string, unknown>) {
        Object.assign(state, value);
      },
    };

    const first = await settings.readSettings(storageArea);
    const second = await settings.readSettings(storageArea);
    expect(first).toEqual(second);
    expect(first.header.lines[0].text).toBe("Mi comercio");

    await settings.saveSettings(storageArea, { paperWidth: "80", header: first.header });
    expect(state.encabezadoImpresionSettingsV1).toEqual(legacyValue);
    expect((state.smartPrintSettingsV1 as { paperWidth: string }).paperWidth).toBe("80");
  });

  it("deduplica eventos automáticos pero permite reimpresión explícita", () => {
    let now = 1_000;
    const jobs = deduplication.createJobDeduplicator({ now: () => now, ttlMs: 10_000 });
    const value = { source: "tucan", documentId: "0001", grandTotal: "100" };

    expect(jobs.accept(value)).toBe(true);
    expect(jobs.accept(value)).toBe(false);
    expect(jobs.accept(value, { explicitReprint: true })).toBe(true);
    now += 10_001;
    expect(jobs.accept(value)).toBe(true);
  });

  it("usa permisos específicos y scripts en marcos relacionados", () => {
    const manifest = JSON.parse(readFileSync(join(extensionRoot, "manifest.json"), "utf8"));
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.host_permissions).not.toContain("*://*/*");
    expect(manifest.content_scripts[0]).toMatchObject({
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true,
    });
    expect(manifest.permissions).toEqual(expect.arrayContaining(["storage", "activeTab"]));
    expect(manifest.permissions).not.toContain("fontSettings");
    for (const pattern of manifest.content_scripts[0].matches) {
      expect(new URL(pattern.replace("*", "placeholder")).pathname).toBe("/placeholder");
    }
  });

  it("limita ejecución a rutas autorizadas aunque el match MV3 cubra el origen", () => {
    expect(contentCore.isAuthorizedLocation(new URL("https://contica.app/app/modules/punto_de_venta/caja"))).toBe(true);
    expect(contentCore.isAuthorizedLocation(new URL("https://contica.app/app/usuarios"))).toBe(false);
    expect(contentCore.isAuthorizedLocation(new URL("https://www.bcrcorresponsal.bancobcr.com/BCRCorresponsalesExterno/pago"))).toBe(true);
    expect(contentCore.isAuthorizedLocation(new URL("https://www.bcrcorresponsal.bancobcr.com/otro"))).toBe(false);
    expect(contentCore.isAuthorizedLocation(new URL("about:blank"))).toBe(true);
  });

  it("inyecta una sola acción SmartPrint y responde con la captura", () => {
    setDocument(fixture("crystal-individual.html"));
    const listeners: Array<(message: { type: string }, sender: unknown, respond: (value: unknown) => void) => void> = [];
    const chromeApi = {
      runtime: { onMessage: { addListener: (listener: typeof listeners[number]) => listeners.push(listener) } },
    };
    const controller = contentCore.createContentController(document, chromeApi, classifier, { isAuthorized: true });
    controller.start();
    controller.start();

    expect(document.querySelectorAll("#smartprint-page-action")).toHaveLength(1);
    let response: any;
    listeners[0]({ type: "SMARTPRINT_CAPTURE" }, {}, (value) => { response = value; });
    expect(response.ok).toBe(true);
    expect(response.result.document.source).toBe("gentecrystal");
    controller.stop();
    expect(document.getElementById("smartprint-page-action")).toBeNull();
  });

  it("no inyecta botón flotante dentro de iframes", () => {
    setDocument(fixture("crystal-individual.html"));
    const listeners: unknown[] = [];
    const chromeApi = {
      runtime: { onMessage: { addListener: (listener: unknown) => listeners.push(listener) } },
    };
    const controller = contentCore.createContentController(document, chromeApi, classifier, { isTopFrame: false, isAuthorized: true });
    controller.start();

    expect(document.getElementById("smartprint-page-action")).toBeNull();
    expect(listeners).toHaveLength(1);
    controller.stop();
  });

  it("abre vista previa guardando el trabajo solo en storage.session", async () => {
    const sessionState: Record<string, unknown> = {};
    const localWrites: unknown[] = [];
    const createdTabs: Array<{ url: string }> = [];
    const chromeApi = {
      runtime: { getURL: (path: string) => `chrome-extension://id/${path}` },
      storage: {
        session: { set: async (value: Record<string, unknown>) => Object.assign(sessionState, value) },
        local: { set: async (value: unknown) => localWrites.push(value) },
      },
      tabs: { create: async (options: { url: string }) => { createdTabs.push(options); return { id: 9 }; } },
    };

    const result = await backgroundCore.openPreview(chromeApi, {
      document: { source: "tucan", kind: "service_payment", totals: [], warnings: [] },
      recognized: true,
    }, 4, () => "job-1");

    expect(Object.keys(sessionState)).toEqual(["smartPrintJob:job-1"]);
    expect(localWrites).toEqual([]);
    expect(createdTabs[0].url).toBe("chrome-extension://id/src/pages/preview.html?job=job-1");
    expect(result.jobId).toBe("job-1");
  });

  it("rechaza trabajos excesivos y poda trabajos antiguos de sesión", async () => {
    const sessionState: Record<string, any> = {};
    for (let index = 0; index < 22; index += 1) {
      sessionState[`smartPrintJob:old-${index}`] = {
        createdAt: new Date(index * 1_000).toISOString(),
        document: { source: "generic" },
      };
    }
    const storage = {
      get: async () => ({ ...sessionState }),
      set: async (value: Record<string, unknown>) => Object.assign(sessionState, value),
      remove: async (keys: string[]) => keys.forEach((key) => delete sessionState[key]),
    };
    const chromeApi = {
      runtime: { getURL: (path: string) => path },
      storage: { session: storage },
      tabs: { create: async () => ({ id: 1 }) },
    };

    await backgroundCore.openPreview(chromeApi, {
      recognized: true,
      document: { source: "generic", kind: "other", sourceText: "ok" },
    }, 1, () => "new-job");
    expect(Object.keys(sessionState).filter((key) => key.startsWith("smartPrintJob:"))).toHaveLength(20);

    await expect(backgroundCore.openPreview(chromeApi, {
      recognized: true,
      document: { source: "generic", kind: "other", sourceText: "x".repeat(1_100_000) },
    }, 1, () => "too-big")).rejects.toThrow(/demasiado grande/i);
  });

  it("popup captura pestaña activa y solicita una sola vista previa", async () => {
    const runtimeMessages: unknown[] = [];
    const chromeApi = {
      tabs: {
        query: async () => [{ id: 7 }],
        sendMessage: async () => ({ ok: true, result: { recognized: true, document: { source: "contica" } } }),
      },
      runtime: {
        sendMessage: async (message: unknown) => { runtimeMessages.push(message); return { ok: true, jobId: "x" }; },
      },
    };

    const result = await popupCore.captureActiveTab(chromeApi);
    expect(result.jobId).toBe("x");
    expect(runtimeMessages).toEqual([{ type: "SMARTPRINT_OPEN_PREVIEW", payload: { recognized: true, document: { source: "contica" } }, sourceTabId: 7 }]);
  });

  it("carga el trabajo de vista previa por ID sin aceptar claves arbitrarias", async () => {
    const job = { document: { source: "contica" } };
    const storage = { get: async (key: string) => ({ [key]: job }) };
    await expect(previewCore.loadJob(storage, "abc-123")).resolves.toEqual(job);
    await expect(previewCore.loadJob(storage, "../local-secret")).rejects.toThrow(/identificador/i);
  });

  it("incluye popup, opciones, preview y documentación de instalación", () => {
    for (const path of [
      "src/pages/popup.html",
      "src/pages/options.html",
      "src/pages/preview.html",
      "README.md",
      "src/templates/impresion-universal.liquid",
      "src/templates/impresion-original.liquid",
    ]) {
      expect(readFileSync(join(extensionRoot, path), "utf8").length).toBeGreaterThan(40);
    }
    const optionsHtml = readFileSync(join(extensionRoot, "src/pages/options.html"), "utf8");
    expect(optionsHtml).toContain('id="profile"');
    expect(optionsHtml).toContain('id="remember-preferences"');
  });
});
