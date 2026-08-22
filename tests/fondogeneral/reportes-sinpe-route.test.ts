import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  readAuthSession: vi.fn(),
  getEmpresaById: vi.fn(),
  readBcrSinpeReport: vi.fn(),
}));

vi.mock("@/lib/auth/session-store.server", () => ({
  readAuthSession: mocks.readAuthSession,
}));

vi.mock("@/services/empresas", () => ({
  EmpresasService: {
    getEmpresaById: mocks.getEmpresaById,
  },
}));

vi.mock("@/services/sinpe-imap.server", () => ({
  readBcrSinpeReport: mocks.readBcrSinpeReport,
}));

const request = (body: Record<string, unknown>) =>
  new Request("http://localhost/api/reportes-sinpe", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      cookie: "pricemaster_auth=session",
    },
    body: JSON.stringify({
      empresaId: "empresa-1",
      startDate: "2026-08-21",
      startTime: "06:00",
      endDate: "2026-08-21",
      endTime: "23:59",
      ...body,
    }),
  }) as NextRequest;

describe("reportes SINPE API", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.readAuthSession.mockResolvedValue({
      session: { id: "session-id" },
      user: {
        id: "user-1",
        role: "user",
        ownercompanie: "Sucursal Centro",
        permissions: { reportessinpe: true },
      },
    });
    mocks.getEmpresaById.mockResolvedValue({
      id: "empresa-1",
      name: "Sucursal Centro",
      ubicacion: "Sucursal Centro",
      ownerId: "owner-1",
      correoConfigEmail: "sinpe@example.com",
      correoConfigPassword: "secret",
    });
    mocks.readBcrSinpeReport.mockResolvedValue({
      processedEmails: 0,
      validTransactions: 0,
      total: 0,
      transactions: [],
    });
  });

  it("rechaza consultas sin sesion antes de abrir el correo", async () => {
    mocks.readAuthSession.mockResolvedValueOnce(null);
    const { POST } = await import("@/app/api/reportes-sinpe/route");

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(mocks.getEmpresaById).not.toHaveBeenCalled();
    expect(mocks.readBcrSinpeReport).not.toHaveBeenCalled();
  });

  it("rechaza usuarios sin permiso reportessinpe", async () => {
    mocks.readAuthSession.mockResolvedValueOnce({
      session: { id: "session-id" },
      user: {
        id: "user-1",
        role: "user",
        ownercompanie: "Sucursal Centro",
        permissions: { reportessinpe: false },
      },
    });
    const { POST } = await import("@/app/api/reportes-sinpe/route");

    const response = await POST(request({}));

    expect(response.status).toBe(403);
    expect(mocks.getEmpresaById).not.toHaveBeenCalled();
    expect(mocks.readBcrSinpeReport).not.toHaveBeenCalled();
  });

  it("limita rangos personalizados demasiado amplios", async () => {
    const { POST } = await import("@/app/api/reportes-sinpe/route");

    const response = await POST(
      request({
        startDate: "2026-08-01",
        endDate: "2026-08-05",
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.readBcrSinpeReport).not.toHaveBeenCalled();
  });

  it("impide consultar una empresa fuera del alcance del usuario", async () => {
    mocks.getEmpresaById.mockResolvedValueOnce({
      id: "empresa-2",
      name: "Otra Sucursal",
      ubicacion: "Otra Sucursal",
      ownerId: "owner-2",
      correoConfigEmail: "otra@example.com",
      correoConfigPassword: "secret",
    });
    const { POST } = await import("@/app/api/reportes-sinpe/route");

    const response = await POST(request({ empresaId: "empresa-2" }));

    expect(response.status).toBe(403);
    expect(mocks.readBcrSinpeReport).not.toHaveBeenCalled();
  });

  it("responde 504 cuando la lectura IMAP excede el tiempo limite del API", async () => {
    vi.useFakeTimers();
    try {
      mocks.readBcrSinpeReport.mockReturnValueOnce(new Promise(() => {}));
      const { POST } = await import("@/app/api/reportes-sinpe/route");

      const responsePromise = POST(request({}));
      for (let i = 0; i < 10 && !mocks.readBcrSinpeReport.mock.calls.length; i++) {
        await Promise.resolve();
      }
      expect(mocks.readBcrSinpeReport).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(15_001);
      await Promise.resolve();
      await Promise.resolve();

      const response = await responsePromise;
      expect(response.status).toBe(504);
    } finally {
      vi.useRealTimers();
    }
  });

  it("rate limita consultas repetidas del mismo usuario", async () => {
    const { POST } = await import("@/app/api/reportes-sinpe/route");

    for (let i = 0; i < 6; i++) {
      const response = await POST(request({}));
      expect(response.status).toBe(200);
    }

    const blocked = await POST(request({}));

    expect(blocked.status).toBe(429);
    expect(mocks.readBcrSinpeReport).toHaveBeenCalledTimes(6);
  });
});
