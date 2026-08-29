import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildBackfillMutation,
  compareDailyTotals,
  parseBackfillArgs,
} from "../../scripts/backfill-gente-crystal-daily.mjs";

const saleAt = new Date("2026-08-24T00:02:00.000Z");
const ticketId = "42148-2204-59468315";
const activeSale = {
  ticketId,
  sorteo: " LOTERIA ",
  captureOrigin: "local_button",
  monto: 2000,
  saleAt,
  status: "active",
  ignoredLegacyField: "must not be copied",
};

describe("Gente Crystal daily backfill arguments", () => {
  it("validates CLI arguments before loading environment or initializing Firebase", () => {
    const scriptPath = fileURLToPath(
      new URL("../../scripts/backfill-gente-crystal-daily.mjs", import.meta.url),
    );
    const result = spawnSync(process.execPath, [scriptPath], {
      encoding: "utf8",
      env: {
        ...process.env,
        FIREBASE_SERVICE_ACCOUNT_KEY: "must-not-be-read-before-validation",
      },
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("--company");
    expect(result.stderr).not.toContain("FIREBASE_SERVICE_ACCOUNT_KEY");
    expect(result.stderr).not.toContain("must-not-be-read-before-validation");
  });

  it("requires one explicit operator mode and a trimmed company document ID", () => {
    expect(
      parseBackfillArgs([
        "--company",
        " DELIKOR PALMARES ",
        "--verify-only",
      ]),
    ).toEqual({ companyId: "DELIKOR PALMARES", mode: "verify-only" });

    expect(() => parseBackfillArgs(["--verify-only"])).toThrow(
      /--company/,
    );
    expect(() => parseBackfillArgs(["--company", "DELIKOR PALMARES"])).toThrow(
      /--apply.*--verify-only|--verify-only.*--apply/,
    );
  });

  it("rejects unsafe company paths and ambiguous modes", () => {
    expect(() =>
      parseBackfillArgs([
        "--company",
        "DELIKOR/PALMARES",
        "--verify-only",
      ]),
    ).toThrow(/document segment/);
    expect(() =>
      parseBackfillArgs([
        "--company",
        "DELIKOR PALMARES",
        "--apply",
        "--verify-only",
      ]),
    ).toThrow(/cannot be combined/);
  });

  it.each([
    ["--company", "--apply"],
    ["--company", "--apply", "--apply"],
    ["--company", "--verify-only", "--apply"],
  ])("does not consume another flag as the --company value: %j", (...argv) => {
    expect(() => parseBackfillArgs(argv)).toThrow(/--company.*value/);
  });
});

describe("Gente Crystal daily backfill mutations", () => {
  it("projects an active sale to its Costa Rica day with only minimal fields", () => {
    expect(
      buildBackfillMutation("DELIKOR PALMARES", ticketId, activeSale),
    ).toEqual({
      dailyPath: "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
      data: {
        sales: {
          [ticketId]: {
            sorteo: "LOTERIA",
            captureOrigin: "local_button",
            monto: 2000,
            saleAt,
            status: "active",
          },
        },
      },
    });
  });

  it("plans a delete only for a tombstone that retains a valid saleAt", () => {
    const mutation = buildBackfillMutation("DELIKOR PALMARES", ticketId, {
      status: "deleted",
      saleAt,
    });

    expect(mutation?.dailyPath).toBe(
      "genteCrystalSales/DELIKOR PALMARES/daily/2026-08-23",
    );
    expect(
      mutation?.data.sales[ticketId]?.constructor.name,
    ).toBe("DeleteTransform");
    expect(
      buildBackfillMutation("DELIKOR PALMARES", ticketId, {
        status: "deleted",
      }),
    ).toBeNull();
  });
});

describe("Gente Crystal daily backfill verification", () => {
  it("compares active counts and monetary totals for every Costa Rica day", () => {
    expect(
      compareDailyTotals(
        [
          { id: ticketId, data: activeSale },
          {
            id: "42148-2204-59468316",
            data: {
              ...activeSale,
              ticketId: "42148-2204-59468316",
              monto: 500,
              captureOrigin: "indirect",
              saleAt: new Date("2026-08-24T06:00:00.000Z"),
            },
          },
          {
            id: "42148-2204-59468317",
            data: { ...activeSale, status: "deleted" },
          },
        ],
        [
          {
            id: "2026-08-23",
            data: {
              sales: {
                [ticketId]: {
                  sorteo: "LOTERIA",
                  captureOrigin: "local_button",
                  monto: 2000,
                  saleAt,
                  status: "active",
                },
              },
            },
          },
          {
            id: "2026-08-24",
            data: {
              sales: {
                "42148-2204-59468316": {
                  sorteo: "NUEVOS TIEMPOS",
                  captureOrigin: "indirect",
                  monto: 400,
                  saleAt: new Date("2026-08-24T06:00:00.000Z"),
                  status: "active",
                },
              },
            },
          },
        ],
      ),
    ).toEqual({
      ok: false,
      individual: {
        "2026-08-23": { count: 1, total: 2000 },
        "2026-08-24": { count: 1, total: 500 },
      },
      daily: {
        "2026-08-23": { count: 1, total: 2000 },
        "2026-08-24": { count: 1, total: 400 },
      },
      mismatches: [
        {
          date: "2026-08-24",
          individual: { count: 1, total: 500 },
          daily: { count: 1, total: 400 },
        },
      ],
      entryMismatches: [
        {
          ticketId: "42148-2204-59468316",
          expected: {
            date: "2026-08-24",
            entry: {
              sorteo: "LOTERIA",
              captureOrigin: "indirect",
              monto: 500,
              saleAt: "2026-08-24T06:00:00.000Z",
              status: "active",
            },
          },
          actual: [
            {
              date: "2026-08-24",
              exactMinimalEntry: true,
              entry: {
                sorteo: "NUEVOS TIEMPOS",
                captureOrigin: "indirect",
                monto: 400,
                saleAt: "2026-08-24T06:00:00.000Z",
                status: "active",
              },
            },
          ],
        },
      ],
    });
  });

  it("rejects compensating totals when daily ticket IDs differ", () => {
    const result = compareDailyTotals(
      [
        { id: ticketId, data: activeSale },
        {
          id: "42148-2204-59468316",
          data: { ...activeSale, monto: 500 },
        },
      ],
      [
        {
          id: "2026-08-23",
          data: {
            sales: {
              "42148-2204-70000001": {
                sorteo: "LOTERIA",
                captureOrigin: "local_button",
                monto: 2000,
                saleAt,
                status: "active",
              },
              "42148-2204-70000002": {
                sorteo: "LOTERIA",
                captureOrigin: "local_button",
                monto: 500,
                saleAt,
                status: "active",
              },
            },
          },
        },
      ],
    );

    expect(result.individual).toEqual({
      "2026-08-23": { count: 2, total: 2500 },
    });
    expect(result.daily).toEqual({
      "2026-08-23": { count: 2, total: 2500 },
    });
    expect(result.ok).toBe(false);
    expect(result.entryMismatches.map(({ ticketId: id }) => id)).toEqual([
      "42148-2204-59468315",
      "42148-2204-59468316",
      "42148-2204-70000001",
      "42148-2204-70000002",
    ]);
  });

  it("rejects tickets stored under each other's Costa Rica date", () => {
    const secondTicketId = "42148-2204-59468316";
    const secondSaleAt = new Date("2026-08-24T06:00:00.000Z");
    const result = compareDailyTotals(
      [
        { id: ticketId, data: activeSale },
        {
          id: secondTicketId,
          data: { ...activeSale, ticketId: secondTicketId, saleAt: secondSaleAt },
        },
      ],
      [
        {
          id: "2026-08-23",
          data: {
            sales: {
              [secondTicketId]: {
                sorteo: "LOTERIA",
                captureOrigin: "local_button",
                monto: 2000,
                saleAt: secondSaleAt,
                status: "active",
              },
            },
          },
        },
        {
          id: "2026-08-24",
          data: {
            sales: {
              [ticketId]: {
                sorteo: "LOTERIA",
                captureOrigin: "local_button",
                monto: 2000,
                saleAt,
                status: "active",
              },
            },
          },
        },
      ],
    );

    expect(result.individual).toEqual({
      "2026-08-23": { count: 1, total: 2000 },
      "2026-08-24": { count: 1, total: 2000 },
    });
    expect(result.daily).toEqual(result.individual);
    expect(result.ok).toBe(false);
    expect(result.entryMismatches).toMatchObject([
      {
        ticketId,
        expected: { date: "2026-08-23" },
        actual: [{ date: "2026-08-24" }],
      },
      {
        ticketId: secondTicketId,
        expected: { date: "2026-08-24" },
        actual: [{ date: "2026-08-23" }],
      },
    ]);
  });

  it("rejects a daily entry whose exact five-field minimal schema differs", () => {
    const result = compareDailyTotals(
      [{ id: ticketId, data: activeSale }],
      [
        {
          id: "2026-08-23",
          data: {
            sales: {
              [ticketId]: {
                sorteo: "OTRA LOTERIA",
                captureOrigin: "local_button",
                monto: 2000,
                saleAt,
                status: "active",
                ignoredLegacyField: "must make verification fail",
              },
            },
          },
        },
      ],
    );

    expect(result.individual).toEqual({
      "2026-08-23": { count: 1, total: 2000 },
    });
    expect(result.daily).toEqual(result.individual);
    expect(result.ok).toBe(false);
    expect(result.entryMismatches).toMatchObject([
      {
        ticketId,
        expected: {
          date: "2026-08-23",
          entry: { sorteo: "LOTERIA" },
        },
        actual: [
          {
            date: "2026-08-23",
            exactMinimalEntry: false,
            entry: { sorteo: "OTRA LOTERIA" },
          },
        ],
      },
    ]);
  });
});
