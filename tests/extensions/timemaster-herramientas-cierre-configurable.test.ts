import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

const requireModule = createRequire(import.meta.url);
const extensionDir = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas",
);
const load = (name: string) => requireModule(resolve(extensionDir, name));

afterEach(() => {
  vi.useRealTimers();
});

describe("tiempo configurable del cierre de impresión en Contica", () => {
  it("acepta segundos enteros desde 1 y recupera 5 ante valores inválidos", () => {
    const settings = load("settings-core.js");

    expect(settings.normalizeSettings({})).toMatchObject({
      tmhCerrarImpresionConticaDelaySeconds: 5,
    });
    expect(
      settings.normalizeSettings({
        tmhCerrarImpresionConticaDelaySeconds: 1,
      }).tmhCerrarImpresionConticaDelaySeconds,
    ).toBe(1);
    for (const invalid of [0, -1, 1.5, "2", null]) {
      expect(
        settings.normalizeSettings({
          tmhCerrarImpresionConticaDelaySeconds: invalid,
        }).tmhCerrarImpresionConticaDelaySeconds,
      ).toBe(5);
    }
  });

  it("cierra el modal al completar el número de segundos configurado", () => {
    vi.useFakeTimers();
    const dom = new JSDOM(`
      <div id="printInvoice" class="modal in" aria-modal="true" style="display: block">
        <button class="esc-button" data-dismiss="modal">X [ESC]</button>
      </div>
    `);
    const button = dom.window.document.querySelector(".esc-button")!;
    const click = vi.fn();
    button.addEventListener("click", click);
    const controller = load("cerrarimpresioncontica-core.js")
      .createPrintInvoiceCloser(dom.window.document);

    controller.setDelaySeconds(1);
    controller.start();
    vi.advanceTimersByTime(999);
    expect(click).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(click).toHaveBeenCalledTimes(1);

    controller.stop();
    dom.window.close();
  });

  it("no vuelve a cerrar la misma apertura al cambiar el tiempo después del clic", () => {
    vi.useFakeTimers();
    const dom = new JSDOM(`
      <div id="printInvoice" class="modal in" aria-modal="true" style="display: block">
        <button class="esc-button" data-dismiss="modal">X [ESC]</button>
      </div>
    `);
    const button = dom.window.document.querySelector(".esc-button")!;
    const click = vi.fn();
    button.addEventListener("click", click);
    const controller = load("cerrarimpresioncontica-core.js")
      .createPrintInvoiceCloser(dom.window.document);

    controller.start();
    vi.advanceTimersByTime(5_000);
    expect(click).toHaveBeenCalledTimes(1);

    controller.setDelaySeconds(1);
    vi.advanceTimersByTime(1_000);
    expect(click).toHaveBeenCalledTimes(1);

    controller.stop();
    dom.window.close();
  });

  it("muestra, habilita y guarda el tiempo desde el popup", () => {
    const dom = new JSDOM(
      readFileSync(resolve(extensionDir, "popup.html"), "utf8"),
    );
    const writes: Record<string, unknown>[] = [];
    const chromeApi = {
      storage: {
        local: {
          get(
            defaults: Record<string, unknown>,
            callback: (values: Record<string, unknown>) => void,
          ) {
            callback({
              ...defaults,
              tmhCerrarImpresionConticaEnabled: true,
              tmhCerrarImpresionConticaDelaySeconds: 12,
            });
          },
          set(values: Record<string, unknown>, callback: () => void) {
            writes.push(values);
            callback();
          },
        },
      },
      runtime: { lastError: null },
    };
    const controller = load("popup.js").createPopupController(
      dom.window.document,
      chromeApi,
    );

    controller.start();
    const input = dom.window.document.getElementById(
      "tmhCerrarImpresionConticaDelaySeconds-input",
    ) as HTMLInputElement;
    expect(input.value).toBe("12");
    expect(input.min).toBe("1");
    expect(input.disabled).toBe(false);

    input.value = "3";
    input.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(writes).toContainEqual({
      tmhCerrarImpresionConticaDelaySeconds: 3,
    });

    const toggle = dom.window.document.getElementById(
      "tmhCerrarImpresionConticaEnabled-toggle",
    ) as HTMLInputElement;
    toggle.checked = false;
    toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    expect(input.disabled).toBe(true);

    controller.destroy();
    dom.window.close();
  });

  it("aplica el tiempo guardado antes de activar el controlador y escucha cambios", () => {
    type StorageListener = (
      changes: Record<string, { newValue?: unknown }>,
      areaName: string,
    ) => void;
    const listeners = new Set<StorageListener>();
    const storage = {
      local: {
        get(
          defaults: Record<string, unknown>,
          callback: (values: Record<string, unknown>) => void,
        ) {
          callback({
            ...defaults,
            tmhCambioTabEnabled: false,
            tmhCerrarImpresionConticaEnabled: true,
            tmhCerrarImpresionConticaDelaySeconds: 2,
          });
        },
      },
      onChanged: {
        addListener(listener: StorageListener) {
          listeners.add(listener);
        },
        removeListener(listener: StorageListener) {
          listeners.delete(listener);
        },
      },
    };
    const calls: string[] = [];
    const controller = load("contica-content.js").createConticaController({
      storage,
      settings: load("settings-core.js"),
      tabController: { start() {}, stop() {} },
      printInvoiceCloser: {
        setDelaySeconds(seconds: number) {
          calls.push(`delay:${seconds}`);
        },
        start() {
          calls.push("start");
        },
        stop() {
          calls.push("stop");
        },
      },
    });

    controller.start();
    expect(calls).toEqual(["delay:2", "start"]);

    for (const listener of listeners) {
      listener(
        { tmhCerrarImpresionConticaDelaySeconds: { newValue: 1 } },
        "local",
      );
    }
    expect(calls).toEqual(["delay:2", "start", "delay:1"]);

    controller.destroy();
  });
});
