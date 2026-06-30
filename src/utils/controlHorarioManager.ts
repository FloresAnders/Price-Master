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

type ClosingMovementLike = {
  createdAt?: string;
  providerCode?: string;
  turno?: ShiftCode;
};

type DailyClosingLike = {
  createdAt?: string;
  closingDate?: string;
  turno?: ShiftCode;
};

export type CashOpeningAvailability =
  | { allowed: true }
  | {
      allowed: false;
      closingTurno: ShiftCode;
      waitUntilLabel: string;
      reason: "next_shift_not_started" | "next_day_shift_not_started";
    };

export const getOccupiedClosingShifts = (
  closings: ClosingMovementLike[],
): Set<ShiftCode> => {
  const occupied = new Set<ShiftCode>();
  closings.forEach((entry) => {
    if (entry.turno === "D" || entry.turno === "N") occupied.add(entry.turno);
  });
  closings
    .filter((entry) => entry.turno !== "D" && entry.turno !== "N")
    .slice()
    .sort(
      (a, b) =>
        Date.parse(String(a.createdAt || "")) -
        Date.parse(String(b.createdAt || "")),
    )
    .forEach(() => {
      if (!occupied.has("D")) occupied.add("D");
      else if (!occupied.has("N")) occupied.add("N");
    });
  return occupied;
};

const normalizeMinuteOfDay = (value: number) =>
  ((Math.trunc(value) % 1440) + 1440) % 1440;

const getMinutesRelativeTo = (minute: number, reference: number) => {
  const forward = normalizeMinuteOfDay(minute - reference);
  return forward > 720 ? forward - 1440 : forward;
};

export const resolveFondoVentasClosingShift = (args: {
  currentMin: number;
  shiftDEndMin: number;
  shiftNEndMin: number;
  expectedShift: ShiftCode;
  minutesBeforeEnd: number;
  minutesAfterEnd: number;
  occupiedShifts: ReadonlySet<ShiftCode>;
}): ShiftCode => {
  const minutesBeforeEnd = Math.max(0, args.minutesBeforeEnd);
  const minutesAfterEnd = Math.max(0, args.minutesAfterEnd);
  const relativeToDEnd = getMinutesRelativeTo(
    args.currentMin,
    args.shiftDEndMin,
  );
  const isInDWindow =
    relativeToDEnd >= -minutesBeforeEnd &&
    relativeToDEnd <= minutesAfterEnd;

  if (!args.occupiedShifts.has("D") && isInDWindow) return "D";

  const nightWindowStart = normalizeMinuteOfDay(
    args.shiftNEndMin - minutesBeforeEnd,
  );
  const minutesUntilNightWindowStart = normalizeMinuteOfDay(
    nightWindowStart - args.currentMin,
  );
  const relativeToNEnd = getMinutesRelativeTo(
    args.currentMin,
    args.shiftNEndMin,
  );
  const isInNWindow =
    relativeToNEnd >= -minutesBeforeEnd &&
    relativeToNEnd <= minutesAfterEnd;
  const isApproachingNWindow =
    minutesUntilNightWindowStart <= minutesBeforeEnd;

  if (
    args.occupiedShifts.has("D") ||
    args.expectedShift === "N" ||
    isApproachingNWindow ||
    isInNWindow
  ) {
    return "N";
  }

  return "D";
};

