import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/services/movimientos-fondos", () => ({ MovimientosFondosService: {
  buildCompanyMovementsKey: () => "movements_TEST",
  getDocumentFromServer: vi.fn(),
  listAllMovementsByCreatedAtRange: vi.fn(),
} }));
import { MovimientosFondosService as service } from "@/services/movimientos-fondos";
import { APERTURA_FONDO_PROVIDER_CODE } from "@/app/fondogeneral/constants";
import { buildOperationalStartISO, calculateLedgerIntegrity, formatLedgerIntegrityMismatch, loadLedgerIntegrity } from "@/app/fondogeneral/utils/closing/ledgerIntegrity";

const opening = { id: "opening", createdAt: "2026-09-22T22:03:49.580Z", providerCode: APERTURA_FONDO_PROVIDER_CODE, openingBalanceCRC: 138_000, openingBalanceUSD: 0 };
const movements = [
  { id: "zero-in", createdAt: "2026-09-22T22:20:26.972Z", amountIngreso: 0, amountEgreso: 0, currency: "CRC" as const },
  { id: "zero-out", createdAt: "2026-09-22T22:20:42.587Z", amountIngreso: 0, amountEgreso: 10, amountPayment: 0, currency: "CRC" as const },
  { id: "purchase", createdAt: "2026-09-22T23:05:57.044Z", amountIngreso: 0, amountEgreso: 54_000, amountPayment: 54_000, currency: "CRC" as const },
  { id: "sales", createdAt: "2026-09-23T05:46:47.372Z", amountIngreso: 89_000, amountEgreso: 0, currency: "CRC" as const },
];
const input = { company: "TEST", accountId: "FondoGeneral" as const, operationalStartISO: "2026-09-22T12:00:00.000Z", closingISO: "2026-09-23T05:46:47.372Z" };
const ledger = (revision: number | undefined = 2, updatedAt = "stable") => ({ state: { revision, updatedAt, balancesByAccount: [
  { accountId: "FondoGeneral", currency: "CRC", currentBalance: 173_000 },
  { accountId: "FondoGeneral", currency: "USD", currentBalance: 0 },
] } });

describe("ledger integrity calculation", () => {
  it("detects the verified CRC incident with cash-effective expenses", () => {
    expect(calculateLedgerIntegrity({ ledgerCRC: 138_000, ledgerUSD: 0, opening, movements })).toMatchObject({ ok: false, reason: "mismatch", expectedCRC: 173_000, ledgerCRC: 138_000, driftCRC: -35_000 });
  });
  it("accepts a healthy ledger and ignores zero cash payment", () => {
    expect(calculateLedgerIntegrity({ ledgerCRC: 173_000, ledgerUSD: 0, opening, movements })).toMatchObject({ ok: true, reason: "balanced", driftCRC: 0, driftUSD: 0 });
  });
  it("calculates USD and rounds cents consistently", () => {
    expect(calculateLedgerIntegrity({ ledgerCRC: 138_000, ledgerUSD: 9.7, opening: { ...opening, openingBalanceUSD: 10 }, movements: [{ id: "usd", createdAt: movements[0].createdAt, currency: "USD", amountIngreso: 0.1, amountEgreso: 2, amountPayment: 0.3 }] })).toMatchObject({ expectedUSD: 9.8, driftUSD: -0.1, reason: "mismatch" });
  });
  it("blocks a missing opening without inventing expected balances", () => {
    expect(calculateLedgerIntegrity({ ledgerCRC: 0, ledgerUSD: 0, opening: null, movements: [] })).toMatchObject({ ok: false, reason: "opening-missing", openingId: null, expectedCRC: null, driftCRC: null });
  });
  it("ignores earlier movements and opening records", () => {
    expect(calculateLedgerIntegrity({ ledgerCRC: 138_000, ledgerUSD: 0, opening, movements: [{ ...movements[3], createdAt: "2026-09-22T21:00:00.000Z" }, { ...opening, id: "another", amountIngreso: 500 }] })).toMatchObject({ ok: true, expectedCRC: 138_000 });
  });
  it("formats every nonzero drift with absolute amounts", () => {
    const crc = calculateLedgerIntegrity({ ledgerCRC: 138_000, ledgerUSD: 0, opening, movements });
    expect(formatLedgerIntegrityMismatch(crc).replace(/\u00a0/g, " ")).toBe("No se puede cerrar el fondo. El ledger está desviado por ₡ 35 000. Actualice la pantalla y solicite revisión administrativa.");
    const mixed = calculateLedgerIntegrity({ ledgerCRC: 138_000, ledgerUSD: 15, opening, movements });
    expect(formatLedgerIntegrityMismatch(mixed).replace(/\u00a0/g, " ")).toContain("₡ 35 000 y $ 15");
  });
});

