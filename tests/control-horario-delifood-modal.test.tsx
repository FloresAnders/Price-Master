// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const service = vi.hoisted(() => ({
  updateScheduleHours: vi.fn(async () => undefined),
}));

vi.mock("@/services/schedules", () => ({
  SchedulesService: service,
}));

import DelifoodHoursModal from "@/components/ui/DelifoodHoursModal";

describe("DelifoodHoursModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("delega un solo guardado al padre y cierra tras completarlo", async () => {
    const onSave = vi.fn(async () => undefined);
    const onClose = vi.fn();
    render(
      <DelifoodHoursModal
        isOpen
        employeeName="Ana"
        day={1}
        month={9}
        year={2026}
        currentHours={7}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "8.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(8.5);
    expect(service.updateScheduleHours).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("permanece abierto y muestra el error cuando el padre rechaza", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const onSave = vi.fn(async () => {
      throw new Error("write failed");
    });
    const onClose = vi.fn();
    render(
      <DelifoodHoursModal
        isOpen
        employeeName="Ana"
        day={1}
        month={9}
        year={2026}
        currentHours={7}
        onSave={onSave}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(
      await screen.findByText("Error al guardar las horas trabajadas"),
    ).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});