type ClosingProviderLike = {
  code: string;
  name?: string | null;
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

export const getCostaRicaDateKeyAndMinute = (
  iso: string,
): { dateKey: string; minuteOfDay: number } | null => {
  const d = new Date(iso);
  const parts = getCRParts(d);
  if (!parts) return null;
  const dateKey = `${parts.year}-${String(parts.month1).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
  return { dateKey, minuteOfDay: parts.hour * 60 + parts.minute };
};

export const getCostaRicaOperationalDateKey = (
  iso: string,
  horarioApertura?: string | null,
): string | null => {
  const parts = getCRParts(new Date(iso));
  if (!parts) return null;
  const openMin = parseHHMMToMinutes(horarioApertura);
  const minuteOfDay = parts.hour * 60 + parts.minute;
  if (openMin !== null && minuteOfDay < openMin) {
    return getPreviousDateKey(parts);
  }
  return `${parts.year}-${String(parts.month1).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
};

const formatMinuteOfDay = (minute: number): string => {
  const normalized = normalizeMinuteOfDay(minute);
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
};

export const getCashOpeningAvailabilityAfterDailyClosing = (args: {
  nowISO: string;
  horarioApertura?: string | null;
  latestDailyClosing?: DailyClosingLike | null;
  shiftChangeMin?: number | null;
}): CashOpeningAvailability => {
  const latest = args.latestDailyClosing;
  if (latest?.turno !== "D" && latest?.turno !== "N") {
    return { allowed: true };
  }

  const openMin = parseHHMMToMinutes(args.horarioApertura);
  if (openMin === null) return { allowed: true };

  const nowInfo = getCostaRicaDateKeyAndMinute(args.nowISO);
  if (!nowInfo) return { allowed: true };

  const nowOperationalDateKey = getCostaRicaOperationalDateKey(
    args.nowISO,
    args.horarioApertura,
  );
  const closingISO = String(latest.closingDate || latest.createdAt || "");
  const closingOperationalDateKey = getCostaRicaOperationalDateKey(
    closingISO,
    args.horarioApertura,
  );
  if (
    !nowOperationalDateKey ||
    !closingOperationalDateKey ||
    nowOperationalDateKey !== closingOperationalDateKey
  ) {
    return { allowed: true };
  }

  if (latest.turno === "N") {
    return {
      allowed: false,
      closingTurno: "N",
      waitUntilLabel: formatMinuteOfDay(openMin),
      reason: "next_day_shift_not_started",
    };
  }

  const shiftChangeMin = Number(args.shiftChangeMin);
  if (!Number.isFinite(shiftChangeMin)) return { allowed: true };

  const currentElapsed = normalizeMinuteOfDay(nowInfo.minuteOfDay - openMin);
  const shiftChangeElapsed = normalizeMinuteOfDay(shiftChangeMin - openMin);
  if (shiftChangeElapsed > 0 && currentElapsed < shiftChangeElapsed) {
    return {
      allowed: false,
      closingTurno: "D",
      waitUntilLabel: formatMinuteOfDay(shiftChangeMin),
      reason: "next_shift_not_started",
    };
  }

  return { allowed: true };
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

export const isWithinFondoVentasNightClosingWindow = (args: {
  nowISO: string;
  horarioCierre?: string | null;
  minutesBeforeEnd: number;
  minutesAfterEnd: number;
}): boolean => {
  const parts = getCRParts(new Date(args.nowISO));
  const closeMin = parseHHMMToMinutes(args.horarioCierre);
  if (!parts || closeMin === null) return false;

  const normalizeMin = (value: number) => ((value % 1440) + 1440) % 1440;
  const nowMin = parts.hour * 60 + parts.minute;
  const startMin = normalizeMin(closeMin - Math.max(0, args.minutesBeforeEnd));
  const endMin = normalizeMin(closeMin + Math.max(0, args.minutesAfterEnd) + 1);

  return startMin <= endMin
    ? nowMin >= startMin && nowMin < endMin
    : nowMin >= startMin || nowMin < endMin;
};

/**
 * True only for post-close grace which crossed midnight. This remains a valid
 * closing window, but belongs to prior calendar day and must not be treated as
 * evidence that current day had only one closing.
 */
export const isFondoVentasPostCloseGraceOnNextDay = (args: {
  nowISO: string;
  horarioCierre?: string | null;
  minutesAfterEnd: number;
}): boolean => {
  const parts = getCRParts(new Date(args.nowISO));
  const closeMin = parseHHMMToMinutes(args.horarioCierre);
  if (!parts || closeMin === null) return false;

  const graceEndMin = closeMin + Math.max(0, args.minutesAfterEnd) + 1;
  if (graceEndMin <= 1440) return false;

  const nowMin = parts.hour * 60 + parts.minute;
  return nowMin < graceEndMin - 1440;
};

const getPreviousDateKey = (parts: CRParts): string => {
  const previous = new Date(Date.UTC(parts.year, parts.month0, parts.day - 1));
  return `${previous.getUTCFullYear()}-${String(
    previous.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(previous.getUTCDate()).padStart(2, "0")}`;
};

const isWithinHorario = (
  nowMin: number,
  openMin: number,
  closeMin: number,
): boolean => {
  // Normal (same-day): open <= close
  if (openMin <= closeMin) return nowMin >= openMin && nowMin < closeMin;
  // Overnight (e.g. 22:00 -> 06:00): within if >= open OR <= close
  return nowMin >= openMin || nowMin < closeMin;
};

const isExpectedDayShiftNow = (
  nowMin: number,
  openMin: number,
  shiftChangeMin: number,
): boolean => {
  const elapsedSinceOpen = (nowMin - openMin + 1440) % 1440;
  const dayShiftDuration = (shiftChangeMin - openMin + 1440) % 1440;
  return elapsedSinceOpen < dayShiftDuration;
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

export const findBestSchedule = (
  schedules: ScheduleEntry[],
  day: number,
  shift: ShiftCode,
): ScheduleEntry | undefined => {
  const matches = schedules.filter(
    (entry) => entry.day === day && String(entry.shift || "").trim() === shift,
  );
  if (matches.length === 0) return undefined;

  const score = (entry: ScheduleEntry) => {
    const hasEmployee =
      String(entry.employeeName || "").trim().length > 0 ? 2 : 0;
    const horas = Number(entry.horasPorDia);
    const hasHoras = Number.isFinite(horas) && horas > 0 ? 1 : 0;
    return hasEmployee + hasHoras;
  };

  let best = matches[0];
  let bestScore = score(best);
  for (let i = 1; i < matches.length; i++) {
    const cur = matches[i];
    const curScore = score(cur);
    if (curScore > bestScore) {
      best = cur;
      bestScore = curScore;
    }
  }
  return best;
};

export const getEmployeesWithAssignedHoursForDay = (
  schedules: ScheduleEntry[],
  day: number,
): string[] => {
  const unique = new Set<string>();
  schedules.forEach((entry) => {
    const hours = Number(entry.horasPorDia);
    const employeeName = String(entry.employeeName || "").trim();
    if (entry.day === day && employeeName && Number.isFinite(hours) && hours > 0) {
      unique.add(employeeName);
    }
  });
  return Array.from(unique).sort((a, b) =>
    a.localeCompare(b, "es", { sensitivity: "base" }),
  );
};

const isCierreFondoVentasMovementLike = (
  entry: ClosingMovementLike,
  providers?: ClosingProviderLike[],
  cierreFondoVentasProviderCode?: string | null,
): boolean => {
  if (cierreFondoVentasProviderCode) {
    return entry.providerCode === cierreFondoVentasProviderCode;
  }
  const providerName = providers
    ?.find((p) => p.code === entry.providerCode)
    ?.name?.toUpperCase();
  return providerName === "CIERRE FONDO VENTAS";
};

export const getFondoVentasShiftFromClosings = (args: {
  nowISO: string;
  horarioApertura?: string | null;
  horarioCierre?: string | null;
  closingMovements?: ClosingMovementLike[];
  providers?: ClosingProviderLike[];
  cierreFondoVentasProviderCode?: string | null;
}): ShiftCode | null => {
  const now = new Date(args.nowISO);
  const parts = getCRParts(now);
  if (!parts) return null;

  const dateKey = `${parts.year}-${String(parts.month1).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
  const openMin = parseHHMMToMinutes(args.horarioApertura);
  const closeMin = parseHHMMToMinutes(args.horarioCierre);
  const nowMin = parts.hour * 60 + parts.minute;
  const overnight = openMin !== null && closeMin !== null && openMin > closeMin;
  const previousDateKey = overnight ? getPreviousDateKey(parts) : null;

  const closingsToday = (args.closingMovements || []).filter((entry) => {
    const info = getCostaRicaDateKeyAndMinute(String(entry.createdAt || ""));
    if (!info) return false;
    if (overnight && openMin !== null) {
      const belongsToCurrentOperationalDay =
        nowMin >= openMin
          ? info.dateKey === dateKey && info.minuteOfDay >= openMin
          : (info.dateKey === previousDateKey && info.minuteOfDay >= openMin) ||
            (info.dateKey === dateKey && info.minuteOfDay <= nowMin);
      if (!belongsToCurrentOperationalDay) return false;
    } else {
      if (info.dateKey !== dateKey) return false;
      // Late closings before today's opening belong to the previous day.
      if (openMin !== null && info.minuteOfDay < openMin) return false;
    }
    return isCierreFondoVentasMovementLike(
      entry,
      args.providers,
      args.cierreFondoVentasProviderCode,
    );
  });

  return getOccupiedClosingShifts(closingsToday).has("D") ? "N" : "D";
};

export const resolveManagerFromControlHorario = (args: {
  nowISO: string;
  empresa: Empresas | null | undefined;
  monthSchedules: ScheduleEntry[];
  closingMovements?: ClosingMovementLike[];
  providers?: ClosingProviderLike[];
  cierreFondoVentasProviderCode?: string | null;
  cierreFondoVentasMinutesAfterEnd?: number;
}): ControlHorarioManagerResolution => {
  const now = new Date(args.nowISO);
  const parts = getCRParts(now);
  if (!parts)
    return { mode: "manual", withinHorario: false, reason: "invalid_now" };

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

  const entryD = findBestSchedule(args.monthSchedules, parts.day, "D");
  const dayHours = (() => {
    const employeeHours = entryD?.employeeName
      ? getEmployeeHoursPerShift(args.empresa, entryD.employeeName)
      : null;
    const dayHoursRaw = Number(entryD?.horasPorDia);
    const scheduleHours =
      Number.isFinite(dayHoursRaw) && dayHoursRaw > 0 ? dayHoursRaw : null;
    return employeeHours ?? scheduleHours ?? 8;
  })();
  const shiftChangeMin = openMin + Math.round(dayHours * 60);
  const expectedShift = isExpectedDayShiftNow(nowMin, openMin, shiftChangeMin)
    ? "D"
    : "N";

  if (!entryD || !String(entryD.employeeName || "").trim()) {
    return { mode: "missing", withinHorario: true, expectedShift, dateKey };
  }

  const closingExistsToday =
    getFondoVentasShiftFromClosings({
      nowISO: args.nowISO,
      horarioApertura: args.empresa?.horarioApertura,
      horarioCierre: args.empresa?.horarioCierre,
      closingMovements: args.closingMovements,
      providers: args.providers,
      cierreFondoVentasProviderCode: args.cierreFondoVentasProviderCode,
    }) === "N";

  const closingGraceAfterEnd = Math.max(
    0,
    Number(args.cierreFondoVentasMinutesAfterEnd ?? 0) || 0,
  );
  const shiftGraceStartMin = shiftChangeMin;
  const shiftGraceEndMin = shiftChangeMin + closingGraceAfterEnd;
  const isWithinShiftGrace = (() => {
    if (closingGraceAfterEnd <= 0) return false;
    const normalizedNow = nowMin < shiftGraceStartMin ? nowMin + 1440 : nowMin;
    return normalizedNow >= shiftGraceStartMin && normalizedNow <= shiftGraceEndMin;
  })();

  if (expectedShift === "N" && isWithinShiftGrace && !closingExistsToday) {
    return {
      mode: "auto",
      withinHorario: true,
      expectedShift: "N",
      manager: String(entryD.employeeName).trim(),
    };
  }

  if (expectedShift === "N") {
    const entryN = findBestSchedule(args.monthSchedules, parts.day, "N");
    if (!entryN || !String(entryN.employeeName || "").trim()) {
      return {
        mode: "missing",
        withinHorario: true,
        expectedShift: "N",
        dateKey,
      };
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

export const getControlHorarioShiftTiming = (args: {
  nowISO: string;
  empresa: Empresas | null | undefined;
  monthSchedules: ScheduleEntry[];
  closingMovements?: ClosingMovementLike[];
  providers?: ClosingProviderLike[];
  cierreFondoVentasProviderCode?: string | null;
}):
  | {
      withinHorario: false;
      reason: "outside_horario" | "missing_horario_config" | "invalid_now";
    }
  | {
      withinHorario: true;
      dateKey: string;
      openMin: number;
      closeMin: number;
      shiftChangeMin: number;
      currentMin: number;
      expectedShift: ShiftCode;
      dayHours: number;
      entryD?: ScheduleEntry;
      entryN?: ScheduleEntry;
    } => {
  const now = new Date(args.nowISO);
  const parts = getCRParts(now);
  if (!parts) return { withinHorario: false, reason: "invalid_now" };

  const openMin = parseHHMMToMinutes(args.empresa?.horarioApertura);
  const closeMin = parseHHMMToMinutes(args.empresa?.horarioCierre);
  if (openMin === null || closeMin === null) {
    return { withinHorario: false, reason: "missing_horario_config" };
  }

  const currentMin = parts.hour * 60 + parts.minute;
  if (!isWithinHorario(currentMin, openMin, closeMin)) {
    return { withinHorario: false, reason: "outside_horario" };
  }

  const dateKey = `${parts.year}-${String(parts.month1).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;

  const entryD = findBestSchedule(args.monthSchedules, parts.day, "D");
  const entryN = findBestSchedule(args.monthSchedules, parts.day, "N");
  const employeeHours = entryD?.employeeName
    ? getEmployeeHoursPerShift(args.empresa, entryD.employeeName)
    : null;
  const dayHoursRaw = Number(entryD?.horasPorDia);
  const scheduleHours =
    Number.isFinite(dayHoursRaw) && dayHoursRaw > 0 ? dayHoursRaw : null;
  const dayHours = employeeHours ?? scheduleHours ?? 8;

  const shiftChangeMin = openMin + Math.round(dayHours * 60);
  const expectedShift = isExpectedDayShiftNow(currentMin, openMin, shiftChangeMin)
    ? "D"
    : "N";

  return {
    withinHorario: true,
    dateKey,
    openMin,
    closeMin,
    shiftChangeMin,
    currentMin,
    expectedShift,
    dayHours,
    entryD,
    entryN,
  };
};
