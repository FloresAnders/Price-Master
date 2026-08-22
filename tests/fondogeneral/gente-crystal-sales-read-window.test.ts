import { describe, expect, it, vi } from "vitest";

import { createGenteCrystalSalesGet } from "@/app/api/integrations/gente-crystal/sales/read-route";

describe("createGenteCrystalSalesGet", () => {
  it("bloquea la actualizacion de un user fuera de las ventanas de cierre", async () => {
    const listDaily = vi.fn();
    const GET = createGenteCrystalSalesGet({
      now: () => new Date("2026-08-22T02:16:00.000Z"), // 20:16 CR
      readUserId: async () => "user-1",
      getUser: async () => ({
        role: "user",
        isActive: true,
        ownercompanie: "Empresa",
        permissions: { reportetiempos: true },
      }),
      getCompany: async () => ({
        id: "empresa-1",
        name: "Empresa",
        horarioApertura: "07:45",
        horarioCierre: "23:45",
        cierreFondoVentasMinutesBeforeEnd: 15,
        cierreFondoVentasMinutesAfterEnd: 90,
      }),
      createReader: () => ({ listDaily }),
    });

    const response = await GET(
      new Request(
        "https://example.com/api/integrations/gente-crystal/sales?companyId=empresa-1&date=2026-08-21",
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "update_window_closed",
    });
    expect(listDaily).not.toHaveBeenCalled();
  });
});
