import { describe, expect, it } from "vitest";

import {
  hasActiveMaintenance,
  normalizeMaintenanceConfig,
  type MaintenanceConfig,
} from "@/lib/maintenance/config";

const inactiveConfig = (): MaintenanceConfig => ({
  global: {
    enabled: false,
    message: "Sin mantenimiento",
  },
  companies: {},
  activeCompanyIdentifiers: [],
});

describe("hasActiveMaintenance", () => {
  it("detecta mantenimiento global activo", () => {
    const config = inactiveConfig();
    config.global.enabled = true;

    expect(hasActiveMaintenance(config)).toBe(true);
  });

  it("detecta una empresa activa aunque el indice derivado este vacio", () => {
    const config = inactiveConfig();
    config.companies["company-1"] = {
      enabled: true,
      message: "Mantenimiento de empresa",
      companyId: "company-1",
    };

    expect(config.activeCompanyIdentifiers).toEqual([]);
    expect(hasActiveMaintenance(config)).toBe(true);
  });

  it("devuelve false cuando todos los targets estan desactivados", () => {
    const config = inactiveConfig();
    config.companies["company-1"] = {
      enabled: false,
      message: "Mantenimiento de empresa",
      companyId: "company-1",
    };

    expect(hasActiveMaintenance(config)).toBe(false);
  });

  it("devuelve false para una configuracion ausente normalizada", () => {
    expect(hasActiveMaintenance(normalizeMaintenanceConfig(null))).toBe(false);
  });
});
