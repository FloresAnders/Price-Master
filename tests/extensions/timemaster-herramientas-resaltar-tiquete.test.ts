// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-require-imports -- Extension modules expose CommonJS test APIs. */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

const extensionDir = path.resolve("extensions/TimeMasterHerramientas");
const settings = require(path.join(extensionDir, "settings-core.js"));
const highlight = require(path.join(extensionDir, "resaltartiquete-core.js"));
const popup = require(path.join(extensionDir, "popup.js"));
const background = require(path.join(extensionDir, "background.js"));
const content = require(path.join(extensionDir, "resaltartiquete-content.js"));
const printGate = require(path.join(extensionDir, "resaltartiquete-print-gate.js"));
const fullPrint = require(path.join(extensionDir, "impresioncompleta-core.js"));
const fullPrintContent = require(path.join(
  extensionDir,
  "impresioncompleta-content.js",
));
let fullPrintGate: {
  READY_EVENT: string;
  installPrintGate: (
    windowRef: Record<string, unknown>,
    documentRef: Document,
    options?: { timeoutMs?: number },
  ) => { destroy: () => void };
} | null = null;
let printLines: {
  createLineStyleController: (
    documentRef: Document,
    options: {
      source: "ticket" | "bcr";
      onLinesChanged?: (lines: Array<{ id: string; text: string }>) => void;
    },
  ) => {
    setConfiguration: (configuration: {
      enabled: boolean;
      selectedLineIds: string[];
      font: { sizePx: number; weight: number; family: string };
    }) => void;
    start: () => void;
    stop: () => void;
    refresh: () => void;
  };
  normalizeSourceSettings: (
    source: "ticket" | "bcr",
    raw: Record<string, unknown>,
    lines: Array<{ id: string; text: string }>,
  ) => {
    enabled: boolean;
    selectedLineIds: string[];
    font: { sizePx: number; weight: number; family: string };
  };
} | null = null;
let lineConfig: {
  createLineConfigController: (
    documentRef: Document,
    chromeApi: Record<string, unknown>,
    source: "ticket" | "bcr",
  ) => { start: () => void; destroy: () => void };
} | null = null;
try {
  fullPrintGate = require(path.join(
    extensionDir,
    "impresioncompleta-print-gate.js",
  ));
} catch {
  fullPrintGate = null;
}
try {
  printLines = require(path.join(extensionDir, "lineasimpresion-core.js"));
} catch {
  printLines = null;
}
try {
  lineConfig = require(path.join(extensionDir, "lineas-config.js"));
} catch {
  lineConfig = null;
}

function loadPopupDocument() {
  const html = fs.readFileSync(path.join(extensionDir, "popup.html"), "utf8");
  const parsed = new DOMParser().parseFromString(html, "text/html");
  document.documentElement.innerHTML = parsed.documentElement.innerHTML;
  return document;
}

function createStorage(initial: Record<string, unknown> = {}) {
  const listeners = new Set<(changes: unknown, area: string) => void>();
  const setCalls: Record<string, unknown>[] = [];
  return {
    setCalls,
    local: {
      get: vi.fn((_defaults, callback) => callback(initial)),
      set: vi.fn((values, callback) => {
        setCalls.push(values);
        callback?.();
      }),
    },
    onChanged: {
      addListener: vi.fn((listener) => listeners.add(listener)),
      removeListener: vi.fn((listener) => listeners.delete(listener)),
      emit(changes: unknown) {
        for (const listener of listeners) listener(changes, "local");
      },
    },
  };
}

function createDualStorage(
  localInitial: Record<string, unknown> = {},
  sessionInitial: Record<string, unknown> = {},
) {
  const listeners = new Set<(changes: unknown, area: string) => void>();
  const localSetCalls: Record<string, unknown>[] = [];
  const sessionSetCalls: Record<string, unknown>[] = [];
  function createArea(
    initial: Record<string, unknown>,
    setCalls: Record<string, unknown>[] = [],
  ) {
    return {
      get: vi.fn((query, callback) => {
        if (query === null) {
          callback({ ...initial });
          return;
        }
        if (Array.isArray(query)) {
          callback(Object.fromEntries(
            query.filter((key) => key in initial).map((key) => [key, initial[key]]),
          ));
          return;
        }
        if (typeof query === "string") {
          callback(query in initial ? { [query]: initial[query] } : {});
          return;
        }
        callback({ ...query, ...initial });
      }),
      set: vi.fn((values, callback) => {
        Object.assign(initial, values);
        setCalls.push(values);
        callback?.();
      }),
    };
  }
  return {
    localSetCalls,
    sessionSetCalls,
    local: createArea(localInitial, localSetCalls),
    session: createArea(sessionInitial, sessionSetCalls),
    onChanged: {
      addListener: vi.fn((listener) => listeners.add(listener)),
      removeListener: vi.fn((listener) => listeners.delete(listener)),
      emit(changes: unknown, area = "local") {
        for (const listener of listeners) listener(changes, area);
      },
    },
  };
}

