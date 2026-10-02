import { getCellStyle, getStateLabel } from "./utils";
import type { ConfiguredShiftHours } from "@/utils/companyShiftHours";

export type DelifoodShift = "D" | "N" | "L" | "V" | "I";

export function getDelifoodDefaultHours(
  shift: string,
  configuredHours: ConfiguredShiftHours | null,
): number {
  if (shift === "D") return configuredHours?.dayHours ?? 0;
  if (shift === "N") return configuredHours?.nightHours ?? 0;
  return 0;
}

export function getDelifoodEffectiveHours(
  shift: string,
  savedHours?: number,
  configuredHours: ConfiguredShiftHours | null = null,
): number {
  const normalized = Number(savedHours);
  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : getDelifoodDefaultHours(shift, configuredHours);
}

export function getDelifoodHoursTooltip(
  shift: string,
  savedHours?: number,
  configuredHours: ConfiguredShiftHours | null = null,
): string {
  const normalized = Number(savedHours);
  const hours =
    Number.isFinite(normalized) && normalized > 0
      ? normalized
      : getDelifoodDefaultHours(shift, configuredHours);
  return `${getStateLabel(shift)} - ${hours} h`;
}

export function sumDelifoodHoursForDays(
  shiftsByDay: Record<string, string> | undefined,
  hoursByDay: Record<string, { hours: number }> | undefined,
  days: number[],
  configuredHours: ConfiguredShiftHours | null,
): { workedDays: number; totalHours: number } {
  let workedDays = 0;
  let totalHours = 0;

  days.forEach((day) => {
    const dayKey = String(day);
    const shift = shiftsByDay?.[dayKey] || "";
    if (!shift) return;
    const hours = getDelifoodEffectiveHours(
      shift,
      hoursByDay?.[dayKey]?.hours,
      configuredHours,
    );
    if (hours <= 0) return;
    workedDays += 1;
    totalHours += hours;
  });

  return { workedDays, totalHours };
}

export function getDelifoodExportCell(shift: string): {
  label: string;
  backgroundColor: string;
  textColor: string;
} {
  const style = getCellStyle(shift);
  return {
    label: shift,
    backgroundColor: style.backgroundColor,
    textColor: style.color,
  };
}
