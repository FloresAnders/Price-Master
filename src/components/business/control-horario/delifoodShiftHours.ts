import { getStateLabel } from "./utils";

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
