import type { Empresas, EmpresaEmpleado } from "@/types/firestore";
import type { ScheduleEntry } from "@/services/schedules";

export const COSTA_RICA_TZ = "America/Costa_Rica";

export type ShiftCode = "D" | "N";

export type ControlHorarioManagerResolution =
  | {
      mode: "manual";
      withinHorario: false;
      reason: "outside_horario" | "missing_horario_config" | "invalid_now";
    }
  | {
      mode: "missing";
      withinHorario: true;
      expectedShift: ShiftCode;
      dateKey: string; // YYYY-MM-DD in Costa Rica timezone
    }
  | {
      mode: "auto";
      withinHorario: true;
      expectedShift: ShiftCode;
      manager: string;
    };

type CRParts = {
  year: number;
  month0: number;
  month1: number;
  day: number;
  hour: number;
  minute: number;
};

const getCRParts = (date: Date): CRParts | null => {
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: COSTA_RICA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const getPart = (type: string) => parts.find((p) => p.type === type)?.value;

  const year = Number(getPart("year"));
  const month1 = Number(getPart("month"));
  const day = Number(getPart("day"));
  const hour = Number(getPart("hour"));
  const minute = Number(getPart("minute"));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month1) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  const month0 = Math.max(0, Math.min(11, month1 - 1));
  return { year, month0, month1, day, hour, minute };
};

const parseHHMMToMinutes = (value: unknown): number | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const match = raw.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  if (hour < 0 || hour > 23) return null;
  if (minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
};

const isWithinHorario = (
  nowMin: number,
  openMin: number,
  closeMin: number,
): boolean => {
  // Normal (same-day): open <= close
  if (openMin <= closeMin) return nowMin >= openMin && nowMin <= closeMin;
  // Overnight (e.g. 22:00 -> 06:00): within if >= open OR <= close
  return nowMin >= openMin || nowMin <= closeMin;
};

const normalizeName = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getEmployeeHoursPerShift = (
  empresa: Empresas | null | undefined,
  employeeName: string,
): number | null => {
  if (!empresa?.empleados) return null;
  const normalized = normalizeName(employeeName);
  const match = empresa.empleados.find(
    (emp: EmpresaEmpleado) => normalizeName(emp?.Empleado) === normalized,
  );
  const hours = Number(match?.hoursPerShift);
  if (!Number.isFinite(hours) || hours <= 0) return null;
  return hours;
};

const findSchedule = (
  schedules: ScheduleEntry[],
  day: number,
  shift: ShiftCode,
): ScheduleEntry | undefined =>
  schedules.find(
    (entry) => entry.day === day && String(entry.shift || "").trim() === shift,
  );

export const resolveManagerFromControlHorario = (args: {
  nowISO: string;
  empresa: Empresas | null | undefined;
  monthSchedules: ScheduleEntry[];
}): ControlHorarioManagerResolution => {
  const now = new Date(args.nowISO);
  const parts = getCRParts(now);
  if (!parts) return { mode: "manual", withinHorario: false, reason: "invalid_now" };

  const openMin = parseHHMMToMinutes(args.empresa?.horarioApertura);
  const closeMin = parseHHMMToMinutes(args.empresa?.horarioCierre);
  if (openMin === null || closeMin === null) {
    return {
      mode: "manual",
      withinHorario: false,
      reason: "missing_horario_config",
    };
  }

  const nowMin = parts.hour * 60 + parts.minute;
  if (!isWithinHorario(nowMin, openMin, closeMin)) {
    return { mode: "manual", withinHorario: false, reason: "outside_horario" };
  }

  const dateKey = `${parts.year}-${String(parts.month1).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;

  const entryD = findSchedule(args.monthSchedules, parts.day, "D");
  if (!entryD || !String(entryD.employeeName || "").trim()) {
    return { mode: "missing", withinHorario: true, expectedShift: "D", dateKey };
  }

  const dayHoursRaw = Number(entryD.horasPorDia);
  const dayHours =
    Number.isFinite(dayHoursRaw) && dayHoursRaw > 0
      ? dayHoursRaw
      : getEmployeeHoursPerShift(args.empresa, entryD.employeeName) ?? 8;

  const shiftChangeMin = openMin + Math.round(dayHours * 60);
  const expectedShift: ShiftCode = nowMin >= shiftChangeMin ? "N" : "D";

  if (expectedShift === "N") {
    const entryN = findSchedule(args.monthSchedules, parts.day, "N");
    if (!entryN || !String(entryN.employeeName || "").trim()) {
      return { mode: "missing", withinHorario: true, expectedShift: "N", dateKey };
    }
    return {
      mode: "auto",
      withinHorario: true,
      expectedShift: "N",
      manager: String(entryN.employeeName).trim(),
    };
  }

  return {
    mode: "auto",
    withinHorario: true,
    expectedShift: "D",
    manager: String(entryD.employeeName).trim(),
  };
};

