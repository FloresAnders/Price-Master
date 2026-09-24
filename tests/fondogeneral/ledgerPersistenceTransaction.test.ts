import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/firebase", () => ({ db: "db" }));
vi.mock("@/utils/serverTime", () => ({ getAuthoritativeNowISO: vi.fn(async () => "2026-09-23T00:00:01.000Z") }));
vi.mock("@/services/fondo-cache", () => ({ invalidateFondoCache: vi.fn(async () => undefined) }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => parts.join("/")),
  deleteDoc: vi.fn(),
  doc: vi.fn((...parts: unknown[]) => parts.join("/")),
  getDocs: vi.fn(),
  getCountFromServer: vi.fn(),
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
  writeBatch: vi.fn(),
}));

import { runTransaction } from "firebase/firestore";
import { MovimientosFondosService } from "@/services/movimientos-fondos";
import { applyLedgerMovementMutation } from "@/app/fondogeneral/utils/fondo/ledgerState";
import { persistMovementToFirestore } from "@/app/fondogeneral/utils/fondo/persistence";
import type { FondoEntry } from "@/app/fondogeneral/types";

const runTransactionMock = vi.mocked(runTransaction);
const company = "DELIKOR SINAI";
const docId = MovimientosFondosService.buildCompanyMovementsKey(company);
const movement = {
  id: "sale-1",
  accountId: "FondoGeneral" as const,
  currency: "CRC" as const,
  amountIngreso: 5_000,
  amountEgreso: 0,
  createdAt: "2026-09-23T00:00:00.000Z",
};

const ledgerAt = (crc: number) => {
  const ledger = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(company);
  ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")!.currentBalance = crc;
  return ledger;
};

