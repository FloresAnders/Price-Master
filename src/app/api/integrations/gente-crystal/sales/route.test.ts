import assert from "node:assert/strict";
import test from "node:test";
import { GenteCrystalSaleError } from "../../../../../lib/gente-crystal/sales.ts";
import { createGenteCrystalSalesPost } from "./route.ts";

const active = {
  ticketId: "41783-2204-59175496",
  sorteo: "12/08/2026 NY NOCHE",
  monto: 100,
  saleAt: "2026-08-13T02:14:00.000Z",
  captureOrigin: "local_button",
  status: "active",
} as const;

function request(
  body: string,
  authorization: string | null = "Bearer tm_gc_secret",
) {
  const headers = new Headers({ "content-type": "application/json" });
  if (authorization) headers.set("authorization", authorization);
  return new Request(
    "http://localhost/api/integrations/gente-crystal/sales",
    { method: "POST", headers, body },
  );
}

test("created sales return 201 and the public response contract", async () => {
  const calls: unknown[][] = [];
  const POST = createGenteCrystalSalesPost({
    now: () => new Date("2026-08-13T02:15:00.000Z"),
    hashToken: () => "a".repeat(64),
    createRepository: () => ({
      sync: async (...args) => {
        calls.push(args);
        return { action: "created" as const };
      },
    }),
  });

  const response = await POST(request(JSON.stringify(active)));

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), {
    ok: true,
    action: "created",
    ticketId: active.ticketId,
  });
  assert.deepEqual(calls, [
    [
      "a".repeat(64),
      { ...active, saleAt: new Date(active.saleAt) },
      new Date("2026-08-13T02:15:00.000Z"),
    ],
  ]);
});

test("non-created successful actions return 200", async () => {
  for (const action of ["already_exists", "updated", "deleted"] as const) {
    const POST = createGenteCrystalSalesPost({
      now: () => new Date("2026-08-13T02:15:00.000Z"),
      hashToken: () => "a".repeat(64),
      createRepository: () => ({ sync: async () => ({ action }) }),
    });
    const body =
      action === "deleted"
        ? { ticketId: active.ticketId, status: "deleted" }
        : active;

    const response = await POST(request(JSON.stringify(body)));

    assert.equal(response.status, 200);
    assert.equal((await response.json()).action, action);
  }
});

test("malformed JSON returns 400 without constructing a repository", async () => {
  let repositoryCreated = false;
  const POST = createGenteCrystalSalesPost({
    now: () => new Date(),
    hashToken: () => "a".repeat(64),
    createRepository: () => {
      repositoryCreated = true;
      return { sync: async () => ({ action: "created" as const }) };
    },
  });

  const response = await POST(request("{"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_json" });
  assert.equal(repositoryCreated, false);
});

test("missing authorization returns 401", async () => {
  const POST = createGenteCrystalSalesPost({
    now: () => new Date(),
    hashToken: () => "a".repeat(64),
    createRepository: () => ({
      sync: async () => ({ action: "created" as const }),
    }),
  });

  const response = await POST(request(JSON.stringify(active), null));

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), {
    error: "missing_or_invalid_authorization",
  });
});

test("repository authorization errors preserve their status and code", async () => {
  for (const [status, code] of [
    [401, "invalid_device_token"],
    [403, "missing_permission"],
  ] as const) {
    const POST = createGenteCrystalSalesPost({
      now: () => new Date(),
      hashToken: () => "a".repeat(64),
      createRepository: () => ({
        sync: async () => {
          throw new GenteCrystalSaleError(status, code, "private message");
        },
      }),
    });

    const response = await POST(request(JSON.stringify(active)));

    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), { error: code });
  }
});

test("unexpected failures return a generic 500", async () => {
  const POST = createGenteCrystalSalesPost({
    now: () => new Date(),
    hashToken: () => "a".repeat(64),
    createRepository: () => ({
      sync: async () => {
        throw new Error("database secret detail");
      },
    }),
    logError: () => undefined,
  });

  const response = await POST(request(JSON.stringify(active)));

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: "internal_server_error" });
});
