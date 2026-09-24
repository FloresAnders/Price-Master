import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("@/utils/serverTime", () => ({ getAuthoritativeNowISO: async () => "2026-09-23T18:00:00.000Z" }));
vi.mock("firebase/firestore", () => ({ doc: (...parts: unknown[]) => parts.join("/"), runTransaction: vi.fn() }));
import { runTransaction } from "firebase/firestore";
import { DailyClosingsService, LEDGER_CHANGED_BEFORE_CLOSING, type DailyClosingRecord } from "@/services/daily-closings";
const record: DailyClosingRecord = { id: "closing", createdAt: "2026-09-23T18:00:00.000Z", closingDate: "2026-09-23T18:00:00.000Z", manager: "Manager", totalCRC: 100, totalUSD: 0, recordedBalanceCRC: 100, recordedBalanceUSD: 0, diffCRC: 0, diffUSD: 0, notes: "", turno: "D", breakdownCRC: {}, breakdownUSD: {} };
const schedule = { horarioApertura: "06:00", horarioCierre: "22:00", authorizedOperationalDateKey: "2026-09-23" };
const condition = { ledgerDocId: "movements_TEST", expectedRevision: 4, expectedUpdatedAt: "saved" };
const set = vi.fn();
const get = vi.fn();
beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  vi.mocked(runTransaction).mockImplementation(async (_db, callback) => callback({ get, set } as never));
  vi.spyOn(DailyClosingsService, "getDocument").mockResolvedValue({ company: "TEST", updatedAt: "saved", closingsByDate: { "2026-09-23": [record] } });
});
function snapshots(revision: number | undefined = 4, updatedAt = "saved", exists = true) {
  get.mockImplementation(async (ref: string) => ref.includes("MovimientosFondos")
    ? { exists: () => exists, data: () => ({ state: { revision, updatedAt } }) }
    : { exists: () => false });
}
describe("closing transaction ledger precondition", () => {
  it("reads both documents before writing a matching closing", async () => {
    snapshots();
    const ledger = await DailyClosingsService.saveClosing("TEST", record, schedule, condition);
    expect(get).toHaveBeenCalledTimes(2);
    expect(get).toHaveBeenCalledWith("db/MovimientosFondos/movements_TEST");
    expect(set).toHaveBeenCalledTimes(2);
    expect(set.mock.calls[0][1]).toMatchObject({ closingsByDate: { "2026-09-23": [expect.objectContaining({ id: "closing" })] } });
    expect(set).toHaveBeenCalledWith("db/MovimientosFondos/movements_TEST", expect.objectContaining({
      state: expect.objectContaining({ revision: 4, lockedUntil: record.createdAt }),
    }));
    expect(ledger?.state.lockedUntil).toBe(record.createdAt);
    expect(Math.max(...get.mock.invocationCallOrder)).toBeLessThan(set.mock.invocationCallOrder[0]);
  });
  it.each([[5, "saved"], [4, "new timestamp"]])("blocks metadata change (%s, %s) before writes", async (revision, updatedAt) => {
    snapshots(revision as number, updatedAt as string);
    await expect(DailyClosingsService.saveClosing("TEST", record, schedule, condition)).rejects.toThrow("LEDGER_CHANGED_BEFORE_CLOSING");
    expect(LEDGER_CHANGED_BEFORE_CLOSING).toBe("LEDGER_CHANGED_BEFORE_CLOSING");
    expect(set).not.toHaveBeenCalled();
  });
  it("blocks a deleted ledger even for a zero revision", async () => {
    snapshots(0, "saved", false);
    await expect(DailyClosingsService.saveClosing("TEST", record, schedule, { ...condition, expectedRevision: 0 })).rejects.toThrow("LEDGER_CHANGED_BEFORE_CLOSING");
    expect(set).not.toHaveBeenCalled();
  });
  it("accepts a legacy ledger with no revision as zero", async () => {
    get.mockImplementation(async (ref: string) => ref.includes("MovimientosFondos") ? { exists: () => true, data: () => ({ state: { updatedAt: "saved" } }) } : { exists: () => false });
    await DailyClosingsService.saveClosing("TEST", record, schedule, { ...condition, expectedRevision: 0 });
    expect(set).toHaveBeenCalledTimes(2);
  });
});
