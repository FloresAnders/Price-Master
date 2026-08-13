import assert from "node:assert/strict";
import test from "node:test";
import {
  GenteCrystalSalesReadError,
  buildCostaRicaDayRange,
  buildGenteCrystalDailyResult,
  canReadGenteCrystalCompany,
  readCompanyDocumentId,
} from "./read-sales.ts";

const company = {
  id: "DELIKOR PALMARES",
  name: "DELIKOR PALMARES",
  ubicacion: "PALMARES",
  ownerId: "owner-1",
};

test("Costa Rica dates become exact UTC half-open ranges", () => {
  assert.deepEqual(buildCostaRicaDayRange("2026-08-12"), {
    date: "2026-08-12",
    start: new Date("2026-08-12T06:00:00.000Z"),
    end: new Date("2026-08-13T06:00:00.000Z"),
  });
});

test("invalid calendar dates are rejected instead of rolling over", () => {
  for (const value of ["", "12/08/2026", "2026-2-03", "2026-02-30"]) {
    assert.throws(
      () => buildCostaRicaDayRange(value),
      (error) =>
        error instanceof GenteCrystalSalesReadError &&
        error.status === 400 &&
        error.code === "invalid_date",
    );
  }
});

test("company document IDs reject empty, oversized, and slash-containing values", () => {
  assert.equal(readCompanyDocumentId(" DELIKOR PALMARES "), "DELIKOR PALMARES");
  for (const value of [null, "", "companies/palmares", "x".repeat(161)]) {
    assert.throws(
      () => readCompanyDocumentId(value),
      (error) =>
        error instanceof GenteCrystalSalesReadError &&
        error.code === "invalid_company_id",
    );
  }
});

test("regular users need Tiempos permission and their assigned company", () => {
  assert.equal(
    canReadGenteCrystalCompany(
      {
        role: "user",
        ownercompanie: "PALMARES",
        permissions: { tiempos: true },
      },
      company,
    ),
    true,
  );
  assert.equal(
    canReadGenteCrystalCompany(
      {
        role: "user",
        ownercompanie: "DELIKOR PALMARES",
        permissions: { tiempos: false },
      },
      company,
    ),
    false,
  );
  assert.equal(
    canReadGenteCrystalCompany(
      {
        role: "user",
        ownercompanie: "DELIKOR SAN VITO",
        permissions: { tiempos: true },
      },
      company,
    ),
    false,
  );
});

test("admins are restricted to their owner scope", () => {
  assert.equal(
    canReadGenteCrystalCompany(
      { id: "admin-1", role: "admin", ownerId: "owner-1", eliminate: true },
      company,
    ),
    true,
  );
  assert.equal(
    canReadGenteCrystalCompany(
      { id: "owner-1", role: "admin", eliminate: false },
      company,
    ),
    true,
  );
  assert.equal(
    canReadGenteCrystalCompany(
      { id: "admin-2", role: "admin", ownerId: "owner-2", eliminate: true },
      company,
    ),
    false,
  );
});

test("superadmins can read any company while unknown roles cannot", () => {
  assert.equal(canReadGenteCrystalCompany({ role: "superadmin" }, company), true);
  assert.equal(canReadGenteCrystalCompany({ role: undefined }, company), false);
});

test("daily results exclude tombstones, sort newest first, and sum active sales", () => {
  const result = buildGenteCrystalDailyResult([
    {
      ticketId: "41807-2204-59177102",
      sorteo: "13/08/2026 TICA TARDE",
      monto: 100,
      saleAt: new Date("2026-08-13T03:31:00.000Z"),
      status: "active",
    },
    {
      ticketId: "41807-2204-59177103",
      sorteo: "13/08/2026 TICA TARDE",
      monto: 50,
      saleAt: new Date("2026-08-13T02:31:00.000Z"),
      status: "deleted",
    },
    {
      ticketId: "41807-2204-59177104",
      sorteo: "13/08/2026 TICA NOCHE",
      monto: 200,
      saleAt: { toDate: () => new Date("2026-08-13T04:31:00.000Z") },
      status: "active",
    },
  ]);

  assert.deepEqual(result, {
    summary: { count: 2, total: 300 },
    sales: [
      {
        ticketId: "41807-2204-59177104",
        sorteo: "13/08/2026 TICA NOCHE",
        monto: 200,
        saleAt: "2026-08-13T04:31:00.000Z",
      },
      {
        ticketId: "41807-2204-59177102",
        sorteo: "13/08/2026 TICA TARDE",
        monto: 100,
        saleAt: "2026-08-13T03:31:00.000Z",
      },
    ],
  });
});

test("malformed active records are omitted from the public result", () => {
  const result = buildGenteCrystalDailyResult([
    { ticketId: "bad", status: "active", sorteo: "TICA", monto: 100 },
    {
      ticketId: "41807-2204-59177102",
      status: "active",
      sorteo: "TICA",
      monto: Number.NaN,
      saleAt: new Date("2026-08-13T03:31:00.000Z"),
    },
  ]);

  assert.deepEqual(result, { summary: { count: 0, total: 0 }, sales: [] });
});
