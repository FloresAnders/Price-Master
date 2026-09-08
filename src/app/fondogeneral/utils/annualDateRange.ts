export interface AnnualDateRange {
  from: Date;
  to: Date;
}

export function resolveAnnualDateRange(
  preset: string,
  now: Date = new Date(),
): AnnualDateRange | null {
  if (preset !== "year" && preset !== "lastyear") return null;

  const year = now.getFullYear() - (preset === "lastyear" ? 1 : 0);
  return {
    from: new Date(year, 0, 1),
    to: new Date(year, 11, 31),
  };
}
