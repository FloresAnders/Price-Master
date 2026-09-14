// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FacturaPaymentModal from "@/app/fondogeneral/components/modals/FacturaPaymentModal";

afterEach(cleanup);

describe("FacturaPaymentModal", () => {
  it("permite agregar una NC manual aunque no existan NC pendientes", () => {
    const onAddManualCreditNote = vi.fn();

    render(
      <FacturaPaymentModal
        open
        target={{
          id: "fcr-5000",
          empresa: "ACME",
          accountId: "FondoGeneral",
          amount: 27_250,
          originalAmount: 27_250,
          amountEgreso: 27_250,
          amountIngreso: 0,
          balanceDue: 27_250,
          paidAmount: 0,
          createdAt: "2026-09-14T12:00:00.000Z",
          currency: "CRC",
          invoiceNumber: "5000",
          manager: "ALVARO",
          notes: "",
          invoiceDocType: "FCR",
          paymentType: "COMPRA INVENTARIO",
          providerCode: "JACKS",
        }}
        providerName="JACKS"
        employeeOptions={[]}
        employeesLoading={false}
        paymentAmount="27250"
        paymentNotes=""
        paymentManager2=""
        selectedPaymentPaid={0}
        selectedPaymentBalance={27_250}
        selectedPaymentStatus="PENDIENTE"
        paymentSubmitting={false}
        canSubmitFullPayment
        onClose={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onPaymentNotesChange={vi.fn()}
        onPaymentManager2Change={vi.fn()}
        onSubmitPartial={vi.fn()}
        onSubmitFull={vi.fn()}
        onAddManualCreditNote={onAddManualCreditNote}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Agregar nota de crédito manual",
    });
    button.click();
    expect(onAddManualCreditNote).toHaveBeenCalledTimes(1);
  });

  it("muestra como pago generado y total a pagar solo el efectivo debitado", () => {
    render(
      <FacturaPaymentModal
        open
        target={{
          id: "fcr-5000",
          empresa: "ACME",
          accountId: "FondoGeneral",
          amount: 27_250,
          originalAmount: 27_250,
          amountEgreso: 27_250,
          amountIngreso: 0,
          balanceDue: 27_250,
          paidAmount: 0,
          createdAt: "2026-09-14T12:00:00.000Z",
          currency: "CRC",
          invoiceNumber: "5000",
          manager: "ALVARO",
          notes: "",
          invoiceDocType: "FCR",
          paymentType: "COMPRA INVENTARIO",
          providerCode: "JACKS",
        }}
        providerName="JACKS"
        employeeOptions={[]}
        employeesLoading={false}
        paymentAmount="27250"
        paymentNotes=""
        paymentManager2=""
        selectedPaymentPaid={0}
        selectedPaymentBalance={27_250}
        selectedPaymentStatus="PENDIENTE"
        paymentSubmitting={false}
        canSubmitFullPayment
        onClose={vi.fn()}
        onPaymentAmountChange={vi.fn()}
        onPaymentNotesChange={vi.fn()}
        onPaymentManager2Change={vi.fn()}
        onSubmitPartial={vi.fn()}
        onSubmitFull={vi.fn()}
        pendingCreditNotes={[
          {
            id: "nc-6055",
            invoiceNumber: "6055",
            amount: 3_560,
            balanceDue: 3_560,
            currency: "CRC",
          },
        ]}
        selectedCreditNoteIds={["nc-6055"]}
        creditNotesAppliedTotal={3_560}
      />,
    );

    const pagoGenerado = screen
      .getByText("Pago generado")
      .parentElement?.textContent?.replace(/\s/g, " ");
    const totalAPagar = screen
      .getByText("Total a pagar")
      .parentElement?.textContent?.replace(/\s/g, " ");
    const totalAplicado = screen
      .getByText("Total aplicado a la factura")
      .parentElement?.textContent?.replace(/\s/g, " ");

    expect(pagoGenerado).toContain("₡ 23 000");
    expect(totalAPagar).toContain("₡ 23 000");
    expect(totalAplicado).toContain("₡ 27 250");
  });
});
