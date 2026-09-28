import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/fondogeneral/utils/fondo/openingRequirement", () => ({
  validateFondoGeneralOpeningRequirement: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn(async () => "2026-09-28T12:00:00.000Z"),
}));
vi.mock("@/services/fondo-cache", () => ({ invalidateFondoCache: vi.fn() }));
vi.mock("@/app/fondogeneral/utils/invoicePayment/fcrLedgerTransaction", () => ({
  commitFcrPayments: vi.fn(),
}));

import { commitFcrPayments } from "@/app/fondogeneral/utils/invoicePayment/fcrLedgerTransaction";
import { submitClosingInvoicePayment } from "@/app/fondogeneral/utils/invoicePayment/closingInvoicePayment";
import type { FacturaMovement } from "@/services/facturas";

const invoice: FacturaMovement = {
  id: "FCR-3778",
  empresa: "EMPRESA PRUEBA",
  accountId: "FondoGeneral",
  amount: 10_000,
  originalAmount: 10_000,
  amountEgreso: 10_000,
  amountIngreso: 0,
  balanceDue: 10_000,
  createdAt: "2026-09-20T12:00:00.000Z",
  currency: "CRC",
  invoiceNumber: "3778",
  manager: "Encargado",
  notes: "",
  invoiceDocType: "FCR",
  paymentType: "FCR",
  providerCode: "0018",
  paymentStatus: "PENDIENTE",
};

describe("submitClosingInvoicePayment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows a useful message when the FCR identity changed", async () => {
    vi.mocked(commitFcrPayments).mockRejectedValue(new Error("FCR_INVOICE_CHANGED"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const showToast = vi.fn();

    await submitClosingInvoicePayment("full", {
      company: "EMPRESA PRUEBA",
      accountKey: "BCR",
      isCajaNegra: false,
      pendingCierreDeCaja: false,
      closingPaymentTarget: invoice,
      closingPaymentAmount: "10000",
      closingPaymentNotes: "",
      closingPaymentManager2: "",
      closingPaymentCreditNoteIds: [],
      closingPaymentManualCreditNotes: [],
      selectedProviderPendingCreditNotes: [],
      showToast,
      setPendingCierreModalOpen: vi.fn(),
      setClosingPaymentSubmitting: vi.fn(),
      setPendingClosingCreditInvoices: vi.fn(),
      setSelectedProviderPendingCreditNotes: vi.fn(),
      setPendingCreditNotes: vi.fn(),
      setClosingPaymentCreditNoteIds: vi.fn(),
      setClosingPaymentManualCreditNotes: vi.fn(),
      closeClosingInvoicePaymentModal: vi.fn(),
      applyLedgerStateFromStorage: vi.fn(),
      applyConfirmedLedger: vi.fn(() => true),
      rebuildEntriesFromV2Cache: vi.fn(),
      storageSnapshotRef: { current: null },
      v2MovementsCacheRef: { current: {} },
    });

    expect(showToast).toHaveBeenCalledWith(
      "La factura cambió desde que se cargó. Vuelve a abrirla e intenta nuevamente.",
      "error",
      6000,
    );
  });
});
