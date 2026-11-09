// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type React from "react";
import { MovementDrawer } from "@/app/fondogeneral/components/drawers/MovementDrawer";

const loadSuggestion = vi.hoisted(() => vi.fn());
const applySuggestion = vi.hoisted(() => vi.fn());

vi.mock("@/components/business/cash-counter-tabs/paymentSuggestion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/business/cash-counter-tabs/paymentSuggestion")>()),
  loadFondoGeneralPaymentSuggestion: loadSuggestion,
  applyFondoGeneralPaymentSuggestion: applySuggestion,
}));

vi.mock("@/app/fondogeneral/components/AgregarMovimiento", () => ({
  default: ({ onSubmit }: { onSubmit: () => void }) => (
    <button type="button" onClick={onSubmit}>
      Abrir confirmación
    </button>
  ),
}));

const suggestion = {
  accountId: "FondoGeneral" as const,
  expectedCounterTotal: 643_000,
  expectedCounterFingerprint: "fondo-general-643000",
  amount: 25_000,
  bills: { 20000: 1, 5000: 1 },
};

const renderDrawer = (onSubmit: () => Promise<boolean>) =>
  render(
    <MovementDrawer
      {...({
        open: true,
        onClose: vi.fn(),
        editingEntry: null,
        movementAutoCloseLocked: false,
        onToggleMovementAutoCloseLocked: vi.fn(),
        beforeConfirmSubmit: vi.fn().mockResolvedValue(true),
        onSubmit,
        isSaving: false,
        selectedProvider: "0020",
        providers: [{ code: "0020", name: "TORTIRICAS" }],
        invoiceNumber: "5253",
        extraInvoices: [],
        notes: "",
        isEgreso: true,
        isIngreso: false,
        egreso: "25000",
        ingreso: "",
        currency: "CRC",
        accountKey: "FondoGeneral",
        invoiceDocType: "FCO",
        amountPayment: 25_000,
        balanceCRC: 643_000,
      } as unknown as React.ComponentProps<typeof MovementDrawer>)}
    />,
  );

afterEach(cleanup);

describe("sugerencia del contador al confirmar un movimiento", () => {
  beforeEach(() => {
    loadSuggestion.mockReset().mockResolvedValue(suggestion);
    applySuggestion.mockReset().mockResolvedValue(true);
  });

  it("muestra denominaciones y las descuenta tras guardar el movimiento", async () => {
    const onSubmit = vi.fn().mockResolvedValue(true);
    renderDrawer(onSubmit);

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmación" }));

    expect(await screen.findByText("Sugerencia de billetes")).toBeTruthy();
    expect(screen.getByText("1 × ₡20.000")).toBeTruthy();
    expect(screen.getByText("1 × ₡5.000")).toBeTruthy();
    expect(loadSuggestion).toHaveBeenCalledWith({
      currentBalance: 643_000,
      paymentAmount: 25_000,
    });

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    await waitFor(() => expect(applySuggestion).toHaveBeenCalledWith(suggestion));
  });

  it("no descuenta billetes cuando guardar falla", async () => {
    const onSubmit = vi.fn().mockResolvedValue(false);
    renderDrawer(onSubmit);

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmación" }));
    await screen.findByText("Sugerencia de billetes");
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(applySuggestion).not.toHaveBeenCalled();
  });

  it("avisa el monto que debe cambiar cuando no hay combinacion exacta", async () => {
    loadSuggestion.mockResolvedValueOnce({
      ...suggestion,
      suggestedAmount: 20_000,
      changeRequired: 5_000,
      bills: { 20000: 1 },
    });
    renderDrawer(vi.fn().mockResolvedValue(true));

    fireEvent.click(screen.getByRole("button", { name: "Abrir confirmación" }));

    expect(await screen.findByText("Debe cambiar ₡5.000")).toBeTruthy();
    expect(screen.getByText("Monto sugerido: ₡20.000")).toBeTruthy();
  });
});
