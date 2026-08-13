import assert from "node:assert/strict";
import test from "node:test";
import {
  GenteCrystalSaleError,
  mergeGenteCrystalSale,
  parseGenteCrystalSale,
  readBearerToken,
} from "./sales.ts";
import { FirestoreGenteCrystalSalesRepository } from "./firestore-sales.ts";

const active = {
  ticketId: "41783-2204-59175496",
  sorteo: "12/08/2026 NY NOCHE",
  monto: 100,
  saleAt: "2026-08-13T02:14:00.000Z",
  status: "active",
} as const;

const now = new Date("2026-08-13T02:15:00.000Z");

test("active sales are normalized", () => {
  assert.deepEqual(parseGenteCrystalSale(active), {
    ...active,
    saleAt: new Date(active.saleAt),
  });
});

test("deleted sales require only a ticket", () => {
  assert.deepEqual(
    parseGenteCrystalSale({ ticketId: active.ticketId, status: "deleted" }),
    { ticketId: active.ticketId, status: "deleted" },
  );
});

test("active sales reject invalid required fields", () => {
  assert.throws(
    () => parseGenteCrystalSale({ ...active, monto: 0 }),
    (error) =>
      error instanceof GenteCrystalSaleError &&
      error.status === 400 &&
      error.code === "invalid_monto",
  );
  assert.throws(
    () => parseGenteCrystalSale({ ...active, ticketId: "bad" }),
    /ticketId/,
  );
  assert.throws(
    () => parseGenteCrystalSale({ ...active, sorteo: " " }),
    /sorteo/,
  );
  assert.throws(
    () => parseGenteCrystalSale({ ...active, saleAt: "bad" }),
    /saleAt/,
  );
});

test("payloads reject unknown statuses and non-object bodies", () => {
  assert.throws(
    () => parseGenteCrystalSale({ ...active, status: "pending" }),
    /status/,
  );
  assert.throws(() => parseGenteCrystalSale(null), /body/);
});

test("draw names have a bounded length", () => {
  assert.throws(
    () => parseGenteCrystalSale({ ...active, sorteo: "x".repeat(161) }),
    /sorteo/,
  );
});

test("bearer authorization is strict", () => {
  assert.equal(readBearerToken("Bearer tm_gc_secret"), "tm_gc_secret");
  assert.throws(() => readBearerToken("Basic tm_gc_secret"), /authorization/);
  assert.throws(() => readBearerToken("Bearer "), /authorization/);
  assert.throws(
    () => readBearerToken("Bearer tm_gc_one extra"),
    /authorization/,
  );
});

test("identical active replay does not rewrite the sale", () => {
  const existing = {
    ...active,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    deviceId: "palmares-01",
    source: "gente-crystal" as const,
  };

  assert.deepEqual(
    mergeGenteCrystalSale(
      existing,
      parseGenteCrystalSale(active),
      "palmares-01",
      now,
    ),
    { action: "already_exists" },
  );
});

test("a changed active sale preserves its first received time", () => {
  const firstReceivedAt = new Date("2026-08-13T02:14:30.000Z");
  const existing = {
    ...active,
    monto: 50,
    saleAt: { toDate: () => new Date(active.saleAt) },
    receivedAt: firstReceivedAt,
    updatedAt: firstReceivedAt,
    deviceId: "palmares-01",
    source: "gente-crystal" as const,
  };

  const result = mergeGenteCrystalSale(
    existing,
    parseGenteCrystalSale(active),
    "palmares-02",
    now,
  );

  assert.equal(result.action, "updated");
  assert.deepEqual(result.record, {
    ticketId: active.ticketId,
    sorteo: active.sorteo,
    monto: active.monto,
    saleAt: new Date(active.saleAt),
    receivedAt: firstReceivedAt,
    updatedAt: now,
    status: "active",
    deviceId: "palmares-02",
    source: "gente-crystal",
  });
});

