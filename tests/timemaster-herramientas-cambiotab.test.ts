import { createRequire } from "node:module";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

type TabController = { start: () => void; stop: () => void };
type TabCore = {
  createTabController: (document: Document) => TabController;
};

const requireModule = createRequire(import.meta.url);
const corePath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/cambiotab-core.js",
);
const contentPath = resolve(
  process.cwd(),
  "extensions/TimeMasterHerramientas/contica-content.js",
);

const loadCore = () => requireModule(corePath) as TabCore;

type StorageChange = Record<string, { newValue?: unknown; oldValue?: unknown }>;

function createStorage(initial: Record<string, unknown> = {}) {
  const listeners = new Set<
    (changes: StorageChange, areaName: string) => void
  >();
  return {
    local: {
      get: vi.fn((_defaults, callback) => callback({ ...initial })),
    },
    onChanged: {
      addListener: vi.fn((listener) => listeners.add(listener)),
      removeListener: vi.fn((listener) => listeners.delete(listener)),
    },
    emit(changes: StorageChange, areaName = "local") {
      for (const listener of listeners) listener(changes, areaName);
    },
  };
}

function createTabsDom() {
  return new JSDOM(`
    <ul id="tabs">
      <li><a href="#one" data-tab="1">Uno</a></li>
      <li class="active"><a href="#two" data-tab="2">Dos</a></li>
      <li class="disabled"><a href="#three" data-tab="3">Tres</a></li>
    </ul>
  `);
}

function press(
  dom: JSDOM,
  code: string,
  overrides: Partial<KeyboardEventInit> = {},
) {
  dom.window.document.dispatchEvent(
    new dom.window.KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code,
      ctrlKey: true,
      altKey: true,
      ...overrides,
    }),
  );
}

function countClicks(element: Element) {
  let count = 0;
  element.addEventListener("click", (event) => {
    event.preventDefault();
    count += 1;
  });
  return () => count;
}

describe("TimeMaster Herramientas CambioTab", () => {
  it("recorre circularmente solo las pestañas disponibles", () => {
    const dom = createTabsDom();
    const { createTabController } = loadCore();
    const controller = createTabController(dom.window.document);
    const firstClicks = countClicks(
      dom.window.document.querySelector('[data-tab="1"]')!,
    );
    const secondClicks = countClicks(
      dom.window.document.querySelector('[data-tab="2"]')!,
    );
    const disabledClicks = countClicks(
      dom.window.document.querySelector('[data-tab="3"]')!,
    );
    controller.start();

    press(dom, "ArrowRight");
    press(dom, "ArrowLeft");

    expect(firstClicks()).toBe(2);
    expect(secondClicks()).toBe(0);
    expect(disabledClicks()).toBe(0);
    controller.stop();
    dom.window.close();
  });

  it("acepta números superiores y del teclado numérico", () => {
    const dom = createTabsDom();
    const { createTabController } = loadCore();
    const controller = createTabController(dom.window.document);
    const firstClicks = countClicks(
      dom.window.document.querySelector('[data-tab="1"]')!,
    );
    controller.start();

    press(dom, "Digit1");
    press(dom, "Numpad1");

    expect(firstClicks()).toBe(2);
    controller.stop();
    dom.window.close();
  });

  it("ignora modificadores no permitidos y eventos repetidos", () => {
    const dom = createTabsDom();
    const { createTabController } = loadCore();
    const controller = createTabController(dom.window.document);
    const firstClicks = countClicks(
      dom.window.document.querySelector('[data-tab="1"]')!,
    );
    controller.start();

    press(dom, "Digit1", { shiftKey: true });
    press(dom, "Digit1", { metaKey: true });
    press(dom, "Digit1", { ctrlKey: false });
    press(dom, "Digit1", { altKey: false });
    press(dom, "Digit1", { repeat: true });

    expect(firstClicks()).toBe(0);
    controller.stop();
    dom.window.close();
  });

  it("hace start y stop de forma idempotente y permite reactivarse", () => {
    const dom = createTabsDom();
    const { createTabController } = loadCore();
    const controller = createTabController(dom.window.document);
    const firstClicks = countClicks(
      dom.window.document.querySelector('[data-tab="1"]')!,
    );

    controller.start();
    controller.start();
    press(dom, "Digit1");
    controller.stop();
    controller.stop();
    press(dom, "Digit1");
    controller.start();
    press(dom, "Digit1");

    expect(firstClicks()).toBe(2);
    controller.stop();
    dom.window.close();
  });

  it("permanece estable con DOM incompleto y funciona al aparecer las pestañas", () => {
    const dom = new JSDOM("<main></main>");
    const { createTabController } = loadCore();
    const controller = createTabController(dom.window.document);
    controller.start();

    expect(() => press(dom, "ArrowRight")).not.toThrow();
    dom.window.document.body.insertAdjacentHTML(
      "beforeend",
      '<ul id="tabs"><li><a href="#one" data-tab="1">Uno</a></li></ul>',
    );
    const clicks = countClicks(
      dom.window.document.querySelector('[data-tab="1"]')!,
    );
    press(dom, "Digit1");

    expect(clicks()).toBe(1);
    controller.stop();
    dom.window.close();
  });
});

