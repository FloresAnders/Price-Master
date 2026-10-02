// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import DelifoodShiftCell from "@/components/business/control-horario/components/DelifoodShiftCell";
import { getShiftOptions } from "@/components/business/control-horario/utils";

afterEach(() => cleanup());

function renderCell({
  value = "D",
  hours = 7,
  disabled = false,
  onChange = vi.fn(),
  onOpenHours = vi.fn(),
}: {
  value?: string;
  hours?: number;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onOpenHours?: () => void;
} = {}) {
  return {
    onChange,
    onOpenHours,
    ...render(
      <DelifoodShiftCell
        value={value}
        hours={hours}
        disabled={disabled}
        shiftOptions={getShiftOptions(true)}
        onChange={onChange}
        onOpenHours={onOpenHours}
      />,
    ),
  };
}

describe("celda de turnos DELIFOOD", () => {
  it("permite seleccionar N y expone las horas de D en el tooltip", () => {
    const { onChange } = renderCell();
    const select = screen.getByRole("combobox");

    expect(select.getAttribute("title")).toBe("Diurno - 7 h");
    expect(select.getAttribute("aria-label")).toBe("Diurno - 7 h");
    fireEvent.change(select, { target: { value: "N" } });

    expect(onChange).toHaveBeenCalledWith("N");
  });

  it("muestra horas personalizadas en el tooltip", () => {
    renderCell({ value: "D", hours: 8.5 });
    expect(screen.getByRole("combobox").getAttribute("title")).toBe(
      "Diurno - 8.5 h",
    );
  });

  it("abre horas con doble clic cuando existe un turno", () => {
    const { onOpenHours } = renderCell();
    fireEvent.doubleClick(screen.getByRole("combobox"));
    expect(onOpenHours).toHaveBeenCalledTimes(1);
  });

  it("no abre horas para una celda vacía o deshabilitada", () => {
    const empty = renderCell({ value: "", hours: 0 });
    fireEvent.doubleClick(screen.getByRole("combobox"));
    expect(empty.onOpenHours).not.toHaveBeenCalled();
    empty.unmount();

    const disabled = renderCell({ disabled: true });
    fireEvent.doubleClick(screen.getByRole("combobox"));
    expect(disabled.onOpenHours).not.toHaveBeenCalled();
  });
});
