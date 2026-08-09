export const TURNO_END_MINUTES: Record<"D" | "N", number> = {
  D: 20 * 60,
  N: 24 * 60,
};

const getCostaRicaMinuteOfDay = (date: Date): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const value = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  return value("hour") * 60 + value("minute");
};

export function isWithinCierreRange(
  turno: "D" | "N",
  minutesBeforeEnd: number,
  minutesAfterEnd: number,
  now: Date = new Date(),
): boolean {
  const totalMinutesNow = getCostaRicaMinuteOfDay(now);
  const endMinutes = TURNO_END_MINUTES[turno];

  const windowStart = endMinutes - minutesBeforeEnd;
  const windowEnd = endMinutes + minutesAfterEnd;

  if (turno === "N") {
    const nowNorm =
      totalMinutesNow < 120 ? totalMinutesNow + 1440 : totalMinutesNow;
    return nowNorm >= windowStart && nowNorm <= windowEnd;
  }

  return totalMinutesNow >= windowStart && totalMinutesNow <= windowEnd;
}

export function getCierreWindowTurno(
  minutesBeforeEnd: number,
  minutesAfterEnd: number,
  now: Date = new Date(),
): "D" | "N" {
  const nowMin = getCostaRicaMinuteOfDay(now);
  const dEnd = TURNO_END_MINUTES.D;
  const nEnd = TURNO_END_MINUTES.N;

  const nWindowStart = nEnd - minutesBeforeEnd;
  const nWindowEnd = nEnd + minutesAfterEnd;
  const nowNorm = nowMin < 120 ? nowMin + 1440 : nowMin;
  const inNWindow = nowNorm >= nWindowStart && nowNorm <= nWindowEnd;

  if (inNWindow) return "N";

  const dWindowStart = dEnd - minutesBeforeEnd;
  const dWindowEnd = dEnd + minutesAfterEnd;
  const inDWindow = nowMin >= dWindowStart && nowMin <= dWindowEnd;

  if (inDWindow) return "D";

  return nowMin < dEnd ? "D" : "N";
}
