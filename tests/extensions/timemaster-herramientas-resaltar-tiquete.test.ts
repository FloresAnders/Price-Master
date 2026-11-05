// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-require-imports -- Extension modules expose CommonJS test APIs. */

import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";

const extensionDir = path.resolve("extensions/TimeMasterHerramientas");
const settings = require(path.join(extensionDir, "settings-core.js"));
const highlight = require(path.join(extensionDir, "resaltartiquete-core.js"));
const popup = require(path.join(extensionDir, "popup.js"));
const content = require(path.join(extensionDir, "resaltartiquete-content.js"));
const printGate = require(path.join(extensionDir, "resaltartiquete-print-gate.js"));
const fullPrint = require(path.join(extensionDir, "impresioncompleta-core.js"));
const fullPrintContent = require(path.join(
  extensionDir,
  "impresioncompleta-content.js",
));

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
        tmhResaltarCodigoTiqueteFontSizePx: 500,
        tmhResaltarCodigoTiqueteFontWeight: 123,
        tmhResaltarCodigoTiqueteFontFamily: "Comic Sans MS",
      }),
    ).toMatchObject({
      tmhResaltarCodigoTiqueteEnabled: true,
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

  test("popup guarda toda la configuracion solo al pulsar Guardar", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage();
    const chromeApi = { storage, runtime: { lastError: null } };
    popup.createPopupController(popupDocument, chromeApi).start();

    const toggle = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteEnabled-toggle",
    ) as HTMLInputElement;
    const size = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteFontSizePx-input",
    ) as HTMLInputElement;
    const weight = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteFontWeight-input",
    ) as HTMLSelectElement;
    const family = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteFontFamily-input",
    ) as HTMLSelectElement;
    const save = popupDocument.getElementById(
      "tmhResaltarCodigoTiquete-save",
    ) as HTMLButtonElement;
    const status = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteFont-status",
    ) as HTMLElement;
    const settingsPanel = popupDocument.getElementById(
      "tmhResaltarLineasTiquete-settings",
    ) as HTMLElement;
    const dateSize = popupDocument.getElementById(
      "tmhResaltarFechaTiqueteFontSizePx-input",
    ) as HTMLInputElement;
    const drawSize = popupDocument.getElementById(
      "tmhResaltarSorteoTiqueteFontSizePx-input",
    ) as HTMLInputElement;
    const drawFamily = popupDocument.getElementById(
      "tmhResaltarSorteoTiqueteFontFamily-input",
    ) as HTMLSelectElement;

    expect(toggle.checked).toBe(false);
    expect(settingsPanel.hidden).toBe(true);
    expect(settingsPanel.contains(save)).toBe(false);
    expect(size.disabled).toBe(true);
    expect(weight.disabled).toBe(true);
    expect(family.disabled).toBe(true);

    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    expect(settingsPanel.hidden).toBe(false);
    expect(size.disabled).toBe(false);
    expect(weight.disabled).toBe(false);
    expect(family.disabled).toBe(false);

    size.value = "28";
    size.dispatchEvent(new Event("change"));
    weight.value = "900";
    weight.dispatchEvent(new Event("change"));
    family.value = "Courier New";
    family.dispatchEvent(new Event("change"));
    dateSize.value = "18";
    dateSize.dispatchEvent(new Event("change"));
    drawSize.value = "26";
    drawSize.dispatchEvent(new Event("change"));
    drawFamily.value = "Verdana";
    drawFamily.dispatchEvent(new Event("change"));

    expect(storage.setCalls).toEqual([]);
    save.click();
    expect(storage.setCalls).toEqual([{
      tmhResaltarCodigoTiqueteEnabled: true,
      tmhResaltarCodigoTiqueteFontSizePx: 28,
      tmhResaltarCodigoTiqueteFontWeight: 900,
      tmhResaltarCodigoTiqueteFontFamily: "Courier New",
      tmhResaltarFechaTiqueteFontSizePx: 18,
      tmhResaltarFechaTiqueteFontWeight: 700,
      tmhResaltarFechaTiqueteFontFamily: "inherit",
      tmhResaltarSorteoTiqueteFontSizePx: 26,
      tmhResaltarSorteoTiqueteFontWeight: 700,
      tmhResaltarSorteoTiqueteFontFamily: "Verdana",
    }]);
    expect(status.textContent).toBe("Guardado");
  });

  test("restablece las tres fuentes y espera Guardar para persistir", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage({
      tmhResaltarCodigoTiqueteEnabled: true,
      tmhResaltarCodigoTiqueteFontSizePx: 30,
      tmhResaltarCodigoTiqueteFontWeight: 900,
      tmhResaltarCodigoTiqueteFontFamily: "Arial",
      tmhResaltarFechaTiqueteFontSizePx: 18,
      tmhResaltarFechaTiqueteFontWeight: 600,
      tmhResaltarFechaTiqueteFontFamily: "Verdana",
      tmhResaltarSorteoTiqueteFontSizePx: 26,
      tmhResaltarSorteoTiqueteFontWeight: 800,
      tmhResaltarSorteoTiqueteFontFamily: "Courier New",
    });
    const chromeApi = { storage, runtime: { lastError: null } };
    popup.createPopupController(popupDocument, chromeApi).start();

    const reset = popupDocument.getElementById(
      "tmhResaltarCodigoTiquete-reset",
    ) as HTMLButtonElement | null;
    const save = popupDocument.getElementById(
      "tmhResaltarCodigoTiquete-save",
    ) as HTMLButtonElement;
    const status = popupDocument.getElementById(
      "tmhResaltarCodigoTiqueteFont-status",
    ) as HTMLElement;

    expect(reset).not.toBeNull();
    reset?.click();

    for (const prefix of ["Codigo", "Fecha", "Sorteo"]) {
      expect(
        (popupDocument.getElementById(
          `tmhResaltar${prefix}TiqueteFontSizePx-input`,
        ) as HTMLInputElement).value,
      ).toBe("22");
      expect(
        (popupDocument.getElementById(
          `tmhResaltar${prefix}TiqueteFontWeight-input`,
        ) as HTMLSelectElement).value,
      ).toBe("700");
      expect(
        (popupDocument.getElementById(
          `tmhResaltar${prefix}TiqueteFontFamily-input`,
        ) as HTMLSelectElement).value,
      ).toBe("inherit");
    }
    expect(status.textContent).toBe("Cambios sin guardar");
    expect(storage.setCalls).toEqual([]);

    save.click();
    expect(storage.setCalls).toEqual([{
      tmhResaltarCodigoTiqueteEnabled: true,
      tmhResaltarCodigoTiqueteFontSizePx: 22,
      tmhResaltarCodigoTiqueteFontWeight: 700,
      tmhResaltarCodigoTiqueteFontFamily: "inherit",
      tmhResaltarFechaTiqueteFontSizePx: 22,
      tmhResaltarFechaTiqueteFontWeight: 700,
      tmhResaltarFechaTiqueteFontFamily: "inherit",
      tmhResaltarSorteoTiqueteFontSizePx: 22,
      tmhResaltarSorteoTiqueteFontWeight: 700,
      tmhResaltarSorteoTiqueteFontFamily: "inherit",
    }]);
    expect(status.textContent).toBe("Guardado");
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

  test("contenido propaga activacion y cambios de fuente sin lectura inicial obsoleta", () => {
    let finishInitialRead: ((value: Record<string, unknown>) => void) | undefined;
    const storage = createStorage();
    storage.local.get = vi.fn((_defaults, callback) => {
      finishInitialRead = callback;
    });
    const ticketController = {
      start: vi.fn(),
      stop: vi.fn(),
      setFonts: vi.fn(),
    };
    const ready = vi.fn();
    document.addEventListener("tmh-ticket-highlight-ready", ready, { once: true });
    const controller = content.createTicketHighlightContentController({
      storage,
      settings,
      ticketCodeController: ticketController,
      documentRef: document,
    });

    controller.start();
    storage.onChanged.emit({
      tmhResaltarCodigoTiqueteEnabled: { newValue: true },
      tmhResaltarCodigoTiqueteFontSizePx: { newValue: 30 },
      tmhResaltarCodigoTiqueteFontWeight: { newValue: 900 },
      tmhResaltarCodigoTiqueteFontFamily: { newValue: "Verdana" },
      tmhResaltarFechaTiqueteFontSizePx: { newValue: 18 },
      tmhResaltarSorteoTiqueteFontFamily: { newValue: "Arial" },
    });
    finishInitialRead?.({
      tmhResaltarCodigoTiqueteEnabled: false,
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
    document.dispatchEvent(new Event("DOMContentLoaded"));

    expect(ticketController.start).toHaveBeenCalledTimes(1);
    expect(ticketController.stop).not.toHaveBeenCalled();
    expect(ticketController.setFonts).toHaveBeenLastCalledWith({
      code: { sizePx: 30, weight: 900, family: "Verdana" },
      date: { sizePx: 18, weight: 700, family: "inherit" },
      draw: { sizePx: 22, weight: 700, family: "Arial" },
    });
    expect(ready).toHaveBeenCalledOnce();
  });

  test("reinicio ignora la respuesta pendiente del ciclo anterior", () => {
    const callbacks: Array<(value: Record<string, unknown>) => void> = [];
    const storage = createStorage();
    storage.local.get = vi.fn((_defaults, callback) => callbacks.push(callback));
    const ticketController = {
      start: vi.fn(),
      stop: vi.fn(),
      setFonts: vi.fn(),
    };
    const controller = content.createTicketHighlightContentController({
      storage,
      settings,
      ticketCodeController: ticketController,
    });

    controller.start();
    controller.destroy();
    controller.start();
    ticketController.start.mockClear();
    ticketController.stop.mockClear();
    callbacks[0]({ tmhResaltarCodigoTiqueteEnabled: true });
    expect(ticketController.start).not.toHaveBeenCalled();

    callbacks[1]({ tmhResaltarCodigoTiqueteEnabled: true });
    expect(ticketController.start).toHaveBeenCalledTimes(1);
    expect(ticketController.stop).not.toHaveBeenCalled();
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
      "https://gentecrystal.net/controllers/sales/SalesController.php*",
      "https://gentecrystal.net/print_pagos.php*",
    ]);
    expect(entry?.js).toEqual([
      "settings-core.js",
      "resaltartiquete-core.js",
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

  test("contenido actua solo cuando la URL real es about:blank", () => {
    const storage = createStorage({
      tmhFormatoImpresionCompletaEnabled: true,
      tmhFormatoImpresionCompletaFontSizePx: 21,
      tmhFormatoImpresionCompletaFontWeight: 900,
      tmhFormatoImpresionCompletaFontFamily: "Verdana",
    });
    const fontController = {
      start: vi.fn(),
      stop: vi.fn(),
      setFont: vi.fn(),
    };
    const aboutBlankController =
      fullPrintContent.createFullPrintContentController({
        storage,
        settings,
        fontController,
        locationHref: "about:blank",
      });

    aboutBlankController.start();
    expect(fontController.setFont).toHaveBeenCalledWith({
      sizePx: 21,
      weight: 900,
      family: "Verdana",
    });
    expect(fontController.start).toHaveBeenCalledOnce();

    const normalStorage = createStorage();
    const normalController = fullPrintContent.createFullPrintContentController({
      storage: normalStorage,
      settings,
      fontController,
      locationHref: "https://www.bcrcorresponsal.bancobcr.com/Inicio.aspx",
    });
    normalController.start();
    expect(normalStorage.local.get).not.toHaveBeenCalled();
    expect(normalStorage.onChanged.addListener).not.toHaveBeenCalled();
  });

  test("popup persiste interruptor y fuente juntos solo al pulsar Guardar", () => {
    const popupDocument = loadPopupDocument();
    const storage = createStorage();
    const chromeApi = { storage, runtime: { lastError: null } };
    popup.createPopupController(popupDocument, chromeApi).start();

    const toggle = popupDocument.getElementById(
      "tmhFormatoImpresionCompletaEnabled-toggle",
    ) as HTMLInputElement;
    const panel = popupDocument.getElementById(
      "tmhFormatoImpresionCompleta-settings",
    ) as HTMLElement;
    const size = popupDocument.getElementById(
      "tmhFormatoImpresionCompletaFontSizePx-input",
    ) as HTMLInputElement;
    const weight = popupDocument.getElementById(
      "tmhFormatoImpresionCompletaFontWeight-input",
    ) as HTMLSelectElement;
    const family = popupDocument.getElementById(
      "tmhFormatoImpresionCompletaFontFamily-input",
    ) as HTMLSelectElement;
    const save = popupDocument.getElementById(
      "tmhFormatoImpresionCompleta-save",
    ) as HTMLButtonElement;

    expect(toggle.checked).toBe(false);
    expect(panel.hidden).toBe(true);
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    expect(panel.hidden).toBe(false);
    expect(size.value).toBe("21");
    expect(weight.value).toBe("900");
    expect(family.value).toBe("Verdana");
    expect(storage.setCalls).toEqual([]);

    save.click();
    expect(storage.setCalls).toEqual([{
      tmhFormatoImpresionCompletaEnabled: true,
      tmhFormatoImpresionCompletaFontSizePx: 21,
      tmhFormatoImpresionCompletaFontWeight: 900,
      tmhFormatoImpresionCompletaFontFamily: "Verdana",
    }]);
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
        "impresioncompleta-core.js",
        "impresioncompleta-content.js",
      ],
      all_frames: true,
      match_about_blank: true,
      match_origin_as_fallback: true,
      run_at: "document_idle",
    });
  });
});
