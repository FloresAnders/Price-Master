// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FacturaPaymentModal from "@/app/fondogeneral/components/modals/FacturaPaymentModal";
import type { FacturaMovement } from "@/services/facturas";

const suggestion = {
  accountId: "FondoGeneral" as const,
  expectedCounterTotal: 1_363_000,
  expectedCounterFingerprint: "fondo-general-1363000",
  amount: 27_000,
  suggestedAmount: 27_000,
  changeRequired: 0,
  bills: { 20000: 1, 5000: 1, 1000: 2 },
};

const loadSuggestion = vi.hoisted(() => vi.fn());
const applySuggestion = vi.hoisted(() => vi.fn());

vi.mock("@/components/business/cash-counter-tabs/paymentSuggestion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/business/cash-counter-tabs/paymentSuggestion")>()),
  loadFondoGeneralPaymentSuggestion: loadSuggestion,
  applyFondoGeneralPaymentSuggestion: applySuggestion,
}));

const target: FacturaMovement = {
  id: "invoice-1",
  empresa: "DELIKOR",
  accountId: "FondoGeneral",
  amount: 27_560.54,
  amountEgreso: 27_560.54,
  amountIngreso: 0,
  createdAt: "2026-11-09T12:00:00.000Z",
  currency: "CRC",
  invoiceNumber: "1234",
  manager: "FABIAN",
  notes: "",
  invoiceDocType: "FCR",
  paymentType: "EFECTIVO",
  providerCode: "PROV-1",
  paidAmount: 0,
  balanceDue: 27_560.54,
  paymentStatus: "PENDIENTE",
};

const renderModal = (
  onSubmitFull: () => Promise<boolean>,
  overrides: Partial<React.ComponentProps<typeof FacturaPaymentModal>> = {},
) =>
  render(
    <FacturaPaymentModal
      open
      target={target}
      providerName="Proveedor"
      employeeOptions={[]}
      employeesLoading={false}
      paymentAmount="27560.54"
      paymentNotes=""
      paymentManager2=""
      selectedPaymentPaid={0}
      selectedPaymentBalance={27_560.54}
      selectedPaymentStatus="PENDIENTE"
      paymentSubmitting={false}
      canSubmitFullPayment
      balanceCRC={1_363_000}
      balanceUSD={0}
      onClose={vi.fn()}
      onPaymentAmountChange={vi.fn()}
      onPaymentNotesChange={vi.fn()}
      onPaymentManager2Change={vi.fn()}
      onSubmitPartial={vi.fn().mockResolvedValue(false)}
      onSubmitFull={onSubmitFull}
      {...overrides}
    />,
  );

afterEach(cleanup);

describe("confirmacion del pago con denominaciones del Fondo General", () => {
  beforeEach(() => {
    loadSuggestion.mockReset().mockResolvedValue(suggestion);
    applySuggestion.mockReset().mockResolvedValue(true);
  });

  it("muestra la sugerencia y descuenta el contador despues de guardar el pago", async () => {
    const onSubmitFull = vi.fn().mockResolvedValue(true);
    renderModal(onSubmitFull);

    fireEvent.click(screen.getByRole("button", { name: "Pagar completo" }));

    expect(await screen.findByText("Sugerencia de billetes")).toBeTruthy();
    expect(screen.getByText("1 × ₡20.000")).toBeTruthy();
    expect(screen.getByText("1 × ₡5.000")).toBeTruthy();
    expect(screen.getByText("2 × ₡1.000")).toBeTruthy();
    expect(loadSuggestion).toHaveBeenCalledWith({
      currentBalance: 1_363_000,
      paymentAmount: 27_000,
    });

    fireEvent.click(screen.getByRole("button", { name: "Pagar" }));

    await waitFor(() => expect(onSubmitFull).toHaveBeenCalledOnce());
    await waitFor(() => expect(applySuggestion).toHaveBeenCalledWith(suggestion));
  });

  it("no descuenta el contador cuando el pago no se guarda", async () => {
    const onSubmitFull = vi.fn().mockResolvedValue(false);
    renderModal(onSubmitFull);

    fireEvent.click(screen.getByRole("button", { name: "Pagar completo" }));
    await screen.findByText("Sugerencia de billetes");
    fireEvent.click(screen.getByRole("button", { name: "Pagar" }));

    await waitFor(() => expect(onSubmitFull).toHaveBeenCalledOnce());
    await Promise.resolve();
    expect(applySuggestion).not.toHaveBeenCalled();
  });

  it("avisa cuanto debe cambiar cuando la sugerencia queda corta", async () => {
    loadSuggestion.mockResolvedValueOnce({
      ...suggestion,
      amount: 25_000,
      suggestedAmount: 20_000,
      changeRequired: 5_000,
      bills: { 20000: 1 },
    });
    renderModal(vi.fn().mockResolvedValue(true), {
      paymentAmount: "25000",
      selectedPaymentBalance: 25_000,
    });

    fireEvent.click(screen.getByRole("button", { name: "Pagar completo" }));

    expect(await screen.findByText("Debe cambiar ₡5.000")).toBeTruthy();
    expect(screen.getByText("Monto sugerido: ₡20.000")).toBeTruthy();
  });

  it("descarta una sugerencia lenta cuando cambia la factura", async () => {
    let resolveSuggestion: (value: typeof suggestion) => void = () => {};
    loadSuggestion.mockReturnValueOnce(
      new Promise<typeof suggestion>((resolve) => {
        resolveSuggestion = resolve;
      }),
    );
    const onSubmitFull = vi.fn().mockResolvedValue(true);
    const view = renderModal(onSubmitFull);

    fireEvent.click(screen.getByRole("button", { name: "Pagar completo" }));
    view.rerender(
      <FacturaPaymentModal
        open
        target={{ ...target, id: "invoice-2", invoiceNumber: "5678", amount: 5_000, balanceDue: 5_000 }}
        providerName="Proveedor"
        employeeOptions={[]}
        employeesLoading={false}
        paymentAmount="5000"
        paymentNotes=""
        paymentManager2=""
        selectedPaymentPaid={0}
        selectedPaymentBalance={5_000}
        selectedPaymentStatus="PENDIENTE"
        paymentSubmitting={false}
        canSubmitFullPayment
        balanceCRC={1_363_000}
        balanceUSD={0}
        onClose={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onPaymentNotesChange={vi.fn()}
        onPaymentManager2Change={vi.fn()}
        onSubmitPartial={vi.fn().mockResolvedValue(false)}
        onSubmitFull={onSubmitFull}
      />,
    );

    await act(async () => {
      resolveSuggestion(suggestion);
      await Promise.resolve();
    });

    expect(screen.queryByText("Sugerencia de billetes")).toBeNull();
    expect(screen.queryByRole("button", { name: "Pagar" })).toBeNull();
  });
});