describe("MovimientosFondosService.commitLedgerTransaction", () => {
  beforeEach(() => vi.clearAllMocks());

  it("commits the movement and balance calculated from the transaction ledger", async () => {
    const transactionSet = vi.fn();
    runTransactionMock.mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async () => ({ exists: () => true, data: () => ledgerAt(138_000) })),
      set: transactionSet,
      delete: vi.fn(),
      update: vi.fn(),
    } as never));

    const result = await MovimientosFondosService.commitLedgerTransaction<typeof movement, FondoEntry>({
      docId,
      company,
      operation: "create",
      movementId: movement.id,
      accountId: "FondoGeneral",
      after: movement,
      mutateLedger: ({ ledger }) => ({
        ledger: applyLedgerMovementMutation({
          storage: ledger,
          operation: "create",
          after: movement,
          nowISO: "2026-09-23T00:00:01.000Z",
        }).storage,
        storedMovement: movement,
      }),
    });

    expect(result.ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(143_000);
    expect(transactionSet).toHaveBeenCalledWith(
      expect.stringContaining("MovimientosFondos/movements_DELIKOR SINAI"),
      expect.objectContaining({ state: expect.objectContaining({ revision: 1 }) }),
    );
    expect(transactionSet).toHaveBeenCalledWith(
      expect.stringContaining("movements/sale-1"),
      expect.objectContaining({ amountIngreso: 5_000 }),
    );
  });

  it("persists against the server ledger even when the caller cache is stale", async () => {
    const transactionSet = vi.fn();
    const serverLedger = ledgerAt(138_000);
    serverLedger.operations.movements = [movement as FondoEntry];
    runTransactionMock.mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async () => ({ exists: () => true, data: () => serverLedger })),
      set: transactionSet,
      delete: vi.fn(),
      update: vi.fn(),
    } as never));
    const stale = ledgerAt(103_000);
    const storageSnapshotRef = { current: stale };
    const localMutation = vi.fn();
    const saved = await persistMovementToFirestore([], "create", {
      upsert: movement as FondoEntry,
    }, undefined, {
      company,
      accountKey: "FondoGeneral",
      storageSnapshotRef,
      v2MovementsCacheRef: { current: {} },
      registerLocalMutation: localMutation,
    });

    expect(saved).toMatchObject({ ok: true, confirmed: true, ledgerSnapshot: { currentCRC: 143_000 }, revision: 1 });
    expect(localMutation).toHaveBeenCalledOnce();
    expect(transactionSet).toHaveBeenCalledWith(
      expect.stringContaining("MovimientosFondos/movements_DELIKOR SINAI"),
      expect.objectContaining({
        operations: { movements: [] },
        state: expect.objectContaining({ revision: 1 }),
      }),
    );
    expect(storageSnapshotRef.current.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(143_000);
  });

  it.each(["edit", "delete"] as const)("aborts %s when the server movement is absent", async (operation) => {
    const transactionSet = vi.fn();
    const transactionDelete = vi.fn();
    const reads: string[] = [];
    runTransactionMock.mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => {
        reads.push(ref);
        return ref.includes("/movements/")
          ? { exists: (): boolean => false }
          : { exists: (): boolean => true, data: () => ledgerAt(138_000) };
      }),
      set: transactionSet,
      delete: transactionDelete,
      update: vi.fn(),
    } as never));

    await expect(MovimientosFondosService.commitLedgerTransaction({
      docId,
      company,
      operation,
      movementId: movement.id,
      accountId: "FondoGeneral",
      after: movement,
      mutateLedger: ({ ledger }) => ({ ledger, storedMovement: movement }),
    })).rejects.toThrow("MOVEMENT_NOT_FOUND");
    expect(reads).toHaveLength(2);
    expect(transactionSet).not.toHaveBeenCalled();
    expect(transactionDelete).not.toHaveBeenCalled();
  });

  it("returns the successful retry balance rather than the first attempted balance", async () => {
    const firstSet = vi.fn();
    const committedSet = vi.fn();
    runTransactionMock.mockImplementation(async (_db, callback) => {
      const attempt = (crc: number, set: typeof firstSet) => callback({
        get: vi.fn(async () => ({ exists: () => true, data: () => ledgerAt(crc) })),
        set,
        delete: vi.fn(),
        update: vi.fn(),
      } as never);
      await attempt(103_000, firstSet);
      return attempt(138_000, committedSet);
    });
    const result = await MovimientosFondosService.commitLedgerTransaction<typeof movement, FondoEntry>({
      docId,
      company,
      operation: "create",
      movementId: movement.id,
      accountId: "FondoGeneral",
      after: movement,
      mutateLedger: ({ ledger }) => ({
        ledger: applyLedgerMovementMutation({ storage: ledger, operation: "create", after: movement, nowISO: movement.createdAt }).storage,
        storedMovement: movement,
      }),
    });

    expect(firstSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ state: expect.objectContaining({ revision: 1 }) }));
    expect(result.ledger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(143_000);
    expect(committedSet).toHaveBeenCalledWith(expect.stringContaining("MovimientosFondos/movements_DELIKOR SINAI"), expect.objectContaining({ state: expect.objectContaining({ revision: 1 }) }));
  });

  it("keeps both deltas and advances the revision across sequential commits", async () => {
    let serverLedger = ledgerAt(138_000);
    runTransactionMock.mockImplementation(async (_db, callback) => {
      let pendingLedger = serverLedger;
      const result = await callback({
        get: vi.fn(async () => ({ exists: () => true, data: () => serverLedger })),
        set: vi.fn((ref: string, data: typeof serverLedger) => {
          if (ref === `db/MovimientosFondos/${docId}`) pendingLedger = data;
        }),
        delete: vi.fn(),
        update: vi.fn(),
      } as never);
      serverLedger = pendingLedger;
      return result;
    });
    for (const id of ["sale-1", "sale-2"]) {
      const after = { ...movement, id };
      await MovimientosFondosService.commitLedgerTransaction<typeof movement, FondoEntry>({
        docId,
        company,
        operation: "create",
        movementId: id,
        accountId: "FondoGeneral",
        after,
        mutateLedger: ({ ledger }) => ({
          ledger: applyLedgerMovementMutation({ storage: ledger, operation: "create", after, nowISO: movement.createdAt }).storage,
          storedMovement: after,
        }),
      });
    }
    expect(serverLedger.state.balancesByAccount.find((b) => b.accountId === "FondoGeneral" && b.currency === "CRC")?.currentBalance).toBe(148_000);
    expect(serverLedger.state.revision).toBe(2);
  });

  it("deletes Facturas mirrors according to the server movement when caller before is stale", async () => {
    const deletes = vi.fn();
    const serverBefore = {
      ...movement,
      invoiceNumber: "F-1",
      appliedCreditNotes: [{ id: "manual-nc-sale-1-a" }],
    };
    runTransactionMock.mockImplementation(async (_db, callback) => callback({
      get: vi.fn(async (ref: string) => ref.includes("/movements/")
        ? { exists: () => true, data: () => serverBefore }
        : { exists: () => true, data: () => ledgerAt(143_000) }),
      set: vi.fn(),
      delete: deletes,
      update: vi.fn(),
    } as never));

    const saved = await persistMovementToFirestore([], "delete", {
      deleteId: movement.id,
      before: { ...movement, invoiceNumber: "", providerCode: "" } as FondoEntry,
    }, undefined, {
      company,
      accountKey: "FondoGeneral",
      storageSnapshotRef: { current: ledgerAt(103_000) },
      v2MovementsCacheRef: { current: {} },
    });

    expect(saved).toMatchObject({ ok: true, confirmed: true, ledgerSnapshot: { currentCRC: 138_000 } });
    expect(deletes).toHaveBeenCalledWith("db/Facturas/DELIKOR_SINAI/movements/sale-1");
    expect(deletes).toHaveBeenCalledWith("db/Facturas/DELIKOR_SINAI/movements/sale-1-NC");
    expect(deletes).toHaveBeenCalledWith("db/Facturas/DELIKOR_SINAI/movements/sale-1-NC-1");
  });

  it("re-reads related documents before writes on every transaction retry", async () => {
    const attempts: Array<{ events: string[]; sets: Array<[string, unknown]> }> = [];
    runTransactionMock.mockImplementation(async (_db, callback) => {
      const attempt = async (paid: number) => {
        const events: string[] = [];
        const sets: Array<[string, unknown]> = [];
        attempts.push({ events, sets });
        return callback({
          get: vi.fn(async (ref: string) => {
            events.push(`read:${ref}`);
            if (ref.includes("/Facturas/")) return { exists: () => true, data: () => ({ paidAmount: paid }) };
            if (ref.includes("/movements/")) return { exists: () => true, data: () => movement };
            return { exists: () => true, data: () => ledgerAt(143_000) };
          }),
          set: vi.fn((ref: string, data: unknown) => { events.push(`write:${ref}`); sets.push([ref, data]); }),
          delete: vi.fn((ref: string) => events.push(`write:${ref}`)),
          update: vi.fn(),
        } as never);
      };
      await attempt(6_000);
      return attempt(7_000);
    });

    await MovimientosFondosService.commitLedgerTransaction({
      docId,
      company,
      operation: "delete",
      movementId: movement.id,
      accountId: "FondoGeneral",
      mutateLedger: ({ ledger }) => ({ ledger }),
      prepareExtraWrites: async (reader, { before }) => {
        const invoice = await reader.get("db/Facturas/DELIKOR_SINAI/movements/FAC-1" as never);
        const paid = Number((invoice.data() as { paidAmount?: number } | undefined)?.paidAmount);
        return (writer) => writer.set("db/Facturas/DELIKOR_SINAI/movements/FAC-1" as never, {
          paidAmount: paid - Number(before?.amountIngreso),
        });
      },
    });

    expect(attempts).toHaveLength(2);
    for (const attempt of attempts) {
      const firstWrite = attempt.events.findIndex((event) => event.startsWith("write:"));
      expect(firstWrite).toBe(3);
    }
    expect(attempts[1].sets).toContainEqual([
      "db/Facturas/DELIKOR_SINAI/movements/FAC-1",
      { paidAmount: 2_000 },
    ]);
  });
});
