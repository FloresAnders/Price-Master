import type { Empresas } from "@/types/firestore";

export type ConfiguredShiftHours = {
  dayHours: number;
  nightHours: number;
};

const parseHHMMToMinutes = (value: unknown): number | null => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (
    !Number.isInteger(hour) ||
    !Number.isInteger(minute) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }
  return hour * 60 + minute;
};

const normalizePositiveHours = (value: unknown): number | null => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

export const getCompanyOperatingMinutes = (
  empresa: Partial<Empresas> | null | undefined,
): number | null => {
  const openMin = parseHHMMToMinutes(empresa?.horarioApertura);
  const closeMin = parseHHMMToMinutes(empresa?.horarioCierre);
  if (openMin === null || closeMin === null) return null;
  const duration = (closeMin - openMin + 1440) % 1440;
  return duration > 0 ? duration : null;
};

export const getConfiguredShiftHours = (
  empresa: Partial<Empresas> | null | undefined,
): ConfiguredShiftHours | null => {
  if (empresa?.configurarHorasTurno !== true) return null;
  const dayHours = normalizePositiveHours(empresa.horasTurnoD);
  const nightHours = normalizePositiveHours(empresa.horasTurnoN);
  const operatingMinutes = getCompanyOperatingMinutes(empresa);
  if (dayHours === null || nightHours === null || operatingMinutes === null) {
    return null;
  }
  const configuredMinutes = Math.round((dayHours + nightHours) * 60);
  if (configuredMinutes !== operatingMinutes) return null;
  return { dayHours, nightHours };
};

export const validateCompanyShiftHours = (
  empresa: Partial<Empresas> | null | undefined,
): string | null => {
  if (empresa?.configurarHorasTurno !== true) return null;

  const dayHours = normalizePositiveHours(empresa?.horasTurnoD);
  const nightHours = normalizePositiveHours(empresa?.horasTurnoN);
  if (dayHours === null || nightHours === null) {
    return "Las horas de los turnos D y N deben ser mayores que cero.";
  }

  const operatingMinutes = getCompanyOperatingMinutes(empresa);
  if (operatingMinutes === null) {
    return "Configura un horario de apertura y cierre válido antes de definir los turnos.";
  }

  const configuredMinutes = Math.round((dayHours + nightHours) * 60);
  if (configuredMinutes !== operatingMinutes) {
    const operatingHours = operatingMinutes / 60;
    return `Las horas de D y N deben sumar ${operatingHours} horas, según el horario de apertura y cierre.`;
  }

  return null;
};

export const formatShiftMinute = (minute: number): string => {
  const normalized = ((Math.round(minute) % 1440) + 1440) % 1440;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(
    normalized % 60,
  ).padStart(2, "0")}`;
};

export const getConfiguredShiftSummary = (
  empresa: Partial<Empresas> | null | undefined,
): string | null => {
  const configured = getConfiguredShiftHours(empresa);
  const openMin = parseHHMMToMinutes(empresa?.horarioApertura);
  if (!configured || openMin === null) return null;
  const shiftChangeMin = openMin + Math.round(configured.dayHours * 60);
  const shiftEndMin = shiftChangeMin + Math.round(configured.nightHours * 60);
  return `D: ${formatShiftMinute(openMin)}–${formatShiftMinute(
    shiftChangeMin,
  )} · N: ${formatShiftMinute(shiftChangeMin)}–${formatShiftMinute(
    shiftEndMin,
  )}`;
};
