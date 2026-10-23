// @vitest-environment jsdom

import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const anotacionesMocks = vi.hoisted(() => ({
  user: {
    id: "user-1",
    name: "Ana",
    role: "user",
    ownerId: "owner-1",
    ownercompanie: "EMPRESA A",
    eliminate: true,
    permissions: { anotaciones: true },
  },
  ownerIds: ["owner-1"],
  showToast: vi.fn(),
  empresas: [
    {
      id: "empresa-a",
      ownerId: "owner-1",
      name: "EMPRESA A",
      ubicacion: "EMPRESA A",
    },
  ],
  getAllEmpresas: vi.fn(async () => [
    {
      id: "empresa-a",
      ownerId: "owner-1",
      name: "EMPRESA A",
      ubicacion: "EMPRESA A",
    },
  ]),
  listByEmpresa: vi.fn(async () => []),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: anotacionesMocks.user,
    firebaseAuthReady: false,
  }),
}));

vi.mock("@/hooks/useActorOwnership", () => ({
  useActorOwnership: () => ({
    ownerIds: anotacionesMocks.ownerIds,
    primaryOwnerId: "owner-1",
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: anotacionesMocks.showToast }),
}));

vi.mock("@/services/empresas", () => ({
  EmpresasService: { getAllEmpresas: anotacionesMocks.getAllEmpresas },
}));

vi.mock("@/services/anotaciones", () => ({
  AnotacionesService: {
    buildEmpresaDocId: (empresa: string) => empresa.replaceAll(" ", "_"),
    listByEmpresa: anotacionesMocks.listByEmpresa,
    create: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/components/anotaciones/anotacionesLayoutDb", () => ({
  getAnotacionesLayoutMap: vi.fn(async () => ({})),
  saveAnotacionLayout: vi.fn(async () => undefined),
  deleteAnotacionLayout: vi.fn(async () => undefined),
}));

import AnotacionesPage from "@/components/anotaciones/AnotacionesPage";

describe("autenticacion Firebase de Anotaciones", () => {
  afterEach(() => {
    cleanup();
    anotacionesMocks.getAllEmpresas.mockClear();
    anotacionesMocks.listByEmpresa.mockClear();
  });

  it("no consulta Firestore ni habilita crear antes de tener auth lista", async () => {
    render(<AnotacionesPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(anotacionesMocks.getAllEmpresas).not.toHaveBeenCalled();
    expect(anotacionesMocks.listByEmpresa).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Nueva nota" })).toHaveProperty(
      "disabled",
      true,
    );
  });
});
