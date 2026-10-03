// @vitest-environment jsdom

import React from "react";
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearCashCounterSnapshot,
  getCashCounterSnapshot,
  saveCashCounterSnapshot,
} from "@/services/cashCounterDb";

const authState = vi.hoisted(() => ({
  permissions: {
    cashcounter: true,
    fondogeneral: true,
    fondogeneralBCR: true,
    fondogeneralBN: false,
    fondogeneralBAC: false,
    cajaNegra: false,
    tucan: false,
    tiempos: false,
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      role: "admin",
      permissions: authState.permissions,
    },
  }),
}));

import CashCounterTabs from "@/components/business/cash-counter-tabs/CashCounterTabs";

describe("contadores predefinidos por cuenta", () => {
  beforeEach(async () => {
    authState.permissions.fondogeneralBCR = true;
    window.localStorage.clear();
    await clearCashCounterSnapshot();
    await saveCashCounterSnapshot({
      counters: [
        {
          name: "Contador libre",
          bills: { 1000: 3 },
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
        {
          accountId: "FondoGeneral",
          name: "Nombre viejo",
          bills: {},
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
        {
          accountId: "BN",
          name: "Cuenta BN",
          bills: {},
          extraAmount: 0,
          currency: "CRC",
          aperturaCaja: 0,
          ventaActual: 0,
        },
      ],
      activeTab: 0,
      lastSaved: "2026-10-02T12:00:00.000Z",
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("preserva los libres y protege solo los contadores de cuentas activas", async () => {
    render(<CashCounterTabs />);

    expect((await screen.findAllByText("Contador libre")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Cuenta BCR")).not.toBeNull();
    expect(screen.queryByText("Cuenta BN")).toBeNull();

    const fondoLabels = await screen.findAllByText("Fondo General");
    const fondoButton = fondoLabels
      .map((label) => label.closest("button"))
      .find((button): button is HTMLButtonElement => Boolean(button));
    expect(fondoButton).toBeDefined();
    fireEvent.click(fondoButton!);

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Eliminar" })).toBeNull();
    });

    const customButton = screen
      .getAllByText("Contador libre")
      .map((label) => label.closest("button"))
      .find((button): button is HTMLButtonElement => Boolean(button));
    expect(customButton).not.toBeNull();
    fireEvent.click(customButton!);
    expect(screen.getByRole("button", { name: "Eliminar" })).not.toBeNull();
  });

  it("selecciona la cuenta solicitada al abrir el contador flotante", async () => {
    render(
      <CashCounterTabs
        {...({ requestedAccountId: "BCR" } as Record<string, unknown>)}
      />,
    );

    await waitFor(() => {
      expect(screen.getAllByText("Cuenta BCR")).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole("button", { name: /Nuevo contador/i }));

    await waitFor(() => {
      expect(screen.getAllByText(/^Contador \d+$/)).toHaveLength(2);
    });
  });

  it("no pierde una edición pendiente cuando cambian los permisos", async () => {
    const rendered = render(<CashCounterTabs />);
    await screen.findAllByText("Contador libre");

    fireEvent.click(screen.getByRole("button", { name: "Monto Adicional" }));
    const zeroInputs = screen.getAllByPlaceholderText("0");
    const extraInput = zeroInputs.at(-1) as HTMLInputElement | undefined;
    expect(extraInput).toBeDefined();
    fireEvent.change(extraInput!, { target: { value: "500" } });

    authState.permissions.fondogeneralBCR = false;
    rendered.rerender(<CashCounterTabs />);

    await waitFor(async () => {
      const snapshot = await getCashCounterSnapshot();
      const customCounter = snapshot?.counters.find(
        (counter) => counter.name === "Contador libre",
      );
      expect(customCounter?.extraAmount).toBe(500);
    }, { timeout: 1500 });
  });
});
