// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import VerificarInventarioPage from "@/app/verificarInventario/page";

const {
  authState,
  getState,
  readWorkbook,
  saveState,
  scannerApi,
  sheetToJson,
  showToast,
} = vi.hoisted(
  () => ({
    authState: { role: "user" as "admin" | "user" | "superadmin" },
    getState: vi.fn(),
    readWorkbook: vi.fn(),
    saveState: vi.fn(),
    sheetToJson: vi.fn(),
    showToast: vi.fn(),
    scannerApi: {
      code: null,
      error: null,
      cameraActive: false,
      liveStreamRef: { current: null },
      toggleCamera: vi.fn(),
      handleClear: vi.fn(),
      handleCopyCode: vi.fn(),
      clearDetection: vi.fn(),
      detectionMethod: null,
    },
  }),
);

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "user-1", name: "Usuario", role: authState.role },
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast }),
}));

vi.mock("@/app/verificarInventario/useBarcodeScanner", () => ({
  useBarcodeScanner: () => scannerApi,
}));

vi.mock("@/app/verificarInventario/verificarInventarioDb", () => ({
  getVerificarInventarioState: getState,
  saveVerificarInventarioState: saveState,
}));

vi.mock("xlsx", () => ({
  read: readWorkbook,
  utils: { sheet_to_json: sheetToJson },
}));

function loadedXlsxState() {
  return {
    empresas: [{ id: "palmares", nombre: "palmares", createdAt: 1 }],
    selectedEmpresaId: "palmares",
    relacionesPorEmpresa: {
      palmares: [
        {
          codigo: "PROD-15",
          codigoBarras: "750100",
          descripcion: "Arroz integral",
          precioVenta: "1850",
        },
      ],
    },
    pendientesPorEmpresa: { palmares: [] },
    inventariosPorEmpresa: { palmares: [] },
    listadosPorEmpresa: { palmares: [] },
  };
}

describe("búsqueda XLSX de escritorio para user", () => {
  beforeEach(() => {
    authState.role = "user";
    getState.mockResolvedValue(loadedXlsxState());
    saveState.mockResolvedValue(undefined);
    readWorkbook.mockReturnValue({
      SheetNames: ["Productos"],
      Sheets: { Productos: {} },
    });
    sheetToJson.mockReturnValue([
      ["Código", "Descripción", "Código de barras", "Precio de Venta"],
      ["PROD-20", "Frijoles", "760200", "2200"],
    ]);
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("enfoca el input y muestra durante cinco segundos el resultado buscado con Enter", async () => {
    render(<VerificarInventarioPage />);

    const input = await screen.findByRole("textbox", {
      name: "Buscar código en XLSX",
    });
    const searchRegion = screen.getByRole("region", {
      name: "Búsqueda manual en XLSX",
    });

    expect(searchRegion).toHaveClass("hidden", "lg:block");
    expect(input).toHaveFocus();

    vi.useFakeTimers();
    fireEvent.change(input, { target: { value: "750100" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("Código encontrado")).toBeInTheDocument();
    expect(screen.getByText("Arroz integral")).toBeInTheDocument();
    expect(screen.getByText("Precio de venta: 1850")).toBeInTheDocument();
    expect(input).toHaveFocus();

    act(() => vi.advanceTimersByTime(4_999));
    expect(screen.getByText("Arroz integral")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText("Arroz integral")).not.toBeInTheDocument();
    expect(input).toHaveFocus();
  });

  it("abre Pendientes para un código inexistente y devuelve el foco al cancelar", async () => {
    render(<VerificarInventarioPage />);

    const lookupInput = await screen.findByRole("textbox", {
      name: "Buscar código en XLSX",
    });
    fireEvent.change(lookupInput, { target: { value: "NO-EXISTE" } });
    fireEvent.keyDown(lookupInput, { key: "Enter" });

    expect(
      screen.getByRole("heading", { name: "Guardar en pendientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("NO-EXISTE")).toBeInTheDocument();

    const pendingNameInput = screen.getByRole("textbox", {
      name: "Nombre del producto",
    });
    expect(pendingNameInput).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(
      screen.queryByRole("heading", { name: "Guardar en pendientes" }),
    ).not.toBeInTheDocument();
    expect(lookupInput).toHaveFocus();
  });

  it.each(["admin", "superadmin"] as const)(
    "no muestra la búsqueda XLSX para %s",
    async (role) => {
      authState.role = role;
      render(<VerificarInventarioPage />);

      await screen.findByText("Base para verificar escaneos.");

      expect(
        screen.queryByRole("textbox", { name: "Buscar código en XLSX" }),
      ).not.toBeInTheDocument();
    },
  );

  it("recupera el foco después de reemplazar el XLSX cargado", async () => {
    const { container } = render(<VerificarInventarioPage />);
    const lookupInput = await screen.findByRole("textbox", {
      name: "Buscar código en XLSX",
    });
    const uploadButton = screen.getByRole("button", { name: "Cargar .xlsx" });
    const fileInput = container.querySelector<HTMLInputElement>(
      'input[type="file"]',
    );

    expect(fileInput).not.toBeNull();
    uploadButton.focus();
    expect(uploadButton).toHaveFocus();

    const file = {
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    } as unknown as File;
    fireEvent.change(fileInput!, { target: { files: [file] } });

    await screen.findByText(/Última importación: 1 relaciones/);
    await waitFor(() => expect(lookupInput).toHaveFocus());
  });
});
