// @vitest-environment jsdom

import { createRequire } from "node:module";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

type TabController = { start: () => void; stop: () => void };
type CambioTabCore = {
  createTabController: (documentRef: Document) => TabController;
};

const requireModule = createRequire(import.meta.url);
const core = requireModule(
  resolve(
    process.cwd(),
    "extensions/TimeMasterHerramientas/cambiotab-core.js",
  ),
) as CambioTabCore;
const activeControllers = new Set<TabController>();

function createFixture() {
  document.body.innerHTML = `
    <ul id="tabs">
      <li class="active"><a href="#sale-1" data-tab="1">Uno</a></li>
      <li><a href="#sale-2" data-tab="2">Dos</a></li>
      <li><a href="#sale-3" data-tab="3">Tres</a></li>
    </ul>
    <main>
      <label for="invoice-observation">Observación opcional en la factura</label>
      <textarea id="invoice-observation"></textarea>
    </main>
  `;

  const clicks: string[] = [];
  for (const anchor of document.querySelectorAll<HTMLAnchorElement>(
    "#tabs a[data-tab]",
  )) {
    anchor.addEventListener("click", (event) => {
      event.preventDefault();
      document.querySelector("#tabs li.active")?.classList.remove("active");
      anchor.closest("li")?.classList.add("active");
      clicks.push(anchor.dataset.tab || "");
    });
  }

  const controller = core.createTabController(document);
  controller.start();
  activeControllers.add(controller);
  const observation = document.querySelector<HTMLTextAreaElement>(
    "#invoice-observation",
  )!;

  function setActiveObservation(tabNumber: string, value: string) {
    document.querySelector("#tabs li.active")?.classList.remove("active");
    document
      .querySelector(`[data-tab="${tabNumber}"]`)
      ?.closest("li")
      ?.classList.add("active");
    observation.value = value;
    observation.dispatchEvent(new Event("input", { bubbles: true }));
  }

  return { clicks, controller, observation, setActiveObservation };
}

function pressCtrlWord(word: string, target: EventTarget = document) {
  return [...word].map((letter) => {
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: letter === " " ? "Space" : `Key${letter.toUpperCase()}`,
      key: letter,
      ctrlKey: true,
    });
    target.dispatchEvent(event);
    return event;
  });
}

function releaseCtrl(target: EventTarget = document) {
  target.dispatchEvent(
    new KeyboardEvent("keyup", {
      bubbles: true,
      cancelable: true,
      code: "ControlLeft",
      key: "Control",
    }),
  );
}

afterEach(() => {
  for (const controller of activeControllers) controller.stop();
  activeControllers.clear();
  document.body.innerHTML = "";
});

