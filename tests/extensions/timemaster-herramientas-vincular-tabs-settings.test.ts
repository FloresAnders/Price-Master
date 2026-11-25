// @vitest-environment jsdom

import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const requireModule = createRequire(import.meta.url);
const extensionRoot = resolve(process.cwd(), "extensions/TimeMasterHerramientas");
const settings = requireModule(resolve(extensionRoot, "settings-core.js"));
const popup = requireModule(resolve(extensionRoot, "popup.js"));

describe("TimeMasterHerramientas vinculación de TABs", () => {
  it("guarda activación y rango completo desde el formulario", () => {
    expect(settings.DEFAULT_SETTINGS).toMatchObject({
      tmhVincularTabsEnabled: false,
      tmhVincularTabsStart: 1,
      tmhVincularTabsEnd: 20,
    });

    const popupHtml = readFileSync(resolve(extensionRoot, "popup.html"), "utf8");
    const popupDocument = new DOMParser().parseFromString(popupHtml, "text/html");
    const stored = { ...settings.DEFAULT_SETTINGS };
    const set = vi.fn((next: Record<string, unknown>, callback: () => void) => {
      Object.assign(stored, next);
      callback();
    });
    const chromeApi = {
      runtime: {
        lastError: null,
        getURL: vi.fn((path: string) => path),
        sendMessage: vi.fn(
          (
            message: { config: { enabled: boolean; start: number; end: number } },
            callback: (response: { ok: boolean }) => void,
          ) => {
            Object.assign(stored, {
              tmhVincularTabsEnabled: message.config.enabled,
              tmhVincularTabsStart: message.config.start,
              tmhVincularTabsEnd: message.config.end,
            });
            callback({ ok: true });
          },
        ),
      },
      storage: {
        local: {
          get: vi.fn((_defaults: unknown, callback: (value: unknown) => void) =>
            callback(stored),
          ),
          set,
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    };

    const controller = popup.createPopupController(popupDocument, chromeApi);
    controller.start();
    const enabled = popupDocument.getElementById(
      "tmhVincularTabsEnabled-toggle",
    ) as HTMLInputElement | null;
    const start = popupDocument.getElementById(
      "tmhVincularTabsStart-input",
    ) as HTMLInputElement | null;
    const end = popupDocument.getElementById(
      "tmhVincularTabsEnd-input",
    ) as HTMLInputElement | null;
    const form = popupDocument.getElementById("tmhVincularTabs-form");

    expect(enabled?.checked).toBe(false);
    expect(start?.value).toBe("1");
    expect(end?.value).toBe("20");
    if (!enabled || !start || !end || !form) throw new Error("Controles ausentes");
    expect(start.disabled).toBe(true);
    expect(end.disabled).toBe(true);

    enabled.checked = true;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));
    expect(start.disabled).toBe(false);
    expect(end.disabled).toBe(false);
    start.value = "7";
    end.value = "12";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(stored).toMatchObject({
      tmhVincularTabsEnabled: true,
      tmhVincularTabsStart: 7,
      tmhVincularTabsEnd: 12,
    });
    controller.destroy();
  });

  it("no deja que una carga inicial tardía revierta el rango guardado", () => {
    const popupHtml = readFileSync(resolve(extensionRoot, "popup.html"), "utf8");
    const popupDocument = new DOMParser().parseFromString(popupHtml, "text/html");
    let finishInitialLoad: ((value: unknown) => void) | undefined;
    const chromeApi = {
      runtime: {
        lastError: null,
        getURL: vi.fn((path: string) => path),
        sendMessage: vi.fn(
          (_message: unknown, callback: (response: { ok: boolean }) => void) =>
            callback({ ok: true }),
        ),
      },
      storage: {
        local: {
          get: vi.fn((_defaults: unknown, callback: (value: unknown) => void) => {
            finishInitialLoad = callback;
          }),
          set: vi.fn((_next: unknown, callback: () => void) => callback()),
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
    const controller = popup.createPopupController(popupDocument, chromeApi);
    controller.start();
    const enabled = popupDocument.getElementById(
      "tmhVincularTabsEnabled-toggle",
    ) as HTMLInputElement;
    const start = popupDocument.getElementById(
      "tmhVincularTabsStart-input",
    ) as HTMLInputElement;
    const end = popupDocument.getElementById(
      "tmhVincularTabsEnd-input",
    ) as HTMLInputElement;
    const form = popupDocument.getElementById("tmhVincularTabs-form")!;

    enabled.checked = true;
    start.value = "7";
    end.value = "9";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    finishInitialLoad?.({
      ...settings.DEFAULT_SETTINGS,
      tmhVincularTabsEnabled: false,
      tmhVincularTabsStart: 1,
      tmhVincularTabsEnd: 20,
    });

    expect(enabled.checked).toBe(true);
    expect(start.value).toBe("7");
    expect(end.value).toBe("9");
    controller.destroy();
  });

  it("rechaza un inicio vacío en vez de convertirlo a TAB 0", () => {
    const popupHtml = readFileSync(resolve(extensionRoot, "popup.html"), "utf8");
    const popupDocument = new DOMParser().parseFromString(popupHtml, "text/html");
    const set = vi.fn((_next: unknown, callback: () => void) => callback());
    const sendMessage = vi.fn(
      (_message: unknown, callback: (response: { ok: boolean }) => void) =>
        callback({ ok: true }),
    );
    const chromeApi = {
      runtime: {
        lastError: null,
        getURL: vi.fn((path: string) => path),
        sendMessage,
      },
      storage: {
        local: {
          get: vi.fn((_defaults: unknown, callback: (value: unknown) => void) =>
            callback(settings.DEFAULT_SETTINGS),
          ),
          set,
        },
        onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
      },
    };
    const controller = popup.createPopupController(popupDocument, chromeApi);
    controller.start();
    const enabled = popupDocument.getElementById(
      "tmhVincularTabsEnabled-toggle",
    ) as HTMLInputElement;
    const start = popupDocument.getElementById(
      "tmhVincularTabsStart-input",
    ) as HTMLInputElement;
    const form = popupDocument.getElementById("tmhVincularTabs-form")!;
    enabled.checked = true;
    enabled.dispatchEvent(new Event("change", { bubbles: true }));
    start.value = "";
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(set).not.toHaveBeenCalled();
    expect(sendMessage).not.toHaveBeenCalled();
    expect(start.getAttribute("aria-invalid")).toBe("true");
    controller.destroy();
  });
});
