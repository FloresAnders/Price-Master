import { describe, expect, it } from "vitest";
import { applyLedgerMovementMutation } from "@/app/fondogeneral/utils/fondo/ledgerState";
import type { FondoEntry } from "@/app/fondogeneral/types";
import { MovimientosFondosService } from "@/services/movimientos-fondos";

const buildLedgerWithOverdueNightClosing = () => {
  const storage =
    MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
      "DELIKOR COOPABUENA",
    );
  storage.state.pendingNightDailyClosing = {
    version: 1,
    movementId: "cierre-fv-n",
    turno: "N",
    createdAt: "2026-10-06T04:43:23.045Z",
    dueAt: "2026-10-06T05:45:00.000Z",
    operationalDateKey: "2026-10-05",
    manager: "MEGAN",
    minutesAfterEnd: 45,
  };
  return storage;
};

const newMovement = {
  id: "egreso-nuevo",
  createdAt: "2026-10-06T05:45:00.000Z",
  accountId: "FondoGeneral" as const,
  currency: "CRC" as const,
  amountEgreso: 5_000,
};

describe("bloqueo por cierre nocturno pendiente", () => {
  it("mantiene bloqueado al usuario regular", () => {
    expect(() =>
      applyLedgerMovementMutation({
        storage: buildLedgerWithOverdueNightClosing(),
        operation: "create",
        nowISO: "2026-10-06T05:45:00.000Z",
        after: newMovement,
        bypassPendingNightDailyClosing: false,
      }),
    ).toThrow("PENDING_NIGHT_DAILY_CLOSING");
  });

  it("permite continuar a admin y superadmin sin eliminar el cierre pendiente", () => {
    const result = applyLedgerMovementMutation({
      storage: buildLedgerWithOverdueNightClosing(),
      operation: "create",
      nowISO: "2026-10-06T05:45:00.000Z",
      after: newMovement,
      bypassPendingNightDailyClosing: true,
    });

    expect(result.storage.state.pendingNightDailyClosing?.movementId).toBe(
      "cierre-fv-n",
    );
    expect(result.ledgerSnapshot.currentCRC).toBe(-5_000);
  });
});
