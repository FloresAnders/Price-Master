// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { VerificarInventarioState } from "@/app/verificarInventario/verificarInventarioDb";

const dependencies = vi.hoisted(() => ({
  addScan: vi.fn(),
  getState: vi.fn(),
  saveState: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Ana",
      role: "admin",
      ownercompanie: "Otra empresa",
    },
    loading: false,
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: dependencies.showToast }),
}));

vi.mock("@/services/scanning", () => ({
  ScanningService: { addScan: dependencies.addScan },
}));

vi.mock("@/app/verificarInventario/verificarInventarioDb", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/app/verificarInventario/verificarInventarioDb")>();
  return {
    ...actual,
    getVerificarInventarioState: dependencies.getState,
    saveVerificarInventarioState: dependencies.saveState,
  };
});

vi.mock("@/app/verificarInventario/useBarcodeScanner", () => ({
  useBarcodeScanner: () => ({
    code: "",
    error: null,
    cameraActive: false,
    liveStreamRef: { current: null },
    toggleCamera: vi.fn(),
    handleClear: vi.fn(),
    handleCopyCode: vi.fn(),
    clearDetection: vi.fn(),
    detectionMethod: null,
  }),
}));

vi.mock("@/app/verificarInventario/AddEmpresaModal", () => ({ default: () => null }));
vi.mock("@/app/verificarInventario/DeleteEmpresaModal", () => ({ default: () => null }));
vi.mock("@/app/verificarInventario/ScannerModal", () => ({ default: () => null }));

import VerificarInventarioPage from "@/app/verificarInventario/VerificarInventarioPage";

const initialState: VerificarInventarioState = {
  empresas: [{ id: "empresa-1", nombre: "Sucursal Central", createdAt: 1 }],
  selectedEmpresaId: "empresa-1",
  relacionesPorEmpresa: { "empresa-1": [] },
  pendientesPorEmpresa: {
    "empresa-1": [
      {
        codigoBarras: "744100000001",
        nombre: "Arroz",
        createdAt: 2,
        empresaId: "empresa-1",
      },
      {
        codigoBarras: "744100000002",
        nombre: "Frijoles",
        createdAt: 3,
        empresaId: "empresa-1",
      },
    ],
  },
  inventariosPorEmpresa: { "empresa-1": [] },
  listadosPorEmpresa: { "empresa-1": [] },
};

describe("enviar pendientes al historial de escaneos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.getState.mockResolvedValue(structuredClone(initialState));
    dependencies.saveState.mockResolvedValue(undefined);
    dependencies.addScan.mockResolvedValue("scan-id");
  });

  afterEach(cleanup);

  it("envia código y nombre de cada pendiente y los elimina después del éxito", async () => {
    render(<VerificarInventarioPage />);

    expect(await screen.findByText("Arroz")).toBeTruthy();
    const sendButton = screen.getByRole("button", { name: "Enviar" });
    expect(sendButton.className).toContain("hidden");
    expect(sendButton.className).toContain("lg:inline-flex");

    fireEvent.click(sendButton);

    await waitFor(() => expect(screen.queryByText("Arroz")).toBeNull());
    expect(dependencies.addScan).toHaveBeenNthCalledWith(1, {
      code: "744100000001",
      productName: "Arroz",
      ownercompanie: "Sucursal Central",
      source: "web",
      userId: "user-1",
      userName: "Ana",
      processed: false,
    });
    expect(dependencies.addScan).toHaveBeenNthCalledWith(2, {
      code: "744100000002",
      productName: "Frijoles",
      ownercompanie: "Sucursal Central",
      source: "web",
      userId: "user-1",
      userName: "Ana",
      processed: false,
    });
    expect(dependencies.saveState).toHaveBeenCalledWith({
      ...initialState,
      pendientesPorEmpresa: { "empresa-1": [] },
    });
    expect(screen.getByText("2 pendientes enviados al historial.")).toBeTruthy();
  });

  it("conserva todos los pendientes cuando falla un envío", async () => {
    dependencies.addScan.mockRejectedValueOnce(new Error("sin conexión"));

    render(<VerificarInventarioPage />);

    fireEvent.click(await screen.findByRole("button", { name: "Enviar" }));

    expect(
      await screen.findByText("No se pudieron enviar los pendientes al historial."),
    ).toBeTruthy();
    expect(screen.getByText("Arroz")).toBeTruthy();
    expect(screen.getByText("Frijoles")).toBeTruthy();
    expect(dependencies.saveState).not.toHaveBeenCalled();
  });
});
