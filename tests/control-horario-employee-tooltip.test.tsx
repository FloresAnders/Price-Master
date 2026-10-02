// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ccssConfigService = vi.hoisted(() => ({
  getAllCcssConfigsByOwner: vi.fn(),
}));

vi.mock("@/services/ccss-config", () => ({
  CcssConfigService: ccssConfigService,
}));

import EmployeeTooltipSummary from "@/components/business/control-horario/components/EmployeeTooltipSummary";

describe("tooltip de colaborador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ccssConfigService.getAllCcssConfigsByOwner.mockReset();
    ccssConfigService.getAllCcssConfigsByOwner.mockResolvedValue([
      {
        companie: [
          { ownerCompanie: "OTRA", valorhora: 2500, pagoTotalPH: 0 },
        ],
      },
    ]);
  });

  afterEach(() => cleanup());

  it("muestra solo días y horas para DELIFOOD", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    ccssConfigService.getAllCcssConfigsByOwner.mockRejectedValueOnce(
      new Error("config unavailable"),
    );

    render(
      <EmployeeTooltipSummary
        employeeName="Ana"
        empresaValue="DELIFOOD"
        empresaLabel="Delifood"
        shiftsByDay={{ "1": "D", "2": "N" }}
        year={2026}
        month={9}
        daysToShow={[1, 2]}
        usesConfiguredShiftHours
        configuredShiftHours={{ dayHours: 7, nightHours: 9 }}
        delifoodHoursData={{
          Ana: { "1": { hours: 7 }, "2": { hours: 8.5 } },
        }}
      />,
    );

    expect(await screen.findByText("Dias con horas:")).toBeTruthy();
    expect(screen.getByText("15.5")).toBeTruthy();
    expect(screen.queryByText("Salario:")).toBeNull();
  });

  it("mantiene el salario para las demás empresas", async () => {
    render(
      <EmployeeTooltipSummary
        employeeName="Ana"
        empresaValue="OTRA"
        empresaLabel="Otra"
        empresaOwnerId="owner-1"
        employeeConfig={{
          name: "Ana",
          ccssType: "TC",
          hoursPerShift: 8,
          extraAmount: 0,
        }}
        shiftsByDay={{ "1": "D" }}
        year={2026}
        month={9}
        daysToShow={[1]}
      />,
    );

    const salaryLabel = await screen.findByText("Salario:");
    expect(salaryLabel.parentElement?.textContent?.replace(/\s/g, " ")).toBe(
      "Salario: ₡20 000,00",
    );
  });
});