describe("resaltado configurable del codigo de tiquete", () => {
  test("resalta codigo fecha y sorteo con fuentes independientes", () => {
    document.body.innerHTML =
      '<b>Grupo Cafetero<br></b>44559-2204-61486297<br>Fecha: 04/11/2026<br><b>LA ANGUILA MAÑANA</b><br>Cliente: Anonimo<script>const id = "99999-9999-99999999";</script>';
    const controller = highlight.createTicketCodeController(document);

    controller.setFonts({
      code: { sizePx: 24, weight: 800, family: "Arial" },
      date: { sizePx: 18, weight: 600, family: "Verdana" },
      draw: { sizePx: 28, weight: 900, family: "Courier New" },
    });
    controller.start();

    const code = document.querySelector("[data-tmh-ticket-code]");
    const date = document.querySelector("[data-tmh-ticket-date]");
    const draw = document.querySelector("[data-tmh-ticket-draw]");
    expect(code?.textContent).toBe("44559-2204-61486297");
    expect(code?.getAttribute("style")).toContain("--tmh-ticket-font-size: 24px");
    expect(code?.getAttribute("style")).toContain("--tmh-ticket-font-weight: 800");
    expect(code?.getAttribute("style")).toContain("--tmh-ticket-font-family: Arial");
    expect(date?.textContent).toBe("Fecha: 04/11/2026");
    expect(date?.getAttribute("style")).toContain("--tmh-ticket-font-size: 18px");
    expect(date?.getAttribute("style")).toContain("--tmh-ticket-font-weight: 600");
    expect(date?.getAttribute("style")).toContain("--tmh-ticket-font-family: Verdana");
    expect(draw?.textContent).toBe("LA ANGUILA MAÑANA");
    expect(draw?.getAttribute("style")).toContain("--tmh-ticket-font-size: 28px");
    expect(draw?.getAttribute("style")).toContain("--tmh-ticket-font-weight: 900");
    expect(draw?.getAttribute("style")).toContain(
      "--tmh-ticket-font-family: Courier New",
    );

    controller.stop();

    expect(document.querySelector("[data-tmh-ticket-code]")).toBeNull();
    expect(document.querySelector("[data-tmh-ticket-date]")).toBeNull();
    expect(document.querySelector("[data-tmh-ticket-draw]")).toBeNull();
    expect(document.body.textContent).toContain("44559-2204-61486297");
  });

  test("define valores seguros y normaliza configuracion invalida", () => {
    expect(settings.DEFAULT_SETTINGS).toMatchObject({
      tmhResaltarCodigoTiqueteEnabled: false,
      tmhResaltarLineasTiqueteSelectedLineIds: [],
      tmhResaltarLineasTiqueteSelectionInitialized: false,
      tmhResaltarLineasTiqueteFontSizePx: 22,
      tmhResaltarLineasTiqueteFontWeight: 700,
      tmhResaltarLineasTiqueteFontFamily: "inherit",
      tmhResaltarCodigoTiqueteFontSizePx: 22,
      tmhResaltarCodigoTiqueteFontWeight: 700,
      tmhResaltarCodigoTiqueteFontFamily: "inherit",
      tmhResaltarFechaTiqueteFontSizePx: 22,
      tmhResaltarFechaTiqueteFontWeight: 700,
      tmhResaltarFechaTiqueteFontFamily: "inherit",
      tmhResaltarSorteoTiqueteFontSizePx: 22,
      tmhResaltarSorteoTiqueteFontWeight: 700,
      tmhResaltarSorteoTiqueteFontFamily: "inherit",
    });

    expect(
      settings.normalizeSettings({
        tmhResaltarCodigoTiqueteEnabled: true,
        tmhResaltarLineasTiqueteSelectedLineIds: [
          "ticket:date",
          44,
          "ticket:date",
          "ticket:code",
        ],
        tmhResaltarCodigoTiqueteFontSizePx: 500,
        tmhResaltarCodigoTiqueteFontWeight: 123,
        tmhResaltarCodigoTiqueteFontFamily: "Comic Sans MS",
      }),
    ).toMatchObject({
      tmhResaltarCodigoTiqueteEnabled: true,
      tmhResaltarLineasTiqueteSelectedLineIds: [
        "ticket:date",
        "ticket:code",
      ],
      tmhResaltarCodigoTiqueteFontSizePx: 22,
      tmhResaltarCodigoTiqueteFontWeight: 700,
      tmhResaltarCodigoTiqueteFontFamily: "inherit",
    });
  });

  test("detecta las tres lineas si la pagina las agrega despues de iniciar", async () => {
    document.body.innerHTML = "";
    const controller = highlight.createTicketCodeController(document);

    controller.start();
    document.body.innerHTML =
      "44559-2204-61486297<br>Fecha: 04/11/2026<br><b>LA ANGUILA MAÑANA</b>";
    await Promise.resolve();

    expect(document.querySelector("[data-tmh-ticket-code]")?.textContent).toBe(
      "44559-2204-61486297",
    );
    expect(document.querySelector("[data-tmh-ticket-date]")?.textContent).toBe(
      "Fecha: 04/11/2026",
    );
    expect(document.querySelector("[data-tmh-ticket-draw]")?.textContent).toBe(
      "LA ANGUILA MAÑANA",
    );
    controller.stop();
  });

  test("retiene window.print hasta que el resaltado confirma estar listo", () => {
    const originalPrint = vi.fn();
    const windowRef = {
      print: originalPrint,
      setTimeout,
      clearTimeout,
    };
    const gate = printGate.installPrintGate(windowRef, document, {
      timeoutMs: 3000,
    });

    windowRef.print("ticket");
    expect(originalPrint).not.toHaveBeenCalled();

    document.dispatchEvent(new CustomEvent("tmh-ticket-highlight-ready"));
    expect(originalPrint).toHaveBeenCalledOnce();
    expect(originalPrint).toHaveBeenCalledWith("ticket");
    gate.destroy();
  });

  test("contenido detecta, guarda cache de sesion y aplica solo lineas elegidas", () => {
    document.body.innerHTML =
      "NEGOCIO<br>44559-2204-61486297<br>Fecha: 04/11/2026<br><b>LA ANGUILA MAÃ‘ANA</b>";
    const storage = createDualStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhResaltarCodigoTiqueteEnabled: true,
      tmhResaltarLineasTiqueteSelectedLineIds: ["ticket:date"],
      tmhResaltarLineasTiqueteSelectionInitialized: true,
      tmhResaltarLineasTiqueteFontSizePx: 23,
      tmhResaltarLineasTiqueteFontWeight: 800,
      tmhResaltarLineasTiqueteFontFamily: "Arial",
    });
    const ready = vi.fn();
    const cacheDetectedLines = vi.fn();
    document.addEventListener("tmh-ticket-highlight-ready", ready, { once: true });
    const controller = content.createTicketHighlightContentController({
      storage,
      settings,
      printLines,
      documentRef: document,
      locationHref: "https://gentecrystal.net/print_pagos.php?id=1",
      cacheDetectedLines,
    });

    controller.start();
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(cacheDetectedLines).toHaveBeenLastCalledWith(
      "tmhDetectedPrintLinesTicket",
      [
        { id: "ticket:line:0", text: "NEGOCIO" },
        { id: "ticket:code", text: "44559-2204-61486297" },
        { id: "ticket:date", text: "Fecha: 04/11/2026" },
        { id: "ticket:draw", text: "LA ANGUILA MAÃ‘ANA" },
      ],
    );
    expect(document.querySelectorAll("[data-tmh-print-line]")).toHaveLength(1);
    const selected = document.querySelector("[data-tmh-print-line]") as HTMLElement;
    expect(selected.dataset.tmhPrintLine).toBe("ticket:date");
    expect(selected.style.fontSize).toBe("23px");
    expect(selected.style.fontWeight).toBe("800");
    expect(selected.style.fontFamily).toBe("Arial");
    expect(ready).toHaveBeenCalledOnce();
    controller.destroy();
  });

  test("reinicio ignora la respuesta pendiente del ciclo anterior", () => {
    const callbacks: Array<(value: Record<string, unknown>) => void> = [];
    const storage = createStorage();
    storage.local.get = vi.fn((_defaults, callback) => callbacks.push(callback));
    const lineStyleController = {
      start: vi.fn(),
      stop: vi.fn(),
      setConfiguration: vi.fn(),
    };
    const controller = content.createTicketHighlightContentController({
      storage,
      settings,
      printLines,
      lineStyleController,
      locationHref: "https://gentecrystal.net/print_pagos.php",
    });

    controller.start();
    controller.destroy();
    controller.start();
    lineStyleController.setConfiguration.mockClear();
    callbacks[0]({ tmhResaltarCodigoTiqueteEnabled: true });
    expect(lineStyleController.setConfiguration).not.toHaveBeenCalled();

    callbacks[1]({ tmhResaltarCodigoTiqueteEnabled: true });
    expect(lineStyleController.setConfiguration).toHaveBeenCalledTimes(1);
  });

  test("manifest carga el resaltado en print_pagos antes que el script de impresion", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"),
    );
    const entry = manifest.content_scripts.find((candidate: { js?: string[] }) =>
      candidate.js?.includes("resaltartiquete-content.js"),
    );

    expect(entry?.run_at).toBe("document_start");
    expect(entry?.matches).toEqual([
      "https://gentecrystal.net/print_pagos.php*",
    ]);
    expect(entry?.js).toEqual([
      "settings-core.js",
      "lineasimpresion-core.js",
      "lineasimpresion-content-core.js",
      "resaltartiquete-content.js",
    ]);
    expect(entry?.css).toEqual(["resaltartiquete.css"]);

    const gateEntry = manifest.content_scripts.find(
      (candidate: { js?: string[] }) =>
        candidate.js?.includes("resaltartiquete-print-gate.js"),
    );
    expect(gateEntry).toMatchObject({
      matches: ["https://gentecrystal.net/print_pagos.php*"],
      js: ["resaltartiquete-print-gate.js"],
      run_at: "document_start",
      world: "MAIN",
    });
  });
});

