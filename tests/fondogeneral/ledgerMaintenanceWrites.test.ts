import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => parts.join("/")),
  doc: vi.fn((...parts: unknown[]) => parts.join("/")),
  runTransaction: vi.fn(),
  updateDoc: vi.fn(),
}));

import { runTransaction, updateDoc } from "firebase/firestore";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

const runTransactionMock = vi.mocked(runTransaction);
const updateDocMock = vi.mocked(updateDoc);
const company = "DELIKOR SINAI";
const docId = MovimientosFondosService.buildCompanyMovementsKey(company);
const ledgerRef = `db/MovimientosFondos/${docId}`;
const lockTime = "2026-09-23T01:00:00.000Z";
const nowISO = "2026-09-23T01:00:01.000Z";

function ledgerAt(crc: number) {
  const ledger = MovimientosFondosService.createEmptyMovementStorage(company);
  ledger.state.balancesByAccount.find((balance) =>
    balance.accountId === "FondoGeneral" && balance.currency === "CRC"
  )!.currentBalance = crc;
  ledger.state.updatedAt = "2026-09-22T00:00:00.000Z";
  ledger.state.revision = 7;
  ledger.state.lastChange = {
    kind: "movement",
    revision: 7,
    movementId: "sale-7",
    operation: "create",
    accountId: "FondoGeneral",
    currency: "CRC",
    updatedAt: "2026-09-22T00:00:00.000Z",
  };
  ledger.configuration.currencies[0].enabled = false;
  return ledger;
}

describe("MovimientosFondosService ledger maintenance writes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sets the lock on the fresh transaction ledger while preserving balance and revision", async () => {
    const authoritative = ledgerAt(138_000);
    const stale = ledgerAt(103_000);
    const transactionSet = vi.fn();
    const transactionGet = vi.fn(async () => ({ exists: () => true, data: () => authoritative }));
    runTransactionMock.mockImplementation(async (_db, callback) => callback({
      get: transactionGet,
      set: transactionSet,
    } as never));

    const result = await MovimientosFondosService.updateLedgerLockTransaction({
      docId, company, lockedUntil: lockTime, nowISO,
    });

    expect(stale.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(103_000);
    expect(transactionGet).toHaveBeenCalledWith(ledgerRef);
    expect(result.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(138_000);
    expect(result.state).toMatchObject({
      lockedUntil: lockTime,
      updatedAt: nowISO,
      revision: 7,
      lastChange: authoritative.state.lastChange,
    });
    expect(result.configuration).toEqual(authoritative.configuration);
    expect(result).toEqual({
      ...authoritative,
      state: { ...authoritative.state, lockedUntil: lockTime, updatedAt: nowISO },
    });
    expect(transactionSet).toHaveBeenCalledWith(ledgerRef, result);
  });

  it("removes lockedUntil with null without changing authoritative balance or revision", async () => {
    const authoritative = ledgerAt(138_000);
    authoritative.state.lockedUntil = lockTime;
    const transactionSet = vi.fn();
    runTransactionMock.mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async () => ({ exists: () => true, data: () => authoritative })),
      set: transactionSet,
    } as never));

    const result = await MovimientosFondosService.updateLedgerLockTransaction({
      docId, company, lockedUntil: null, nowISO,
    });

    expect(result.state).not.toHaveProperty("lockedUntil");
    expect(result.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(138_000);
    expect(result.state.revision).toBe(7);
    expect(result.state.lastChange).toEqual(authoritative.state.lastChange);
    const { lockedUntil: _previousLock, ...stateWithoutLock } = authoritative.state;
    expect(result).toEqual({
      ...authoritative,
      state: { ...stateWithoutLock, updatedAt: nowISO },
    });
    expect(transactionSet).toHaveBeenCalledWith(ledgerRef, result);
  });

  it("clears only the legacy operations.movements field", async () => {
    await MovimientosFondosService.clearLegacyMovements(docId);
    expect(updateDocMock).toHaveBeenCalledExactlyOnceWith(
      ledgerRef,
      { "operations.movements": [] },
    );
  });
});
