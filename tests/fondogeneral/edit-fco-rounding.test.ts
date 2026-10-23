import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn().mockResolvedValue("2026-10-21T16:44:00.000Z"),
}));

import { handleSubmitFondo } from "@/app/fondogeneral/utils/submitFondo";
import type { FondoEntry } from "@/app/fondogeneral/types";

describe("edición de factura FCO con redondeo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda hacia arriba la selección confirmada", async () => {
    const original: FondoEntry = {
      id: "movement-0035",
      providerCode: "VASOS_MICHELADOS",
      invoiceNumber: "0035",
      invoiceDocType: "FCO",
      paymentType: "Compra Inventario",
      amountEgreso: 19_800,
      amountIngreso: 0,
      amountPayment: 19_000,
      roundingAdjustment: -800,
      manager: "ALICIA",
      notes: "",
      createdAt: "2026-10-21T16:44:00.000Z",
      currency: "CRC",
    };
    const persistMovementToFirestore = vi
      .fn()
      .mockResolvedValue({ ok: false });
    const noop = vi.fn();

    await handleSubmitFondo({
      company: "DELIKOR SINAI",
      isSaving: false,
      movementSubmitInProgressRef: { current: false },
      manager: "ALICIA",
      isCajaNegra: false,
      editingEntryId: original.id,
      getTodayInvoiceMMDD: () => "1021",
      invoiceNumber: "35",
      invoiceDocType: "FCO",
      selectedProvider: "VASOS_MICHELADOS",
      setProviderError: noop,
      selectedProviderExists: true,
      editingEntry: original,
      setInvoiceError: noop,
      isRegularUser: false,
      accountKey: "FondoGeneral",
      namespace: "fg",
      configurarHorasTurno: false,
      manager2: "",
      isEditingPaidFcrMovement: false,
      setManagerError: noop,
      setManager2Error: noop,
      isEgreso: true,
      isIngreso: false,
      egreso: "19800",
      ingreso: "",
      roundUpInvoicePayment: true,
      roundUpMainInvoicePayment: true,
      confirmedRoundUpSelections: [true],
      notes: "",
      movementProviders: [
        { code: "VASOS_MICHELADOS", name: "VASOS MICHELADOS" },
      ],
      paymentType: "Compra Inventario",
      setAmountError: noop,
      showToast: noop,
      selectedAppliedCreditNoteIds: [],
      selectedProviderPendingCreditNotes: [],
      setPendingZeroAmountCreditNoteModalOpen: noop,
      isAdminUser: true,
      isSuperAdminUser: false,
      movementCurrency: "CRC",
      ledgerSnapshot: { currentCRC: 203_000, currentUSD: 0 },
      fondoEntries: [original],
      setIsSaving: noop,
      editingInProgressRef: { current: true },
      persistMovementToFirestore,
      manualCreditNoteDrafts: [],
      pendingClosingCreditInvoices: [],
      selectedPendingCreditInvoiceIds: [],
      selectedProviderPendingCreditInvoices: [],
    });

    expect(persistMovementToFirestore).toHaveBeenCalledOnce();
    const [, mode, options] = persistMovementToFirestore.mock.calls[0];
    expect(mode).toBe("edit");
    expect(options.upsert).toMatchObject({
      amountEgreso: 19_800,
      amountPayment: 20_000,
      roundingAdjustment: 200,
    });
  });

  it("rechaza ingresos CRC de Fondo General menores a ₡1 000 antes del redondeo", async () => {
    const original: FondoEntry = {
      id: "2026_10_22-13_06_52_884_FondoGeneral",
      providerCode: "0016",
      invoiceNumber: "1441",
      invoiceDocType: "FCO",
      paymentType: "COMPRA INVENTARIO",
      amountEgreso: 22_000,
      amountIngreso: 0,
      amountPayment: 22_000,
      manager: "FABIAN",
      notes: "",
      createdAt: "2026-10-22T19:06:52.884Z",
      currency: "CRC",
    };
    const persistMovementToFirestore = vi
      .fn()
      .mockResolvedValue({ ok: false });
    const setAmountError = vi.fn();
    const noop = vi.fn();

    await handleSubmitFondo({
      company: "DELIKOR SINAI",
      isSaving: false,
      movementSubmitInProgressRef: { current: false },
      manager: "FABIAN",
      isCajaNegra: false,
      editingEntryId: original.id,
      editingEntry: original,
      getTodayInvoiceMMDD: () => "1022",
      invoiceNumber: "1441",
      invoiceDocType: "FCO",
      selectedProvider: "0009",
      selectedProviderExists: true,
      setProviderError: noop,
      setInvoiceError: noop,
      isRegularUser: false,
      accountKey: "FondoGeneral",
      namespace: "fg",
      configurarHorasTurno: false,
      manager2: "",
      isEditingPaidFcrMovement: false,
      setManagerError: noop,
      setManager2Error: noop,
      isEgreso: false,
      isIngreso: true,
      egreso: "",
      ingreso: "999.99",
      roundUpInvoicePayment: true,
      roundUpMainInvoicePayment: true,
      confirmedRoundUpSelections: [true],
      notes: "",
      movementProviders: [
        {
          code: "0009",
          name: "INGRESO DESDE FONDO VENTAS",
          type: "VENTAS",
        },
      ],
      paymentType: "VENTAS",
      setAmountError,
      showToast: noop,
      selectedAppliedCreditNoteIds: [],
      selectedProviderPendingCreditNotes: [],
      setPendingZeroAmountCreditNoteModalOpen: noop,
      isAdminUser: true,
      isSuperAdminUser: false,
      movementCurrency: "CRC",
      ledgerSnapshot: { currentCRC: 55_000, currentUSD: 88 },
      fondoEntries: [original],
      setIsSaving: noop,
      editingInProgressRef: { current: true },
      persistMovementToFirestore,
      manualCreditNoteDrafts: [],
      pendingClosingCreditInvoices: [],
      selectedPendingCreditInvoiceIds: [],
      selectedProviderPendingCreditInvoices: [],
    });

    expect(setAmountError).toHaveBeenCalledWith(
      "Ingresa un monto mayor a ₡999.99 para ingreso",
    );
    expect(persistMovementToFirestore).not.toHaveBeenCalled();
  });
});