describe("formato completo de impresion BCR en about:blank", () => {
  test("define valores iniciales seguros solicitados", () => {
    expect(settings.DEFAULT_SETTINGS).toMatchObject({
      tmhFormatoImpresionCompletaEnabled: false,
      tmhFormatoImpresionCompletaSelectedLineIds: [],
      tmhFormatoImpresionCompletaSelectionInitialized: false,
      tmhFormatoImpresionCompletaFontSizePx: 21,
      tmhFormatoImpresionCompletaFontWeight: 900,
      tmhFormatoImpresionCompletaFontFamily: "Verdana",
    });

    expect(
      settings.normalizeSettings({
        tmhFormatoImpresionCompletaEnabled: true,
        tmhFormatoImpresionCompletaFontSizePx: 500,
        tmhFormatoImpresionCompletaFontWeight: 123,
        tmhFormatoImpresionCompletaFontFamily: "Comic Sans MS",
      }),
    ).toMatchObject({
      tmhFormatoImpresionCompletaEnabled: true,
      tmhFormatoImpresionCompletaFontSizePx: 21,
      tmhFormatoImpresionCompletaFontWeight: 900,
      tmhFormatoImpresionCompletaFontFamily: "Verdana",
    });
  });

  test("aplica una misma fuente a todo el documento y la retira al detenerse", () => {
    document.documentElement.innerHTML =
      "<head></head><body><table><tbody><tr><td><span>MONTO TOTAL</span></td></tr></tbody></table></body>";
    const controller = fullPrint.createFullPrintFontController(document);

    controller.setFont({ sizePx: 21, weight: 900, family: "Verdana" });
    controller.start();

    expect(document.documentElement.dataset.tmhFullPrintFont).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-size"),
    ).toBe("21px");
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-weight"),
    ).toBe("900");
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-family"),
    ).toBe("Verdana");
    const rule = Array.from(document.styleSheets)
      .flatMap((sheet) => Array.from(sheet.cssRules))
      .find((candidate) => candidate.cssText.includes("data-tmh-full-print-font"));
    expect(rule?.cssText).toContain("body *");

    controller.stop();
    expect(document.documentElement.dataset.tmhFullPrintFont).toBeUndefined();
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-size"),
    ).toBe("");
  });

  test("restaura el formato antes de imprimir si BCR reemplaza el documento", () => {
    document.documentElement.innerHTML =
      "<head></head><body><span>COMPROBANTE ORIGINAL</span></body>";
    const controller = fullPrint.createFullPrintFontController(document);
    controller.setFont({ sizePx: 23, weight: 800, family: "Arial" });
    controller.start();

    const replacement = document.createElement("html");
    replacement.innerHTML =
      "<head></head><body><span>COMPROBANTE BCR</span></body>";
    document.replaceChild(replacement, document.documentElement);
    window.dispatchEvent(new Event("beforeprint"));

    expect(document.documentElement.dataset.tmhFullPrintFont).toBe("true");
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-size"),
    ).toBe("23px");
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-weight"),
    ).toBe("800");
    expect(
      document.documentElement.style.getPropertyValue("--tmh-full-print-font-family"),
    ).toBe("Arial");
    expect(document.getElementById("tmh-full-print-font-style")).not.toBeNull();
    controller.stop();
  });

  test("contenido actua solo cuando la URL real es about:blank", () => {
    const storage = createStorage({
      tmhFormatoImpresionCompletaEnabled: true,
      tmhFormatoImpresionCompletaFontSizePx: 21,
      tmhFormatoImpresionCompletaFontWeight: 900,
      tmhFormatoImpresionCompletaFontFamily: "Verdana",
    });
    const lineStyleController = {
      start: vi.fn(),
      stop: vi.fn(),
      setConfiguration: vi.fn(),
    };
    const aboutBlankController =
      fullPrintContent.createFullPrintContentController({
        storage,
        settings,
        printLines,
        lineStyleController,
        locationHref: "about:blank",
      });

    aboutBlankController.start();
    expect(lineStyleController.setConfiguration).toHaveBeenCalledWith({
      enabled: true,
      selectedLineIds: [],
      font: { sizePx: 21, weight: 900, family: "Verdana" },
    });
    expect(lineStyleController.start).toHaveBeenCalledOnce();

    const normalStorage = createStorage();
    const normalController = fullPrintContent.createFullPrintContentController({
      storage: normalStorage,
      settings,
      printLines,
      lineStyleController,
      locationHref: "https://www.bcrcorresponsal.bancobcr.com/Inicio.aspx",
    });
    normalController.start();
    expect(normalStorage.local.get).not.toHaveBeenCalled();
    expect(normalStorage.onChanged.addListener).not.toHaveBeenCalled();
  });

  test("contenido anuncia formato listo solo despues de leer y aplicar storage", () => {
    let finishInitialRead: ((value: Record<string, unknown>) => void) | undefined;
    const storage = createStorage();
    storage.local.get = vi.fn((_defaults, callback) => {
      finishInitialRead = callback;
    });
    const lineStyleController = {
      start: vi.fn(),
      stop: vi.fn(),
      setConfiguration: vi.fn(),
    };
    const ready = vi.fn();
    document.addEventListener("tmh-full-print-font-ready", ready, { once: true });
    const controller = fullPrintContent.createFullPrintContentController({
      storage,
      settings,
      printLines,
      lineStyleController,
      documentRef: document,
      locationHref: "about:blank",
    });

    controller.start();
    expect(ready).not.toHaveBeenCalled();
    finishInitialRead?.({
      tmhFormatoImpresionCompletaEnabled: true,
      tmhFormatoImpresionCompletaFontSizePx: 23,
      tmhFormatoImpresionCompletaFontWeight: 800,
      tmhFormatoImpresionCompletaFontFamily: "Arial",
    });

    expect(lineStyleController.setConfiguration).toHaveBeenLastCalledWith({
      enabled: true,
      selectedLineIds: [],
      font: { sizePx: 23, weight: 800, family: "Arial" },
    });
    expect(lineStyleController.start).toHaveBeenCalledOnce();
    expect(ready).toHaveBeenCalledOnce();
    controller.destroy();
  });

  test("retiene print hasta que formato completo confirma estar listo", () => {
    expect(fullPrintGate).not.toBeNull();
    if (!fullPrintGate) return;
    const originalPrint = vi.fn();
    const windowRef = {
      print: originalPrint,
      setTimeout,
      clearTimeout,
    };
    const gate = fullPrintGate.installPrintGate(windowRef, document, {
      timeoutMs: 3000,
    });

    windowRef.print("bcr");
    expect(originalPrint).not.toHaveBeenCalled();
    document.dispatchEvent(new CustomEvent(fullPrintGate.READY_EVENT));
    expect(originalPrint).toHaveBeenCalledOnce();
    expect(originalPrint).toHaveBeenCalledWith("bcr");
    gate.destroy();
  });

  test("manifest habilita scripts en about:blank iniciado por BCR", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"),
    );
    const entry = manifest.content_scripts.find((candidate: { js?: string[] }) =>
      candidate.js?.includes("impresioncompleta-content.js"),
    );

    expect(entry).toMatchObject({
      matches: ["https://www.bcrcorresponsal.bancobcr.com/*"],
      js: [
        "settings-core.js",
        "lineasimpresion-core.js",
        "lineasimpresion-content-core.js",
        "impresioncompleta-content.js",
      ],
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true,
      run_at: "document_start",
    });

    const gateEntry = manifest.content_scripts.find(
      (candidate: { js?: string[] }) =>
        candidate.js?.includes("impresioncompleta-print-gate.js"),
    );
    expect(gateEntry).toMatchObject({
      matches: ["https://www.bcrcorresponsal.bancobcr.com/*"],
      js: ["impresioncompleta-print-gate.js"],
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true,
      run_at: "document_start",
      world: "MAIN",
    });
  });
});

