import assert from "node:assert/strict";
import test from "node:test";
import type {
  GenteCrystalReadCompany,
  GenteCrystalReadUser,
} from "../../../../../lib/gente-crystal/read-sales.ts";
import { createGenteCrystalSalesGet } from "./read-route.ts";

const company: GenteCrystalReadCompany = {
  id: "DELIKOR PALMARES",
  name: "DELIKOR PALMARES",
  ubicacion: "PALMARES",
  ownerId: "owner-1",
};

const regularUser: GenteCrystalReadUser = {
  role: "user",
  isActive: true,
  ownercompanie: "PALMARES",
  permissions: { reportetiempos: true },
};

const populatedResult = {
  summary: { count: 1, total: 100, indirectCount: 1, indirectTotal: 100 },
  sales: [
    {
      ticketId: "41807-2204-59177102",
      sorteo: "13/08/2026 TICA TARDE",
      monto: 100,
      saleAt: "2026-08-13T03:31:00.000Z",
      captureOrigin: "indirect" as const,
    },
  ],
};

function request(
  companyId = "DELIKOR PALMARES",
  date = "2026-08-12",
) {
  const url = new URL(
    "http://localhost/api/integrations/gente-crystal/sales",
  );
  url.searchParams.set("companyId", companyId);
  url.searchParams.set("date", date);
  return new Request(url, {
    headers: { cookie: "pricemaster_auth=signed" },
  });
}

function dependencies(overrides: {
  readUserId?: () => string;
  getUser?: () => Promise<GenteCrystalReadUser | null>;
  getCompany?: () => Promise<GenteCrystalReadCompany | null>;
  listDaily?: () => Promise<typeof populatedResult>;
  logError?: (message: string, error: unknown) => void;
} = {}) {
  return {
    readUserId: overrides.readUserId ?? (() => "user-1"),
    getUser: overrides.getUser ?? (async () => regularUser),
    getCompany: overrides.getCompany ?? (async () => company),
    createReader: () => ({
      listDaily: overrides.listDaily ?? (async () => populatedResult),
    }),
    logError: overrides.logError,
  };
}

test("authorized GET returns the public daily contract without caching", async () => {
  const calls: unknown[][] = [];
  const GET = createGenteCrystalSalesGet({
    readUserId: () => "user-1",
    getUser: async (userId) => {
      calls.push(["user", userId]);
      return regularUser;
    },
    getCompany: async (companyId) => {
      calls.push(["company", companyId]);
      return company;
    },
    createReader: () => ({
      listDaily: async (companyId, range) => {
        calls.push(["sales", companyId, range]);
        return populatedResult;
      },
    }),
  });

  const response = await GET(request());

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    ok: true,
    companyId: "DELIKOR PALMARES",
    date: "2026-08-12",
    timezone: "America/Costa_Rica",
    ...populatedResult,
  });
  assert.deepEqual(calls, [
    ["user", "user-1"],
    ["company", "DELIKOR PALMARES"],
    [
      "sales",
      "DELIKOR PALMARES",
      {
        date: "2026-08-12",
        start: new Date("2026-08-12T06:00:00.000Z"),
        end: new Date("2026-08-13T06:00:00.000Z"),
      },
    ],
  ]);
});

test("an authorized day without movements returns a zero summary", async () => {
  const GET = createGenteCrystalSalesGet(
    dependencies({
      listDaily: async () => ({
        summary: { count: 0, total: 0, indirectCount: 0, indirectTotal: 0 },
        sales: [],
      }),
    }),
  );

  const response = await GET(request());

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).summary, {
    count: 0,
    total: 0,
    indirectCount: 0,
    indirectTotal: 0,
  });
});

test("invalid company IDs and dates return 400 before authorization", async () => {
  let userReads = 0;
  const GET = createGenteCrystalSalesGet(
    dependencies({
      readUserId: () => {
        userReads += 1;
        return "user-1";
      },
    }),
  );

  for (const invalidRequest of [
    request("companies/palmares"),
    request("DELIKOR PALMARES", "2026-02-30"),
  ]) {
    const response = await GET(invalidRequest);
    assert.equal(response.status, 400);
  }
  assert.equal(userReads, 0);
});

test("missing, unknown, and inactive sessions return 401", async () => {
  const scenarios = [
    dependencies({ readUserId: () => "" }),
    dependencies({ getUser: async () => null }),
    dependencies({ getUser: async () => ({ ...regularUser, isActive: false }) }),
  ];

  for (const scenario of scenarios) {
    const response = await createGenteCrystalSalesGet(scenario)(request());
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: "unauthorized" });
  }
});

test("missing reportetiempos permission and forged company scopes return 403", async () => {
  const scenarios = [
    dependencies({
      getUser: async () => ({
        ...regularUser,
        permissions: { reportetiempos: false },
      }),
    }),
    dependencies({
      getCompany: async () => ({
        ...company,
        id: "DELIKOR SAN VITO",
        name: "DELIKOR SAN VITO",
        ubicacion: "SAN VITO",
      }),
    }),
    dependencies({ getCompany: async () => null }),
  ];

  for (const scenario of scenarios) {
    const response = await createGenteCrystalSalesGet(scenario)(request());
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "forbidden" });
  }
});

test("unexpected reader failures return a generic 500", async () => {
  const logged: unknown[][] = [];
  const GET = createGenteCrystalSalesGet(
    dependencies({
      listDaily: async () => {
        throw new Error("private database detail");
      },
      logError: (...args) => logged.push(args),
    }),
  );

  const response = await GET(request());

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "internal_server_error" });
  assert.equal(logged.length, 1);
});
