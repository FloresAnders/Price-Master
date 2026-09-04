// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RightPanel } from "@/components/business/cash-counter-tabs/components/RightPanel";

let intersectionCallback: IntersectionObserverCallback;

class IntersectionObserverStub implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(callback: IntersectionObserverCallback) {
    intersectionCallback = callback;
  }

  disconnect = vi.fn();
  observe = vi.fn();
  takeRecords = vi.fn(() => []);
  unobserve = vi.fn();
}

const renderPanel = () => render(
  <RightPanel
    data={{
      name: "Caja principal",
      bills: { 1000: 2 },
      extraAmount: 500,
      currency: "CRC",
      aperturaCaja: 0,
      ventaActual: 0,
    }}
    showExtra={false}
    setShowExtra={vi.fn()}
    showBD={false}
    setShowBD={vi.fn()}
    onUpdate={vi.fn()}
    onCurrencyOpen={vi.fn()}
    onDelete={vi.fn()}
  />,
);

describe("saldo total fijo del contador en móvil", () => {
  beforeEach(() => {
    vi.stubGlobal("IntersectionObserver", IntersectionObserverStub);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("mantiene visible el saldo mientras el resumen natural está fuera de pantalla", () => {
    renderPanel();

    expect(screen.getByRole("status", { name: "Saldo total flotante" }).textContent).toMatch(/₡2\s500/);
  });

  it("deja de flotar cuando el resumen natural llega a la pantalla", () => {
    renderPanel();

    act(() => intersectionCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));

    expect(screen.queryByRole("status", { name: "Saldo total flotante" })).toBeNull();
  });
});
