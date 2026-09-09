// @vitest-environment jsdom

import React, { type ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn(async () => "2026-09-09T12:00:00.000-06:00"),
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

import AgregarMovimiento from "@/app/fondogeneral/components/AgregarMovimiento";
import { handleSubmitFondo } from "@/app/fondogeneral/utils/submitFondo";
import type { FondoEntry } from "@/app/fondogeneral/types";

type FormProps = ComponentProps<typeof AgregarMovimiento>;

const baseFormProps: FormProps = {
  selectedProvider: "VENTAS",
  onProviderChange: vi.fn(),
  providers: [{ code: "VENTAS", name: "VENTAS", category: "Ingreso" }],
  providersLoading: false,
  isProviderSelectDisabled: false,
  selectedProviderExists: true,
  invoiceNumber: "1111",
  onInvoiceNumberChange: vi.fn(),
  invoiceDocType: "FCO",
  onInvoiceDocTypeChange: vi.fn(),
  invoiceValid: true,
  invoiceDisabled: false,
  paymentType: "VENTAS",
  isEgreso: false,
  isIngreso: true,
  egreso: "",
  onEgresoChange: vi.fn(),
  egresoBorderClass: "",
  ingreso: "11220",
  onIngresoChange: vi.fn(),
  ingresoBorderClass: "",
  notes: "",
  onNotesChange: vi.fn(),
  manager: "ALICIA",
  onManagerChange: vi.fn(),
  managerSelectDisabled: false,
  employeeOptions: ["ALICIA"],
  employeesLoading: false,
  editingEntryId: null,
  onCancelEditing: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitDisabled: false,
  onFieldKeyDown: vi.fn(),
  currency: "CRC",
  accountKey: "FondoGeneral",
};

const digits = (value: string | null | undefined) =>
  String(value ?? "").replace(/\D/g, "");

const renderedTotal = () =>
  digits(
    screen
      .getByText("Total a guardar")
      .parentElement?.querySelector("span:last-child")?.textContent,
  );

const makeSubmitDeps = (overrides: Record<string, unknown> = {}) => {
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
      getTodayInvoiceMMDD: () => "0909",
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
      providers: [{ code: "VENTAS", name: "VENTAS" }],
      movementCurrency: "CRC",
      solicitarApertura: false,
      cierreFondoVentasTurnoSelection: "",
      ...overrides,
    },
  };
};

describe("redondeo visual de ingresos del Fondo General", () => {
  afterEach(cleanup);

  it("muestra el ingreso CRC redondeado hacia abajo a la unidad de mil", () => {
    render(<AgregarMovimiento {...baseFormProps} />);

    expect(screen.getByText("Redondeo Aplicado")).toBeTruthy();
    expect(renderedTotal()).toBe("11000");
  });

  it("permite redondear hacia arriba un ingreso CRC elegible", () => {
    render(
      <AgregarMovimiento
        {...baseFormProps}
        ingreso="11800"
        roundUpToThousand
        onRoundUpToThousandChange={vi.fn()}
      />,
    );

    expect(renderedTotal()).toBe("12000");
    expect(
      screen.getByRole("checkbox", { name: "Redondear hacia arriba" }),
    ).toBeTruthy();
  });

  it("conserva el monto exacto de ingresos USD y de otras cuentas", () => {
    const { rerender } = render(
      <AgregarMovimiento
        {...baseFormProps}
        ingreso="11220.75"
        currency="USD"
      />,
    );
    expect(renderedTotal()).toBe("1122075");

    rerender(
      <AgregarMovimiento
        {...baseFormProps}
        ingreso="11220.75"
        accountKey="BCR"
      />,
    );
    expect(renderedTotal()).toBe("1122075");
  });
});

describe("persistencia del redondeo de ingresos del Fondo General", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("guarda redondeados hacia abajo el ingreso principal y los adicionales", async () => {
    const { deps, savedEntries } = makeSubmitDeps({
      extraInvoices: [
        {
          invoiceNumber: "2222",
          amount: "22330",
          observation: "",
          creditNotes: [
            { id: "stale-nc", invoiceNumber: "9001", amount: 500 },
          ],
        },
      ],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries.map((entry) => entry.amountIngreso)).toEqual([
      11000,
      22000,
    ]);
    expect(savedEntries.map((entry) => entry.amountEgreso)).toEqual([0, 0]);
  });

  it("guarda hacia arriba un ingreso elegible confirmado", async () => {
    const { deps, savedEntries } = makeSubmitDeps({
      ingreso: "11800",
      roundUpInvoicePayment: true,
      confirmedRoundUpSelections: [true],
    });

    await handleSubmitFondo(deps);

    expect(savedEntries[0]?.amountIngreso).toBe(12000);
  });

  it("no redondea ingresos en USD ni en otras cuentas", async () => {
    const usd = makeSubmitDeps({
      ingreso: "11220.75",
      movementCurrency: "USD",
    });
    const bcr = makeSubmitDeps({
      ingreso: "11220.75",
      accountKey: "BCR",
    });

    await handleSubmitFondo(usd.deps);
    await handleSubmitFondo(bcr.deps);

    expect(usd.savedEntries[0]?.amountIngreso).toBe(11220.75);
    expect(bcr.savedEntries[0]?.amountIngreso).toBe(11220.75);
  });
});