describe("TimeMasterHerramientas CambioTab por observación", () => {
  it("activa la pestaña al completar Ctrl más la observación exacta", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.setActiveObservation("2", "NATY");

    const events = pressCtrlWord("JOSE");

    expect(fixture.clicks).toEqual(["1"]);
    expect(events.every((event) => event.defaultPrevented)).toBe(true);
    fixture.controller.stop();
  });

  it("ignora mayúsculas y acentos al comparar", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "  José  ");
    fixture.setActiveObservation("2", "NATY");

    pressCtrlWord("jose");

    expect(fixture.clicks).toEqual(["1"]);
    fixture.controller.stop();
  });

  it("activa la primera pestaña disponible cuando hay duplicados", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.setActiveObservation("2", "JOSE");
    fixture.setActiveObservation("3", "AXEL");

    pressCtrlWord("JOSE");

    expect(fixture.clicks).toEqual(["1"]);
    fixture.controller.stop();
  });

  it("no activa una observación más larga con solo su prefijo", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE PEREZ");
    fixture.setActiveObservation("2", "NATY");

    pressCtrlWord("JOSE");
    releaseCtrl();

    expect(fixture.clicks).toEqual([]);
    fixture.controller.stop();
  });

  it("permite completar observaciones con espacios", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE PEREZ");
    fixture.setActiveObservation("2", "NATY");

    pressCtrlWord("JOSE PEREZ");

    expect(fixture.clicks).toEqual(["1"]);
    fixture.controller.stop();
  });

  it("espera al soltar Ctrl cuando un nombre exacto también es prefijo", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.setActiveObservation("2", "JOSEFINA");

    pressCtrlWord("JOSE");
    expect(fixture.clicks).toEqual([]);
    releaseCtrl();

    expect(fixture.clicks).toEqual(["1"]);
    fixture.controller.stop();
  });

  it("permite completar el nombre más largo cuando comparte prefijo exacto", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.setActiveObservation("2", "JOSEFINA");

    pressCtrlWord("JOSEFINA");

    expect(fixture.clicks).toEqual(["2"]);
    fixture.controller.stop();
  });

  it("deja pasar combinaciones Ctrl que no son prefijo de una observación", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");

    const [event] = pressCtrlWord("K");

    expect(event.defaultPrevented).toBe(false);
    expect(fixture.clicks).toEqual([]);
    fixture.controller.stop();
  });

  it("preserva Ctrl C y Ctrl V dentro de controles editables", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "CARLOS");
    fixture.setActiveObservation("2", "VICTORIA");

    const [copyEvent] = pressCtrlWord("C", fixture.observation);
    releaseCtrl(fixture.observation);
    const [pasteEvent] = pressCtrlWord("V", fixture.observation);

    expect(copyEvent.defaultPrevented).toBe(false);
    expect(pasteEvent.defaultPrevented).toBe(false);
    expect(fixture.clicks).toEqual([]);
    fixture.controller.stop();
  });

  it("limpia la palabra parcial al ejecutar navegación Ctrl Alt", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.setActiveObservation("2", "NATY");
    pressCtrlWord("J");
    const navigate = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "Digit2",
      key: "2",
      ctrlKey: true,
      altKey: true,
    });
    document.dispatchEvent(navigate);

    pressCtrlWord("OSE");

    expect(fixture.clicks).toEqual(["2"]);
    fixture.controller.stop();
  });

  it("descarta una observación vaciada programáticamente antes de cambiar tab", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.observation.value = "";

    document.querySelector<HTMLAnchorElement>('[data-tab="2"]')?.click();
    pressCtrlWord("JOSE");

    expect(fixture.clicks).toEqual(["2"]);
    fixture.controller.stop();
  });

  it("indexa un campo de observación insertado después de start", async () => {
    document.body.innerHTML = `
      <ul id="tabs">
        <li class="active"><a href="#sale-1" data-tab="1">Uno</a></li>
        <li><a href="#sale-2" data-tab="2">Dos</a></li>
      </ul>
    `;
    const first = document.querySelector<HTMLAnchorElement>('[data-tab="1"]')!;
    let clicks = 0;
    first.addEventListener("click", (event) => {
      event.preventDefault();
      clicks += 1;
    });
    const controller = core.createTabController(document);
    controller.start();
    activeControllers.add(controller);

    document.body.insertAdjacentHTML(
      "beforeend",
      '<label for="late-observation">Observación opcional en la factura</label><textarea id="late-observation">JOSE</textarea>',
    );
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 0));
    await new Promise((resolveTimer) => setTimeout(resolveTimer, 0));
    pressCtrlWord("JOSE");

    expect(clicks).toBe(1);
    controller.stop();
  });

  it("conserva navegación existente con Ctrl Alt flecha", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("2", "NATY");
    const event = new KeyboardEvent("keydown", {
      bubbles: true,
      cancelable: true,
      code: "ArrowLeft",
      key: "ArrowLeft",
      ctrlKey: true,
      altKey: true,
    });

    document.dispatchEvent(event);

    expect(fixture.clicks).toEqual(["1"]);
    expect(event.defaultPrevented).toBe(true);
    fixture.controller.stop();
  });

  it("stop elimina captura e índice de observaciones", () => {
    const fixture = createFixture();
    fixture.setActiveObservation("1", "JOSE");
    fixture.controller.stop();

    const events = pressCtrlWord("JOSE");

    expect(fixture.clicks).toEqual([]);
    expect(events.every((event) => !event.defaultPrevented)).toBe(true);
  });
});
