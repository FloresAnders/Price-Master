// @vitest-environment jsdom

import React, { type ComponentProps, useState } from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AgregarMovimiento from "@/app/fondogeneral/components/AgregarMovimiento";
import { MovementDrawer } from "@/app/fondogeneral/components/drawers/MovementDrawer";
import type { ExtraInvoice } from "@/app/fondogeneral/hooks/movements/useMovementForm";

type Props = ComponentProps<typeof AgregarMovimiento>;

const baseProps: Props = {
  selectedProvider: "DOS_PINOS",
  onProviderChange: vi.fn(),
  providers: [{ code: "DOS_PINOS", name: "DOS PINOS" }],
  providersLoading: false,
  isProviderSelectDisabled: false,
  selectedProviderExists: true,
  invoiceNumber: "1111",
  onInvoiceNumberChange: vi.fn(),
  invoiceDocType: "FCO",
  onInvoiceDocTypeChange: vi.fn(),
  invoiceValid: true,
  invoiceDisabled: false,
  paymentType: "Compra Inventario",
  isEgreso: true,
  egreso: "11220",
  onEgresoChange: vi.fn(),
  egresoBorderClass: "",
  ingreso: "",
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

const digits = (value: string | null | undefined) =>
  String(value ?? "").replace(/\D/g, "");

const renderedRoundingAmounts = () =>
  screen.getAllByText("Redondeo Aplicado").map((label) =>
    digits(label.parentElement?.querySelector("span:last-child")?.textContent),
  );

const renderedTotal = () =>
  digits(
    screen
      .getByText("Total a guardar")
      .parentElement?.querySelector("span:last-child")?.textContent,
  );

describe("redondeo de varias facturas FCO", () => {
  afterEach(cleanup);

  it("coloca el boton para agregar factura en la misma fila de Factura #1", () => {
    render(<AgregarMovimiento {...baseProps} extraInvoices={[]} />);

    const firstInvoiceInput = screen.getByDisplayValue("1111");
    const firstInvoiceRow = firstInvoiceInput.parentElement;

    expect(firstInvoiceRow).not.toBeNull();
    expect(
      firstInvoiceRow?.querySelector('button[aria-label="Agregar factura"]'),
    ).not.toBeNull();
  });

  it("redondea y muestra el ajuste de cada factura sin notas de credito", () => {
    render(
      <AgregarMovimiento
        {...baseProps}
        extraInvoices={[
          {
            invoiceNumber: "2222",
            amount: "22330",
            observation: "",
            creditNotes: [],
          },
          {
            invoiceNumber: "3333",
            amount: "33440",
            observation: "",
            creditNotes: [],
          },
        ]}
      />,
    );

    expect(renderedRoundingAmounts()).toEqual(["220", "330", "440"]);
    expect(renderedTotal()).toBe("66000");
  });

  it("resta cada NC antes de redondear su factura", () => {
    render(
      <AgregarMovimiento
        {...baseProps}
        creditNotesAppliedTotal={500}
        extraInvoices={[
          {
            invoiceNumber: "2222",
            amount: "22330",
            observation: "",
            creditNotes: [
              { id: "nc-2", invoiceNumber: "652", amount: 550 },
            ],
          },
          {
            invoiceNumber: "3333",
            amount: "33440",
            observation: "",
            creditNotes: [
              { id: "nc-3", invoiceNumber: "6666", amount: 756 },
            ],
          },
        ]}
      />,
    );

    expect(renderedRoundingAmounts()).toEqual(["720", "780", "684"]);
    expect(renderedTotal()).toBe("63000");
  });

  it("solo redondea hacia arriba las facturas elegibles", () => {
    render(
      <AgregarMovimiento
        {...baseProps}
        egreso="7499"
        roundUpToThousand
        onRoundUpToThousandChange={vi.fn()}
        extraInvoices={[
          {
            invoiceNumber: "2222",
            amount: "8525",
            observation: "",
            creditNotes: [],
          },
        ]}
      />,
    );

    expect(renderedTotal()).toBe("16000");
    expect(
      screen.getByRole("columnheader", { name: "Redondear hacia arriba" }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("checkbox", {
        name: "Redondear hacia arriba factura #1",
      }),
    ).toBeNull();
    expect(
      (
        screen.getByRole("checkbox", {
          name: "Redondear hacia arriba factura #2",
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it("muestra factura, monto y redondeo en tres columnas", () => {
    render(
      <AgregarMovimiento
        {...baseProps}
        egreso="7499"
        roundUpToThousand
        onRoundUpToThousandChange={vi.fn()}
        extraInvoices={[
          {
            invoiceNumber: "2222",
            amount: "8525",
            observation: "",
            creditNotes: [],
          },
          {
            invoiceNumber: "3333",
            amount: "9999",
            observation: "",
            creditNotes: [],
          },
        ]}
      />,
    );

    expect(
      screen.getAllByRole("columnheader").map((header) => header.textContent),
    ).toEqual(["Facturas", "Resumen de facturas", "Redondeo"]);

    const secondInvoiceRow = within(screen.getByRole("table"))
      .getByText("Factura #2")
      .closest('[role="row"]');
    expect(secondInvoiceRow).not.toBeNull();
    expect(secondInvoiceRow?.querySelectorAll('[role="cell"]')).toHaveLength(3);
    expect(
      secondInvoiceRow?.querySelector(
        'input[aria-label="Redondear hacia arriba factura #2"]',
      ),
    ).not.toBeNull();
  });

  it("permite desmarcar individualmente una factura elegible", () => {
    const ControlledRounding = () => {
      const [extraInvoices, setExtraInvoices] = useState<ExtraInvoice[]>([
        {
          invoiceNumber: "2222",
          amount: "8525",
          observation: "",
          creditNotes: [],
        },
      ]);
      return (
        <AgregarMovimiento
          {...baseProps}
          egreso="7499"
          roundUpToThousand
          onRoundUpToThousandChange={vi.fn()}
          extraInvoices={extraInvoices}
          onExtraInvoicesChange={setExtraInvoices}
        />
      );
    };
    render(<ControlledRounding />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Redondear hacia arriba factura #2",
      }),
    );

    expect(renderedTotal()).toBe("15000");
  });

  it("respeta el redondeo individual al confirmar el guardado", async () => {
    const onSubmit = vi.fn();
    const ControlledConfirmation = () => {
      const [roundUpToThousand, setRoundUpToThousand] = useState(true);
      const [extraInvoices, setExtraInvoices] = useState<ExtraInvoice[]>([
        {
          invoiceNumber: "13",
          amount: "8525",
          observation: "prueba unitaria",
          creditNotes: [],
          roundUpToThousand: true,
        },
        {
          invoiceNumber: "14",
          amount: "9999",
          observation: "prueba unitaria",
          creditNotes: [],
          roundUpToThousand: true,
        },
      ]);

      return (
        <MovementDrawer
          {...baseProps}
          open
          onClose={vi.fn()}
          editingEntry={null}
          movementAutoCloseLocked={false}
          onToggleMovementAutoCloseLocked={vi.fn()}
          beforeConfirmSubmit={() => true}
          onSubmit={onSubmit}
          egreso="7499"
          extraInvoices={extraInvoices}
          onExtraInvoicesChange={setExtraInvoices}
          roundUpToThousand={roundUpToThousand}
          onRoundUpToThousandChange={setRoundUpToThousand}
        />
      );
    };

    render(<ControlledConfirmation />);

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Redondear hacia arriba factura #2",
      }),
    );
    const confirmSaveButton = screen
      .getAllByRole("button", { name: "Guardar" })
      .at(-1);
    expect(confirmSaveButton).toBeTruthy();
    fireEvent.click(confirmSaveButton as HTMLButtonElement);
    await screen.findByText("Confirmar guardado");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente →" }));

    const secondAmount = screen.getByText("Monto:").parentElement;
    const secondRounding = screen.getByText("Desde caja:").parentElement;
    expect(digits(secondAmount?.querySelector("span:last-child")?.textContent)).toBe(
      "8000",
    );
    expect(secondRounding?.querySelector("span:last-child")?.textContent).toContain(
      "- ",
    );
    expect(
      digits(secondRounding?.querySelector("span:last-child")?.textContent),
    ).toBe("525");

    fireEvent.click(screen.getByRole("button", { name: "Siguiente →" }));
    const thirdAmount = screen.getByText("Monto:").parentElement;
    const thirdRounding = screen.getByText("Desde caja:").parentElement;
    expect(digits(thirdAmount?.querySelector("span:last-child")?.textContent)).toBe(
      "10000",
    );
    expect(thirdRounding?.querySelector("span:last-child")?.textContent).toContain(
      "+ ",
    );
    expect(
      digits(thirdRounding?.querySelector("span:last-child")?.textContent),
    ).toBe("1");

    const modalSaveButton = screen
      .getAllByRole("button", { name: "Guardar" })
      .at(-1);
    expect(modalSaveButton).toBeTruthy();
    fireEvent.click(modalSaveButton as HTMLButtonElement);
    expect(onSubmit).toHaveBeenCalledWith([false, false, true]);
  });

  it("copia la observacion general a todas cuando las individuales estan cerradas", () => {
    const ControlledObservations = () => {
      const [notes, setNotes] = useState("");
      const [extraInvoices, setExtraInvoices] = useState<ExtraInvoice[]>([
        {
          invoiceNumber: "2222",
          amount: "8525",
          observation: "",
          creditNotes: [],
        },
      ]);
      return (
        <AgregarMovimiento
          {...baseProps}
          notes={notes}
          onNotesChange={setNotes}
          extraInvoices={extraInvoices}
          onExtraInvoicesChange={setExtraInvoices}
        />
      );
    };
    render(<ControlledObservations />);

    fireEvent.change(screen.getByPlaceholderText("Observacion"), {
      target: { value: "Aplica a todas" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Observaciones individuales" }),
    );

    expect(screen.getAllByDisplayValue("Aplica a todas")).toHaveLength(2);

    const individualInputs = screen.getAllByPlaceholderText("Observacion");
    fireEvent.change(individualInputs[1], {
      target: { value: "Solo factura #2" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Ocultar individuales" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Observaciones individuales" }),
    );

    expect(screen.getAllByDisplayValue("Aplica a todas")).toHaveLength(2);
  });
});
