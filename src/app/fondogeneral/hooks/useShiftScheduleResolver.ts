import { useCallback, useRef } from "react";
import { SchedulesService } from "@/services/schedules";
import type { Empresas } from "@/types/firestore";
import {
  getControlHorarioShiftTiming,
  resolveManagerFromControlHorario,
} from "@/utils/controlHorarioManager";

const FG_SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000;

const getCompanyKeysToTry = (
  company: string,
  empresa: Empresas | null | undefined,
) => {
  const normalizedCompany = (company || "").trim();
  if (!normalizedCompany) return [];

  const keys = new Set<string>();
  keys.add(normalizedCompany);
  [empresa?.name, empresa?.ubicacion, empresa?.id]
    .map((value) =>
      typeof value === "string" ? value.trim() : String(value || "").trim(),
    )
    .filter(Boolean)
    .forEach((value) => keys.add(value));
  return Array.from(keys);
};

const getCostaRicaYearMonthParts = (nowISO: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(nowISO));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month1 = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const month0 = Math.max(0, Math.min(11, month1 - 1));

  if (!Number.isFinite(year) || !Number.isFinite(month1) || !Number.isFinite(day))
    return null;
  return { year, month0, day };
};

const parseHHMMToMinutes = (value: unknown) => {
  const match = String(value || "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
};

const getCostaRicaDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month1 = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month1) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute)
  ) {
    return null;
  }

  return { year, month0: Math.max(0, Math.min(11, month1 - 1)), day, hour, minute };
};

const getPreviousNightShiftDateParts = (
  nowISO: string,
  empresa: Empresas | null | undefined,
) => {
  const now = new Date(nowISO);
  const currentParts = getCostaRicaDateParts(now);
  if (!currentParts) return null;

  const openMin = parseHHMMToMinutes(empresa?.horarioApertura);
  const nowMin = currentParts.hour * 60 + currentParts.minute;
  const targetDate =
    openMin !== null && nowMin < openMin
      ? new Date(now.getTime() - 24 * 60 * 60 * 1000)
      : now;

  return getCostaRicaDateParts(targetDate);
};

const findNightManagerForDay = (
  monthSchedules: Awaited<
    ReturnType<typeof SchedulesService.getSchedulesByLocationYearMonth>
  >,
  day: number,
) => {
  const entry = monthSchedules.find(
    (schedule) =>
      Number(schedule.day) === day &&
      String(schedule.shift || "").trim().toUpperCase() === "N" &&
      String(schedule.employeeName || "").trim().length > 0,
  );
  return entry ? String(entry.employeeName || "").trim() : "";
};

export function useShiftScheduleResolver(args: {
  company: string;
  empresa: Empresas | null | undefined;
  closingMovements?: Array<{ createdAt?: string; providerCode?: string }>;
  providers?: Array<{ code: string; name?: string | null }>;
  cierreFondoVentasMinutesAfterEnd?: number;
}) {
  const {
    company,
    empresa,
    closingMovements,
    providers,
    cierreFondoVentasMinutesAfterEnd,
  } = args;
  const fgSchedulesMonthCacheRef = useRef<
    Map<
      string,
      {
        at: number;
        promise: Promise<
          Awaited<ReturnType<typeof SchedulesService.getSchedulesByLocationYearMonth>>
        >;
      }
    >
  >(new Map());

  const getFGMonthlySchedulesCached = useCallback(
    async (locationValue: string, year: number, month0: number) => {
      const key = `${locationValue}__${year}__${month0}`;
      const now = Date.now();
      const cached = fgSchedulesMonthCacheRef.current.get(key);
      if (cached && now - cached.at < FG_SCHEDULES_CACHE_TTL_MS) {
        return cached.promise;
      }

      const promise = SchedulesService.getSchedulesByLocationYearMonth(
        locationValue,
        year,
        month0,
      );
      fgSchedulesMonthCacheRef.current.set(key, { at: now, promise });
      return promise;
    },
    [],
  );

  const resolveShiftManagerForNow = useCallback(
    async (nowISO: string) => {
      if (!empresa) return null;

      const companyKeysToTry = getCompanyKeysToTry(company, empresa);
      if (companyKeysToTry.length === 0) return null;

      const ymParts = getCostaRicaYearMonthParts(nowISO);
      if (!ymParts) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) =>
          getFGMonthlySchedulesCached(key, ymParts.year, ymParts.month0),
        ),
      );
      const monthSchedules = schedulesLists.flat();

      return resolveManagerFromControlHorario({
        nowISO,
        empresa,
        monthSchedules,
        closingMovements,
        providers,
        cierreFondoVentasMinutesAfterEnd,
      });
    },
    [
      company,
      empresa,
      closingMovements,
      cierreFondoVentasMinutesAfterEnd,
      getFGMonthlySchedulesCached,
      providers,
    ],
  );

  const resolveShiftTimingForNow = useCallback(
    async (nowISO: string) => {
      if (!empresa) return null;

      const companyKeysToTry = getCompanyKeysToTry(company, empresa);
      if (companyKeysToTry.length === 0) return null;

      const ymParts = getCostaRicaYearMonthParts(nowISO);
      if (!ymParts) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) =>
          getFGMonthlySchedulesCached(key, ymParts.year, ymParts.month0),
        ),
      );
      const monthSchedules = schedulesLists.flat();

      return getControlHorarioShiftTiming({
        nowISO,
        empresa,
        monthSchedules,
        closingMovements,
        providers,
      });
    },
    [company, empresa, closingMovements, getFGMonthlySchedulesCached, providers],
  );

  const resolvePreviousNightManagerForNow = useCallback(
    async (nowISO: string) => {
      if (!empresa) return null;

      const companyKeysToTry = getCompanyKeysToTry(company, empresa);
      if (companyKeysToTry.length === 0) return null;

      const targetParts = getPreviousNightShiftDateParts(nowISO, empresa);
      if (!targetParts) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) =>
          getFGMonthlySchedulesCached(key, targetParts.year, targetParts.month0),
        ),
      );
      const manager = findNightManagerForDay(schedulesLists.flat(), targetParts.day);

      return manager
        ? { mode: "auto" as const, expectedShift: "N" as const, manager }
        : { mode: "missing" as const, expectedShift: "N" as const };
    },
    [company, empresa, getFGMonthlySchedulesCached],
  );

  return {
    getFGMonthlySchedulesCached,
    resolveShiftManagerForNow,
    resolveShiftTimingForNow,
    resolvePreviousNightManagerForNow,
  };
}
