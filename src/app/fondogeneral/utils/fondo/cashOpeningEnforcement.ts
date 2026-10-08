import { getCostaRicaOperationalDateKey } from "@/utils/controlHorarioManager";
import { getConfiguredShiftHours } from "@/utils/companyShiftHours";
import type { Empresas } from "@/types/firestore";

type ShiftCode = "D" | "N";

export type RequiredCashOpeningWindow = {
  status: "required";
  turno: ShiftCode;
  mandatoryStartISO: string;
  shiftEndISO: string;
  releaseISO: string;
  isLate: boolean;
  effectiveOpeningISO: string;
};

export type CashOpeningEnforcementDecision =
  | { status: "normal"; nextTransitionISO: string }
  | { status: "unavailable" }
  | RequiredCashOpeningWindow;

const MINUTE_MS = 60_000;

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

const buildCostaRicaMinuteMs = (dateKey: string, minute: number): number => {
  const midnightMs = Date.parse(`${dateKey}T00:00:00.000-06:00`);
  return midnightMs + Math.round(minute) * MINUTE_MS;
};

const normalizeWindowMinutes = (value: unknown): number | null => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(0, Math.round(parsed));
};

export function resolveCashOpeningDayShiftHours(args: {
  empresa?: {
    configurarHorasTurno?: boolean;
    horasTurnoD?: number;
    horasTurnoN?: number;
    horarioApertura?: string;
    horarioCierre?: string;
    empleados?: Array<{ Empleado?: string; hoursPerShift?: number }>;
  } | null;
  entryD?: { employeeName?: string | null; horasPorDia?: number | null } | null;
}): number | null {
  const configured = getConfiguredShiftHours(
    args.empresa as Partial<Empresas> | null | undefined,
  );
  if (configured) return configured.dayHours;
  if (args.empresa?.configurarHorasTurno === true) return null;

  const employeeName = String(args.entryD?.employeeName || "")
    .trim()
    .toLocaleLowerCase("es");
  const employeeHours = employeeName
    ? args.empresa?.empleados?.find(
        (employee) =>
          String(employee.Empleado || "")
            .trim()
            .toLocaleLowerCase("es") === employeeName,
      )?.hoursPerShift
    : null;
  const normalizedEmployeeHours = Number(employeeHours);
  if (Number.isFinite(normalizedEmployeeHours) && normalizedEmployeeHours > 0) {
    return normalizedEmployeeHours;
  }

  const scheduleHours = Number(args.entryD?.horasPorDia);
  return Number.isFinite(scheduleHours) && scheduleHours > 0
    ? scheduleHours
    : null;
}

export function resolveCashOpeningEnforcementWindow(args: {
  nowISO: string;
  horarioApertura?: string | null;
  horarioCierre?: string | null;
  dayShiftHours?: number | null;
  minutesBeforeEnd?: number | null;
  minutesAfterEnd?: number | null;
}): CashOpeningEnforcementDecision {
  const nowMs = Date.parse(args.nowISO);
  const openMin = parseHHMMToMinutes(args.horarioApertura);
  const closeMin = parseHHMMToMinutes(args.horarioCierre);
  const dayShiftHours = Number(args.dayShiftHours);
  const before = normalizeWindowMinutes(args.minutesBeforeEnd);
  const after = normalizeWindowMinutes(args.minutesAfterEnd);
  const operationalDateKey = getCostaRicaOperationalDateKey(
    args.nowISO,
    args.horarioApertura,
  );

  if (
    !Number.isFinite(nowMs) ||
    openMin === null ||
    closeMin === null ||
    !Number.isFinite(dayShiftHours) ||
    dayShiftHours <= 0 ||
    before === null ||
    after === null ||
    !operationalDateKey
  ) {
    return { status: "unavailable" };
  }

  const dayEndMinute = openMin + Math.round(dayShiftHours * 60);
  const nightEndMinute = closeMin <= openMin ? closeMin + 1440 : closeMin;
  if (dayEndMinute <= openMin || dayEndMinute >= nightEndMinute) {
    return { status: "unavailable" };
  }

  const candidates: Array<{ turno: ShiftCode; endMs: number }> = [
    {
      turno: "D",
      endMs: buildCostaRicaMinuteMs(operationalDateKey, dayEndMinute),
    },
    {
      turno: "N",
      endMs: buildCostaRicaMinuteMs(operationalDateKey, nightEndMinute),
    },
  ];
  const candidateWindows = candidates.map((candidate) => ({
    ...candidate,
    mandatoryStartMs:
      candidate.endMs - before * MINUTE_MS + MINUTE_MS,
    releaseMs: candidate.endMs + after * MINUTE_MS + MINUTE_MS,
  }));

  const activeCandidate = candidateWindows
    .filter(
      (candidate) =>
        nowMs >= candidate.mandatoryStartMs && nowMs < candidate.releaseMs,
    )
    .sort((a, b) => b.mandatoryStartMs - a.mandatoryStartMs)[0];
  if (activeCandidate) {
    const candidate = activeCandidate;
    const isLate = nowMs >= candidate.endMs + MINUTE_MS;
    return {
      status: "required",
      turno: candidate.turno,
      mandatoryStartISO: new Date(candidate.mandatoryStartMs).toISOString(),
      shiftEndISO: new Date(candidate.endMs).toISOString(),
      releaseISO: new Date(candidate.releaseMs).toISOString(),
      isLate,
      effectiveOpeningISO: isLate
        ? new Date(candidate.endMs - 2 * MINUTE_MS).toISOString()
        : new Date(nowMs).toISOString(),
    };
  }

  const nextStartMs = candidateWindows
    .map((candidate) => candidate.mandatoryStartMs)
    .filter((startMs) => startMs > nowMs)
    .sort((a, b) => a - b)[0];
  if (Number.isFinite(nextStartMs)) {
    return {
      status: "normal",
      nextTransitionISO: new Date(nextStartMs).toISOString(),
    };
  }

  const nextOperationalDate = new Date(
    Date.parse(`${operationalDateKey}T12:00:00.000Z`) + 24 * 60 * MINUTE_MS,
  )
    .toISOString()
    .slice(0, 10);
  const nextDayStartMs = buildCostaRicaMinuteMs(
    nextOperationalDate,
    dayEndMinute - before + 1,
  );
  return {
    status: "normal",
    nextTransitionISO: new Date(nextDayStartMs).toISOString(),
  };
}

export function isOpeningRequirementEligibleForEnforcement(args: {
  window: RequiredCashOpeningWindow;
  latestClosingISO?: string | null;
}): boolean {
  if (!args.latestClosingISO) return true;
  const closingMs = Date.parse(args.latestClosingISO);
  const mandatoryStartMs = Date.parse(args.window.mandatoryStartISO);
  if (!Number.isFinite(closingMs) || !Number.isFinite(mandatoryStartMs)) {
    return false;
  }
  return closingMs <= mandatoryStartMs;
}

export function buildCashOpeningPersistenceTiming(args: {
  registeredAtISO: string;
  window: RequiredCashOpeningWindow;
}) {
  return {
    createdAt: args.window.effectiveOpeningISO,
    openingRegisteredAt: args.registeredAtISO,
    openingTurno: args.window.turno,
    openingTimestampAdjusted: args.window.isLate,
  } as const;
}
