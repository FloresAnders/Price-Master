import { getCellStyle, getStateLabel } from "./utils";

export type DelifoodShift = "D" | "N" | "L" | "V" | "I";

export function getDelifoodDefaultHours(shift: string): number {
  if (shift === "D") return 7;
  if (shift === "N") return 6;
  return 0;
}

export function getDelifoodEffectiveHours(
  shift: string,
  savedHours?: number,
): number {
  const normalized = Number(savedHours);
  return Number.isFinite(normalized) && normalized > 0
    ? normalized
    : getDelifoodDefaultHours(shift);
}

export function getDelifoodHoursTooltip(
  shift: string,
  savedHours?: number,
): string {
  return `${getStateLabel(shift)} - ${getDelifoodEffectiveHours(shift, savedHours)} h`;
}

export function sumDelifoodHoursForDays(
  shiftsByDay: Record<string, string> | undefined,
  hoursByDay: Record<string, { hours: number }> | undefined,
  days: number[],
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
