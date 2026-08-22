// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EmpleadosProximamente from "@/components/business/EmpleadosProximamente";

const { getAllEmpresas, getByEmpresaId } = vi.hoisted(() => ({
  getAllEmpresas: vi.fn(),
  getByEmpresaId: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "owner-1",
      role: "superadmin",
      permissions: { empleados: true },
    },
  }),
}));

vi.mock("@/hooks/useActorOwnership", () => ({
  useActorOwnership: () => ({ ownerIds: ["owner-1"] }),
}));

vi.mock("@/services/empresas", () => ({
  EmpresasService: {
    getAllEmpresas,
    getEmpresaById: vi.fn(),
    updateEmpresa: vi.fn(),
  },
}));

vi.mock("@/services/empleados", () => ({
  EmpleadosService: {
    getByEmpresaId,
    updateEmpleado: vi.fn(),
    upsertEmpleadoByEmpresaAndName: vi.fn(),
    deleteEmpleado: vi.fn(),
    clearCache: vi.fn(),
  },
}));

vi.mock("@/services/ccss-config", () => ({
  CcssConfigService: {
    getAllCcssConfigsByOwner: vi.fn(),
  },
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: vi.fn() }),
}));

describe("EmpleadosProximamente", () => {
  beforeEach(() => {
    getAllEmpresas.mockResolvedValue([
      {
        id: "empresa-1",
        name: "Empresa Uno",
        ubicacion: "Centro",
        ownerId: "owner-1",
        empleados: [
          {
            Empleado: "Ana Gomez",
            hoursPerShift: 48,
            ccssType: "TC",
          },
        ],
      },
    ]);
    getByEmpresaId.mockResolvedValue([
      {
        id: "empleado-1",
        empresaId: "empresa-1",
        Empleado: "Ana Gomez",
        ccssType: "TC",
        cantidadHorasTrabaja: 48,
      },
    ]);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("shows collaborator card hours as weekly hours", async () => {
    render(<EmpleadosProximamente />);

    await waitFor(() => {
      expect(screen.getByText(/Horas semanales: 48/)).toBeInTheDocument();
    });
  });
});
