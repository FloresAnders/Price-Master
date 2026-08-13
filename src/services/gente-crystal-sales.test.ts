import assert from "node:assert/strict";
import test from "node:test";
import {
  GenteCrystalSalesClient,
  GenteCrystalSalesClientError,
  messageForGenteCrystalSalesError,
} from "./gente-crystal-sales.ts";

const responseBody = {
  ok: true as const,
  companyId: "DELIKOR PALMARES",
  date: "2026-08-12",
  timezone: "America/Costa_Rica",
  summary: { count: 1, total: 100 },
  sales: [
    {
      ticketId: "41807-2204-59177102",
      sorteo: "13/08/2026 TICA TARDE",
      monto: 100,
      saleAt: "2026-08-13T03:31:00.000Z",
    },
  ],
};

test("daily client requests the encoded company and date without cache", async () => {
  const calls: unknown[][] = [];
  const originalFetch = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = (async (input, init) => {
    calls.push([input, init]);
    return Response.json(responseBody);
  }) as typeof fetch;

  try {
    const result = await GenteCrystalSalesClient.getDaily(
      "DELIKOR PALMARES",
      "2026-08-12",
      controller.signal,
    );

    assert.deepEqual(result, responseBody);
    assert.deepEqual(calls, [
      [
        "/api/integrations/gente-crystal/sales?companyId=DELIKOR+PALMARES&date=2026-08-12",
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        },
      ],
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("non-success responses preserve status and public error code", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({ error: "forbidden" }, { status: 403 })) as typeof fetch;

  try {
    await assert.rejects(
      GenteCrystalSalesClient.getDaily("DELIKOR PALMARES", "2026-08-12"),
      (error) =>
        error instanceof GenteCrystalSalesClientError &&
        error.status === 403 &&
        error.code === "forbidden",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("malformed success payloads are rejected before reaching the UI", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    Response.json({ ok: true, sales: null })) as typeof fetch;

  try {
    await assert.rejects(
      GenteCrystalSalesClient.getDaily("DELIKOR PALMARES", "2026-08-12"),
      (error) =>
        error instanceof GenteCrystalSalesClientError &&
        error.code === "invalid_response",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("client errors map to the approved Spanish messages", () => {
  assert.equal(
    messageForGenteCrystalSalesError(
      new GenteCrystalSalesClientError(401, "unauthorized"),
    ),
    "Tu sesión expiró. Inicia sesión nuevamente.",
  );
  assert.equal(
    messageForGenteCrystalSalesError(
      new GenteCrystalSalesClientError(403, "forbidden"),
    ),
    "No tienes acceso a esta empresa.",
  );
  assert.equal(
    messageForGenteCrystalSalesError(new TypeError("network failed")),
    "No se pudieron cargar los movimientos.",
  );
});
