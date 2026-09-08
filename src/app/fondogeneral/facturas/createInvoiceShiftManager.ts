import type { ControlHorarioManagerResolution } from "@/utils/controlHorarioManager";

export type CreateInvoiceOpeningDecision =
  | {
      mode: "ready";
      manager: string;
      managerLockedByShift: boolean;
    }
  | {
      mode: "missing";
      expectedShift: "D" | "N";
      dateKey: string;
    };

export function resolveCreateInvoiceOpeningDecision(params: {
  fallbackManager: string;
  resolution: ControlHorarioManagerResolution | null;
}): CreateInvoiceOpeningDecision {
  if (params.resolution?.mode === "missing") {
    return {
      mode: "missing",
      expectedShift: params.resolution.expectedShift,
      dateKey: params.resolution.dateKey,
    };
  }

  if (params.resolution?.mode === "auto") {
    return {
      mode: "ready",
      manager: params.resolution.manager.trim(),
      managerLockedByShift: true,
    };
  }

  return {
    mode: "ready",
    manager: params.fallbackManager.trim(),
    managerLockedByShift: false,
  };
}
