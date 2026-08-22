// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EmpleadoDetailsModal from "@/components/ui/EmpleadoDetailsModal";
import type { Empleado } from "@/types/firestore";

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: vi.fn() }),
}));

const baseEmpleado: Empleado = {
  id: "empleado-1",
  empresaId: "empresa-1",
  Empleado: "Ana Gomez",
  pagoHoraBruta: 250000,
  diaContratacion: "2026-08-01",
  paganAguinaldo: "Si",
  ccssType: "TC",
  cantidadHorasTrabaja: 48,
  danReciboPago: "Si",
  contratoFisico: "Si",
  espacioComida: "Si",
  brindanVacaciones: "Si",
  incluidoCCSS: true,
  incluidoINS: true,
};

describe("EmpleadoDetailsModal", () => {
  afterEach(() => {
    cleanup();
  });

  it("shows TC MT and PH hours as weekly hours in the editor", () => {
    render(
      <EmpleadoDetailsModal
        isOpen
        onClose={() => undefined}
        empleado={baseEmpleado}
        onSave={() => undefined}
      />,
    );

    expect(
      screen.getByRole("option", { name: "Tiempo Completo (48 horas semanales)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Medio Tiempo (24 horas semanales)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "Pago por Hora (8 horas semanales)" }),
    ).toBeInTheDocument();
  });

  it("shows the selected read-only work-hours value as weekly hours", () => {
    render(
      <EmpleadoDetailsModal
        isOpen
        readOnly
        onClose={() => undefined}
        empleado={{ ...baseEmpleado, ccssType: "MT", cantidadHorasTrabaja: 24 }}
      />,
    );

    expect(
      screen.getByText("Medio Tiempo (24 horas semanales)"),
    ).toBeInTheDocument();
  });
});
