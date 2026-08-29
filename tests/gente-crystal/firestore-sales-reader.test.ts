import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import {
  createGenteCrystalSalesReader,
  FirestoreGenteCrystalDailySalesReader,
  FirestoreGenteCrystalSalesQueryReader,
  shouldUseGenteCrystalDailyReads,
} from "@/lib/gente-crystal/firestore-sales-reader";
import { buildCostaRicaDayRange } from "@/lib/gente-crystal/read-sales";

type DailyDocument = Record<string, unknown> | undefined;

function createFirestore(data: DailyDocument) {
  const paths: string[] = [];
  const queryMethods: string[] = [];

  function collection(path: string) {
    return {
      doc(id: string) {
        const documentPath = `${path}/${id}`;
        paths.push(documentPath);
        return {
          collection(name: string) {
            return collection(`${documentPath}/${name}`);
          },
          async get() {
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
        };
      },
      where() {
        queryMethods.push("where");
        return this;
      },
      orderBy() {
        queryMethods.push("orderBy");
        return this;
      },
      async get() {
        queryMethods.push("get");
        return { docs: [] };
      },
    };
  }

  return {
    firestore: { collection } as unknown as Firestore,
    paths,
    queryMethods,
  };
}

describe("FirestoreGenteCrystalDailySalesReader", () => {
  it("reads the selected daily document without issuing a sales collection query", async () => {
    const { firestore, paths, queryMethods } = createFirestore({
      sales: {
        "42148-2204-59468315": {
          sorteo: "LOTERIA",
          captureOrigin: "local_button",
          monto: 2000,
          saleAt: new Date("2026-08-24T00:02:00.000Z"),
          status: "active",
        },
      },
    });
    const reader = new FirestoreGenteCrystalDailySalesReader(firestore);

    await expect(
      reader.listDaily(" DELIKOR PALMARES ", buildCostaRicaDayRange("2026-08-23")),
    ).resolves.toEqual({
      summary: {
        count: 1,
        total: 2000,
        indirectCount: 0,
        indirectTotal: 0,
      },
      sales: [
        {
          ticketId: "42148-2204-59468315",
          sorteo: "LOTERIA",
          monto: 2000,
          saleAt: "2026-08-24T00:02:00.000Z",
          captureOrigin: "local_button",
        },
      ],
    });

    expect(paths).toEqual([
      "genteCrystalSales/DELIKOR PALMARES",
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
    ]);
    expect(queryMethods).toEqual([]);
  });

  it("returns an empty daily result when the selected document is missing", async () => {
    const { firestore, paths, queryMethods } = createFirestore(undefined);
    const reader = new FirestoreGenteCrystalDailySalesReader(firestore);

    await expect(
      reader.listDaily("DELIKOR PALMARES", buildCostaRicaDayRange("2026-08-23")),
    ).resolves.toEqual({
      summary: {
        count: 0,
        total: 0,
        indirectCount: 0,
        indirectTotal: 0,
      },
      sales: [],
    });

    expect(paths).toEqual([
      "genteCrystalSales/DELIKOR PALMARES",
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
    ]);
    expect(queryMethods).toEqual([]);
  });
});

describe("shouldUseGenteCrystalDailyReads", () => {
  it("enables the daily reader only for the exact true flag", () => {
    expect(
      shouldUseGenteCrystalDailyReads({
        GENTE_CRYSTAL_DAILY_READS_ENABLED: "true",
      }),
    ).toBe(true);
    expect(
      shouldUseGenteCrystalDailyReads({
        GENTE_CRYSTAL_DAILY_READS_ENABLED: "TRUE",
      }),
    ).toBe(false);
    expect(
      shouldUseGenteCrystalDailyReads({
        GENTE_CRYSTAL_DAILY_READS_ENABLED: " true ",
      }),
    ).toBe(false);
    expect(shouldUseGenteCrystalDailyReads({})).toBe(false);
  });

  it("factory selects the concrete reader only for the exact true flag", () => {
    const { firestore } = createFirestore(undefined);

    expect(
      createGenteCrystalSalesReader(firestore, {
        GENTE_CRYSTAL_DAILY_READS_ENABLED: "true",
      }),
    ).toBeInstanceOf(FirestoreGenteCrystalDailySalesReader);
    expect(
      createGenteCrystalSalesReader(firestore, {
        GENTE_CRYSTAL_DAILY_READS_ENABLED: "TRUE",
      }),
    ).toBeInstanceOf(FirestoreGenteCrystalSalesQueryReader);
    expect(createGenteCrystalSalesReader(firestore, {})).toBeInstanceOf(
      FirestoreGenteCrystalSalesQueryReader,
    );
  });
});
