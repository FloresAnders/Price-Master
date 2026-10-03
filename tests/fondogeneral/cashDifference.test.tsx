// @vitest-environment jsdom

import React, { type ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

  it("permite redondear como uno solo el total de varias facturas", () => {
    const Example = () => {
      const [roundTotal, setRoundTotal] = React.useState(false);
      return (
        <AgregarMovimiento
          {...baseProps}
          ingreso="3139.34"
          extraInvoices={[
            {
              invoiceNumber: "2222",
              amount: "46963.89",
              observation: "",
              creditNotes: [],
              roundUpToThousand: true,
            },
            {
              invoiceNumber: "3333",
              amount: "85545.14",
              observation: "",
              creditNotes: [],
              roundUpToThousand: true,
            },
          ]}
          onExtraInvoicesChange={vi.fn()}
          roundUpToThousand
          onRoundUpToThousandChange={vi.fn()}
          roundUpMainInvoicePayment
          onRoundUpMainInvoicePaymentChange={vi.fn()}
          roundUpTotalToThousand={roundTotal}
          onRoundUpTotalToThousandChange={setRoundTotal}
        />
      );
    };

    render(<Example />);

    expect(screen.getByText("₡ 135 000")).toBeTruthy();
    expect(
      screen
        .getByText("Diferencia de caja")
        .parentElement?.textContent?.replace(/\s/g, ""),
    ).toContain("-₡648,37");

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Redondear el total hacia arriba",
      }),
    );

    expect(screen.getByText("₡ 136 000")).toBeTruthy();
    expect(
      screen
        .getByText("Diferencia de caja")
        .parentElement?.textContent?.replace(/\s/g, ""),
    ).toContain("+₡351,63");
  });
});
