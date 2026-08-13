import assert from "node:assert/strict";
import test from "node:test";
import { buildCostaRicaDayRange } from "./read-sales.ts";
import { FirestoreGenteCrystalSalesReader } from "./firestore-sales-reader.ts";

class FakeQuery {
  readonly operations: unknown[][];
  readonly records: Array<Record<string, unknown>>;

  constructor(
    operations: unknown[][],
    records: Array<Record<string, unknown>>,
  ) {
    this.operations = operations;
    this.records = records;
  }

  doc(value: string) {
    this.operations.push(["doc", value]);
    return this;
  }

  collection(value: string) {
    this.operations.push(["collection", value]);
    return this;
  }

  where(field: string, operator: string, value: unknown) {
    this.operations.push(["where", field, operator, value]);
    return this;
  }

  orderBy(field: string, direction: string) {
    this.operations.push(["orderBy", field, direction]);
    return this;
  }

  async get() {
    this.operations.push(["get"]);
    return {
      docs: this.records.map((record) => ({ data: () => record })),
    };
  }
}

class FakeFirestore {
  readonly operations: unknown[][] = [];
  readonly records: Array<Record<string, unknown>>;

  constructor(records: Array<Record<string, unknown>>) {
    this.records = records;
  }

  collection(value: string) {
    this.operations.push(["collection", value]);
    return new FakeQuery(this.operations, this.records);
  }
}

test("reader queries one company and one half-open saleAt range", async () => {
  const firestore = new FakeFirestore([
    {
      ticketId: "41807-2204-59177102",
      status: "active",
      sorteo: "13/08/2026 TICA TARDE",
      monto: 100,
      saleAt: new Date("2026-08-13T03:31:00.000Z"),
    },
    {
      ticketId: "41807-2204-59177103",
      status: "deleted",
      sorteo: "13/08/2026 TICA TARDE",
      monto: 50,
      saleAt: new Date("2026-08-13T02:31:00.000Z"),
    },
  ]);
  const range = buildCostaRicaDayRange("2026-08-12");
  const reader = new FirestoreGenteCrystalSalesReader(firestore as never);

  const result = await reader.listDaily("DELIKOR PALMARES", range);

  assert.deepEqual(firestore.operations, [
    ["collection", "genteCrystalSales"],
    ["doc", "DELIKOR PALMARES"],
    ["collection", "sales"],
    ["where", "saleAt", ">=", range.start],
    ["where", "saleAt", "<", range.end],
    ["orderBy", "saleAt", "desc"],
    ["get"],
  ]);
  assert.deepEqual(result, {
    summary: { count: 1, total: 100 },
    sales: [
      {
        ticketId: "41807-2204-59177102",
        sorteo: "13/08/2026 TICA TARDE",
        monto: 100,
        saleAt: "2026-08-13T03:31:00.000Z",
      },
    ],
  });
});
