import { isWithinCierreRange } from "./turnoRango";

type TiemposTucanRole = "admin" | "user" | "superadmin" | string | undefined;

type TiemposTucanUpdateAccessArgs = {
  role: TiemposTucanRole;
  horarioApertura?: string | null;
  horarioCierre?: string | null;
  shiftChangeMin?: number | null;
  minutesBeforeEnd?: number | null;
  minutesAfterEnd?: number | null;
  now?: Date;
};

export type TiemposTucanUpdateAccess = {
  allowed: boolean;
  turno: "D" | "N" | null;
};

const readWindowMinutes = (value: number | null | undefined, fallback: number) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

const parseHHMMToMinutes = (value: unknown): number | null => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
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

const getCostaRicaMinuteOfDay = (date: Date): number | null => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const normalizeMinute = (value: number) => ((value % 1440) + 1440) % 1440;

const getMinutesRelativeTo = (minute: number, reference: number) => {
  const forward = normalizeMinute(minute - reference);
  return forward > 720 ? forward - 1440 : forward;
};

const isWithinConfiguredWindow = (
  nowMin: number,
  referenceMin: number,
  minutesBeforeEnd: number,
  minutesAfterEnd: number,
) => {
  const relative = getMinutesRelativeTo(nowMin, referenceMin);
  return relative >= -minutesBeforeEnd && relative <= minutesAfterEnd;
};

export function getTiemposTucanUpdateAccess({
  role,
  horarioCierre,
  shiftChangeMin,
  minutesBeforeEnd,
  minutesAfterEnd,
  now = new Date(),
}: TiemposTucanUpdateAccessArgs): TiemposTucanUpdateAccess {
  if (role === "admin" || role === "superadmin") {
    return { allowed: true, turno: null };
  }

  if (role !== "user") {
    return { allowed: false, turno: null };
  }

  const before = readWindowMinutes(minutesBeforeEnd, 15);
  const after = readWindowMinutes(minutesAfterEnd, 90);
  const closeMin = parseHHMMToMinutes(horarioCierre);
  const nowMin = getCostaRicaMinuteOfDay(now);

  if (closeMin !== null && nowMin !== null) {
    const configuredShiftChange = Number(shiftChangeMin);
    const dayEndMin = Number.isFinite(configuredShiftChange)
      ? normalizeMinute(configuredShiftChange)
      : null;

    if (
      dayEndMin !== null &&
      isWithinConfiguredWindow(nowMin, dayEndMin, before, after)
    ) {
      return { allowed: true, turno: "D" };
    }

    if (isWithinConfiguredWindow(nowMin, closeMin, before, after)) {
      return { allowed: true, turno: "N" };
    }

    return { allowed: false, turno: null };
  }

  if (isWithinCierreRange("D", before, after, now)) {
    return { allowed: true, turno: "D" };
  }

  if (isWithinCierreRange("N", before, after, now)) {
    return { allowed: true, turno: "N" };
  }

  return { allowed: false, turno: null };
}
