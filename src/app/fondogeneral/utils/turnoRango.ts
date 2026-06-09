export const TURNO_END_MINUTES: Record<"D" | "N", number> = {
  D: 20 * 60,
  N: 24 * 60,
};

export function isWithinCierreRange(
  turno: "D" | "N",
  minutesBeforeEnd: number,
  minutesAfterEnd: number,
  now: Date = new Date(),
): boolean {
  const totalMinutesNow = now.getHours() * 60 + now.getMinutes();
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
