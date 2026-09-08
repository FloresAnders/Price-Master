import { describe, expect, it } from "vitest";
import { resolveCreateInvoiceOpeningDecision } from "@/app/fondogeneral/facturas/createInvoiceShiftManager";

describe("encargado por turno al crear FC/NC", () => {
  it("abre con el encargado del turno seleccionado y bloqueado", () => {
    expect(
      resolveCreateInvoiceOpeningDecision({
        fallbackManager: "USUARIO ACTUAL",
        resolution: {
          mode: "auto",
          withinHorario: true,
          expectedShift: "N",
          manager: "ENCARGADO NOCTURNO",
        },
      }),
    ).toEqual({
      mode: "ready",
      manager: "ENCARGADO NOCTURNO",
      managerLockedByShift: true,
    });
  });

  it("bloquea la apertura cuando falta el encargado del turno", () => {
    expect(
      resolveCreateInvoiceOpeningDecision({
        fallbackManager: "USUARIO ACTUAL",
        resolution: {
          mode: "missing",
          withinHorario: true,
          expectedShift: "D",
          dateKey: "2026-09-07",
        },
      }),
    ).toEqual({
      mode: "missing",
      expectedShift: "D",
      dateKey: "2026-09-07",
    });
  });

  it("mantiene selección manual fuera del horario configurado", () => {
    expect(
      resolveCreateInvoiceOpeningDecision({
        fallbackManager: "USUARIO ACTUAL",
        resolution: {
          mode: "manual",
          withinHorario: false,
          reason: "outside_horario",
        },
      }),
    ).toEqual({
      mode: "ready",
      manager: "USUARIO ACTUAL",
      managerLockedByShift: false,
    });
  });
});