describe("TimeMaster Herramientas en Contica", () => {
  it("aplica el valor inicial y los cambios sin duplicar el controlador", () => {
    const dom = createTabsDom();
    const storage = createStorage({ tmhCambioTabEnabled: true });
    const tabController = loadCore().createTabController(dom.window.document);
    const firstClicks = countClicks(
      dom.window.document.querySelector('[data-tab="1"]')!,
    );
    const { createConticaController } = requireModule(contentPath) as {
      createConticaController: (options: Record<string, unknown>) => {
        start: () => void;
        destroy: () => void;
      };
    };
    const controller = createConticaController({
      storage,
      tabController,
      settings: requireModule(
        resolve(
          process.cwd(),
          "extensions/TimeMasterHerramientas/settings-core.js",
        ),
      ),
    });

    controller.start();
    controller.start();
    press(dom, "Digit1");
    storage.emit({ tmhCambioTabEnabled: { newValue: false } });
    press(dom, "Digit1");
    storage.emit({ tmhCambioTabEnabled: { newValue: true } });
    storage.emit({ tmhCambioTabEnabled: { newValue: true } });
    press(dom, "Digit1");

    expect(firstClicks()).toBe(2);
    expect(storage.local.get).toHaveBeenCalledTimes(1);
    expect(storage.onChanged.addListener).toHaveBeenCalledTimes(1);
    controller.destroy();
    dom.window.close();
  });

  it("ignora áreas y valores inválidos, y destroy desconecta todo", () => {
    const storage = createStorage({ tmhCambioTabEnabled: false });
    const tabController = { start: vi.fn(), stop: vi.fn() };
    const settings = requireModule(
      resolve(
        process.cwd(),
        "extensions/TimeMasterHerramientas/settings-core.js",
      ),
    );
    const { createConticaController } = requireModule(contentPath) as {
      createConticaController: (options: Record<string, unknown>) => {
        start: () => void;
        destroy: () => void;
      };
    };
    const controller = createConticaController({
      storage,
      tabController,
      settings,
    });

    controller.start();
    storage.emit({ tmhCambioTabEnabled: { newValue: true } }, "sync");
    storage.emit({ tmhCambioTabEnabled: { newValue: "yes" } });
    expect(tabController.start).not.toHaveBeenCalled();
    expect(tabController.stop).toHaveBeenCalledTimes(1);

    controller.destroy();
    storage.emit({ tmhCambioTabEnabled: { newValue: true } });
    expect(tabController.start).not.toHaveBeenCalled();
    expect(tabController.stop).toHaveBeenCalledTimes(2);
    expect(storage.onChanged.removeListener).toHaveBeenCalledTimes(1);
  });
});
