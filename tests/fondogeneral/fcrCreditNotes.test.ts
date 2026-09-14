import { describe, expect, it } from "vitest";
import type { FacturaMovement } from "@/services/facturas";
import {
  buildManualCreditNoteMovement,
  isInvoicePaymentApplicationValid,
  resolveInvoicePaymentCreditNotes,
  resolvePendingCreditNoteOptionsForInvoice,
  shouldKeepPendingCreditNotesLoaded,
} from "@/app/fondogeneral/utils/invoicePayment/creditNotes";

const movement = (
  overrides: Partial<FacturaMovement>,
): FacturaMovement => ({
  id: "movement-1",
  empresa: "ACME",
  accountId: "FondoGeneral",
  amount: 0,
  amountEgreso: 0,
  amountIngreso: 0,
  createdAt: "2026-09-14T12:00:00.000Z",
  currency: "CRC",
  invoiceNumber: "0001",
  manager: "ALVARO",
  notes: "",
  invoiceDocType: "NC",
  paymentType: "COMPRA INVENTARIO",
  providerCode: "JACKS",
  ...overrides,
});

describe("notas de credito para pagos FCR", () => {
  it("mantiene cargadas las NC al pasar de Agregar movimiento al pago FCR", () => {
    expect(
      shouldKeepPendingCreditNotesLoaded({
        movementModalOpen: false,
        pendingSectionOpen: false,
        paymentProviderCode: "JACKS",
      }),
    ).toBe(true);
  });

  it("resuelve las NC por el proveedor y moneda de la FCR, no por el formulario cerrado", () => {
    const target = movement({
      id: "fcr-5000",
      invoiceDocType: "FCR",
      amount: 27_250,
      originalAmount: 27_250,
      balanceDue: 27_250,
    });
    const result = resolvePendingCreditNoteOptionsForInvoice(
      [
        movement({
          id: "nc-jacks-crc",
          amount: 5_000,
          originalAmount: 5_000,
          paidAmount: 1_440,
          balanceDue: 3_560,
          invoiceNumber: "6055",
        }),
        movement({ id: "nc-otro", providerCode: "OTRO", amount: 7_000 }),
        movement({ id: "nc-usd", currency: "USD", amount: 20 }),
      ],
      target,
    );

    expect(result).toEqual([
      {
        id: "nc-jacks-crc",
        invoiceNumber: "6055",
        amount: 5_000,
        paidAmount: 1_440,
        balanceDue: 3_560,
        currency: "CRC",
      },
    ]);
  });

  it("combina NC pendientes y manuales seleccionadas sin superar el saldo", () => {
    const result = resolveInvoicePaymentCreditNotes({
      balance: 27_250,
      currency: "CRC",
      selectedIds: ["nc-6055", "manual-nc-draft-1"],
      pendingCreditNotes: [
        {
          id: "nc-6055",
          invoiceNumber: "6055",
          amount: 3_560,
          paidAmount: 0,
          balanceDue: 3_560,
          currency: "CRC",
        },
      ],
      manualCreditNotes: [
        {
          id: "manual-nc-draft-1",
          invoiceNumber: "6060",
          amount: 2_000,
          observation: "Devolucion",
        },
      ],
    });

    expect(result.overLimit).toBe(false);
    expect(result.total).toBe(5_560);
    expect(result.persistedNotes).toHaveLength(1);
    expect(result.manualNotes).toEqual([
      {
        id: "manual-nc-draft-1",
        invoiceNumber: "6060",
        amount: 2_000,
        appliedAmount: 2_000,
        currency: "CRC",
        observation: "Devolucion",
      },
    ]);
  });

  it("marca como invalida una combinacion cuyo total solicitado supera el saldo", () => {
    const result = resolveInvoicePaymentCreditNotes({
      balance: 5_000,
      currency: "CRC",
      selectedIds: ["nc-1", "manual-nc-draft-1"],
      pendingCreditNotes: [
        {
          id: "nc-1",
          invoiceNumber: "1000",
          amount: 4_000,
          paidAmount: 0,
          balanceDue: 4_000,
          currency: "CRC",
        },
      ],
      manualCreditNotes: [
        {
          id: "manual-nc-draft-1",
          invoiceNumber: "1001",
          amount: 2_000,
        },
      ],
    });

    expect(result.overLimit).toBe(true);
    expect(result.requestedTotal).toBe(6_000);
  });

  it("permite saldar una FCR solo con notas de credito", () => {
    expect(
      isInvoicePaymentApplicationValid({
        cashDebit: 0,
        totalAppliedToInvoice: 5_000,
      }),
    ).toBe(true);
    expect(
      isInvoicePaymentApplicationValid({
        cashDebit: 0,
        totalAppliedToInvoice: 0,
      }),
    ).toBe(false);
  });

  it("construye la NC manual aplicada como rebajada dentro del pago", () => {
    expect(
      buildManualCreditNoteMovement({
        id: "manual-nc-fcr-5000-1",
        company: "ACME",
        invoice: movement({
          id: "fcr-5000",
          invoiceDocType: "FCR",
          amount: 27_250,
          originalAmount: 27_250,
        }),
        note: {
          id: "manual-nc-draft-1",
          invoiceNumber: "6060",
          amount: 2_000,
          appliedAmount: 2_000,
          currency: "CRC",
          observation: "Devolucion",
        },
        createdAt: "2026-09-14T13:00:00.000Z",
        manager2: "MARIA",
      }),
    ).toMatchObject({
      id: "manual-nc-fcr-5000-1",
      empresa: "ACME",
      accountId: "FondoGeneral",
      providerCode: "JACKS",
      invoiceNumber: "6060",
      invoiceDocType: "NC",
      amount: 2_000,
      paidAmount: 2_000,
      balanceDue: 0,
      paymentStatus: "REBAJADA",
      manager: "ALVARO",
      manager2: "MARIA",
      notes: "Devolucion",
    });
  });
});
