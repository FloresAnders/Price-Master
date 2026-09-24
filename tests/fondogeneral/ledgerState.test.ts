import { describe, expect, it } from "vitest";
import {
  applyLedgerMovementMutation,
  extractLedgerSnapshot,
} from "@/app/fondogeneral/utils/fondo/ledgerState";
import type { FondoEntry } from "@/app/fondogeneral/types";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

const storage = (crc = 138_000) => {
  const value = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
    "DELIKOR SINAI",
  );
  const balance = value.state.balancesByAccount.find(
    (item) => item.accountId === "FondoGeneral" && item.currency === "CRC",
  )!;
  balance.currentBalance = crc;
  return value;
};

describe("applyLedgerMovementMutation", () => {
  it("uses the authoritative storage balance and initializes a legacy revision", () => {
    const result = applyLedgerMovementMutation({
      storage: storage(138_000),
      operation: "create",
      after: {
        id: "sale-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 5_000,
        amountEgreso: 0,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
      clientMutationId: "client-a-1",
    });

    expect(extractLedgerSnapshot(result.storage, "FondoGeneral").currentCRC)
      .toBe(143_000);
    expect(result.storage.state.revision).toBe(1);
    expect(result.storage.state.lastChange).toMatchObject({
      kind: "movement",
      revision: 1,
      movementId: "sale-1",
      operation: "create",
      clientMutationId: "client-a-1",
    });
  });

  it("uses amountPayment as the effective debit", () => {
    const result = applyLedgerMovementMutation({
      storage: storage(),
      operation: "create",
      after: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 0,
        amountEgreso: 10,
        amountPayment: 0,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(extractLedgerSnapshot(result.storage, "FondoGeneral").currentCRC)
      .toBe(138_000);
  });

  it("reverses the server before value and applies an edited currency", () => {
    const value = storage();
    const usd = value.state.balancesByAccount.find(
      (item) => item.accountId === "FondoGeneral" && item.currency === "USD",
    )!;
    usd.currentBalance = 20;

    const result = applyLedgerMovementMutation({
      storage: value,
      operation: "edit",
      before: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 0,
        amountEgreso: 5_000,
        amountPayment: 5_000,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      after: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "USD",
        amountIngreso: 0,
        amountEgreso: 10,
        amountPayment: 10,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:01:00.000Z",
    });

    const snapshot = extractLedgerSnapshot(result.storage, "FondoGeneral");
    expect(snapshot.currentCRC).toBe(143_000);
    expect(snapshot.currentUSD).toBe(10);
  });

  it("discards invalid revision metadata without changing hydrated balances", () => {
    const value = storage(138_000);
    value.state.revision = Number.NaN;
    value.state.lastChange = { kind: "movement", revision: -1 } as never;

    const hydrated = MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
      value,
      value.company,
    );

    expect(hydrated.state.revision).toBeUndefined();
    expect(hydrated.state.lastChange).toBeUndefined();
    expect(extractLedgerSnapshot(hydrated, "FondoGeneral").currentCRC).toBe(138_000);
  });

  it("keeps valid revision metadata through hydration", () => {
    const value = storage();
    value.state.revision = 4;
    value.state.lastChange = {
      kind: "movement",
      revision: 4,
      movementId: "expense-4",
      operation: "edit",
      accountId: "FondoGeneral",
      currency: "CRC",
      updatedAt: "2026-09-23T00:00:00.000Z",
      clientMutationId: "client-a-4",
    };

    const hydrated = MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
      value,
      value.company,
    );

    expect(hydrated.state.revision).toBe(4);
    expect(hydrated.state.lastChange).toEqual(value.state.lastChange);
  });

  it.each([
    ["create", undefined, undefined],
    ["edit", undefined, { id: "sale-1", createdAt: "2026-09-23T00:00:00.000Z" }],
    ["delete", undefined, undefined],
  ] as const)("rejects a %s with missing operands without changing input", (operation, before, after) => {
    const value = storage();
    const original = structuredClone(value);
    expect(() => applyLedgerMovementMutation({
      storage: value,
      operation,
      before,
      after,
      nowISO: "2026-09-23T00:00:01.000Z",
    })).toThrow();
    expect(value).toEqual(original);
  });

  it("preserves settings, lockedUntil, configuration, unrelated accounts, and input", () => {
    const value = storage();
    const crc = value.state.balancesByAccount.find(
      (item) => item.accountId === "FondoGeneral" && item.currency === "CRC",
    )!;
    crc.initialBalance = 100_000;
    crc.enabled = false;
    value.state.lockedUntil = "2026-09-22T22:00:00.000Z";
    const bcr = value.state.balancesByAccount.find(
      (item) => item.accountId === "BCR" && item.currency === "CRC",
    )!;
    bcr.currentBalance = 900;
    const original = structuredClone(value);

    const result = applyLedgerMovementMutation({
      storage: value,
      operation: "create",
      after: {
        id: "sale-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 5,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(value).toEqual(original);
    expect(result.storage.configuration).toEqual(original.configuration);
    expect(result.storage.state.lockedUntil).toBe(original.state.lockedUntil);
    expect(result.storage.state.balancesByAccount.find(
      (item) => item.accountId === "BCR" && item.currency === "CRC",
    )).toEqual(bcr);
    expect(result.storage.state.balancesByAccount.find(
      (item) => item.accountId === "FondoGeneral" && item.currency === "CRC",
    )).toMatchObject({ initialBalance: 100_000, currentBalance: 138_005, enabled: false });
  });

  it("reverses the stored effective debit when deleting an expense", () => {
    const result = applyLedgerMovementMutation({
      storage: storage(),
      operation: "delete",
      before: {
        id: "expense-1",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 0,
        amountEgreso: 6_000,
        amountPayment: 5_000,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(result.ledgerSnapshot.currentCRC).toBe(143_000);
    expect(result.storage.state.lastChange).toMatchObject({
      operation: "delete",
      movementId: "expense-1",
    });
  });

  it("changes an opening by the difference between persisted counted balances", () => {
    const result = applyLedgerMovementMutation({
      storage: storage(),
      operation: "edit",
      before: {
        id: "opening-1",
        providerCode: "APERTURA DE FONDO",
        openingBalanceCRC: 138_000,
        openingBalanceUSD: 20,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      after: {
        id: "opening-1",
        providerCode: "APERTURA DE FONDO",
        openingBalanceCRC: 140_000,
        openingBalanceUSD: 25,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(result.ledgerSnapshot.currentCRC).toBe(140_000);
    expect(result.ledgerSnapshot.currentUSD).toBe(5);
  });

  it("restores persisted previous balances when deleting an opening", () => {
    const value = storage();
    value.state.balancesByAccount.find(
      (item) => item.accountId === "FondoGeneral" && item.currency === "USD",
    )!.currentBalance = 25;

    const result = applyLedgerMovementMutation({
      storage: value,
      operation: "delete",
      before: {
        id: "opening-1",
        providerCode: "APERTURA DE FONDO",
        openingBalanceCRC: 138_000,
        openingBalanceUSD: 25,
        openingPreviousBalanceCRC: 130_000,
        openingPreviousBalanceUSD: 10,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(result.ledgerSnapshot.currentCRC).toBe(130_000);
    expect(result.ledgerSnapshot.currentUSD).toBe(10);
  });

  it("sets the counted balances on opening creation without treating it as income", () => {
    const value = storage(50_000);
    const result = applyLedgerMovementMutation({
      storage: value,
      operation: "create",
      after: {
        id: "opening-1",
        providerCode: "APERTURA DE FONDO",
        amountIngreso: 138_000,
        openingBalanceCRC: 138_000,
        openingBalanceUSD: 12,
        createdAt: "2026-09-23T00:00:00.000Z",
      },
      nowISO: "2026-09-23T00:00:01.000Z",
    });

    expect(result.ledgerSnapshot.currentCRC).toBe(138_000);
    expect(result.ledgerSnapshot.currentUSD).toBe(12);
  });
});
