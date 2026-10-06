import { describe, expect, it } from "vitest";
import {
  buildPendingNightDailyClosing,
  clearPendingNightDailyClosingForSavedClosing,
  getPendingNightDailyClosingStatus,
} from "@/app/fondogeneral/utils/closing/pendingNightDailyClosing";
import { applyLedgerMovementMutation } from "@/app/fondogeneral/utils/fondo/ledgerState";
import type { FondoEntry } from "@/app/fondogeneral/types";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

describe("cierre nocturno pendiente de Fondo General", () => {
  it("vence usando cierreFondoVentasMinutesAfterEnd desde el fin del horario N", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
      horarioApertura: "06:00",
      horarioCierre: "23:00",
    });

    expect(pending).toEqual({
      version: 1,
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      dueAt: "2026-10-06T05:45:00.000Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
    });
  });

  it("no crea obligación futura para un Cierre FV D", () => {
    expect(
      buildPendingNightDailyClosing({
        movementId: "cierre-fv-d",
        turno: "D",
        createdAt: "2026-10-05T20:46:28.922Z",
        operationalDateKey: "2026-10-05",
        manager: "NIDZY",
        minutesAfterEnd: 45,
      }),
    ).toBeNull();
  });

  it("mantiene el comportamiento actual antes del vencimiento y obliga al llegar al límite", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
      horarioApertura: "06:00",
      horarioCierre: "23:00",
    });

    expect(
      getPendingNightDailyClosingStatus(
        pending,
        "2026-10-06T05:44:59.999Z",
      ),
    ).toBe("waiting");
    expect(
      getPendingNightDailyClosingStatus(
        pending,
        "2026-10-06T05:45:00.000Z",
      ),
    ).toBe("due");
  });

  it("mantiene el día operativo anterior cuando el cierre N se registra después de medianoche", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n-0005",
      turno: "N",
      createdAt: "2026-10-06T06:05:00.000Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 90,
      horarioApertura: "06:00",
      horarioCierre: "23:59",
    });

    expect(pending?.operationalDateKey).toBe("2026-10-05");
    expect(pending?.dueAt).toBe("2026-10-06T07:29:00.000Z");
  });

  it("ignora cierres históricos que no tienen la nueva obligación persistida", () => {
    expect(
      getPendingNightDailyClosingStatus(null, "2026-10-07T14:00:00.000Z"),
    ).toBe("none");
  });

  it("persiste en el ledger la obligación creada por un Cierre FV N nuevo", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
      horarioApertura: "06:00",
      horarioCierre: "23:00",
    });
    const storage = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
      "DELIKOR COOPABUENA",
    );

    const result = applyLedgerMovementMutation({
      storage,
      operation: "create",
      nowISO: "2026-10-06T04:43:23.045Z",
      after: {
        id: "cierre-fv-n",
        createdAt: "2026-10-06T04:43:23.045Z",
        accountId: "FondoGeneral",
        currency: "CRC",
        amountIngreso: 39_000,
        pendingNightDailyClosing: pending ?? undefined,
      },
    });

    expect(result.storage.state.pendingNightDailyClosing).toEqual(pending);
  });

  it("conserva la obligación al hidratar el ledger desde Firestore", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
      horarioApertura: "06:00",
      horarioCierre: "23:00",
    });
    const raw = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
      "DELIKOR COOPABUENA",
    );
    raw.state.pendingNightDailyClosing = pending ?? undefined;

    const hydrated = MovimientosFondosService.ensureMovementStorageShape(
      raw,
      "DELIKOR COOPABUENA",
    );

    expect(hydrated.state.pendingNightDailyClosing).toEqual(pending);
  });

  it("el cierre Fondo General N del mismo día operativo elimina la obligación", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
      horarioApertura: "06:00",
      horarioCierre: "23:00",
    });

    expect(
      clearPendingNightDailyClosingForSavedClosing(pending, {
        turno: "N",
        operationalDateKey: "2026-10-05",
      }),
    ).toBeNull();
    expect(
      clearPendingNightDailyClosingForSavedClosing(pending, {
        turno: "D",
        operationalDateKey: "2026-10-05",
      }),
    ).toEqual(pending);
  });

  it("permite el flujo actual antes del plazo y bloquea movimientos al vencer", () => {
    const pending = buildPendingNightDailyClosing({
      movementId: "cierre-fv-n",
      turno: "N",
      createdAt: "2026-10-06T04:43:23.045Z",
      operationalDateKey: "2026-10-05",
      manager: "MEGAN",
      minutesAfterEnd: 45,
      horarioApertura: "06:00",
      horarioCierre: "23:00",
    });
    const storage = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
      "DELIKOR COOPABUENA",
    );
    storage.state.pendingNightDailyClosing = pending ?? undefined;
    const movement = {
      id: "egreso-nuevo",
      createdAt: "2026-10-06T05:45:00.000Z",
      accountId: "FondoGeneral" as const,
      currency: "CRC" as const,
      amountEgreso: 5_000,
    };

    expect(() =>
      applyLedgerMovementMutation({
        storage,
        operation: "create",
        nowISO: "2026-10-06T05:44:59.999Z",
        after: movement,
      }),
    ).not.toThrow();
    expect(() =>
      applyLedgerMovementMutation({
        storage,
        operation: "create",
        nowISO: "2026-10-06T05:45:00.000Z",
        after: movement,
      }),
    ).toThrow("PENDING_NIGHT_DAILY_CLOSING");
  });
});
