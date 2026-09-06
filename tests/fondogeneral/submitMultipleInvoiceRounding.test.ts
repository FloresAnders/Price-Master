import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn(async () => "2026-09-05T22:01:00.000-06:00"),
}));

vi.mock("@/app/fondogeneral/utils/fondo/openingRequirement", () => ({
  validateFondoGeneralOpeningRequirement: vi.fn(async () => ({
    allowed: true,
  })),
}));

vi.mock("@/services/providers", () => ({
  ProvidersService: {
    incrementMovementCount: vi.fn(async () => undefined),
  },
}));

import { handleSubmitFondo } from "@/app/fondogeneral/utils/submitFondo";
import type { FondoEntry } from "@/app/fondogeneral/types";

const makeDeps = (overrides: Record<string, unknown> = {}) => {
  const savedEntries: FondoEntry[] = [];
  const persistCreatedMovement = vi.fn(async (entry: FondoEntry) => {
    savedEntries.push(entry);
    return true;
  });

  return {
    savedEntries,
    deps: {
      company: "DELIKOR",
      isSaving: false,
      movementSubmitInProgressRef: { current: false },
      manager: "ALICIA",
      isCajaNegra: false,
      editingEntryId: null,
      getTodayInvoiceMMDD: () => "0905",
      invoiceNumber: "1111",
      invoiceDocType: "FCO",
      selectedProvider: "DOS_PINOS",
      setProviderError: vi.fn(),
      selectedProviderExists: true,
      editingEntry: null,
      setInvoiceError: vi.fn(),
      isRegularUser: false,
      accountKey: "FondoGeneral",
      namespace: "fg",
      isDelifoodCompany: false,
      activeEmpresaForCompany: null,
      getFGMonthlySchedulesCached: vi.fn(async () => []),
      resolveShiftTimingForNow: vi.fn(async () => null),
      setMissingShiftExpectedShift: vi.fn(),
      setMissingShiftDateKey: vi.fn(),
      setMissingShiftModalOpen: vi.fn(),
      setManager: vi.fn(),
      setManagerError: vi.fn(),
      manager2: "",
      isEditingPaidFcrMovement: false,
      setManager2Error: vi.fn(),
      isEgreso: true,
      isIngreso: false,
      egreso: "11220",
      ingreso: "",
      roundUpInvoicePayment: false,
      notes: "",
      movementProviders: [{ code: "DOS_PINOS", name: "DOS PINOS" }],
      paymentType: "Compra Inventario",
      setAmountError: vi.fn(),
      showToast: vi.fn(),
      selectedAppliedCreditNoteIds: [],
      selectedProviderPendingCreditNotes: [],
      setPendingZeroAmountCreditNoteModalOpen: vi.fn(),
      isAdminUser: true,
      isSuperAdminUser: false,
      ledgerSnapshot: { currentCRC: 800500, currentUSD: 0 },
      fondoEntries: [],
      initialAmount: 800500,
      lastMovementCreatedAtRef: { current: 0 },
      lastMovementDedupeRef: { current: null },
      lastEditSaveTimestampRef: { current: 0 },
      setIsSaving: vi.fn(),
      editingInProgressRef: { current: false },
      persistMovementToFirestore: vi.fn(),
      persistCreatedMovement,
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
      v2MovementsCacheRef: { current: {} },
      rebuildEntriesFromV2Cache: vi.fn(),
      applyLedgerStateFromStorage: vi.fn(),
      storageSnapshotRef: { current: null },
      setNegativeBalanceModal: vi.fn(),
      providers: [{ code: "DOS_PINOS", name: "DOS PINOS" }],
      movementCurrency: "CRC",
      solicitarApertura: false,
      cierreFondoVentasTurnoSelection: "",
      ...overrides,
    },
  };
};

describe("persistencia de varias facturas FCO", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda el pago redondeado de cada factura", async () => {
    const { deps, savedEntries } = makeDeps({
      extraInvoices: [
        {
          invoiceNumber: "2222",
          amount: "22330",
          observation: "",
          creditNotes: [],
        },
        {
          invoiceNumber: "3333",
          amount: "33440",
          observation: "",
          creditNotes: [],
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.amountPayment)).toEqual([
      11000,
      22000,
      33000,
    ]);
  });

  it("resta las NC antes de redondear los pagos adicionales", async () => {
    const { deps, savedEntries } = makeDeps({
      extraInvoices: [
        {
          invoiceNumber: "8888",
          amount: "15500",
          observation: "",
          creditNotes: [
            { id: "nc-1", invoiceNumber: "101", amount: 1000 },
          ],
        },
        {
          invoiceNumber: "9999",
          amount: "2001",
          observation: "",
          creditNotes: [
            { id: "nc-2", invoiceNumber: "102", amount: 500 },
          ],
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.amountPayment)).toEqual([
      11000,
      14000,
      1000,
    ]);
  });

  it("valida el saldo disponible con la suma ya redondeada", async () => {
    const { deps, savedEntries } = makeDeps({
      isAdminUser: false,
      ledgerSnapshot: { currentCRC: 66500, currentUSD: 0 },
      initialAmount: 66500,
      extraInvoices: [
        {
          invoiceNumber: "2222",
          amount: "22330",
          observation: "",
          creditNotes: [],
        },
        {
          invoiceNumber: "3333",
          amount: "33440",
          observation: "",
          creditNotes: [],
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(deps.setNegativeBalanceModal).not.toHaveBeenCalled();
    expect(savedEntries).toHaveLength(3);
  });

  it("redondea hacia arriba solo las facturas elegibles marcadas", async () => {
    const { deps, savedEntries } = makeDeps({
      egreso: "7499",
      roundUpInvoicePayment: true,
      roundUpMainInvoicePayment: true,
      extraInvoices: [
        {
          invoiceNumber: "2222",
          amount: "8525",
          observation: "",
          creditNotes: [],
          roundUpToThousand: true,
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.amountPayment)).toEqual([
      7000,
      9000,
    ]);
  });

  it("respeta las facturas elegibles desmarcadas individualmente", async () => {
    const { deps, savedEntries } = makeDeps({
      egreso: "8525",
      roundUpInvoicePayment: true,
      roundUpMainInvoicePayment: false,
      extraInvoices: [
        {
          invoiceNumber: "2222",
          amount: "8525",
          observation: "",
          creditNotes: [],
          roundUpToThousand: false,
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.amountPayment)).toEqual([
      8000,
      8000,
    ]);
  });

  it("guarda la seleccion confirmada aunque el estado anterior estuviera marcado", async () => {
    const { deps, savedEntries } = makeDeps({
      egreso: "7499",
      roundUpInvoicePayment: true,
      roundUpMainInvoicePayment: true,
      confirmedRoundUpSelections: [false, false, true],
      extraInvoices: [
        {
          invoiceNumber: "0013",
          amount: "8525",
          observation: "",
          creditNotes: [],
          roundUpToThousand: true,
        },
        {
          invoiceNumber: "0014",
          amount: "9999",
          observation: "",
          creditNotes: [],
          roundUpToThousand: true,
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.amountPayment)).toEqual([
      7000,
      8000,
      10000,
    ]);
  });
});
