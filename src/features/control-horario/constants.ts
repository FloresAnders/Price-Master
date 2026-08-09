import type { ShiftOption } from "./types";

export const DUP_WINDOW_MS = 3000;
export const STORAGE_KEY_SIGNATURE = "controlHorario:lastIncompletePastSignature";

export const SHIFT_OPTIONS_BASE: ShiftOption[] = [
  { value: "", label: "▼", color: "var(--card-bg)", textColor: "var(--foreground)" },
  { value: "N", label: "N", color: "#87CEEB", textColor: "#000" },
  { value: "D", label: "D", color: "#FFFF00", textColor: "#000" },
  { value: "L", label: "L", color: "#FF00FF", textColor: "#FFF" },
];

export const ADMIN_SHIFT_OPTIONS: ShiftOption[] = [
  { value: "V", label: "V", color: "#28a745", textColor: "#FFF" },
  { value: "I", label: "I", color: "#fd7e14", textColor: "#FFF" },
];

export const ALL_SHIFT_COLORS: ShiftOption[] = [
  { value: "", label: "▼", color: "var(--card-bg)", textColor: "var(--foreground)" },
  { value: "N", label: "N", color: "#0ea5e9", textColor: "#000" },
  { value: "D", label: "D", color: "#ffea00", textColor: "#000" },
  { value: "L", label: "L", color: "#a855f7", textColor: "#FFF" },
  { value: "V", label: "V", color: "#10b981", textColor: "#FFF" },
  { value: "I", label: "I", color: "#ea580c", textColor: "#FFF" },
];

export const STATE_LABELS: Record<string, string> = {
  V: "Vacaciones",
  I: "Incapacidad",
  L: "Libre",
  N: "Nocturno",
  D: "Diurno",
};
