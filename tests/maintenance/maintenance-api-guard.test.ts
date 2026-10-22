import { describe, expect, it } from "vitest";

import { getSessionTokenFromCookie } from "@/lib/auth/session-cookie.server";
import { createMaintenanceApiGuard } from "@/lib/maintenance/guard.server";
import {
  normalizeMaintenanceConfig,
  type MaintenanceConfig,
} from "@/lib/maintenance/config";
import type { User } from "@/types/firestore";

const regularUser: User = {
  id: "user-1",
  name: "Usuario",
  role: "user",
  ownercompanie: "DELIKOR PALMARES",
};

const inactiveConfig = normalizeMaintenanceConfig(null);
const globalConfig = normalizeMaintenanceConfig({
  global: { enabled: true, message: "Mantenimiento global" },
});
const companyConfig = normalizeMaintenanceConfig({
  companies: {
    "company-1": {
      enabled: true,
      message: "Mantenimiento local",
      companyId: "company-1",
      companyName: "DELIKOR",
      companyLocation: "SAN VITO",
      identifiers: ["DELIKOR SAN VITO"],
    },
  },
});

type GuardFixtureOptions = {
  config?: MaintenanceConfig;
  user?: User | null;
  bypassActive?: boolean;
};

function createGuardFixture({
  config = inactiveConfig,
  user = regularUser,
  bypassActive = false,
}: GuardFixtureOptions = {}) {
  const reads = { config: 0, session: 0 };
  const guard = createMaintenanceApiGuard({
    hasSessionToken: (cookieHeader) =>
      Boolean(getSessionTokenFromCookie(cookieHeader)),
    async readConfig() {
      reads.config += 1;
      return config;
    },
    async readSession() {
      reads.session += 1;
      return user ? { user } : null;
    },
    verifyBypass: () => bypassActive,
  });
  return { guard, reads };
}

const requestWithCookie = () =>
  new Request("https://www.timemaster.es/api/server-time", {
    headers: { cookie: "timemaster_auth=token" },
  });

describe("createMaintenanceApiGuard", () => {
  it("omite Firestore cuando no existe token de sesion", async () => {
    const { guard, reads } = createGuardFixture();

    expect(await guard(new Request("https://www.timemaster.es/api/server-time"))).toBeNull();
    expect(reads).toEqual({ config: 0, session: 0 });
  });

  it("omite Firestore cuando el token de sesion esta malformado", async () => {
    const { guard, reads } = createGuardFixture();
    const request = new Request("https://www.timemaster.es/api/server-time", {
      headers: { cookie: "timemaster_auth=%E0%A4%A" },
    });

    expect(await guard(request)).toBeNull();
    expect(reads).toEqual({ config: 0, session: 0 });
  });

  it("no lee sesion cuando mantenimiento esta apagado", async () => {
    const { guard, reads } = createGuardFixture();

    expect(await guard(requestWithCookie())).toBeNull();
    expect(reads).toEqual({ config: 1, session: 0 });
  });

  it("bloquea con 503 al usuario regular durante mantenimiento global", async () => {
    const { guard, reads } = createGuardFixture({ config: globalConfig });

    const response = await guard(requestWithCookie());

    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({ maintenance: true });
    expect(reads).toEqual({ config: 1, session: 1 });
  });

  it("permite al usuario de una empresa no afectada", async () => {
    const { guard, reads } = createGuardFixture({ config: companyConfig });

    expect(await guard(requestWithCookie())).toBeNull();
    expect(reads).toEqual({ config: 1, session: 1 });
  });

  it("permite al SuperAdmin durante mantenimiento global", async () => {
    const { guard } = createGuardFixture({
      config: globalConfig,
      user: { ...regularUser, role: "superadmin" },
    });

    expect(await guard(requestWithCookie())).toBeNull();
  });

  it("permite bypass valido durante mantenimiento global", async () => {
    const { guard } = createGuardFixture({
      config: globalConfig,
      bypassActive: true,
    });

    expect(await guard(requestWithCookie())).toBeNull();
  });
});
