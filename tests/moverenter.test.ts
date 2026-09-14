import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { createMoverEnterController } = require(
  "../extensions/moverenter/moverenter-core.js",
);

function createFixture({ open = true, openedAt = "1000" } = {}) {
  const dom = new JSDOM(`
    <dialog
      id="sales-success-dialog"
      data-sales-opened-at="${openedAt}"
      ${open ? "open" : ""}
    >
      <button id="sales-success-dialog-print" type="button">Imprimir</button>
      <button id="sales-success-dialog-continue" type="button">Seguir vendiendo</button>
    </dialog>
  `);
  const printButton = dom.window.document.querySelector(
    "#sales-success-dialog-print",
  ) as HTMLButtonElement;
  let printClicks = 0;
  printButton.addEventListener("click", () => {
    printClicks += 1;
  });

  const controller = createMoverEnterController(dom.window.document);

  return {
    controller,
    dialog: dom.window.document.querySelector(
      "#sales-success-dialog",
    ) as HTMLDialogElement,
    getPrintClicks: () => printClicks,
  };
}

async function flushMutations() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function readExtensionFile(filename: string) {
  return readFileSync(
    new URL(`../extensions/moverenter/${filename}`, import.meta.url),
    "utf8",
  );
}

describe("moverenter", () => {
  test("does not print while the popup toggle is disabled", async () => {
    const fixture = createFixture();

    fixture.controller.start();
    fixture.dialog.appendChild(
      fixture.dialog.ownerDocument.createElement("span"),
    );
    await flushMutations();

    expect(fixture.getPrintClicks()).toBe(0);
    fixture.controller.stop();
  });

  test("prints immediately when enabled while the modal is already open", () => {
    const fixture = createFixture();

    fixture.controller.start();
    fixture.controller.setEnabled(true);

    expect(fixture.getPrintClicks()).toBe(1);
    fixture.controller.stop();
  });

  test("prints only once during the same modal opening", async () => {
    const fixture = createFixture();

    fixture.controller.start();
    fixture.controller.setEnabled(true);
    fixture.dialog.appendChild(
      fixture.dialog.ownerDocument.createElement("span"),
    );
    fixture.dialog.setAttribute("aria-live", "polite");
    await flushMutations();

    expect(fixture.getPrintClicks()).toBe(1);
    fixture.controller.stop();
  });

  test("prints again after the modal opens for a new sale", async () => {
    const fixture = createFixture();

    fixture.controller.start();
    fixture.controller.setEnabled(true);
    fixture.dialog.removeAttribute("open");
    await flushMutations();
    fixture.dialog.setAttribute("data-sales-opened-at", "2000");
    fixture.dialog.setAttribute("open", "");
    await flushMutations();

    expect(fixture.getPrintClicks()).toBe(2);
    fixture.controller.stop();
  });

  test("prints again when the same modal node closes and reopens", async () => {
    const fixture = createFixture();

    fixture.controller.start();
    fixture.controller.setEnabled(true);
    fixture.dialog.removeAttribute("open");
    await flushMutations();
    fixture.dialog.setAttribute("open", "");
    await flushMutations();

    expect(fixture.getPrintClicks()).toBe(2);
    fixture.controller.stop();
  });

  test("the content script applies the saved enabled setting", () => {
    const dom = new JSDOM(
      `
        <dialog id="sales-success-dialog" data-sales-opened-at="1000" open>
          <button id="sales-success-dialog-print" type="button">Imprimir</button>
        </dialog>
      `,
      { runScripts: "outside-only" },
    );
    let printClicks = 0;
    dom.window.document
      .querySelector("#sales-success-dialog-print")
      ?.addEventListener("click", () => {
        printClicks += 1;
      });
    Object.assign(dom.window, {
      chrome: {
        storage: {
          local: {
            get: (_defaults: object, callback: (value: object) => void) =>
              callback({ enabled: true }),
          },
          onChanged: { addListener: () => undefined },
        },
      },
    });

    dom.window.eval(readExtensionFile("moverenter-core.js"));
    dom.window.eval(readExtensionFile("sales-content.js"));

    expect(printClicks).toBe(1);
  });

  test("the content script reacts when the popup enables automation", () => {
    const dom = new JSDOM(
      `
        <dialog id="sales-success-dialog" data-sales-opened-at="1000" open>
          <button id="sales-success-dialog-print" type="button">Imprimir</button>
        </dialog>
      `,
      { runScripts: "outside-only" },
    );
    let printClicks = 0;
    let storageListener:
      | ((changes: Record<string, unknown>, areaName: string) => void)
      | undefined;
    dom.window.document
      .querySelector("#sales-success-dialog-print")
      ?.addEventListener("click", () => {
        printClicks += 1;
      });
    Object.assign(dom.window, {
      chrome: {
        storage: {
          local: {
            get: (_defaults: object, callback: (value: object) => void) =>
              callback({ enabled: false }),
          },
          onChanged: {
            addListener: (
              listener: (
                changes: Record<string, unknown>,
                areaName: string,
              ) => void,
            ) => {
              storageListener = listener;
            },
          },
        },
      },
    });

    dom.window.eval(readExtensionFile("moverenter-core.js"));
    dom.window.eval(readExtensionFile("sales-content.js"));
    storageListener?.({ enabled: { newValue: true } }, "local");

    expect(printClicks).toBe(1);
  });

  test("the popup persists the toggle and displays its active state", () => {
    const dom = new JSDOM(
      `
        <input id="automation-toggle" type="checkbox">
        <span id="automation-status"></span>
      `,
      { runScripts: "outside-only" },
    );
    let storedEnabled = false;
    Object.assign(dom.window, {
      chrome: {
        runtime: { lastError: null },
        storage: {
          local: {
            get: (_defaults: object, callback: (value: object) => void) =>
              callback({ enabled: false }),
            set: (value: { enabled: boolean }, callback: () => void) => {
              storedEnabled = value.enabled;
              callback();
            },
          },
        },
      },
    });

    dom.window.eval(readExtensionFile("popup.js"));
    const toggle = dom.window.document.querySelector(
      "#automation-toggle",
    ) as HTMLInputElement;
    toggle.checked = true;
    toggle.dispatchEvent(new dom.window.Event("change", { bubbles: true }));

    expect(storedEnabled).toBe(true);
    expect(
      dom.window.document.querySelector("#automation-status")?.textContent,
    ).toBe("Activado");
  });
});
