import { JSDOM } from "jsdom";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const { createTabController } = require("../extensions/cambiotab/tab-core.js");

function createFixture(activeTab = "2") {
  const dom = new JSDOM(`
    <ul id="tabs">
      <li class="${activeTab === "1" ? "active" : ""}"><a data-tab="1">1</a></li>
      <li class="${activeTab === "2" ? "active" : ""}"><a data-tab="2">2</a></li>
      <li class="${activeTab === "3" ? "active" : ""}"><a data-tab="3">3</a></li>
      <li class="disabled"><a data-tab="4">4</a></li>
      <li><a data-tab="7">7</a></li>
    </ul>
  `);
  const selected: string[] = [];

  dom.window.document.querySelectorAll<HTMLAnchorElement>("#tabs a[data-tab]").forEach((anchor) => {
    anchor.addEventListener("click", () => {
      dom.window.document.querySelector("#tabs li.active")?.classList.remove("active");
      anchor.closest("li")?.classList.add("active");
      selected.push(anchor.dataset.tab || "");
    });
  });

  createTabController(dom.window.document).start();
  return { dom, selected };
}

function press(dom: JSDOM, options: KeyboardEventInit) {
  const event = new dom.window.KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    ...options,
  });
  dom.window.document.dispatchEvent(event);
  return event;
}

describe("CambioTab", () => {
  let fixture: ReturnType<typeof createFixture>;

  beforeEach(() => {
    fixture = createFixture();
  });

  test("Ctrl+Alt+ArrowRight selects the next available tab", () => {
    const event = press(fixture.dom, {
      code: "ArrowRight",
      key: "ArrowRight",
      ctrlKey: true,
      altKey: true,
    });

    expect(fixture.selected).toEqual(["3"]);
    expect(event.defaultPrevented).toBe(true);
  });

  test("arrow navigation wraps and skips disabled tabs", () => {
    const { dom, selected } = createFixture("1");

    press(dom, {
      code: "ArrowLeft",
      key: "ArrowLeft",
      ctrlKey: true,
      altKey: true,
    });

    expect(selected).toEqual(["7"]);
  });

  test.each(["Digit7", "Numpad7"])(
    "Ctrl+Alt+7 selects data-tab 7 with %s",
    (code) => {
      press(fixture.dom, {
        code,
        key: "7",
        ctrlKey: true,
        altKey: true,
      });

      expect(fixture.selected).toEqual(["7"]);
    },
  );

  test("numeric shortcuts do not select disabled tabs", () => {
    const event = press(fixture.dom, {
      code: "Digit4",
      key: "4",
      ctrlKey: true,
      altKey: true,
    });

    expect(fixture.selected).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
  });

  test("unmodified keys and repeated keydown events are ignored", () => {
    press(fixture.dom, { code: "ArrowRight", key: "ArrowRight" });
    press(fixture.dom, {
      code: "ArrowRight",
      key: "ArrowRight",
      ctrlKey: true,
      altKey: true,
      repeat: true,
    });

    expect(fixture.selected).toEqual([]);
  });
});
