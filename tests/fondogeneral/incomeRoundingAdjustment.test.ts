import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn(async () => "2026-10-02T12:00:00.000-06:00"),
}));
vi.mock("@/app/fondogeneral/utils/fondo/openingRequirement", () => ({
  validateFondoGeneralOpeningRequirement: vi.fn(async () => ({ allowed: true })),
}));
vi.mock("@/services/providers", () => ({
  ProvidersService: { incrementMovementCount: vi.fn(async () => undefined) },
}));

import { handleSubmitFondo } from "@/app/fondogeneral/utils/submitFondo";
import type { FondoEntry } from "@/app/fondogeneral/types";

const makeSubmitDeps = (overrides: Record<string, unknown> = {}) => {
  const savedEntries: FondoEntry[] = [];
  const persistMovementToFirestore = vi.fn(async () => ({
    ok: true,
    confirmed: true,
  }));
  return {
    savedEntries,
    persistMovementToFirestore,
    deps: {
      company: "EMPRESA PRUEBA",
      isSaving: false,
      movementSubmitInProgressRef: { current: false },
      manager: "ALICIA",
      isCajaNegra: false,
      editingEntryId: null,
      getTodayInvoiceMMDD: () => "1002",
      invoiceNumber: "1111",
      extraInvoices: [],
      invoiceDocType: "FCO",
      selectedProvider: "VENTAS",
      setProviderError: vi.fn(),
      selectedProviderExists: true,
      editingEntry: null,
      setInvoiceError: vi.fn(),
      isRegularUser: false,
      accountKey: "FondoGeneral",
      namespace: "fg",
      configurarHorasTurno: false,
      empresaUsesSingleClosing: false,
      activeEmpresaForCompany: null,
      getFGMonthlySchedulesCached: vi.fn(async () => []),
      resolveShiftTimingForNow: vi.fn(async () => null),
      resolveShiftEmployeesForNow: vi.fn(async () => []),
      setConfiguredShiftEmployees: vi.fn(),
      setMissingShiftExpectedShift: vi.fn(),
      setMissingShiftDateKey: vi.fn(),
      setMissingShiftModalOpen: vi.fn(),
      setManager: vi.fn(),
      setManagerError: vi.fn(),
      manager2: "",
      isEditingPaidFcrMovement: false,
      setManager2Error: vi.fn(),
      isEgreso: false,
      isIngreso: true,
      egreso: "",
      ingreso: "11220",
      roundUpInvoicePayment: false,
      roundUpMainInvoicePayment: true,
      notes: "",
      movementProviders: [
        { code: "VENTAS", name: "VENTAS", category: "Ingreso" },
      ],
      paymentType: "VENTAS",
      setAmountError: vi.fn(),
      showToast: vi.fn(),
      selectedAppliedCreditNoteIds: [],
      selectedProviderPendingCreditNotes: [],
      setPendingZeroAmountCreditNoteModalOpen: vi.fn(),
      isAdminUser: true,
      isSuperAdminUser: false,
      ledgerSnapshot: { currentCRC: 800_500, currentUSD: 0 },
      fondoEntries: [],
      initialAmount: 800_500,
      lastMovementCreatedAtRef: { current: 0 },
      lastMovementDedupeRef: { current: null },
      lastEditSaveTimestampRef: { current: 0 },
      setIsSaving: vi.fn(),
      editingInProgressRef: { current: false },
      persistMovementToFirestore,
      persistCreatedMovement: vi.fn(async (entry: FondoEntry) => {
        savedEntries.push(entry);
        return true;
      }),
      setFondoEntries: vi.fn(),
      setLedgerSnapshot: vi.fn(),
      setPendingCierreDeCaja: vi.fn(),
      movementAutoCloseLocked: false,
      resetFondoForm: vi.fn(),
      setMovementModalOpen: vi.fn(),
      ownerAdminEmail: "",
      activeOwnerId: "",
      user: { id: "user-1", email: "user@example.com" },
      manualCreditNoteDrafts: [],
      setSelectedProviderPendingCreditNotes: vi.fn(),
      setSelectedAppliedCreditNoteIds: vi.fn(),
      pendingClosingCreditInvoices: [],
      selectedPendingCreditInvoiceIds: [],
      setPendingClosingCreditInvoices: vi.fn(),
      selectedProviderPendingCreditInvoices: [],
      setSelectedPendingCreditInvoiceIds: vi.fn(),
      setFcrPaymentRecovery: vi.fn(),
      v2MovementsCacheRef: { current: {} },
      rebuildEntriesFromV2Cache: vi.fn(),
      applyLedgerStateFromStorage: vi.fn(),
      applyConfirmedLedger: vi.fn(),
      setNegativeBalanceModal: vi.fn(),
      providers: [{ code: "VENTAS", name: "VENTAS" }],
      movementCurrency: "CRC",
      solicitarApertura: false,
      cierreFondoVentasTurnoSelection: "",
      ...overrides,
    },
  };
};

describe("persistencia del ajuste de redondeo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("guarda como negativo un ingreso redondeado hacia abajo", async () => {
    const { deps, savedEntries } = makeSubmitDeps();

    await handleSubmitFondo(deps);

    expect(savedEntries[0]).toMatchObject({
      amountIngreso: 11_000,
      roundingAdjustment: -220,
    });
  });

  it("guarda el ajuste de cada factura adicional", async () => {
    const { deps, savedEntries } = makeSubmitDeps({
      extraInvoices: [
        {
          invoiceNumber: "2222",
          amount: "22330",
          observation: "",
          creditNotes: [],
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.roundingAdjustment)).toEqual([
      -220,
      -330,
    ]);
  });

  it("guarda como negativo un egreso redondeado hacia abajo", async () => {
    const { deps, savedEntries } = makeSubmitDeps({
      isEgreso: true,
      isIngreso: false,
      egreso: "15766",
      ingreso: "",
      paymentType: "COMPRA",
      movementProviders: [
        { code: "VENTAS", name: "VENTAS", category: "Egreso" },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries[0]).toMatchObject({
      amountEgreso: 15_766,
      amountPayment: 15_000,
      roundingAdjustment: -766,
    });
  });

  it("reemplaza el ajuste cuando se edita un movimiento", async () => {
    const original: FondoEntry = {
      id: "mov-edit",
      empresa: "EMPRESA PRUEBA",
      accountId: "FondoGeneral",
      providerCode: "VENTAS",
      invoiceNumber: "1111",
      invoiceDocType: "FCO",
      paymentType: "VENTAS",
      amountEgreso: 0,
      amountIngreso: 11_000,
      roundingAdjustment: -220,
      manager: "ALICIA",
      notes: "",
      createdAt: "2026-10-02T18:00:00.000Z",
      currency: "CRC",
    };
    const { deps, persistMovementToFirestore } = makeSubmitDeps({
      editingEntryId: original.id,
      editingEntry: original,
      fondoEntries: [original],
      ingreso: "11800",
      roundUpInvoicePayment: true,
      confirmedRoundUpSelections: [true],
    });

    await handleSubmitFondo(deps);

    expect(persistMovementToFirestore).toHaveBeenCalledWith(
      expect.any(Array),
      "edit",
      expect.objectContaining({
        upsert: expect.objectContaining({ roundingAdjustment: 200 }),
      }),
    );
  });
});