describe("operational range", () => {
  it("constructs the Costa Rica opening instant", () => expect(buildOperationalStartISO("2026-09-22", "06:00")).toBe("2026-09-22T12:00:00.000Z"));
  it.each([["2026-9-22", "06:00"], ["2026-02-30", "06:00"], ["2026-09-22", "24:00"], ["2026-09-22", "6:00"], ["", ""]])("rejects malformed range %s %s", (date, time) => expect(() => buildOperationalStartISO(date, time)).toThrow());
});

describe("authoritative complete view", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(service.getDocumentFromServer).mockResolvedValue(ledger() as never);
    vi.mocked(service.listAllMovementsByCreatedAtRange).mockResolvedValue([opening, ...movements]);
  });
  it("uses a stable server view and includes the closing instant", async () => {
    expect(await loadLedgerIntegrity(input)).toMatchObject({ ok: true, ledgerRevision: 2, ledgerUpdatedAt: "stable" });
    expect(service.getDocumentFromServer).toHaveBeenCalledTimes(2);
    expect(service.listAllMovementsByCreatedAtRange).toHaveBeenCalledExactlyOnceWith("movements_TEST", { accountId: "FondoGeneral", startIso: input.operationalStartISO, endIsoExclusive: "2026-09-23T05:46:47.373Z" });
  });
  it.each([ledger(3), ledger(2, "changed")])("retries the whole range on changed metadata", async (changed) => {
    vi.mocked(service.getDocumentFromServer).mockResolvedValueOnce(ledger() as never).mockResolvedValueOnce(changed as never);
    expect(await loadLedgerIntegrity(input)).toMatchObject({ ok: true });
    expect(service.getDocumentFromServer).toHaveBeenCalledTimes(4);
    expect(service.listAllMovementsByCreatedAtRange).toHaveBeenCalledTimes(2);
  });
  it("rejects after three unstable complete attempts", async () => {
    let revision = 0;
    vi.mocked(service.getDocumentFromServer).mockImplementation(async () => ledger(++revision) as never);
    await expect(loadLedgerIntegrity(input)).rejects.toThrow("LEDGER_CHANGED_DURING_INTEGRITY_CHECK");
    expect(service.getDocumentFromServer).toHaveBeenCalledTimes(6);
    expect(service.listAllMovementsByCreatedAtRange).toHaveBeenCalledTimes(3);
  });
  it("propagates a server query rejection", async () => {
    vi.mocked(service.listAllMovementsByCreatedAtRange).mockRejectedValue(new Error("offline"));
    await expect(loadLedgerIntegrity(input)).rejects.toThrow("offline");
  });
  it("propagates server ledger read rejection and missing ledger", async () => {
    vi.mocked(service.getDocumentFromServer).mockRejectedValueOnce(new Error("offline"));
    await expect(loadLedgerIntegrity(input)).rejects.toThrow("offline");
    vi.mocked(service.getDocumentFromServer).mockResolvedValueOnce(null);
    await expect(loadLedgerIntegrity(input)).rejects.toThrow();
  });
  it("defaults absent revision to zero", async () => {
    const legacy = { state: { ...ledger().state, revision: undefined } };
    vi.mocked(service.getDocumentFromServer).mockResolvedValue(legacy as never);
    expect(await loadLedgerIntegrity(input)).toMatchObject({ ledgerRevision: 0 });
  });
  it("selects the latest applicable opening and excludes future records", async () => {
    vi.mocked(service.listAllMovementsByCreatedAtRange).mockResolvedValue([
      ...movements, opening,
      { ...opening, id: "latest", createdAt: "2026-09-23T04:00:00.000Z", openingBalanceCRC: 84_000 },
      { ...opening, id: "future", createdAt: "2026-09-24T04:00:00.000Z" },
    ]);
    expect(await loadLedgerIntegrity(input)).toMatchObject({ ok: true, openingId: "latest", expectedCRC: 173_000 });
  });
  it("returns typed missing opening for an empty operational range", async () => {
    vi.mocked(service.listAllMovementsByCreatedAtRange).mockResolvedValue(movements);
    expect(await loadLedgerIntegrity(input)).toMatchObject({ ok: false, reason: "opening-missing" });
  });
});
