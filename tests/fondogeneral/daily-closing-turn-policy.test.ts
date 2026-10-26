import { describe, expect, it } from "vitest";

import * as singleClosingReason from "@/app/fondogeneral/utils/closing/singleClosingReason";
import { sanitizeFondoEntries } from "@/app/fondogeneral/utils/fondo/sanitizeFondoEntries";

type ClosingEntry = {
  id: string;
  turno?: "D" | "N";
  sinTurno?: boolean;
};

type ClosingPolicyResolver = (args: {
  empresaUsesSingleClosing: boolean;
  hasRealD: boolean;
  hasDayClosingMovement: boolean;
  hasNightClosingMovement: boolean;
}) => {
  turno: "D" | "N";
  requireSingleClosingReason: boolean;
};

type ClosingMovementSelector = <T>(
  entries: T[],
  turno: "D" | "N",
  resolveTurno: (entry: T) => "D" | "N" | undefined,
) => T | null;

const getPolicyResolver = (): ClosingPolicyResolver | undefined =>
  (
    singleClosingReason as typeof singleClosingReason & {
      resolveAutomaticDailyClosingPolicy?: ClosingPolicyResolver;
    }
  ).resolveAutomaticDailyClosingPolicy;

const getMovementSelector = (): ClosingMovementSelector | undefined =>
  (
    singleClosingReason as typeof singleClosingReason & {
      selectClosingMovementForDailyTurno?: ClosingMovementSelector;
    }
  ).selectClosingMovementForDailyTurno;

describe("politica de turno del cierre diario", () => {
  it("mantiene N y exige motivo cuando existe N sin cierre D", () => {
    const resolvePolicy = getPolicyResolver();

    expect(resolvePolicy).toBeTypeOf("function");
    expect(
      resolvePolicy?.({
        empresaUsesSingleClosing: false,
        hasRealD: false,
        hasDayClosingMovement: false,
        hasNightClosingMovement: true,
      }),
    ).toEqual({
      turno: "N",
      requireSingleClosingReason: true,
    });
  });

  it("mantiene dos cierres cuando existen movimientos D y N", () => {
    const resolvePolicy = getPolicyResolver();

    expect(resolvePolicy).toBeTypeOf("function");
    expect(
      resolvePolicy?.({
        empresaUsesSingleClosing: false,
        hasRealD: false,
        hasDayClosingMovement: true,
        hasNightClosingMovement: true,
      }),
    ).toEqual({
      turno: "D",
      requireSingleClosingReason: false,
    });
    expect(
      resolvePolicy?.({
        empresaUsesSingleClosing: false,
        hasRealD: true,
        hasDayClosingMovement: true,
        hasNightClosingMovement: true,
      }),
    ).toEqual({
      turno: "N",
      requireSingleClosingReason: false,
    });
  });

  it("no usa movimiento N como encargado de un cierre D", () => {
    const selectMovement = getMovementSelector();
    const entries: ClosingEntry[] = [{ id: "night", turno: "N" }];

    expect(selectMovement).toBeTypeOf("function");
    expect(selectMovement?.(entries, "D", (entry) => entry.turno)).toBeNull();
    expect(selectMovement?.(entries, "N", (entry) => entry.turno)).toEqual(
      entries[0],
    );
  });
});

describe("sanitizacion del cierre N pendiente", () => {
  const validPending = {
    version: 1,
    movementId: "2026_10_26-00_19_51_797_FondoGeneral",
    turno: "N",
    createdAt: "2026-10-26T06:19:51.797Z",
    dueAt: "2026-10-26T06:44:00.000Z",
    operationalDateKey: "2026-10-25",
    manager: "GUILLERMO",
    minutesAfterEnd: 45,
  } as const;

  const sanitizePending = (pendingNightDailyClosing: unknown) => {
    const [entry] = sanitizeFondoEntries([
      {
        id: "2026_10_26-00_19_51_797_FondoGeneral",
        providerCode: "0008",
        invoiceNumber: "2610",
        invoiceDocType: "FCO",
        paymentType: "VENTAS",
        amountEgreso: 0,
        amountIngreso: 191_000,
        manager: "GUILLERMO",
        notes: "",
        createdAt: "2026-10-26T06:19:51.797Z",
        currency: "CRC",
        accountId: "FondoGeneral",
        turno: "N",
        pendingNightDailyClosing,
      },
    ]);
    return entry.pendingNightDailyClosing;
  };

  it("conserva pendingNightDailyClosing valido en el movimiento", () => {
    expect(sanitizePending(validPending)).toEqual(validPending);
  });

  it.each([
    ["version", { ...validPending, version: 2 }],
    ["turno", { ...validPending, turno: "D" }],
    ["movementId", { ...validPending, movementId: " " }],
    ["createdAt", { ...validPending, createdAt: "fecha-invalida" }],
    ["dueAt", { ...validPending, dueAt: "fecha-invalida" }],
    ["operationalDateKey", { ...validPending, operationalDateKey: "26-10-2026" }],
    ["manager", { ...validPending, manager: null }],
    ["minutesAfterEnd", { ...validPending, minutesAfterEnd: -1 }],
  ])("descarta pendingNightDailyClosing con %s invalido", (_field, pending) => {
    expect(sanitizePending(pending)).toBeUndefined();
  });
});
