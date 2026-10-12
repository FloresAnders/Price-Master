// @vitest-environment jsdom

import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  createDefaultMaintenanceConfig,
  buildCompanyMaintenanceWrite,
  getMaintenanceBlock,
  normalizeMaintenanceConfig,
} from "@/lib/maintenance/config";
import {
  createMaintenanceApiGuard,
  evaluateMaintenanceAccess,
  isMaintenanceGuardExemptPath,
} from "@/lib/maintenance/guard.server";
import { MaintenanceBoundary } from "@/components/maintenance/MaintenanceGate";
import MaintenanceScreen from "@/components/maintenance/MaintenanceScreen";
import { MaintenanceTotpSettings } from "@/components/maintenance/MaintenanceTotpSettings";
import type { User } from "@/types/firestore";

const user = (role: User["role"], ownercompanie = "DELIKOR SINÁI"): User => ({
  id: `${role}-id`,
  name: role || "user",
  role,
  ownercompanie,
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("maintenance access policy", () => {
  it("blocks only users; admin and superadmin remain available", () => {
    const config = createDefaultMaintenanceConfig();
    config.global.enabled = true;

    expect(getMaintenanceBlock(config, user("user"))?.scope).toBe("global");
    expect(getMaintenanceBlock(config, user("admin"))).toBeNull();
    expect(getMaintenanceBlock(config, user("superadmin"))).toBeNull();
  });

  it("derives flattened company identifiers for server and rules enforcement", () => {
    const config = normalizeMaintenanceConfig({
      companies: {
        "company-1": {
          enabled: true,
          companyName: "DELIKOR SINAI",
          companyLocation: "San José",
          message: "Actualizando",
        },
      },
    });

    expect(config.activeCompanyIdentifiers).toContain("delikor sinai");
    expect(getMaintenanceBlock(config, user("user"))?.scope).toBe("company");
  });

  it("removes a company from the flattened enforcement list when disabled", () => {
    const config = normalizeMaintenanceConfig({
      companies: {
        "company-1": {
          enabled: true,
          companyName: "DELIKOR SINAI",
          identifiers: ["delikor sinai"],
        },
      },
    });
    const write = buildCompanyMaintenanceWrite(config, "company-1", {
      ...config.companies["company-1"],
      enabled: false,
    });

    expect(write.activeCompanyIdentifiers).toEqual([]);
    expect(write.companies["company-1"].enabled).toBe(false);
  });

  it("allows a blocked user only while a verified bypass is active", () => {
    const config = createDefaultMaintenanceConfig();
    config.global.enabled = true;

    expect(
      evaluateMaintenanceAccess({ config, user: user("user"), bypassActive: false }),
    ).toMatchObject({ allowed: false });
    expect(
      evaluateMaintenanceAccess({ config, user: user("user"), bypassActive: true }),
    ).toEqual({ allowed: true });
  });

  it("returns maintenance 503 for a blocked user's API request", async () => {
    const config = createDefaultMaintenanceConfig();
    config.global.enabled = true;
    const guard = createMaintenanceApiGuard({
      readSession: async () => ({ user: user("user") }),
      readConfig: async () => config,
      verifyBypass: () => false,
    });

    const response = await guard(
      new Request("https://timemaster.app/api/reportes-sinpe", {
        headers: { cookie: "timemaster_auth=session" },
      }),
    );
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({ maintenance: true });
  });

  it("keeps login, session, Firebase bridge and bypass endpoints reachable", () => {
    expect(isMaintenanceGuardExemptPath("/api/auth/login")).toBe(true);
    expect(isMaintenanceGuardExemptPath("/api/auth/session/heartbeat")).toBe(true);
    expect(isMaintenanceGuardExemptPath("/api/auth/firebase-token")).toBe(true);
    expect(isMaintenanceGuardExemptPath("/api/maintenance/bypass")).toBe(true);
    expect(isMaintenanceGuardExemptPath("/api/reportes-sinpe")).toBe(false);
  });
});

describe("maintenance boundary", () => {
  it("renders normal content for admin during global maintenance", () => {
    const config = createDefaultMaintenanceConfig();
    config.global.enabled = true;

    render(
      <MaintenanceBoundary
        user={user("admin")}
        isAuthenticated
        config={config}
        loading
      >
        <div>Panel disponible</div>
      </MaintenanceBoundary>,
    );

    expect(screen.getByText("Panel disponible")).toBeTruthy();
  });

  it("renders normal content and expiry banner with an active bypass", () => {
    const config = createDefaultMaintenanceConfig();
    config.global.enabled = true;

    render(
      <MaintenanceBoundary
        user={user("user")}
        isAuthenticated
        config={config}
        loading={false}
        bypassStatus={{
          checking: false,
          active: true,
          expiresAt: new Date("2026-10-11T21:30:00-06:00").getTime(),
        }}
      >
        <div>Panel con pase</div>
      </MaintenanceBoundary>,
    );

    expect(screen.getByText("Panel con pase")).toBeTruthy();
    expect(screen.getByText(/Pase de mantenimiento activo/)).toBeTruthy();
  });
});

describe("maintenance bypass UI", () => {
  it("opens the code dialog from TIME-MASTER without a visual click cue", () => {
    render(
      <MaintenanceScreen
        block={{
          scope: "global",
          target: { enabled: true, message: "Actualizando" },
        }}
      />,
    );

    const trigger = screen.getByRole("button", { name: /time-master/i });
    expect(trigger.className).not.toContain("cursor-pointer");
    expect(trigger.className).not.toContain("underline");
    fireEvent.click(trigger);

    expect(
      screen.getByRole("dialog", { name: "Acceso de mantenimiento" }),
    ).toBeTruthy();
    expect(screen.getByLabelText("Código de 6 dígitos")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeTruthy();
  });
});

describe("maintenance TOTP profile settings", () => {
  it("is completely hidden for non-superadmin roles", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<MaintenanceTotpSettings role="admin" />);

    expect(container.childElementCount).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("starts enrollment and shows the one-time QR to a superadmin", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, active: false }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, qrDataUrl: "data:image/png;base64,qr" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<MaintenanceTotpSettings role="superadmin" />);
    const activate = await screen.findByRole("button", {
      name: "Activar acceso de mantenimiento",
    });
    fireEvent.click(activate);

    await waitFor(() => {
      expect(
        screen
          .getByAltText("Código QR para acceso de mantenimiento")
          .getAttribute("src"),
      ).toBe("data:image/png;base64,qr");
    });
    expect(screen.getByLabelText("Primer código de 6 dígitos")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeTruthy();
  });
});