describe("selector general de lineas de impresion", () => {
  test("service worker guarda texto en sesion y catalogo logico persistente", () => {
    let messageListener:
      | ((message: unknown, sender: unknown, respond: (value: unknown) => void) => boolean)
      | undefined;
    const sessionSet = vi.fn((_payload, callback) => callback?.());
    const localState = {
      tmhKnownPrintLinesBcr: [
        { id: "bcr:field:numero-de-factura", label: "NUMERO DE FACTURA" },
      ],
    };
    const localSet = vi.fn((values, callback) => {
      Object.assign(localState, values);
      callback?.();
    });
    const chromeApi = {
      runtime: {
        lastError: null,
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          }),
          removeListener: vi.fn(),
        },
      },
      storage: {
        session: { set: sessionSet },
        local: {
          get: vi.fn((defaults, callback) => callback({ ...defaults, ...localState })),
          set: localSet,
        },
      },
    };
    const controller = background.createBackgroundController(chromeApi);
    controller.start();
    const respond = vi.fn();

    expect(messageListener?.({
      type: "tmh-cache-print-lines",
      cacheKey: "tmhDetectedPrintLinesBcr",
      lines: [
        { id: "bcr:field:convenio", text: "CONVENIO: RECARGA LIBERTY" },
        { id: 4, text: "invalida" },
      ],
    }, {}, respond)).toBe(true);
    expect(sessionSet).toHaveBeenCalledWith({
      tmhDetectedPrintLinesBcr: [
        { id: "bcr:field:convenio", text: "CONVENIO: RECARGA LIBERTY" },
      ],
    }, expect.any(Function));
    expect(localSet).toHaveBeenCalledWith({
      tmhKnownPrintLinesBcr: [
        { id: "bcr:field:numero-de-factura", label: "NUMERO DE FACTURA" },
        { id: "bcr:field:convenio", label: "CONVENIO" },
      ],
    }, expect.any(Function));
    expect(respond).toHaveBeenCalledWith({ ok: true });
    expect(messageListener?.({
      type: "tmh-cache-print-lines",
      cacheKey: "clave-no-permitida",
      lines: [],
    }, {}, vi.fn())).toBe(false);
    controller.destroy();
  });

  test("detecta lineas logicas de tiquete y conserva identidad cuando cambia valor", () => {
    expect(printLines).not.toBeNull();
    if (!printLines) return;
    document.body.innerHTML =
      "NEGOCIO<br>44559-2204-61486297<br>Fecha: 04/11/2026<br><b>LA ANGUILA MAÑANA</b><br>Total: 2.000";
    const snapshots: Array<Array<{ id: string; text: string }>> = [];
    const controller = printLines.createLineStyleController(document, {
      source: "ticket",
      onLinesChanged: (lines) => snapshots.push(lines),
    });
    controller.setConfiguration({
      enabled: true,
      selectedLineIds: ["ticket:date", "ticket:line:4"],
      font: { sizePx: 23, weight: 800, family: "Arial" },
    });
    controller.start();

    expect(snapshots.at(-1)).toEqual([
      { id: "ticket:line:0", text: "NEGOCIO" },
      { id: "ticket:code", text: "44559-2204-61486297" },
      { id: "ticket:date", text: "Fecha: 04/11/2026" },
      { id: "ticket:draw", text: "LA ANGUILA MAÑANA" },
      { id: "ticket:line:4", text: "Total: 2.000" },
    ]);
    expect(
      Array.from(document.querySelectorAll("[data-tmh-print-line]"))
        .map((node) => node.getAttribute("data-tmh-print-line")),
    ).toEqual(["ticket:date", "ticket:line:4"]);
    const date = document.querySelector(
      '[data-tmh-print-line="ticket:date"]',
    ) as HTMLElement;
    expect(date.style.getPropertyValue("--tmh-line-font-size")).toBe("23px");
    expect(date.style.getPropertyValue("--tmh-line-font-weight")).toBe("800");
    expect(date.style.getPropertyValue("--tmh-line-font-family")).toBe("Arial");

    controller.stop();
    document.body.innerHTML =
      "NEGOCIO<br>44559-2204-99999999<br>Fecha: 05/11/2026<br><b>LA ANGUILA MAÑANA</b><br>Total: 5.000";
    controller.start();
    expect(snapshots.at(-1)?.map((line) => line.id)).toEqual([
      "ticket:line:0",
      "ticket:code",
      "ticket:date",
      "ticket:draw",
      "ticket:line:4",
    ]);
    controller.stop();
  });

  test("usa identidades logicas BCR y marca solo las seleccionadas", () => {
    expect(printLines).not.toBeNull();
    if (!printLines) return;
    document.body.innerHTML = `
      <div id="tablaComprobantePago">
        <span id="negocio">NOMBRE DEL NEGOCIO: DELIKOR</span>
        <span id="monto">MONTO TOTAL: 10,225.00</span>
        <span id="fecha">BCR 04/11/2026 19:41</span>
      </div>`;
    let detected: Array<{ id: string; text: string }> = [];
    const controller = printLines.createLineStyleController(document, {
      source: "bcr",
      onLinesChanged: (lines) => {
        detected = lines;
      },
    });
    controller.setConfiguration({
      enabled: true,
      selectedLineIds: ["bcr:field:monto-total"],
      font: { sizePx: 21, weight: 900, family: "Verdana" },
    });
    controller.start();

    expect(detected).toEqual([
      { id: "bcr:field:nombre-del-negocio", text: "NOMBRE DEL NEGOCIO: DELIKOR" },
      { id: "bcr:field:monto-total", text: "MONTO TOTAL: 10,225.00" },
      { id: "bcr:date", text: "BCR 04/11/2026 19:41" },
    ]);
    expect(document.querySelectorAll("[data-tmh-print-line]")).toHaveLength(1);
    expect(
      document.querySelector("[data-tmh-print-line]")?.getAttribute(
        "data-tmh-print-line",
      ),
    ).toBe("bcr:field:monto-total");
    controller.stop();
  });

  test("detecta reimpresion BCR visible dentro de tablaConcentrador", () => {
    expect(printLines).not.toBeNull();
    if (!printLines) return;
    document.body.innerHTML = `
      <div id="tablaConcentrador" hidden="hidden" style="display: block">
        <table>
          <tbody>
            <tr><td>COMPROBANTE DE PAGO</td></tr>
            <tr><td>NOMBRE DEL NEGOCIO:</td></tr>
            <tr><td>DELIKOR</td></tr>
            <tr><td>MONTO PAGADO: ........2,000.00</td></tr>
          </tbody>
        </table>
      </div>`;
    const detected: Array<Array<{ id: string; text: string }>> = [];
    const controller = printLines.createLineStyleController(document, {
      source: "bcr",
      onLinesChanged: (lines) => detected.push(lines),
    });

    controller.start();

    expect(detected.at(-1)).toEqual([
      { id: "bcr:text:comprobante-de-pago", text: "COMPROBANTE DE PAGO" },
      { id: "bcr:field:nombre-del-negocio:label", text: "NOMBRE DEL NEGOCIO:" },
      { id: "bcr:field:nombre-del-negocio:value", text: "DELIKOR" },
      { id: "bcr:field:monto-pagado", text: "MONTO PAGADO: ........2,000.00" },
    ]);
    controller.stop();
  });

  test("mantiene misma identidad CONVENIO aunque cambie su valor", () => {
    expect(printLines).not.toBeNull();
    if (!printLines) return;
    const snapshots: Array<Array<{ id: string; text: string }>> = [];
    const controller = printLines.createLineStyleController(document, {
      source: "bcr",
      onLinesChanged: (lines) => snapshots.push(lines),
    });
    document.body.innerHTML = `
      <div id="tablaConcentrador" style="display: block">
        <span>DETALLE DE PAGO</span>
        <span>CONVENIO: .............LIBERTY MOVIL</span>
      </div>`;
    controller.start();
    expect(snapshots.at(-1)?.[1].id).toBe("bcr:field:convenio");

    controller.stop();
    document.body.innerHTML = `
      <div id="tablaConcentrador" style="display: block">
        <span>DETALLE DE PAGO</span>
        <span>CONVENIO: ...........RECARGA LIBERTY</span>
      </div>`;
    controller.start();
    expect(snapshots.at(-1)?.[1].id).toBe("bcr:field:convenio");
    controller.stop();
  });

  test("migra defaults anteriores y deriva seleccion inicial por origen", () => {
    expect(printLines).not.toBeNull();
    if (!printLines) return;
    const ticketLines = [
      { id: "ticket:line:0", text: "NEGOCIO" },
      { id: "ticket:code", text: "44559-2204-61486297" },
      { id: "ticket:date", text: "Fecha: 04/11/2026" },
      { id: "ticket:draw", text: "LA ANGUILA MAÑANA" },
    ];
    expect(
      printLines.normalizeSourceSettings(
        "ticket",
        {
          tmhResaltarCodigoTiqueteEnabled: true,
          tmhResaltarCodigoTiqueteFontSizePx: 24,
          tmhResaltarCodigoTiqueteFontWeight: 800,
          tmhResaltarCodigoTiqueteFontFamily: "Arial",
          tmhResaltarLineasTiqueteSelectionInitialized: false,
        },
        ticketLines,
      ),
    ).toEqual({
      enabled: true,
      selectedLineIds: ["ticket:code", "ticket:date", "ticket:draw"],
      font: { sizePx: 24, weight: 800, family: "Arial" },
    });

    const bcrLines = [
      { id: "bcr:id:negocio", text: "NEGOCIO" },
      { id: "bcr:id:monto", text: "MONTO" },
    ];
    expect(
      printLines.normalizeSourceSettings(
        "bcr",
        {
          tmhFormatoImpresionCompletaEnabled: true,
          tmhFormatoImpresionCompletaFontSizePx: 23,
          tmhFormatoImpresionCompletaFontWeight: 800,
          tmhFormatoImpresionCompletaFontFamily: "Arial",
          tmhFormatoImpresionCompletaSelectionInitialized: false,
        },
        bcrLines,
      ),
    ).toEqual({
      enabled: true,
      selectedLineIds: ["bcr:id:negocio", "bcr:id:monto"],
      font: { sizePx: 23, weight: 800, family: "Arial" },
    });
  });

  test("popup principal abre configurador sin cambiar activacion", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhResaltarCodigoTiqueteEnabled: true,
    });
    const windowsCreate = vi.fn();
    const chromeApi = {
      storage,
      runtime: {
        lastError: null,
        getURL: (filename: string) => `chrome-extension://test/${filename}`,
      },
      windows: { create: windowsCreate },
    };
    popup.createPopupController(popupDocument, chromeApi).start();
    const toggle = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteEnabled-toggle",
    ) as HTMLInputElement;

    expect(toggle.checked).toBe(true);
    toggle.checked = false;
    toggle.dispatchEvent(new Event("change"));

    expect(toggle.checked).toBe(true);
    expect(storage.setCalls).toEqual([]);
    expect(windowsCreate).toHaveBeenCalledWith({
      url: "chrome-extension://test/lineas-config.html?source=ticket",
      type: "popup",
      width: 540,
      height: 720,
    });
  });

  test("popup principal refleja activacion guardada desde el configurador", () => {
    const popupDocument = loadPopupDocument();
    const storage = createDualStorage({
      ...settings.DEFAULT_SETTINGS,
      tmhFormatoImpresionCompletaEnabled: false,
    });
    const chromeApi = {
      storage,
      runtime: {
        lastError: null,
        getURL: (filename: string) => `chrome-extension://test/${filename}`,
      },
      windows: { create: vi.fn() },
    };
    const controller = popup.createPopupController(popupDocument, chromeApi);
    controller.start();
    const toggle = popupDocument.getElementById(
      "tmhFormatoImpresionCompletaEnabled-toggle",
    ) as HTMLInputElement;
    const status = popupDocument.getElementById(
      "tmhFormatoImpresionCompletaEnabled-status",
    ) as HTMLElement;
    expect(toggle.checked).toBe(false);
    expect(status.textContent).toBe("Desactivado");

    storage.onChanged.emit({
      tmhFormatoImpresionCompletaEnabled: {
        oldValue: false,
        newValue: true,
      },
    });

    expect(toggle.checked).toBe(true);
    expect(status.textContent).toBe("Activado");
    controller.destroy();
  });

  test("manifest usa service worker para cache de sesion", () => {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(extensionDir, "manifest.json"), "utf8"),
    );
    expect(manifest.background).toEqual({ service_worker: "background.js" });
  });

  test("configurador muestra cache, selecciona lineas y guarda cambio comun", () => {
    expect(lineConfig).not.toBeNull();
    expect(fs.existsSync(path.join(extensionDir, "lineas-config.html"))).toBe(true);
    if (!lineConfig || !fs.existsSync(path.join(extensionDir, "lineas-config.html"))) {
      return;
    }
    const html = fs.readFileSync(path.join(extensionDir, "lineas-config.html"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.documentElement.innerHTML = parsed.documentElement.innerHTML;
    const storage = createDualStorage(
      {
        tmhFormatoImpresionCompletaEnabled: true,
        tmhFormatoImpresionCompletaSelectedLineIds: ["bcr:field:convenio"],
        tmhFormatoImpresionCompletaSelectionInitialized: true,
        tmhFormatoImpresionCompletaFontSizePx: 23,
        tmhFormatoImpresionCompletaFontWeight: 800,
        tmhFormatoImpresionCompletaFontFamily: "Arial",
        tmhKnownPrintLinesBcr: [
          { id: "bcr:field:convenio", label: "CONVENIO" },
          { id: "bcr:field:numero-de-factura", label: "NUMERO DE FACTURA" },
        ],
      },
      {
        tmhDetectedPrintLinesBcr: [
          { id: "bcr:field:convenio", text: "CONVENIO: RECARGA LIBERTY" },
        ],
      },
    );
    const chromeApi = { storage, runtime: { lastError: null } };
    const controller = lineConfig.createLineConfigController(
      document,
      chromeApi,
      "bcr",
    );
    controller.start();

    const lineInputs = Array.from(
      document.querySelectorAll<HTMLInputElement>("[data-line-id]"),
    );
    expect(lineInputs.map((input) => [input.dataset.lineId, input.checked])).toEqual([
      ["bcr:field:convenio", true],
      ["bcr:field:numero-de-factura", false],
    ]);
    expect(
      Array.from(document.querySelectorAll(".line-option span")).map(
        (node) => node.textContent,
      ),
    ).toEqual([
      "CONVENIO: RECARGA LIBERTY",
      "NUMERO DE FACTURA",
    ]);
    expect(document.getElementById("lineas-config-title")?.textContent).toBe(
      "Líneas de impresión BCR",
    );
    expect((document.getElementById("lineas-config-size") as HTMLInputElement).value).toBe("23");
    expect((document.getElementById("lineas-config-weight") as HTMLSelectElement).value).toBe("800");
    expect((document.getElementById("lineas-config-family") as HTMLSelectElement).value).toBe("Arial");

    document.getElementById("lineas-config-select-all")?.click();
    (document.getElementById("lineas-config-size") as HTMLInputElement).value = "25";
    document.getElementById("lineas-config-save")?.click();

    expect(storage.localSetCalls).toEqual([{
      tmhFormatoImpresionCompletaEnabled: true,
      tmhFormatoImpresionCompletaSelectedLineIds: [
        "bcr:field:convenio",
        "bcr:field:numero-de-factura",
      ],
      tmhFormatoImpresionCompletaSelectionInitialized: true,
      tmhFormatoImpresionCompletaFontSizePx: 25,
      tmhFormatoImpresionCompletaFontWeight: 800,
      tmhFormatoImpresionCompletaFontFamily: "Arial",
    }]);
    expect(document.getElementById("lineas-config-status")?.textContent).toBe(
      "Guardado",
    );
    controller.destroy();
  });

  test("restablecer cambia borrador sin escribir storage", () => {
    expect(lineConfig).not.toBeNull();
    if (!lineConfig || !fs.existsSync(path.join(extensionDir, "lineas-config.html"))) {
      return;
    }
    const html = fs.readFileSync(path.join(extensionDir, "lineas-config.html"), "utf8");
    const parsed = new DOMParser().parseFromString(html, "text/html");
    document.documentElement.innerHTML = parsed.documentElement.innerHTML;
    const storage = createDualStorage(
      {
        tmhFormatoImpresionCompletaEnabled: true,
        tmhFormatoImpresionCompletaSelectedLineIds: [],
        tmhFormatoImpresionCompletaSelectionInitialized: true,
        tmhFormatoImpresionCompletaFontSizePx: 30,
        tmhFormatoImpresionCompletaFontWeight: 600,
        tmhFormatoImpresionCompletaFontFamily: "Courier New",
      },
      {
        tmhDetectedPrintLinesBcr: [
          { id: "bcr:id:monto", text: "MONTO TOTAL: 10,225.00" },
        ],
      },
    );
    const controller = lineConfig.createLineConfigController(
      document,
      { storage, runtime: { lastError: null } },
      "bcr",
    );
    controller.start();
    document.getElementById("lineas-config-reset")?.click();

    expect((document.getElementById("lineas-config-enabled") as HTMLInputElement).checked).toBe(true);
    expect((document.querySelector("[data-line-id]") as HTMLInputElement).checked).toBe(true);
    expect((document.getElementById("lineas-config-size") as HTMLInputElement).value).toBe("21");
    expect((document.getElementById("lineas-config-weight") as HTMLSelectElement).value).toBe("900");
    expect((document.getElementById("lineas-config-family") as HTMLSelectElement).value).toBe("Verdana");
    expect(storage.localSetCalls).toEqual([]);
    controller.destroy();
  });
});
