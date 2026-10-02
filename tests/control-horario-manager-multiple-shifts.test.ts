import { describe, expect, it } from "vitest";
import type { Empresas } from "@/types/firestore";
import { resolveManagerFromControlHorario } from "@/utils/controlHorarioManager";

describe("consumidores de Control Horario con turnos múltiples", () => {
  it("resuelve un encargado existente cuando DELIFOOD tiene dos turnos D", () => {
    const empresa = {
      horarioApertura: "10:00",
      horarioCierre: "22:00",
      empleados: [
        { Empleado: "Ana", hoursPerShift: 7 },
        { Empleado: "Luis", hoursPerShift: 7 },
      ],
    } as unknown as Empresas;

    const result = resolveManagerFromControlHorario({
      nowISO: "2026-10-01T17:00:00.000Z",
      empresa,
      monthSchedules: [
        {
          companieValue: "DELIFOOD",
          employeeName: "Ana",
          year: 2026,
          month: 9,
          day: 1,
          shift: "D",
          horasPorDia: 7,
        },
        {
          companieValue: "DELIFOOD",
          employeeName: "Luis",
          year: 2026,
          month: 9,
          day: 1,
          shift: "D",
          horasPorDia: 7,
        },
      ],
    });

    expect(result.mode).toBe("auto");
    if (result.mode === "auto") {
      expect(result.expectedShift).toBe("D");
      expect(["Ana", "Luis"]).toContain(result.manager);
    }
  });
});
