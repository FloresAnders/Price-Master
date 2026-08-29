import { describe, expect, it, vi } from "vitest";
import {
  applyPendingBackfill,
  comparePendingIndex,
  parsePendingBackfillArgs,
} from "../../scripts/backfill-factura-pending-index.mjs";

describe("pending invoice backfill arguments", () => {
  it("requires explicit company, database, and exactly one operator mode", () => {
    expect(() =>
      parsePendingBackfillArgs([
        "--company",
        "ACME",
        "--verify-only",
      ]),
    ).toThrow(/--database/);
    expect(() =>
      parsePendingBackfillArgs([
        "--database",
        "restauracion",
        "--verify-only",
      ]),
    ).toThrow(/--company/);
    expect(() =>
      parsePendingBackfillArgs([
        "--company",
        "ACME",
        "--database",
        "restauracion",
      ]),
    ).toThrow(/Exactly one/);
    expect(() =>
      parsePendingBackfillArgs([
        "--company",
        "ACME",
        "--database",
        "restauracion",
        "--apply",
        "--verify-only",
      ]),
    ).toThrow(/cannot be combined/);
  });

  it("returns trimmed safe values without accepting Firestore paths", () => {
    expect(
      parsePendingBackfillArgs([
        "--company",
        " DELIKOR PALMARES ",
        "--database",
        " restauracion ",
        "--verify-only",
      ]),
    ).toEqual({
      company: "DELIKOR PALMARES",
      databaseId: "restauracion",
      mode: "verify-only",
    });
    expect(() =>
      parsePendingBackfillArgs([
        "--company",
        "DELIKOR/PALMARES",
        "--database",
        "restauracion",
        "--apply",
      ]),
    ).toThrow(/document segment/);
  });
});

describe("pending invoice backfill application", () => {
  it("re-reads each document in a transaction and writes only a changed flag", async () => {
    const staleDocument = {
      id: "invoice-1",
      ref: { path: "Facturas/ACME/movements/invoice-1" },
      data: () => ({ invoiceDocType: "FCR", amount: 0 }),
    };
    const latestData = {
      invoiceDocType: "FCR",
      amount: 100,
      paymentStatus: "PENDIENTE",
      isPendingForClosing: false,
    };
    const set = vi.fn();
    const get = vi.fn(async () => ({
      exists: true,
      id: "invoice-1",
      data: () => latestData,
    }));
    const firestore = {
      runTransaction: async (
        update: (transaction: { get: typeof get; set: typeof set }) => Promise<void>,
      ) => update({ get, set }),
    };

    const result = await applyPendingBackfill(
      firestore as never,
      [staleDocument] as never,
    );

    expect(get).toHaveBeenCalledWith(staleDocument.ref);
    expect(set).toHaveBeenCalledWith(
      staleDocument.ref,
      { isPendingForClosing: true },
      { merge: true },
    );
    expect(result).toEqual({ scanned: 1, changed: 1, unchanged: 0 });
  });

  it("performs no write when the current transaction value is already correct", async () => {
    const document = {
      id: "invoice-1",
      ref: { path: "Facturas/ACME/movements/invoice-1" },
    };
    const set = vi.fn();
    const firestore = {
      runTransaction: async (
        update: (transaction: Record<string, unknown>) => Promise<void>,
      ) =>
        update({
          get: async () => ({
            exists: true,
            id: "invoice-1",
            data: () => ({
              invoiceDocType: "FCO",
              amount: 100,
              isPendingForClosing: false,
            }),
          }),
          set,
        }),
    };

    const result = await applyPendingBackfill(
      firestore as never,
      [document] as never,
    );

    expect(set).not.toHaveBeenCalled();
    expect(result).toEqual({ scanned: 1, changed: 0, unchanged: 1 });
  });
});

describe("pending invoice backfill verification", () => {
  it("detects missing indexed IDs and incorrect stored projection flags", () => {
    const result = comparePendingIndex(
      [
        {
          id: "pending-fcr",
          data: {
            invoiceDocType: "FCR",
            amount: 100,
            paymentStatus: "PENDIENTE",
            isPendingForClosing: false,
          },
        },
        {
          id: "cash",
          data: {
            invoiceDocType: "FCO",
            amount: 100,
            isPendingForClosing: false,
          },
        },
      ],
      [],
    );

    expect(result.ok).toBe(false);
    expect(result.expectedPendingIds).toEqual(["pending-fcr"]);
    expect(result.missingFromIndex).toEqual(["pending-fcr"]);
    expect(result.flagMismatches).toEqual([
      { id: "pending-fcr", expected: true, actual: false },
    ]);
  });

  it("accepts exact projected flags and indexed identities", () => {
    const allDocuments = [
      {
        id: "pending-nc",
        data: {
          invoiceDocType: "NC",
          amount: 0,
          paymentStatus: "PENDIENTE",
          isPendingForClosing: true,
        },
      },
      {
        id: "paid-fcr",
        data: {
          invoiceDocType: "FCR",
          amount: 100,
          balanceDue: 0,
          paymentStatus: "PAGADA",
          isPendingForClosing: false,
        },
      },
    ];

    expect(
      comparePendingIndex(allDocuments, [{ id: "pending-nc" }]),
    ).toMatchObject({
      ok: true,
      expectedPendingIds: ["pending-nc"],
      indexedPendingIds: ["pending-nc"],
      missingFromIndex: [],
      unexpectedInIndex: [],
      flagMismatches: [],
    });
  });
});
