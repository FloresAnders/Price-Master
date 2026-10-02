// @vitest-environment jsdom

import React from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  DelifoodHoursData,
  ScheduleData,
} from "@/components/business/control-horario/types";

const service = vi.hoisted(() => ({
  updateScheduleShift: vi.fn(async () => undefined),
  updateScheduleHours: vi.fn(async () => undefined),
}));

vi.mock("@/services/schedules", () => ({
  SchedulesService: service,
}));

import { useShiftManagement } from "@/components/business/control-horario/hooks/useShiftManagement";

function renderManagement({
  isDelifoodEmpresa = true,
  initialScheduleData,
  initialHours = {},
  role = "admin",
}: {
  isDelifoodEmpresa?: boolean;
  initialScheduleData: ScheduleData;
  initialHours?: DelifoodHoursData;
  role?: string;
}) {
  const showToast = vi.fn();
  const rendered = renderHook(() => {
    const [scheduleData, setScheduleData] = React.useState(initialScheduleData);
    const [delifoodHoursData, setDelifoodHoursData] = React.useState(initialHours);
    const management = useShiftManagement({
      empresa: isDelifoodEmpresa ? "DELIFOOD" : "OTRA",
      empresas: [],
      scheduleData,
      setScheduleData,
      delifoodHoursData,
      setDelifoodHoursData,
      year: 2026,
      month: 9,
      user: { role },
      showToast,
      isDelifoodEmpresa,
    });
    return { ...management, scheduleData, delifoodHoursData };
  });
  return { ...rendered, showToast };
}

async function confirmPending(
  result: ReturnType<typeof renderManagement>["result"],
) {
  await act(async () => {
    await result.current.confirmModal.onConfirm?.();
  });
}

describe("gestión de turnos DELIFOOD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-01T18:00:00.000Z"));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("permite un segundo turno D el mismo día y guarda 7 horas", async () => {
    const { result } = renderManagement({
      initialScheduleData: { Ana: { "1": "D" }, Luis: {} },
    });

    act(() => result.current.handleCellChange("Luis", 1, "D"));
    await confirmPending(result);

    expect(service.updateScheduleShift).toHaveBeenCalledWith(
      "DELIFOOD",
      "Luis",
      2026,
      9,
      1,
      "D",
      { horasPorDia: 7 },
    );
    expect(result.current.scheduleData.Luis["1"]).toBe("D");
    expect(result.current.delifoodHoursData.Luis["1"].hours).toBe(7);
  });

  it("mantiene el rechazo de un D duplicado en una empresa regular", () => {
    const { result, showToast } = renderManagement({
      isDelifoodEmpresa: false,
      initialScheduleData: { Ana: { "1": "D" }, Luis: {} },
    });

    act(() => result.current.handleCellChange("Luis", 1, "D"));

    expect(showToast).toHaveBeenCalledWith(
      '"D" ya asignado a Ana el día 1.',
      "error",
    );
    expect(service.updateScheduleShift).not.toHaveBeenCalled();
  });

  it("permite más de dos turnos L en DELIFOOD", async () => {
    const { result } = renderManagement({
      initialScheduleData: {
        Ana: { "1": "L" },
        Luis: { "1": "L" },
        Marta: {},
      },
    });

    act(() => result.current.handleCellChange("Marta", 1, "L"));
    await confirmPending(result);

    expect(result.current.scheduleData.Marta["1"]).toBe("L");
  });

  it("cambiar un D personalizado a N descarta la excepción y aplica 6 horas", async () => {
    const { result } = renderManagement({
      initialScheduleData: { Ana: { "1": "D" } },
      initialHours: { Ana: { "1": { hours: 8.5 } } },
    });

    act(() => result.current.handleCellChange("Ana", 1, "N"));
    await confirmPending(result);

    expect(result.current.scheduleData.Ana["1"]).toBe("N");
    expect(result.current.delifoodHoursData.Ana["1"].hours).toBe(6);
  });

  it("abre el modal solo cuando ya existe un turno", () => {
    const { result } = renderManagement({
      initialScheduleData: { Ana: { "1": "D" }, Luis: {} },
      initialHours: { Ana: { "1": { hours: 7 } } },
    });

    act(() => result.current.handleDelifoodHoursOpen("Luis", 1));
    expect(result.current.delifoodModal.isOpen).toBe(false);

    act(() => result.current.handleDelifoodHoursOpen("Ana", 1));
    expect(result.current.delifoodModal).toMatchObject({
      isOpen: true,
      employeeName: "Ana",
      day: 1,
      shift: "D",
      currentHours: 7,
    });
  });

  it("guardar 0 elimina turno y horas del estado local", async () => {
    const { result } = renderManagement({
      initialScheduleData: { Ana: { "1": "D" } },
      initialHours: { Ana: { "1": { hours: 7 } } },
    });
    act(() => result.current.handleDelifoodHoursOpen("Ana", 1));

    await act(async () => {
      await result.current.handleDelifoodHoursSave(0);
    });

    expect(result.current.scheduleData.Ana["1"]).toBeUndefined();
    expect(result.current.delifoodHoursData.Ana["1"]).toBeUndefined();
  });

  it("un usuario regular no puede asignar V o I", () => {
    const { result, showToast } = renderManagement({
      initialScheduleData: { Ana: {} },
      role: "user",
    });

    act(() => result.current.handleCellChange("Ana", 1, "V"));

    expect(showToast).toHaveBeenCalledWith(
      expect.stringContaining("Solo ADMIN puede asignar"),
      "error",
    );
    expect(service.updateScheduleShift).not.toHaveBeenCalled();
  });
});