test("deletion creates an auditable tombstone", () => {
  const result = mergeGenteCrystalSale(
    undefined,
    parseGenteCrystalSale({
      ticketId: active.ticketId,
      status: "deleted",
    }),
    "palmares-01",
    now,
  );

  assert.equal(result.action, "deleted");
  assert.deepEqual(result.record, {
    ticketId: active.ticketId,
    status: "deleted",
    receivedAt: now,
    updatedAt: now,
    deviceId: "palmares-01",
    source: "gente-crystal",
  });
});

test("deletion preserves the original sale details", () => {
  const firstReceivedAt = new Date("2026-08-13T02:14:30.000Z");
  const existing = {
    ...active,
    saleAt: new Date(active.saleAt),
    receivedAt: firstReceivedAt,
    updatedAt: firstReceivedAt,
    deviceId: "palmares-01",
    source: "gente-crystal" as const,
  };

  const result = mergeGenteCrystalSale(
    existing,
    parseGenteCrystalSale({
      ticketId: active.ticketId,
      status: "deleted",
    }),
    "palmares-01",
    now,
  );

  assert.deepEqual(result.record, {
    ...existing,
    status: "deleted",
    updatedAt: now,
  });
});

test("an already deleted sale ignores repeated tombstones", () => {
  const existing = {
    ...active,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    status: "deleted" as const,
    deviceId: "palmares-01",
    source: "gente-crystal" as const,
  };

  assert.deepEqual(
    mergeGenteCrystalSale(
      existing,
      parseGenteCrystalSale({
        ticketId: active.ticketId,
        status: "deleted",
      }),
      "palmares-01",
      new Date("2026-08-13T02:16:00.000Z"),
    ),
    { action: "already_exists" },
  );
});

test("an already deleted sale ignores later active payloads", () => {
  const existing = {
    ...active,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    status: "deleted" as const,
    deviceId: "palmares-01",
    source: "gente-crystal" as const,
  };

  assert.deepEqual(
    mergeGenteCrystalSale(
      existing,
      parseGenteCrystalSale(active),
      "palmares-01",
      new Date("2026-08-13T02:16:00.000Z"),
    ),
    { action: "already_exists" },
  );
});

interface FakeSnapshot {
  exists: boolean;
  data(): Record<string, unknown> | undefined;
}

class FakeFirestore {
  documents = new Map<string, Record<string, unknown>>();
  writePaths: string[] = [];

  doc(path: string) {
    return { path };
  }

  async runTransaction<T>(
    callback: (transaction: {
      get: (reference: { path: string }) => Promise<FakeSnapshot>;
      set: (
        reference: { path: string },
        value: Record<string, unknown>,
        options?: { merge?: boolean },
      ) => void;
    }) => Promise<T>,
  ): Promise<T> {
    const writes: Array<{
      path: string;
      value: Record<string, unknown>;
      merge: boolean;
    }> = [];

    const result = await callback({
      get: async (reference) => {
        const value = this.documents.get(reference.path);
        return {
          exists: Boolean(value),
          data: () => value,
        };
      },
      set: (reference, value, options) => {
        writes.push({
          path: reference.path,
          value,
          merge: options?.merge === true,
        });
      },
    });

    for (const write of writes) {
      const previous = this.documents.get(write.path);
      this.documents.set(
        write.path,
        write.merge ? { ...previous, ...write.value } : { ...write.value },
      );
      this.writePaths.push(write.path);
    }

    return result;
  }
}

const tokenHash = "a".repeat(64);
const devicePath = `genteCrystalIntegrationDevices/${tokenHash}`;
const salePath =
  "genteCrystalSales/company-palmares/sales/41783-2204-59175496";

function addWritableDevice(firestore: FakeFirestore) {
  firestore.documents.set(devicePath, {
    companyId: "company-palmares",
    deviceId: "palmares-01",
    deviceName: "PALMARES-PC-01",
    permissions: ["gentecrystal.sales.write"],
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
  });
}

test("repository rejects an unknown device token", async () => {
  const firestore = new FakeFirestore();
  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );

  await assert.rejects(
    repository.sync(tokenHash, parseGenteCrystalSale(active), now),
    (error) =>
      error instanceof GenteCrystalSaleError &&
      error.status === 401 &&
      error.code === "invalid_device_token",
  );
  assert.deepEqual(firestore.writePaths, []);
});

