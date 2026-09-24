// @vitest-environment jsdom
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("@/app/fondogeneral/utils/v2movementsLoader", () => ({ ensureV2MovementsLoaded: vi.fn(async () => undefined) }));
import { MovimientosFondosService as Service, type MovementStorage, type LedgerMovementChange } from "@/services/movimientos-fondos";
import { useV2MovementsHydration } from "@/app/fondogeneral/hooks/fondo/useV2MovementsHydration";
import { ensureV2MovementsLoaded } from "@/app/fondogeneral/utils/v2movementsLoader";
import type { FondoEntry } from "@/app/fondogeneral/types";

type Props = Parameters<typeof useV2MovementsHydration>[0];
type Snapshot = { storage: MovementStorage<FondoEntry>; hasPendingWrites: boolean; fromCache: boolean };
let next: (value: Snapshot) => void;
let fail: (error: Error) => void;
let unsubscribe: ReturnType<typeof vi.fn<() => void>>;
let props: Props;
type ServerEntry = FondoEntry & { accountId: "FondoGeneral"; currency: "CRC" };
const movement: ServerEntry = { id: "m1", createdAt: "2026-09-23T12:00:00.000Z", accountId: "FondoGeneral", currency: "CRC", providerCode: "P1", paymentType: "EFECTIVO", invoiceNumber: "I1", manager: "user", notes: "", amountIngreso: 20, amountEgreso: 0 };
function snapshot(revision: number, change: Partial<LedgerMovementChange> = {}): Snapshot {
  const storage = Service.createEmptyMovementStorage<FondoEntry>("ACME");
  storage.state.revision = revision;
  storage.state.balancesByAccount[0].currentBalance = revision * 100;
  storage.state.lastChange = { kind: "movement", revision, movementId: "m1", operation: "create", accountId: "FondoGeneral", currency: "CRC", updatedAt: movement.createdAt, ...change };
  return { storage, hasPendingWrites: false, fromCache: false };
}
async function emit(value: Snapshot) { await act(async () => { next(value); }); }
function event(name: string) { act(() => { window.dispatchEvent(new Event(name)); }); }
function visibility(value: string) { Object.defineProperty(document, "visibilityState", { configurable: true, value }); act(() => { document.dispatchEvent(new Event("visibilitychange")); }); }
function seed(result: { current: ReturnType<typeof useV2MovementsHydration> }) {
  result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"] = { loaded: true, movements: [movement], cursor: null, exhausted: true, loading: false };
}

