import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaintenanceBoundary } from "@/components/maintenance/MaintenanceGate";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  getMaintenanceBlock,
  normalizeMaintenanceConfig,
  normalizeMaintenanceConfigFromVersionSnapshot,
  type MaintenanceConfig,
} from "@/services/maintenance";
import type { VersionDocSnapshot } from "@/services/version-doc";
import type { User } from "@/types/firestore";

const regularUser: User = {
  id: "user-1",
  name: "Usuario",
  role: "user",
  ownercompanie: "Delikor San Vito",
};

const enabledConfig: MaintenanceConfig = {
  global: {
    enabled: true,
    message: "Actualización general",
  },
  companies: {
    "company-1": {
      enabled: true,
      message: "Actualización de empresa",
      companyId: "company-1",
      companyName: "DELIKOR",
      companyLocation: "San Vito",
      identifiers: ["delikor san vito", "san vito"],
    },
  },
};

describe("getMaintenanceBlock", () => {
  it("bloquea primero por mantenimiento global", () => {
    const block = getMaintenanceBlock(enabledConfig, regularUser);

    expect(block).toEqual({
      scope: "global",
      target: enabledConfig.global,
    });
  });

  it("nunca bloquea a SuperAdmin", () => {
    const superadmin: User = {
      ...regularUser,
      role: "superadmin",
    };

    expect(getMaintenanceBlock(enabledConfig, superadmin)).toBeNull();
  });

  it("bloquea empresa asignada ignorando mayúsculas y acentos", () => {
    const companyOnlyConfig: MaintenanceConfig = {
      ...enabledConfig,
      global: { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE },
    };
    const user: User = {
      ...regularUser,
      ownercompanie: "  DELÍKOR   SAN VITO ",
    };

    const block = getMaintenanceBlock(companyOnlyConfig, user);

    expect(block?.scope).toBe("company");
    expect(block?.target.companyId).toBe("company-1");
  });

  it("permite empresa no incluida en mantenimiento", () => {
    const companyOnlyConfig: MaintenanceConfig = {
      ...enabledConfig,
      global: { enabled: false, message: DEFAULT_MAINTENANCE_MESSAGE },
    };
    const user: User = {
      ...regularUser,
      ownercompanie: "Delifood",
    };

    expect(getMaintenanceBlock(companyOnlyConfig, user)).toBeNull();
  });
});

describe("normalizeMaintenanceConfig", () => {
  it("convierte configuración ausente en estado seguro desactivado", () => {
    expect(normalizeMaintenanceConfig(null)).toEqual({
      global: {
        enabled: false,
        message: DEFAULT_MAINTENANCE_MESSAGE,
        enabledAt: undefined,
        enabledBy: null,
        updatedAt: undefined,
        updatedBy: null,
        companyId: undefined,
        companyName: undefined,
        companyLocation: undefined,
        identifiers: [],
      },
      companies: {},
    });
  });
  it("lee mantenimiento desde version/current", () => {
    const snapshot: VersionDocSnapshot = {
      id: "current",
      exists: true,
      data: {
        maintenance: {
          global: {
            enabled: true,
            message: "Ventana corta",
          },
        },
      },
      version: "1",
      versionstorage: "1",
      notasDeSistemas: "",
      systemNotes: [],
    };

    expect(
      normalizeMaintenanceConfigFromVersionSnapshot(snapshot).global,
    ).toMatchObject({
      enabled: true,
      message: "Ventana corta",
    });
  });
});

describe("MaintenanceBoundary", () => {
  it("omite shell completo cuando usuario está bloqueado", () => {
    const html = renderToStaticMarkup(
      <MaintenanceBoundary
        user={regularUser}
        isAuthenticated
        config={enabledConfig}
        loading={false}
      >
        <div>APP_SHELL_SENTINEL</div>
      </MaintenanceBoundary>,
    );

    expect(html).not.toContain("APP_SHELL_SENTINEL");
    expect(html).toContain("Sistema en mantenimiento");
    expect(html).toContain("Actualización general");
  });

  it("renderiza shell completo para SuperAdmin", () => {
    const html = renderToStaticMarkup(
      <MaintenanceBoundary
        user={{ ...regularUser, role: "superadmin" }}
        isAuthenticated
        config={enabledConfig}
        loading={false}
      >
        <div>APP_SHELL_SENTINEL</div>
      </MaintenanceBoundary>,
    );

    expect(html).toContain("APP_SHELL_SENTINEL");
    expect(html).not.toContain("Sistema en mantenimiento");
  });
});
