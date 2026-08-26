// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import VerificarInventarioHeader from "@/app/verificarInventario/VerificarInventarioHeader";
import type { User } from "@/types/firestore";

function renderHeader(
  userRole: User["role"],
  hideManagementControls = false,
) {
  render(
    <VerificarInventarioHeader
      empresas={[{ id: "palmares", nombre: "palmares", createdAt: 1 }]}
      selectedEmpresaId="palmares"
      inventoryMode={false}
      listProductsMode={false}
      onOpenAddModal={vi.fn()}
      onOpenScanner={vi.fn()}
      onToggleInventoryMode={vi.fn()}
      onToggleListProductsMode={vi.fn()}
      onSelectEmpresa={vi.fn()}
      onOpenDeleteModal={vi.fn()}
      onUploadXlsx={vi.fn()}
      disableUpload={false}
      disableScanner={false}
      hideManagementControls={hideManagementControls}
      userRole={userRole}
    />,
  );
}

describe("VerificarInventarioHeader por rol y resolución", () => {
  afterEach(() => cleanup());

  it("deja solo la carga XLSX en escritorio y oculta la gestión de empresas para user", () => {
    renderHeader("user");

    expect(
      screen.queryByRole("button", { name: "Agregar empresa" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Eliminar empresa" }),
    ).not.toBeInTheDocument();

    const uploadButton = screen.getByRole("button", { name: "Cargar .xlsx" });
    expect(uploadButton).toBeInTheDocument();
    expect(uploadButton).not.toHaveClass("lg:hidden");

    const titleGroup = screen.getByRole("heading", {
      name: "Verificar Inventario",
    }).parentElement;
    const scannerButton = screen.getByRole("button", { name: "Abrir escáner" });
    const stepsGroup = screen.getByText("1. Empresa").parentElement;
    const modesGroup = screen.getByRole("button", {
      name: "Inventariar",
    }).parentElement;

    expect(titleGroup).toHaveClass("lg:hidden");
    expect(scannerButton).toHaveClass("lg:hidden");
    expect(stepsGroup).toHaveClass("lg:hidden");
    expect(modesGroup).toHaveClass("lg:hidden");
  });

  it("mantiene la carga XLSX para user aunque se oculten los controles de gestión", () => {
    renderHeader("user", true);

    expect(
      screen.getByRole("button", { name: "Cargar .xlsx" }),
    ).toBeInTheDocument();
  });

  it("aplica la vista restringida cuando el rol está ausente", () => {
    renderHeader(undefined);

    expect(
      screen.queryByRole("button", { name: "Agregar empresa" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Abrir escáner" }),
    ).toHaveClass("lg:hidden");
    expect(
      screen.getByRole("button", { name: "Cargar .xlsx" }),
    ).toBeInTheDocument();
  });

  it("conserva el encabezado y la gestión de empresas para admin", () => {
    renderHeader("admin");

    expect(
      screen.getByRole("button", { name: "Agregar empresa" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Eliminar empresa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Verificar Inventario" }).parentElement,
    ).not.toHaveClass("lg:hidden");
    expect(
      screen.getByRole("button", { name: "Abrir escáner" }),
    ).not.toHaveClass("lg:hidden");
  });
});
