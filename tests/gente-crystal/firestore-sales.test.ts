import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { FirestoreGenteCrystalSalesRepository } from "@/lib/gente-crystal/firestore-sales";

const tokenHash = "a".repeat(64);
const companyId = "DELIKOR PALMARES";
const ticketId = "42148-2204-59468315";
const now = new Date("2026-08-24T12:00:00.000Z");
const saleAt = new Date("2026-08-24T00:02:00.000Z");

type FakeWrite = {
  path: string;
  data: Record<string, unknown>;
  options?: { merge: true };
};

function activeSale(overrides: Record<string, unknown> = {}) {
  return {
    ticketId,
    sorteo: "LOTERIA",
    captureOrigin: "local_button" as const,
    monto: 2000,
    saleAt,
    status: "active" as const,
    ...overrides,
  };
}

function createFirestore(existingSale?: Record<string, unknown>) {
  const writes: FakeWrite[] = [];
  const documents: Record<string, Record<string, unknown> | undefined> = {
    [`genteCrystalIntegrationDevices/${tokenHash}`]: {
      companyId,
      deviceId: "device-1",
      permissions: ["gentecrystal.sales.write"],
    },
    [`genteCrystalSales/${companyId}/sales/${ticketId}`]: existingSale,
  };
  const firestore = {
    doc(path: string) {
      return { path };
    },
    async runTransaction<T>(
      update: (transaction: {
        get(reference: { path: string }): Promise<{
          exists: boolean;
          data(): Record<string, unknown> | undefined;
        }>;
        set(
          reference: { path: string },
          data: Record<string, unknown>,
          options?: { merge: true },
        ): void;
      }) => Promise<T>,
    ): Promise<T> {
      return update({
        async get(reference) {
          const data = documents[reference.path];
          return { exists: data !== undefined, data: () => data };
        },
        set(reference, data, options) {
          writes.push({ path: reference.path, data, options });
        },
      });
    },
  };

  return { firestore: firestore as unknown as Firestore, writes };
}

function dailyWrites(writes: FakeWrite[]) {
  return writes.filter((write) => write.path.includes("/daily/"));
}

describe("FirestoreGenteCrystalSalesRepository", () => {
  it("writes a created active sale into its daily consolidation", async () => {
    const { firestore, writes } = createFirestore();
    const repository = new FirestoreGenteCrystalSalesRepository(firestore);

    await repository.sync(tokenHash, activeSale(), now);

    expect(writes.map((write) => write.path)).toEqual([
      "genteCrystalSales/DELIKOR PALMARES/sales/42148-2204-59468315",
      `genteCrystalIntegrationDevices/${tokenHash}`,
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
    ]);
    const [dailyWrite] = dailyWrites(writes);
    expect(dailyWrite.options).toEqual({ merge: true });
    expect(
      (dailyWrite.data.sales as Record<string, unknown>)[ticketId],
    ).toMatchObject({
      sorteo: "LOTERIA",
      captureOrigin: "local_button",
      monto: 2000,
      status: "active",
    });
  });

  it("replaces the daily entry when an active sale changes on the same day", async () => {
    const { firestore, writes } = createFirestore(activeSale());
    const repository = new FirestoreGenteCrystalSalesRepository(firestore);

    await repository.sync(tokenHash, activeSale({ monto: 3000 }), now);

    const [dailyWrite] = dailyWrites(writes);
    expect(dailyWrites(writes)).toHaveLength(1);
    expect(dailyWrite.path).toBe(
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
    );
    expect(
      (dailyWrite.data.sales as Record<string, { monto: number }>)[ticketId]
        .monto,
    ).toBe(3000);
    expect(dailyWrite.options).toEqual({ merge: true });
  });

  it("removes the old daily entry before upserting a moved active sale", async () => {
    const { firestore, writes } = createFirestore(activeSale());
    const repository = new FirestoreGenteCrystalSalesRepository(firestore);

    await repository.sync(
      tokenHash,
      activeSale({ saleAt: new Date("2026-08-24T06:00:00.000Z") }),
      now,
    );

    expect(dailyWrites(writes).map((write) => write.path)).toEqual([
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-24",
    ]);
    expect(
      (dailyWrites(writes)[0].data.sales as Record<string, unknown>)[ticketId],
    ).toEqual(FieldValue.delete());
    expect(
      (dailyWrites(writes)[1].data.sales as Record<string, { monto: number }>)[
        ticketId
      ].monto,
    ).toBe(2000);
  });

  it("removes a deleted active sale from its daily consolidation", async () => {
    const { firestore, writes } = createFirestore(activeSale());
    const repository = new FirestoreGenteCrystalSalesRepository(firestore);

    await repository.sync(tokenHash, { ticketId, status: "deleted" }, now);

    const [dailyWrite] = dailyWrites(writes);
    expect(dailyWrite.path).toBe(
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
    );
    expect(
      (dailyWrite.data.sales as Record<string, unknown>)[ticketId],
    ).toEqual(FieldValue.delete());
    expect(dailyWrite.options).toEqual({ merge: true });
  });

  it("does not write a daily document when deleting a sale that does not exist", async () => {
    const { firestore, writes } = createFirestore();
    const repository = new FirestoreGenteCrystalSalesRepository(firestore);

    await repository.sync(tokenHash, { ticketId, status: "deleted" }, now);

    expect(writes.map((write) => write.path)).toEqual([
      "genteCrystalSales/DELIKOR PALMARES/sales/42148-2204-59468315",
      `genteCrystalIntegrationDevices/${tokenHash}`,
    ]);
    expect(dailyWrites(writes)).toEqual([]);
  });

  it("does not write when the sale already exists", async () => {
    const { firestore, writes } = createFirestore(activeSale());
    const repository = new FirestoreGenteCrystalSalesRepository(firestore);

    await expect(repository.sync(tokenHash, activeSale(), now)).resolves.toEqual({
      action: "already_exists",
    });

    expect(writes).toEqual([]);
  });
});
