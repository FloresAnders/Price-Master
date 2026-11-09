import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaMovement } from "@/services/facturas";

const commitFcrPayments = vi.hoisted(() => vi.fn());

vi.mock("@/app/fondogeneral/utils/invoicePayment/fcrLedgerTransaction", () => ({
  commitFcrPayments,
}));

vi.mock("@/app/fondogeneral/utils/fondo/openingRequirement", () => ({
  validateFondoGeneralOpeningRequirement: vi.fn().mockResolvedValue({
    allowed: true,
  }),
}));

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn().mockResolvedValue("2026-11-09T12:00:00.000Z"),
}));

vi.mock("@/services/fondo-cache", () => ({
  invalidateFondoCache: vi.fn().mockResolvedValue(undefined),
}));

import {
  submitClosingInvoicePayment,
  type ClosingInvoicePaymentDeps,
} from "@/app/fondogeneral/utils/invoicePayment/closingInvoicePayment";

const invoice: FacturaMovement = {
  id: "invoice-1",
  empresa: "DELIKOR",
  accountId: "FondoGeneral",
  amount: 27_560.54,
  amountEgreso: 27_560.54,
  amountIngreso: 0,
  createdAt: "2026-11-09T10:00:00.000Z",
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

const buildDeps = (): ClosingInvoicePaymentDeps => ({
  company: "DELIKOR",
  accountKey: "FondoGeneral",
  isCajaNegra: false,
  bypassPendingNightDailyClosing: false,
  pendingCierreDeCaja: false,
  closingPaymentTarget: invoice,
  closingPaymentAmount: "27560.54",
  closingPaymentNotes: "",
  closingPaymentManager2: "",
  closingPaymentCreditNoteIds: [],
  closingPaymentManualCreditNotes: [],
  selectedProviderPendingCreditNotes: [],
  showToast: vi.fn(),
  setPendingCierreModalOpen: vi.fn(),
  setClosingPaymentSubmitting: vi.fn(),
  setPendingClosingCreditInvoices: vi.fn(),
  setSelectedProviderPendingCreditNotes: vi.fn(),
  setPendingCreditNotes: vi.fn(),
  setClosingPaymentCreditNoteIds: vi.fn(),
  setClosingPaymentManualCreditNotes: vi.fn(),
  closeClosingInvoicePaymentModal: vi.fn(),
  applyLedgerStateFromStorage: vi.fn(),
  applyConfirmedLedger: vi.fn().mockReturnValue(true),
  rebuildEntriesFromV2Cache: vi.fn(),
  storageSnapshotRef: { current: null },
  v2MovementsCacheRef: { current: {} },
});

describe("resultado del pago FCR para actualizar el contador", () => {
  beforeEach(() => {
    commitFcrPayments.mockReset().mockResolvedValue({
      ledger: { state: {} },
      invoices: [{ ...invoice, balanceDue: 0, paymentStatus: "PAGADA" }],
      paymentMovements: [{ id: "payment-1" }],
    });
  });

  it("devuelve true solamente despues de confirmar el pago", async () => {
    const result = await submitClosingInvoicePayment("full", buildDeps());

    expect(result).toBe(true);
    expect(commitFcrPayments).toHaveBeenCalledOnce();
  });

  it("devuelve false si la persistencia del pago falla", async () => {
    commitFcrPayments.mockRejectedValueOnce(new Error("network"));

    const result = await submitClosingInvoicePayment("full", buildDeps());

    expect(result).toBe(false);
  });
});
