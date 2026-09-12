// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const scanEntry = {
  id: "scan-1",
  code: "74410000000000000001",
  productName: "PRODUCTO CON UN NOMBRE MUY LARGO PARA UNA PANTALLA MOVIL",
  ownercompanie: "EMPRESA CON UN NOMBRE EXTENSO",
  timestamp: new Date("2026-09-12T08:30:00-06:00"),
  hasImages: false,
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      permissions: { scanhistory: true, scanhistoryEmpresas: [] },
    },
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: vi.fn() }),
}));

vi.mock("@/hooks/useScanHistory", () => ({
  useScanHistory: () => ({
    scanHistory: [scanEntry],
    loading: false,
    refreshHistory: vi.fn(),
    deleteScan: vi.fn(),
    deleteScans: vi.fn(),
    clearHistory: vi.fn(),
  }),
  useScanImages: () => ({
    codeImages: [],
    loadingImages: false,
    imageLoadError: null,
    loadImagesForCode: vi.fn(),
    clearImages: vi.fn(),
    codeBU: null,
  }),
}));

vi.mock("@/services/empresas", () => ({
  EmpresasService: { getAllEmpresas: vi.fn().mockResolvedValue([]) },
}));

import ScanHistoryTable from "@/components/scanner/ScanHistoryTable";

describe("responsividad del historial de escaneos", () => {
  afterEach(cleanup);

  it("mantiene textos largos dentro de la tarjeta en movil", () => {
    const { container } = render(<ScanHistoryTable />);

    const history = container.querySelector(".scan-history-mobile");
    expect(history?.className).toContain("min-w-0");
    expect(history?.className).toContain("overflow-x-hidden");

    const productButton = screen.getByRole("button", {
      name: scanEntry.productName,
    });
    expect(productButton.className).toContain("w-full");
    expect(productButton.className).toContain("sm:w-auto");

    const companyText = screen.getAllByText(scanEntry.ownercompanie)[0];
    expect(companyText.className).toContain("whitespace-normal");
    expect(companyText.parentElement?.className).toContain("min-w-0");
    expect(companyText.parentElement?.className).toContain("w-full");
  });

  it("limita el calendario al ancho disponible en movil", () => {
    const { container } = render(<ScanHistoryTable />);

    fireEvent.click(
      screen.getByRole("button", { name: "Seleccionar fecha desde" }),
    );

    const calendar = container.querySelector("[data-scan-calendar='from']");
    expect(calendar?.className).toContain("min-w-0");
    expect(calendar?.className).toContain("max-w-full");
    expect(calendar?.className).not.toContain("min-w-[280px]");
  });
});
