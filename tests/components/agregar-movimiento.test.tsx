// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgregarMovimiento from "@/app/fondogeneral/components/AgregarMovimiento";

describe("AgregarMovimiento", () => {
  afterEach(() => cleanup());

  it("muestra el monto CRC sin espacio tras el símbolo y con espacios entre millares", () => {
    render(
      <AgregarMovimiento
        selectedProvider=""
        onProviderChange={vi.fn()}
        providers={[]}
        providersLoading={false}
        isProviderSelectDisabled={false}
        selectedProviderExists={false}
        invoiceNumber=""
        onInvoiceNumberChange={vi.fn()}
        invoiceDocType="FCO"
        onInvoiceDocTypeChange={vi.fn()}
        invoiceValid
        invoiceDisabled={false}
        paymentType="EGRESO"
        isEgreso
        egreso="1000"
        onEgresoChange={vi.fn()}
        egresoBorderClass=""
        ingreso=""
        onIngresoChange={vi.fn()}
        ingresoBorderClass=""
        notes=""
        onNotesChange={vi.fn()}
        manager=""
        onManagerChange={vi.fn()}
        managerSelectDisabled={false}
        employeeOptions={[]}
        employeesLoading={false}
        editingEntryId={null}
        onCancelEditing={vi.fn()}
        onSubmit={vi.fn()}
        isSubmitDisabled={false}
        onFieldKeyDown={vi.fn()}
      />,
    );

    expect(screen.getByPlaceholderText("0")).toHaveValue("₡1 000");
  });
});
