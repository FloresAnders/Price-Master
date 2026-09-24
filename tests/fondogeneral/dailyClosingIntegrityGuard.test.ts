import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({ addDoc: vi.fn(), collection: vi.fn(), serverTimestamp: vi.fn() }));
vi.mock("@/utils/serverTime", () => ({ getAuthoritativeNowISO: async () => "2026-09-23T18:00:00.000Z", getAuthoritativeNowMs: async () => Date.parse("2026-09-23T18:00:00.000Z") }));
vi.mock("@/services/daily-closings", () => ({
  DAILY_CLOSING_DUPLICATE_ERROR: "DUPLICATE", DAILY_CLOSING_SCHEDULE_REQUIRED_ERROR: "SCHEDULE", LEDGER_CHANGED_BEFORE_CLOSING: "LEDGER_CHANGED_BEFORE_CLOSING",
  DailyClosingsService: { saveClosing: vi.fn() }, isValidDailyClosingSchedule: () => true,
}));
vi.mock("@/services/movimientos-fondos", () => ({ MovimientosFondosService: { buildCompanyMovementsKey: () => "movements_TEST", updateLedgerLockTransaction: vi.fn() } }));
vi.mock("@/app/fondogeneral/components/modals/DailyClosingModal", () => ({ clearDailyClosingModalDraft: vi.fn() }));
vi.mock("@/app/fondogeneral/utils/closing/closingGuards", () => ({ acquireClosingGuard: vi.fn(), releaseClosingGuard: vi.fn(), touchClosingGuard: vi.fn() }));
vi.mock("@/app/fondogeneral/utils/closing/ledgerIntegrity", async (importOriginal) => ({ ...await importOriginal<typeof import("@/app/fondogeneral/utils/closing/ledgerIntegrity")>(), loadLedgerIntegrity: vi.fn() }));
import { addDoc } from "firebase/firestore";
import { DailyClosingsService } from "@/services/daily-closings";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import { acquireClosingGuard, releaseClosingGuard } from "@/app/fondogeneral/utils/closing/closingGuards";
import { loadLedgerIntegrity, type LedgerIntegrityResult } from "@/app/fondogeneral/utils/closing/ledgerIntegrity";
import { handleConfirmDailyClosing, type HandleConfirmDailyClosingDeps } from "@/app/fondogeneral/utils/closing/dailyClosing";
const healthy: LedgerIntegrityResult = { ok: true, reason: "balanced", openingId: "opening", expectedCRC: 173_000, expectedUSD: 20, ledgerCRC: 173_000, ledgerUSD: 20, driftCRC: 0, driftUSD: 0, ledgerRevision: 7, ledgerUpdatedAt: "saved" };
const closing = { manager: "Manager", totalCRC: 173_000, totalUSD: 20, notes: "", turno: "D", breakdownCRC: {}, breakdownUSD: {} };
function dependencies(): HandleConfirmDailyClosingDeps {
  return {
    accountKey: "FondoGeneral", activeOwnerId: null, beginDailyClosingsRequest: vi.fn(), company: " TEST ", currentBalanceCRC: 138_000, currentBalanceUSD: 0,
    dailyClosingSubmitInProgressRef: { current: false }, dailyClosings: [], dailyClosingsRequestCountRef: { current: 0 }, editingDailyClosingId: null, finishDailyClosingsRequest: vi.fn(), fondoEntries: [],
    formatToastWaitTime: () => "un minuto", horarioApertura: "06:00", horarioCierre: "22:00", isRegularUser: true, lastDailyClosingSavedAtRef: { current: 0 }, minutesAfterClose: 60,
    requireSingleClosingReason: false, systemVerificationEnabled: false, solicitarApertura: false, loadedDailyClosingKeysRef: { current: new Set() }, loadingDailyClosingKeysRef: { current: new Set() }, ownerAdminEmail: null,
    persistMovementToFirestore: vi.fn(async () => ({ ok: true, confirmed: true })), setDailyClosingInitialValues: vi.fn(), setDailyClosingModalOpen: vi.fn(), setDailyClosings: vi.fn(), setDailyClosingsHydrated: vi.fn(), setEditingDailyClosingId: vi.fn(), setFondoEntries: vi.fn(), setLedgerSnapshot: vi.fn(), setPendingCierreDeCaja: vi.fn(), showToast: vi.fn(), storageSnapshotRef: { current: null }, user: null,
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("localStorage", { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() });
  vi.mocked(loadLedgerIntegrity).mockResolvedValue(healthy);
  vi.mocked(acquireClosingGuard).mockResolvedValue({ ok: true, token: "token", docId: "guard" });
  vi.mocked(releaseClosingGuard).mockResolvedValue(undefined);
  vi.mocked(MovimientosFondosService.updateLedgerLockTransaction).mockResolvedValue({ state: { balancesByAccount: [] } } as never);
});
describe("authoritative closing guard", () => {
  it.each(["mismatch", "opening-missing", "query-failure"])("blocks %s before any side effect", async (failure) => {
    const deps = dependencies();
    if (failure === "query-failure") vi.mocked(loadLedgerIntegrity).mockRejectedValue(new Error("offline"));
    else if (failure === "mismatch") vi.mocked(loadLedgerIntegrity).mockResolvedValue({ ...healthy, ok: false, reason: "mismatch", ledgerCRC: 138_000, driftCRC: -35_000 });
    else vi.mocked(loadLedgerIntegrity).mockResolvedValue({ ...healthy, ok: false, reason: "opening-missing", openingId: null, expectedCRC: null, expectedUSD: null, driftCRC: null, driftUSD: null });
    expect(await handleConfirmDailyClosing(closing as never, deps)).toBeNull();
    expect(DailyClosingsService.saveClosing).not.toHaveBeenCalled();
    expect(addDoc).not.toHaveBeenCalled();
    expect(deps.persistMovementToFirestore).not.toHaveBeenCalled();
    expect(acquireClosingGuard).not.toHaveBeenCalled();
    expect(deps.showToast).toHaveBeenCalled();
  });
  it("records authoritative balances despite stale React props and passes metadata", async () => {
    const deps = dependencies();
    const result = await handleConfirmDailyClosing(closing as never, deps);
    expect(result).toMatchObject({ recordedBalanceCRC: 173_000, recordedBalanceUSD: 20, diffCRC: 0, diffUSD: 0 });
    expect(loadLedgerIntegrity).toHaveBeenCalledWith({ company: "TEST", accountId: "FondoGeneral", operationalStartISO: "2026-09-23T12:00:00.000Z", closingISO: "2026-09-23T18:00:00.000Z" });
    expect(DailyClosingsService.saveClosing).toHaveBeenCalledWith("TEST", expect.objectContaining({ diffCRC: 0 }), expect.any(Object), { ledgerDocId: "movements_TEST", expectedRevision: 7, expectedUpdatedAt: "saved" });
    expect(deps.persistMovementToFirestore).toHaveBeenCalledExactlyOnceWith(expect.any(Array), "create", { upsert: expect.objectContaining({ paymentType: "INFORMATIVO", amountIngreso: 0, amountEgreso: 0 }) });
  });
  it("releases the guard and requests retry without alert mail on concurrent mutation", async () => {
    const deps = dependencies();
    vi.mocked(DailyClosingsService.saveClosing).mockRejectedValue(new Error("LEDGER_CHANGED_BEFORE_CLOSING"));
    expect(await handleConfirmDailyClosing(closing as never, deps)).toBeNull();
    expect(releaseClosingGuard).toHaveBeenCalledWith("TEST", { token: "token", docId: "guard" });
    expect(deps.dailyClosingSubmitInProgressRef.current).toBe(false);
    expect(deps.finishDailyClosingsRequest).toHaveBeenCalledOnce();
    expect(deps.showToast).toHaveBeenCalledWith("El saldo cambió mientras se preparaba el cierre. Actualice e inténtelo de nuevo.", "warning", 6000);
    expect(addDoc).not.toHaveBeenCalled();
    expect(deps.persistMovementToFirestore).not.toHaveBeenCalled();
  });
});
