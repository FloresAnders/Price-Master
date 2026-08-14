import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { JSDOM } from "jsdom";
import {
  GenteCrystalSalesClient,
  type GenteCrystalDailySalesResponse,
} from "../../../services/gente-crystal-sales.ts";
import { GenteCrystalTiemposPanel } from "./GenteCrystalTiemposPanel.tsx";

const emptyResponse = (
  companyId: string,
  date: string,
): GenteCrystalDailySalesResponse => ({
  ok: true,
  companyId,
  date,
  timezone: "America/Costa_Rica",
  summary: {
    count: 0,
    total: 0,
    indirectCount: 0,
    indirectTotal: 0,
  },
  sales: [],
});

function installDom() {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost",
  });
  const values: Record<string, unknown> = {
    window: dom.window,
    document: dom.window.document,
    navigator: dom.window.navigator,
    Element: dom.window.Element,
    HTMLElement: dom.window.HTMLElement,
    HTMLButtonElement: dom.window.HTMLButtonElement,
    HTMLInputElement: dom.window.HTMLInputElement,
    Node: dom.window.Node,
    Event: dom.window.Event,
    MouseEvent: dom.window.MouseEvent,
    IS_REACT_ACT_ENVIRONMENT: true,
  };
  const previous = new Map(
    Object.keys(values).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );

  Object.entries(values).forEach(([key, value]) => {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value,
    });
  });

  return {
    dom,
    restore() {
      previous.forEach((descriptor, key) => {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else Reflect.deleteProperty(globalThis, key);
      });
      dom.window.close();
    },
  };
}

function refreshButton(container: HTMLElement): HTMLButtonElement {
  const button = Array.from(
    container.querySelectorAll<HTMLButtonElement>("button"),
  ).find((candidate) => candidate.textContent?.trim() === "Actualizar");
  assert.ok(button);
  return button;
}

test("the panel queries only after an explicit refresh with the current scope", async () => {
  const { dom, restore } = installDom();
  const { createRoot } = await import("react-dom/client");
  const originalGetDaily = GenteCrystalSalesClient.getDaily;
  const calls: Array<{
    companyId: string;
    date: string;
    signal: AbortSignal | undefined;
  }> = [];
  let resolveRequest:
    | ((response: GenteCrystalDailySalesResponse) => void)
    | undefined;
  let root: Root | undefined;

  GenteCrystalSalesClient.getDaily = (companyId, date, signal) => {
    calls.push({ companyId, date, signal });
    return new Promise((resolve) => {
      resolveRequest = resolve;
    });
  };

  try {
    const container = dom.window.document.createElement("div");
    dom.window.document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        createElement(GenteCrystalTiemposPanel, {
          companyId: "DELIKOR PALMARES",
        }),
      );
    });

    assert.equal(calls.length, 0);
    assert.match(container.textContent ?? "", /Presiona Actualizar/);

    const dateInput = container.querySelector<HTMLInputElement>(
      'input[type="date"]',
    );
    assert.ok(dateInput);
    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        dom.window.HTMLInputElement.prototype,
        "value",
      )?.set;
      assert.ok(valueSetter);
      valueSetter.call(dateInput, "2026-08-13");
      dateInput.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
      dateInput.dispatchEvent(
        new dom.window.Event("change", { bubbles: true }),
      );
    });
    await act(async () => {
      root!.render(
        createElement(GenteCrystalTiemposPanel, {
          companyId: "DELIKOR SAN VITO",
        }),
      );
    });

    assert.equal(calls.length, 0);

    await act(async () => {
      refreshButton(container).dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      );
    });

    assert.deepEqual(
      calls.map(({ companyId, date }) => ({ companyId, date })),
      [{ companyId: "DELIKOR SAN VITO", date: "2026-08-13" }],
    );
    assert.equal(refreshButton(container).disabled, true);

    await act(async () => {
      resolveRequest?.(emptyResponse("DELIKOR SAN VITO", "2026-08-13"));
      await Promise.resolve();
    });

    assert.equal(refreshButton(container).disabled, false);
    assert.match(container.textContent ?? "", /No hay movimientos/);
  } finally {
    GenteCrystalSalesClient.getDaily = originalGetDaily;
    const mountedRoot = root;
    if (mountedRoot) await act(async () => mountedRoot.unmount());
    restore();
  }
});

test("unmounting the panel aborts its pending manual query", async () => {
  const { dom, restore } = installDom();
  const { createRoot } = await import("react-dom/client");
  const originalGetDaily = GenteCrystalSalesClient.getDaily;
  let requestSignal: AbortSignal | undefined;
  let root: Root | undefined;

  GenteCrystalSalesClient.getDaily = (_companyId, _date, signal) => {
    requestSignal = signal;
    return new Promise(() => {});
  };

  try {
    const container = dom.window.document.createElement("div");
    dom.window.document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root!.render(
        createElement(GenteCrystalTiemposPanel, {
          companyId: "DELIKOR PALMARES",
        }),
      );
    });
    await act(async () => {
      refreshButton(container).dispatchEvent(
        new dom.window.MouseEvent("click", { bubbles: true }),
      );
    });

    assert.equal(requestSignal?.aborted, false);
    await act(async () => root!.unmount());
    root = undefined;
    assert.equal(requestSignal?.aborted, true);
  } finally {
    GenteCrystalSalesClient.getDaily = originalGetDaily;
    const mountedRoot = root;
    if (mountedRoot) await act(async () => mountedRoot.unmount());
    restore();
  }
});
