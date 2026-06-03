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
  }).formatToParts(new Date(nowISO));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month1 = Number(parts.find((part) => part.type === "month")?.value);
  const month0 = Math.max(0, Math.min(11, month1 - 1));

  if (!Number.isFinite(year) || !Number.isFinite(month1)) return null;
  return { year, month0 };
};

export function useShiftScheduleResolver(args: {
  company: string;
  empresa: Empresas | null | undefined;
}) {
  const { company, empresa } = args;
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

      return resolveManagerFromControlHorario({ nowISO, empresa, monthSchedules });
    },
    [company, empresa, getFGMonthlySchedulesCached],
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

      return getControlHorarioShiftTiming({ nowISO, empresa, monthSchedules });
    },
    [company, empresa, getFGMonthlySchedulesCached],
  );

  return {
    getFGMonthlySchedulesCached,
    resolveShiftManagerForNow,
    resolveShiftTimingForNow,
  };
}
