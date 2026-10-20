import { describe, expect, it } from "vitest";

import * as singleClosingReason from "@/app/fondogeneral/utils/closing/singleClosingReason";

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
