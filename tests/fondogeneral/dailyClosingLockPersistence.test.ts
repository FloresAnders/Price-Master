import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/utils/serverTime", () => ({
  getAuthoritativeNowISO: vi.fn(),
  getAuthoritativeNowMs: vi.fn(async () => 1_779_000_000_000),
}));
vi.mock("@/services/daily-closings", () => ({
  DAILY_CLOSING_DUPLICATE_ERROR: "DAILY_CLOSING_DUPLICATE",
  DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR: "SCHEDULE_REQUIRED",
  LEDGER_CHANGED_BEFORE_CLOSING: "LEDGER_CHANGED_BEFORE_CLOSING",
  DailyClosingsService: { saveClosing: vi.fn(async () => undefined) },
  isValidDailyClosingSchedule: vi.fn(() => true),
}));
vi.mock("@/app/fondogeneral/utils/closing/ledgerIntegrity", () => ({
  buildOperationalStartISO: vi.fn(() => "2026-09-23T12:00:00.000Z"),
  formatLedgerIntegrityMismatch: vi.fn(),
  loadLedgerIntegrity: vi.fn(async () => ({ ok: true, reason: "balanced", ledgerCRC: 138_000, ledgerUSD: 0, ledgerRevision: 1, ledgerUpdatedAt: "saved" })),
}));
vi.mock("@/services/movimientos-fondos", () => ({
  MovimientosFondosService: {
    buildCompanyMovementsKey: vi.fn(() => "movements_DELIKOR SINAI"),
    updateLedgerLockTransaction: vi.fn(),
  },
}));
vi.mock("@/app/fondogeneral/components/modals/DailyClosingModal", () => ({
  clearDailyClosingModalDraft: vi.fn(),
}));
vi.mock("@/app/fondogeneral/utils/closing/closingGuards", () => ({
  acquireClosingGuard: vi.fn(),
  releaseClosingGuard: vi.fn(),
  touchClosingGuard: vi.fn(),
}));

import { getAuthoritativeNowISO } from "@/utils/serverTime";
import { DailyClosingsService } from "@/services/daily-closings";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import { handleConfirmDailyClosing } from "@/app/fondogeneral/utils/closing/dailyClosing";

const closingTime = "2026-09-23T12:34:56.000Z";

describe("daily closing ledger lock persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", { setItem: vi.fn(), getItem: vi.fn(), removeItem: vi.fn() });
  });

  it.each([
    { storageThrows: false, contextAccepted: true },
    { storageThrows: true, contextAccepted: true },
    { storageThrows: false, contextAccepted: false },
  ])("applies committed ledger only for current context: %j", async ({ storageThrows, contextAccepted }) => {
    if (storageThrows) vi.stubGlobal("localStorage", {
      setItem: vi.fn(() => { throw new Error("storage unavailable"); }),
      getItem: vi.fn(), removeItem: vi.fn(),
    });
    vi.mocked(getAuthoritativeNowISO)
      .mockResolvedValueOnce(closingTime)
      .mockRejectedValue(new Error("second time lookup unavailable"));
    const ledger = {
      company: "DELIKOR SINAI",
      state: {
        balancesByAccount: [
          { accountId: "FondoGeneral", currency: "CRC", initialBalance: 0, currentBalance: 138_000 },
          { accountId: "FondoGeneral", currency: "USD", initialBalance: 0, currentBalance: 0 },
        ],
        lockedUntil: closingTime,
        revision: 1,
        updatedAt: closingTime,
      },
    };
    vi.mocked(DailyClosingsService.saveClosing).mockResolvedValue(ledger as never);
    const storageSnapshotRef = { current: null as typeof ledger | null };
    const setLedgerSnapshot = vi.fn();

    const record = await handleConfirmDailyClosing({
      manager: "Manager",
      totalCRC: 138_000,
      totalUSD: 0,
      notes: "",
      turno: "D",
      breakdownCRC: {},
      breakdownUSD: {},
    } as never, {
      accountKey: "FondoGeneral",
      activeOwnerId: null,
      beginDailyClosingsRequest: vi.fn(),
      company: "DELIKOR SINAI",
      currentBalanceCRC: 138_000,
      currentBalanceUSD: 0,
      dailyClosingSubmitInProgressRef: { current: false },
      dailyClosings: [],
      dailyClosingsRequestCountRef: { current: 0 },
      editingDailyClosingId: null,
      finishDailyClosingsRequest: vi.fn(),
      fondoEntries: [],
      formatToastWaitTime: vi.fn(() => "1 minuto"),
      horarioApertura: "06:00",
      horarioCierre: "22:00",
      isRegularUser: false,
      lastDailyClosingSavedAtRef: { current: 0 },
      minutesAfterClose: 60,
      authorizedOperationalDateKey: "2026-09-23",
      requireSingleClosingReason: false,
      systemVerificationEnabled: false,
      solicitarApertura: false,
      loadedDailyClosingKeysRef: { current: new Set() },
      loadingDailyClosingKeysRef: { current: new Set() },
      ownerAdminEmail: null,
      persistMovementToFirestore: vi.fn(async () => ({ ok: true, confirmed: true })),
      setDailyClosingInitialValues: vi.fn(),
      setDailyClosingModalOpen: vi.fn(),
      setDailyClosings: vi.fn(),
      setDailyClosingsHydrated: vi.fn(),
      setEditingDailyClosingId: vi.fn(),
      setFondoEntries: vi.fn(),
      setLedgerSnapshot,
      applyConfirmedLedger: vi.fn((_key, incoming) => {
        if (contextAccepted) storageSnapshotRef.current = incoming;
        return contextAccepted;
      }),
      isCurrentLedgerContext: vi.fn(() => contextAccepted),
      setPendingCierreDeCaja: vi.fn(),
      showToast: vi.fn(),
      storageSnapshotRef,
      user: null,
    });

    expect(DailyClosingsService.saveClosing).toHaveBeenCalledOnce();
    expect(record?.createdAt ?? null).toBe(contextAccepted ? closingTime : null);
    expect(MovimientosFondosService.updateLedgerLockTransaction).not.toHaveBeenCalled();
    expect(getAuthoritativeNowISO).toHaveBeenCalledOnce();
    if (contextAccepted) {
      expect(storageSnapshotRef.current).toBe(ledger);
      expect(setLedgerSnapshot).toHaveBeenCalledWith({
        initialCRC: 0, currentCRC: 138_000, initialUSD: 0, currentUSD: 0,
      });
    } else {
      expect(storageSnapshotRef.current).toBeNull();
      expect(setLedgerSnapshot).not.toHaveBeenCalled();
    }
  });
});