test("repository rejects revoked devices", async () => {
  const firestore = new FakeFirestore();
  addWritableDevice(firestore);
  firestore.documents.set(devicePath, {
    ...firestore.documents.get(devicePath),
    revokedAt: new Date("2026-08-12T00:00:00.000Z"),
  });

  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );
  await assert.rejects(
    repository.sync(tokenHash, parseGenteCrystalSale(active), now),
    (error) =>
      error instanceof GenteCrystalSaleError && error.status === 401,
  );
  assert.deepEqual(firestore.writePaths, []);
});

test("repository rejects devices without the write permission", async () => {
  const firestore = new FakeFirestore();
  addWritableDevice(firestore);
  firestore.documents.set(devicePath, {
    ...firestore.documents.get(devicePath),
    permissions: [],
  });

  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );
  await assert.rejects(
    repository.sync(tokenHash, parseGenteCrystalSale(active), now),
    (error) =>
      error instanceof GenteCrystalSaleError &&
      error.status === 403 &&
      error.code === "missing_permission",
  );
  assert.deepEqual(firestore.writePaths, []);
});

test("repository rejects unsafe company document segments", async () => {
  const firestore = new FakeFirestore();
  addWritableDevice(firestore);
  firestore.documents.set(devicePath, {
    ...firestore.documents.get(devicePath),
    companyId: "companies/palmares",
  });

  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );
  await assert.rejects(
    repository.sync(tokenHash, parseGenteCrystalSale(active), now),
    (error) =>
      error instanceof GenteCrystalSaleError &&
      error.status === 401 &&
      error.code === "invalid_device",
  );
  assert.deepEqual(firestore.writePaths, []);
});

test("repository creates the company and ticket scoped sale", async () => {
  const firestore = new FakeFirestore();
  addWritableDevice(firestore);
  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );

  const result = await repository.sync(
    tokenHash,
    parseGenteCrystalSale(active),
    now,
  );

  assert.deepEqual(result, { action: "created" });
  assert.deepEqual(firestore.writePaths, [salePath, devicePath]);
  assert.deepEqual(firestore.documents.get(salePath), {
    ticketId: active.ticketId,
    sorteo: active.sorteo,
    monto: active.monto,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    status: "active",
    deviceId: "palmares-01",
    source: "gente-crystal",
  });
  assert.equal(
    firestore.documents.get(devicePath)?.lastSeenAt,
    now,
  );
});

test("repository skips the sale write for an identical replay", async () => {
  const firestore = new FakeFirestore();
  addWritableDevice(firestore);
  firestore.documents.set(salePath, {
    ticketId: active.ticketId,
    sorteo: active.sorteo,
    monto: active.monto,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    status: "active",
    deviceId: "palmares-01",
    source: "gente-crystal",
  });
  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );

  const result = await repository.sync(
    tokenHash,
    parseGenteCrystalSale(active),
    now,
  );

  assert.deepEqual(result, { action: "already_exists" });
  assert.deepEqual(firestore.writePaths, [devicePath]);
});

test("repository performs no writes for an already deleted ticket", async () => {
  const firestore = new FakeFirestore();
  addWritableDevice(firestore);
  firestore.documents.set(salePath, {
    ticketId: active.ticketId,
    sorteo: active.sorteo,
    monto: active.monto,
    saleAt: new Date(active.saleAt),
    receivedAt: now,
    updatedAt: now,
    status: "deleted",
    deviceId: "palmares-01",
    source: "gente-crystal",
  });
  const repository = new FirestoreGenteCrystalSalesRepository(
    firestore as never,
  );

  const result = await repository.sync(
    tokenHash,
    parseGenteCrystalSale({
      ticketId: active.ticketId,
      status: "deleted",
    }),
    new Date("2026-08-13T02:16:00.000Z"),
  );

  assert.deepEqual(result, { action: "already_exists" });
  assert.deepEqual(firestore.writePaths, []);
  assert.equal(firestore.documents.get(salePath)?.updatedAt, now);
  assert.equal(firestore.documents.get(devicePath)?.lastSeenAt, undefined);
});
