// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dbMocks = vi.hoisted(() => ({
  getState: vi.fn(),
  saveState: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    loading: false,
    user: {
      role: "user",
      ownercompanie: "Empresa sin XLSX",
    },
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/app/verificarInventario/verificarInventarioDb", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/app/verificarInventario/verificarInventarioDb")
  >();

  return {
    ...actual,
    getVerificarInventarioState: dbMocks.getState,
    saveVerificarInventarioState: dbMocks.saveState,
  };
});

vi.mock("@/app/verificarInventario/useBarcodeScanner", () => ({
  useBarcodeScanner: () => ({
    code: "",
    error: "",
    cameraActive: false,
    liveStreamRef: { current: null },
    toggleCamera: vi.fn(),
    handleClear: vi.fn(),
    handleCopyCode: vi.fn(),
    clearDetection: vi.fn(),
    detectionMethod: "",
  }),
}));

import VerificarInventarioPage from "@/app/verificarInventario/VerificarInventarioPage";

afterEach(cleanup);

beforeEach(() => {
  window.localStorage.clear();
  dbMocks.getState.mockReset();
  dbMocks.saveState.mockReset();
  dbMocks.getState.mockResolvedValue({
    empresas: [],
    selectedEmpresaId: null,
    relacionesPorEmpresa: {},
    pendientesPorEmpresa: {},
    inventariosPorEmpresa: {},
    listadosPorEmpresa: {},
  });
  dbMocks.saveState.mockResolvedValue(undefined);
});

describe("listar productos sin cargar codigos", () => {
  it("crea la empresa asignada y activa el listado sin requerir un XLSX", async () => {
    render(<VerificarInventarioPage />);

    const listButton = await screen.findByRole("button", {
      name: "Listar productos",
    });
    expect((listButton as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(listButton);

    await waitFor(() => expect(dbMocks.saveState).toHaveBeenCalledTimes(1));
    const savedState = dbMocks.saveState.mock.calls[0][0];
    expect(savedState.empresas).toHaveLength(1);
    expect(savedState.empresas[0].nombre).toBe("Empresa sin XLSX");
    expect(savedState.relacionesPorEmpresa[savedState.empresas[0].id]).toEqual([]);
    expect(screen.getByText("No hay códigos listados.")).toBeTruthy();
  });
});
