import { describe, expect, it } from "vitest";
import { createGenteCrystalSalesPost } from "@/app/api/integrations/gente-crystal/sales/route";
import { createGenteCrystalSalesGet } from "@/app/api/integrations/gente-crystal/sales/read-route";

const ticketId = "42148-2204-59468315";

describe("Gente Crystal sales route public contracts", () => {
  it("returns the existing created response for a successful injected POST", async () => {
    const POST = createGenteCrystalSalesPost({
      now: () => new Date("2026-08-24T12:00:00.000Z"),
      hashToken: () => "a".repeat(64),
      createRepository: () => ({
        async sync() {
          return { action: "created" as const };
        },
      }),
    });
    const response = await POST(
      new Request("http://localhost/api/integrations/gente-crystal/sales", {
        method: "POST",
        headers: {
          authorization: "Bearer device-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          ticketId,
          sorteo: "LOTERIA",
          monto: 2000,
          saleAt: "2026-08-24T00:02:00.000Z",
          captureOrigin: "local_button",
          status: "active",
        }),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      action: "created",
      ticketId,
    });
  });

  it("returns the existing daily response for a successful injected GET", async () => {
    const GET = createGenteCrystalSalesGet({
      readUserId: async () => "user-1",
      getUser: async () => ({
        isActive: true,
        role: "superadmin",
        permissions: { reportetiempos: true },
      }),
      getCompany: async (companyId) => ({ id: companyId }),
      createReader: () => ({
        async listDaily() {
          return {
            summary: {
              count: 1,
              total: 2000,
              indirectCount: 0,
              indirectTotal: 0,
            },
            sales: [
              {
                ticketId,
                sorteo: "LOTERIA",
                monto: 2000,
                saleAt: "2026-08-24T00:02:00.000Z",
                captureOrigin: "local_button" as const,
              },
            ],
          };
        },
      }),
      now: () => new Date("2026-08-24T12:00:00.000Z"),
    });
    const response = await GET(
      new Request(
        "http://localhost/api/integrations/gente-crystal/sales?companyId=DELIKOR%20PALMARES&date=2026-08-23",
        { headers: { cookie: "session=test" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      companyId: "DELIKOR PALMARES",
      date: "2026-08-23",
      timezone: "America/Costa_Rica",
      summary: {
        count: 1,
        total: 2000,
        indirectCount: 0,
        indirectTotal: 0,
      },
      sales: [
        {
          ticketId,
          sorteo: "LOTERIA",
          monto: 2000,
          saleAt: "2026-08-24T00:02:00.000Z",
          captureOrigin: "local_button",
        },
      ],
    });
  });
});
