// @vitest-environment jsdom

import React, { type ComponentProps } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import AgregarMovimiento from "@/app/fondogeneral/components/AgregarMovimiento";

type FormProps = ComponentProps<typeof AgregarMovimiento>;

const baseProps: FormProps = {
  selectedProvider: "VENTAS",
  onProviderChange: vi.fn(),
  providers: [{ code: "VENTAS", name: "VENTAS", category: "Ingreso" }],
  providersLoading: false,
  isProviderSelectDisabled: false,
  selectedProviderExists: true,
  invoiceNumber: "1111",
  onInvoiceNumberChange: vi.fn(),
  invoiceDocType: "FCO",
  onInvoiceDocTypeChange: vi.fn(),
  invoiceValid: true,
  invoiceDisabled: false,
  paymentType: "VENTAS",
  isEgreso: false,
  isIngreso: true,
  egreso: "",
  onEgresoChange: vi.fn(),
  egresoBorderClass: "",
  ingreso: "11925",
  onIngresoChange: vi.fn(),
  ingresoBorderClass: "",
  notes: "",
  onNotesChange: vi.fn(),
  manager: "ALICIA",
  onManagerChange: vi.fn(),
  managerSelectDisabled: false,
  employeeOptions: ["ALICIA"],
  employeesLoading: false,
  editingEntryId: null,
  onCancelEditing: vi.fn(),
  onSubmit: vi.fn(),
  isSubmitDisabled: false,
  onFieldKeyDown: vi.fn(),
  currency: "CRC",
  accountKey: "FondoGeneral",
};

describe("diferencia de caja en Agregar movimiento", () => {
  afterEach(cleanup);

  it("muestra el neto firmado de los redondeos debajo del total", () => {
    render(
      <AgregarMovimiento
        {...baseProps}
        extraInvoices={[
          {
            invoiceNumber: "2222",
            amount: "4450",
            observation: "",
            creditNotes: [],
            roundUpToThousand: false,
          },
        ]}
        onExtraInvoicesChange={vi.fn()}
        roundUpToThousand
        onRoundUpToThousandChange={vi.fn()}
        roundUpMainInvoicePayment
        onRoundUpMainInvoicePaymentChange={vi.fn()}
      />,
    );

    const label = screen.getByText("Diferencia de caja");
    const value = label.parentElement?.querySelector("span:last-child");
    expect(value?.textContent?.replace(/\s/g, "")).toBe("-₡375");
  });
});
