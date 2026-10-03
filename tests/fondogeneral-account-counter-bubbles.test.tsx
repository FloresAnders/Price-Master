// @vitest-environment jsdom

import React from "react";
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCashCounterSnapshot,
  getCashCounterSnapshot,
  saveCashCounterSnapshot,
  type CashCounterSnapshot,
} from "@/services/cashCounterDb";

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    user: {
      role: "admin",
      permissions: {
        fondogeneral: true,
        fondogeneralBCR: true,
        fondogeneralBN: false,
        fondogeneralBAC: false,
        cajaNegra: false,
        tucan: false,
        tiempos: false,
        cashcounter: true,
      },
    },
  }),
}));

vi.mock("@/app/fondogeneral/components", () => ({
  FondoSection: ({ namespace }: { namespace: string }) => (
    <div data-testid="fondo-section">namespace-{namespace}</div>
  ),
}));

vi.mock("@/app/fondogeneral/hooks/useFondoGeneralTabLock", () => ({
  useFondoGeneralTabLock: () => "owner",
}));

import FondoPage from "@/app/fondogeneral/page";

const OPEN_EVENT = "price-master:open-cash-counter";

describe("montos de contadores en las cuentas del Fondo General", () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearCashCounterSnapshot();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("muestra solo el monto contado y solicita abrir el contador de esa cuenta", async () => {
    await saveCashCounterSnapshot({
      counters: [
        {
          accountId: "FondoGeneral",
          name: "Fondo General",
          bills: { 20000: 1, 5000: 1 },
          extraAmount: 500,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
      ],
      activeTab: 0,
      lastSaved: "2026-10-02T12:00:00.000Z",
    } as CashCounterSnapshot);

    let openedAccountId: string | undefined;
    const handleOpen = (event: Event) => {
      openedAccountId = (event as CustomEvent<{ accountId: string }>).detail.accountId;
    };
    window.addEventListener(OPEN_EVENT, handleOpen);

    render(<FondoPage />);

    const bubble = await screen.findByRole("button", {
      name: "Abrir contador de Fondo General: 25 500",
    });
    await waitFor(() => expect(bubble.textContent).toBe("25 500"));
    expect(bubble.textContent).not.toMatch(/CRC|USD|₡|\$/);

    fireEvent.click(bubble);
    expect(openedAccountId).toBe("FondoGeneral");

    await waitFor(async () => {
      const snapshot = await getCashCounterSnapshot();
      expect(snapshot?.counters.some((counter) => counter.name === "Cuenta BCR")).toBe(true);
    });

    window.removeEventListener(OPEN_EVENT, handleOpen);
  });

  it("migra los contadores antiguos si Fondo General se abre antes que el contador", async () => {
    window.localStorage.setItem(
      "cashCounters",
      JSON.stringify([
        {
          name: "Contador heredado",
          bills: { 1000: 2 },
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
      ]),
    );

    render(<FondoPage />);

    await waitFor(async () => {
      const snapshot = await getCashCounterSnapshot();
      expect(snapshot?.counters.some((counter) => counter.name === "Contador heredado"))
        .toBe(true);
      expect(window.localStorage.getItem("cashCounters")).toBeNull();
    });
  });
});
