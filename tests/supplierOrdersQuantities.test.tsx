// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => ({
  fetchOrdersForCompany: vi.fn(),
  saveOrder: vi.fn(),
  showToast: vi.fn(),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: {
      id: "user-1",
      name: "Ana",
      role: "user",
      ownercompanie: "Empresa A",
      permissions: { supplierorders: true },
    },
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  default: () => ({ showToast: dependencies.showToast }),
}));

vi.mock("@/hooks/useProviders", () => ({
  useProviders: () => ({
    providers: [
      {
        code: "PROV-1",
        name: "Proveedor Uno",
        type: "COMPRA INVENTARIO",
        company: "Empresa A",
      },
    ],
  }),
}));

vi.mock("@/services/empresas", () => ({
  EmpresasService: { getAllEmpresas: vi.fn() },
}));

vi.mock("@/services/supplier-orders", () => ({
  SupplierOrdersService: {
    fetchOrdersForCompany: dependencies.fetchOrdersForCompany,
    saveOrder: dependencies.saveOrder,
    removeOrder: vi.fn(),
  },
}));

import SupplierOrders from "@/components/business/SupplierOrders";

describe("cantidades de las líneas de órdenes de proveedor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.fetchOrdersForCompany.mockResolvedValue([]);
    dependencies.saveOrder.mockResolvedValue("empresa-a-proveedor-uno");
  });

  afterEach(cleanup);

  it("permite cambiar la cantidad de una línea al crear una orden", async () => {
    render(<SupplierOrders />);

    await waitFor(() =>
      expect(dependencies.fetchOrdersForCompany).toHaveBeenCalledWith("Empresa A"),
    );

    fireEvent.change(screen.getByPlaceholderText("Buscar proveedor"), {
      target: { value: "Proveedor Uno" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del producto"), {
      target: { value: "Arroz" },
    });
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    const lineQuantity = screen.getByRole("spinbutton", {
      name: "Cantidad del producto, línea 1",
    });
    expect((lineQuantity as HTMLInputElement).value).toBe("1");
    fireEvent.change(lineQuantity, { target: { value: "5" } });
    expect((lineQuantity as HTMLInputElement).value).toBe("5");

    fireEvent.click(screen.getByRole("button", { name: "Guardar Orden" }));

    await waitFor(() => expect(dependencies.saveOrder).toHaveBeenCalledOnce());
    expect(dependencies.saveOrder.mock.calls[0][0].order.products).toEqual([
      expect.objectContaining({ name: "Arroz", quantity: 5 }),
    ]);
  });

  it("permite cambiar la cantidad de una línea al editar una orden", async () => {
    dependencies.fetchOrdersForCompany.mockResolvedValue([
      {
        id: "empresa-a-proveedor-uno",
        companyName: "Empresa A",
        supplierName: "Proveedor Uno",
        orders: [
          {
            id: "orden-1",
            supplierName: "Proveedor Uno",
            companyName: "Empresa A",
            orderDate: "2026-09-16",
            products: [{ id: "producto-1", name: "Frijoles", quantity: 0 }],
          },
        ],
      },
    ]);

    render(<SupplierOrders />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Órdenes Guardadas/ }),
    );
    fireEvent.click(await screen.findByTitle("Editar orden"));

    const lineQuantity = screen.getByRole("spinbutton", {
      name: "Cantidad del producto, línea 1",
    });
    expect((lineQuantity as HTMLInputElement).value).toBe("1");
    fireEvent.change(lineQuantity, { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Orden" }));

    await waitFor(() => expect(dependencies.saveOrder).toHaveBeenCalledOnce());
    expect(dependencies.saveOrder.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        previousDocumentId: "empresa-a-proveedor-uno",
        order: expect.objectContaining({
          id: "orden-1",
          products: [
            expect.objectContaining({ name: "Frijoles", quantity: 7 }),
          ],
        }),
      }),
    );
  });
});

describe("nombres de las líneas de órdenes de proveedor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dependencies.fetchOrdersForCompany.mockResolvedValue([]);
    dependencies.saveOrder.mockResolvedValue("empresa-a-proveedor-uno");
  });

  afterEach(cleanup);

  it("permite cambiar el nombre de una línea al crear una orden", async () => {
    render(<SupplierOrders />);

    await waitFor(() =>
      expect(dependencies.fetchOrdersForCompany).toHaveBeenCalledWith("Empresa A"),
    );
    fireEvent.change(screen.getByPlaceholderText("Buscar proveedor"), {
      target: { value: "Proveedor Uno" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del producto"), {
      target: { value: "Arroz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));

    fireEvent.change(
      screen.getByRole("textbox", { name: "Nombre del producto, línea 1" }),
      { target: { value: "  Arroz integral  " } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar Orden" }));

    await waitFor(() => expect(dependencies.saveOrder).toHaveBeenCalledOnce());
    expect(dependencies.saveOrder.mock.calls[0][0].order.products).toEqual([
      expect.objectContaining({ name: "Arroz integral", quantity: 1 }),
    ]);
  });

  it("permite cambiar el nombre de una línea al editar una orden", async () => {
    dependencies.fetchOrdersForCompany.mockResolvedValue([
      {
        id: "empresa-a-proveedor-uno",
        companyName: "Empresa A",
        supplierName: "Proveedor Uno",
        orders: [
          {
            id: "orden-1",
            supplierName: "Proveedor Uno",
            companyName: "Empresa A",
            orderDate: "2026-09-16",
            products: [{ id: "producto-1", name: "Frijoles", quantity: 2 }],
          },
        ],
      },
    ]);

    render(<SupplierOrders />);

    fireEvent.click(
      await screen.findByRole("button", { name: /Órdenes Guardadas/ }),
    );
    fireEvent.click(await screen.findByTitle("Editar orden"));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Nombre del producto, línea 1" }),
      { target: { value: "Frijoles rojos" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Actualizar Orden" }));

    await waitFor(() => expect(dependencies.saveOrder).toHaveBeenCalledOnce());
    expect(dependencies.saveOrder.mock.calls[0][0].order.products).toEqual([
      expect.objectContaining({ name: "Frijoles rojos", quantity: 2 }),
    ]);
  });

  it("impide guardar una orden con el nombre de una línea vacío", async () => {
    render(<SupplierOrders />);

    await waitFor(() =>
      expect(dependencies.fetchOrdersForCompany).toHaveBeenCalledWith("Empresa A"),
    );
    fireEvent.change(screen.getByPlaceholderText("Buscar proveedor"), {
      target: { value: "Proveedor Uno" },
    });
    fireEvent.change(screen.getByPlaceholderText("Nombre del producto"), {
      target: { value: "Arroz" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Agregar" }));
    fireEvent.change(
      screen.getByRole("textbox", { name: "Nombre del producto, línea 1" }),
      { target: { value: "   " } },
    );

    const saveButton = screen.getByRole("button", { name: "Guardar Orden" });
    expect((saveButton as HTMLButtonElement).disabled).toBe(true);
    expect(dependencies.saveOrder).not.toHaveBeenCalled();
  });
});