describe("ledger realtime hydration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    unsubscribe = vi.fn();
    vi.spyOn(Service, "subscribeToLedger").mockImplementation((_key, onNext, onError) => { next = onNext; fail = onError; return unsubscribe; });
    vi.spyOn(Service, "getMovementById").mockResolvedValue(movement);
    props = { company: "ACME", resolvedOwnerId: "owner", accountKey: "FondoGeneral", pageSize: "daily", pageIndex: 0, entriesHydrated: false, movementCurrency: "CRC", currencyEnabled: { CRC: true, USD: true }, currentDailyKey: "2026-09-23", todayKey: "2026-09-23", fromFilter: null, toFilter: null, fondoEntriesLength: 0, beginMovementsLoading: vi.fn(), endMovementsLoading: vi.fn(), setFondoEntries: vi.fn(), setCurrencyEnabled: vi.fn(), setInitialAmount: vi.fn(), setInitialAmountUSD: vi.fn(), setLedgerSnapshot: vi.fn(), setMovementCurrency: vi.fn() };
  });
  afterEach(cleanup);
  it("subscribes only when visible and online and cleans listeners on unmount", () => {
    visibility("hidden");
    const { result, unmount } = renderHook(() => useV2MovementsHydration(props));
    expect(Service.subscribeToLedger).not.toHaveBeenCalled();
    visibility("visible"); expect(Service.subscribeToLedger).toHaveBeenCalledTimes(1);
    visibility("hidden"); expect(unsubscribe).toHaveBeenCalledTimes(1);
    visibility("visible"); expect(Service.subscribeToLedger).toHaveBeenCalledTimes(2);
    event("offline"); expect(unsubscribe).toHaveBeenCalledTimes(2); expect(result.current.ledgerSyncStatus).toBe("offline");
    event("online"); expect(Service.subscribeToLedger).toHaveBeenCalledTimes(3); expect(result.current.ledgerSyncStatus).toBe("connecting");
    act(() => fail(new Error("denied"))); expect(result.current.ledgerSyncStatus).toBe("error");
    unmount(); expect(unsubscribe).toHaveBeenCalledTimes(3);
    event("online"); visibility("visible"); expect(Service.subscribeToLedger).toHaveBeenCalledTimes(3);
  });
  it.each(["hasPendingWrites", "fromCache"] as const)("rejects unconfirmed %s snapshots", async (metadata) => {
    const { result } = renderHook(() => useV2MovementsHydration(props));
    await emit({ ...snapshot(1), [metadata]: true });
    expect(result.current.storageSnapshotRef.current).toBeNull(); expect(result.current.ledgerSyncStatus).toBe("connecting");
    expect(Service.getMovementById).not.toHaveBeenCalled();
    await emit(snapshot(1)); expect(result.current.ledgerSyncStatus).toBe("synced");
  });
  it("applies confirmed balances before fetching one movement and upserts the cache", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    vi.mocked(Service.getMovementById).mockImplementation(async () => {
      expect(result.current.storageSnapshotRef.current?.state.revision).toBe(1);
      expect(props.setLedgerSnapshot).toHaveBeenLastCalledWith({ initialCRC: 0, currentCRC: 100, initialUSD: 0, currentUSD: 0 });
      return { ...movement, amountIngreso: 55 };
    });
    await emit(snapshot(1));
    expect(Service.getMovementById).toHaveBeenCalledExactlyOnceWith("movements_ACME", "m1", "FondoGeneral");
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movements).toEqual([{ ...movement, amountIngreso: 55 }]);
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movementVersions).toEqual({ m1: 1 });
    expect(props.setFondoEntries).toHaveBeenLastCalledWith([expect.objectContaining({ amountIngreso: 55 })]);
  });
  it("refreshes a revision gap once, even with a local latest ID", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props));
    result.current.registerLocalMutation("local"); await emit(snapshot(5, { clientMutationId: "local" })); await emit(snapshot(5));
    expect(ensureV2MovementsLoaded).toHaveBeenCalledTimes(1);
    expect(ensureV2MovementsLoaded).toHaveBeenCalledWith("movements_ACME", { forceRefresh: true }, expect.any(Object));
    expect(Service.getMovementById).not.toHaveBeenCalled();
  });
  it("refreshes once for a missing server movement", async () => {
    vi.mocked(Service.getMovementById).mockResolvedValue(null);
    renderHook(() => useV2MovementsHydration(props)); await emit(snapshot(1));
    expect(ensureV2MovementsLoaded).toHaveBeenCalledTimes(1);
    expect(ensureV2MovementsLoaded).toHaveBeenCalledWith("movements_ACME", { forceRefresh: true }, expect.any(Object));
  });
  it("removes deletes without reads and ignores movements of another account", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    await emit(snapshot(1, { operation: "delete" }));
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movements).toEqual([]);
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movementVersions).toEqual({ m1: 1 });
    await emit(snapshot(2, { accountId: "BCR" }));
    expect(Service.getMovementById).not.toHaveBeenCalled(); expect(ensureV2MovementsLoaded).not.toHaveBeenCalled();
  });
  it.each([
    { createdAt: "2026-09-24T06:00:00.000Z" }, { providerCode: "P2" }, { paymentType: "OTHER" }, { invoiceNumber: "I2" },
  ])("removes edits outside the active query: %j", async (edit) => {
    props = { ...props, providerCode: "P1", paymentType: "EFECTIVO", invoiceNumber: "I1" };
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    vi.mocked(Service.getMovementById).mockResolvedValue({ ...movement, ...edit });
    await emit(snapshot(1, { operation: "edit" }));
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movements).toEqual([]);
  });
  it("retains the confirmed ledger and unchanged movements on server read failure", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    vi.mocked(Service.getMovementById).mockRejectedValue(new Error("server read failed"));
    await emit(snapshot(1));
    expect(result.current.storageSnapshotRef.current?.state.revision).toBe(1);
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movements).toEqual([movement]);
    expect(result.current.ledgerSyncStatus).toBe("error");
  });
  it.each([1, 2])("does not certify a failed fetch on a ledger-only snapshot at revision %s", async (revision) => {
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    vi.mocked(Service.getMovementById).mockRejectedValueOnce(new Error("server read failed"));
    await emit(snapshot(1));
    await emit(snapshot(revision, { accountId: revision === 2 ? "BCR" : "FondoGeneral" }));
    expect(result.current.ledgerSyncStatus).toBe("error");
    expect(result.current.movementLoadError?.message).toBe("server read failed");
    expect(result.current.storageSnapshotRef.current?.state.revision).toBe(revision);
    visibility("hidden"); visibility("visible");
    await emit(snapshot(revision, { accountId: "BCR" }));
    expect(ensureV2MovementsLoaded).toHaveBeenCalledExactlyOnceWith("movements_ACME", { forceRefresh: true }, expect.any(Object));
    expect(result.current.ledgerSyncStatus).toBe("synced");
    expect(result.current.movementLoadError).toBeNull();
  });
  it("repairs the previously active account once after an inactive remote change", async () => {
    const { result, rerender } = renderHook((p: Props) => useV2MovementsHydration(p), { initialProps: props }); seed(result);
    await emit(snapshot(0));
    rerender({ ...props, accountKey: "BCR" }); await emit(snapshot(0));
    await emit(snapshot(1, { operation: "edit" }));
    expect(ensureV2MovementsLoaded).not.toHaveBeenCalled();
    expect(Service.getMovementById).not.toHaveBeenCalled();
    rerender(props); await emit(snapshot(1, { operation: "edit" })); await emit(snapshot(1));
    expect(ensureV2MovementsLoaded).toHaveBeenCalledExactlyOnceWith("movements_ACME", { forceRefresh: true }, expect.objectContaining({ accountKeyRef: { current: "FondoGeneral" } }));
  });
  it.each([{ company: "OTHER" }, { accountKey: "BCR" as const }])("ignores pending fetches after a context switch %j", async (update) => {
    let resolve!: (entry: ServerEntry) => void;
    vi.mocked(Service.getMovementById).mockReturnValue(new Promise((r) => { resolve = r; }));
    const { result, rerender } = renderHook((p: Props) => useV2MovementsHydration(p), { initialProps: props }); seed(result);
    await emit(snapshot(1)); const oldNext = next;
    rerender({ ...props, ...update }); vi.mocked(props.setFondoEntries).mockClear();
    await act(async () => resolve({ ...movement, amountIngreso: 99 }));
    await act(async () => oldNext(snapshot(2)));
    expect(props.setFondoEntries).not.toHaveBeenCalled(); expect(result.current.storageSnapshotRef.current).toBeNull();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
  it("bounds local IDs to 100 and consumes consecutive echoes", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props));
    for (let i = 0; i <= 100; i++) result.current.registerLocalMutation(`local-${i}`);
    await emit(snapshot(1, { clientMutationId: "local-0" })); expect(Service.getMovementById).toHaveBeenCalledTimes(1);
    await emit(snapshot(2, { clientMutationId: "local-100" })); expect(Service.getMovementById).toHaveBeenCalledTimes(1);
    await emit(snapshot(3, { clientMutationId: "local-100" })); expect(Service.getMovementById).toHaveBeenCalledTimes(2);
  });
  it("applies lock state even when movement revision is unchanged", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props));
    await emit(snapshot(0)); const locked = snapshot(0); locked.storage.state.lockedUntil = movement.createdAt; await emit(locked);
    expect(result.current.storageSnapshotRef.current?.state.lockedUntil).toBe(movement.createdAt);
    expect(ensureV2MovementsLoaded).not.toHaveBeenCalled(); expect(Service.getMovementById).not.toHaveBeenCalled();
  });
  it("waits for a running range load before forcing the gap refresh", async () => {
    let finish!: () => void;
    vi.mocked(ensureV2MovementsLoaded).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useV2MovementsHydration(props));
    void result.current.ensureV2MovementsLoaded("movements_ACME");
    await emit(snapshot(5));
    expect(ensureV2MovementsLoaded).toHaveBeenCalledTimes(1);
    await act(async () => finish());
    expect(ensureV2MovementsLoaded).toHaveBeenCalledTimes(2);
    expect(ensureV2MovementsLoaded).toHaveBeenLastCalledWith("movements_ACME", { forceRefresh: true }, expect.any(Object));
  });
  it("does not let a late range rebuild change the new company", async () => {
    const { result, rerender } = renderHook((p: Props) => useV2MovementsHydration(p), { initialProps: props }); seed(result);
    await emit(snapshot(5));
    const deps = vi.mocked(ensureV2MovementsLoaded).mock.calls[0][2];
    rerender({ ...props, company: "OTHER" }); vi.mocked(props.setFondoEntries).mockClear();
    act(() => deps.rebuildEntriesFromV2Cache("movements_ACME", "FondoGeneral"));
    expect(props.setFondoEntries).not.toHaveBeenCalled();
  });
  it("repairs an interrupted single read after the page becomes visible", async () => {
    let finish!: (entry: ServerEntry) => void;
    vi.mocked(Service.getMovementById).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    await emit(snapshot(1)); visibility("hidden");
    await act(async () => finish({ ...movement, amountIngreso: 99 }));
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movements).toEqual([movement]);
    visibility("visible"); await emit(snapshot(1));
    expect(ensureV2MovementsLoaded).toHaveBeenCalledExactlyOnceWith("movements_ACME", { forceRefresh: true }, expect.any(Object));
    expect(result.current.ledgerSyncStatus).toBe("synced");
  });
  it("serializes a delete after an in-flight edit so the late edit cannot resurrect it", async () => {
    let finish!: (entry: ServerEntry) => void;
    vi.mocked(Service.getMovementById).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    await emit(snapshot(1)); await emit(snapshot(2, { operation: "delete" }));
    await act(async () => finish({ ...movement, amountIngreso: 99 }));
    expect(result.current.v2MovementsCacheRef.current["movements_ACME::FondoGeneral"].movements).toEqual([]);
  });
  it("repairs failed movement synchronization when the user retries", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    vi.mocked(Service.getMovementById).mockRejectedValueOnce(new Error("read failed"));
    await emit(snapshot(1));
    await act(async () => { await result.current.retryMovements(); });
    expect(ensureV2MovementsLoaded).toHaveBeenCalledExactlyOnceWith("movements_ACME", { forceRefresh: true }, expect.any(Object));
    expect(result.current.ledgerSyncStatus).toBe("synced");
    expect(result.current.movementLoadError).toBeNull();
  });
  it("does not skip a failed read when the next active-account change arrives", async () => {
    const { result } = renderHook(() => useV2MovementsHydration(props)); seed(result);
    vi.mocked(Service.getMovementById).mockRejectedValueOnce(new Error("read failed"));
    await emit(snapshot(1));
    vi.mocked(ensureV2MovementsLoaded).mockRejectedValueOnce(new Error("repair failed"));
    await emit(snapshot(2, { movementId: "m2" }));
    expect(result.current.ledgerSyncStatus).toBe("error");
    await emit(snapshot(2, { movementId: "m2" }));
    expect(result.current.ledgerSyncStatus).toBe("error");
    expect(ensureV2MovementsLoaded).toHaveBeenCalledTimes(1);
    await act(async () => { await result.current.refreshMovements(); });
    expect(ensureV2MovementsLoaded).toHaveBeenCalledTimes(2);
    expect(result.current.ledgerSyncStatus).toBe("synced");
  });
  it.each(["offline", "listener-error"] as const)("preserves %s when an old range repair finishes", async (interruption) => {
    let finish!: () => void;
    vi.mocked(ensureV2MovementsLoaded).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const { result } = renderHook(() => useV2MovementsHydration(props));
    await emit(snapshot(5));
    if (interruption === "offline") event("offline");
    else act(() => fail(new Error("listener failed")));
    const expectedStatus = interruption === "offline" ? "offline" : "error";
    expect(result.current.ledgerSyncStatus).toBe(expectedStatus);
    await act(async () => finish());
    expect(result.current.ledgerSyncStatus).toBe(expectedStatus);
    if (interruption === "listener-error") expect(result.current.movementLoadError?.message).toBe("listener failed");
  });
});
