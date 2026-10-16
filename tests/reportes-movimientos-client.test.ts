import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  getDocs: vi.fn(async () => ({ empty: true, docs: [], size: 0 })),
}));

vi.mock("@/config/firebase", () => ({ db: {} }));
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  collectionGroup: vi.fn(),
  getDocs: firestoreMocks.getDocs,
  limit: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  startAfter: vi.fn(),
  where: vi.fn(),
}));

import { ReportesMovimientosService } from "@/services/reportes-movimientos";

const request = {
  fromIso: "2026-10-01T06:00:00.000Z",
  toExclusiveIso: "2026-10-17T06:00:00.000Z",
  empresa: "DELIKOR SAN VITO",
  accountIds: ["FondoGeneral"],
  currency: "CRC" as const,
  paymentType: "PRESTAMOS INTERCOMPAÑIA (EGRESO)",
  limit: 50 as const,
};

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Fondo report detail client", () => {
  it("loads normalized detail through the authenticated server route", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          items: [
            {
              id: "movement-1",
              movementId: "movement-1",
              empresa: "DELIKOR SAN VITO",
              createdAt: "2026-10-01T13:48:49.178Z",
              accountId: "FondoGeneral",
              paymentType: "PRESTAMOS INTERCOMPAÑIA (EGRESO)",
              classification: "egreso",
              amountIngreso: "0",
              amountEgreso: "100000",
              currency: "CRC",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(ReportesMovimientosService.listDetailItems(request)).resolves.toEqual([
      expect.objectContaining({
        id: "movement-1",
        amountIngreso: 0,
        amountEgreso: 100000,
        currency: "CRC",
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/reportes-movimientos/detalle",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(request),
      }),
    );
  });

  it("throws the server error code when authorization fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: "forbidden_company" }), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      ReportesMovimientosService.listDetailItems(request),
    ).rejects.toThrow("forbidden_company");
  });
});
