import { isWithinCierreRange } from "./turnoRango";

type TiemposTucanRole = "admin" | "user" | "superadmin" | string | undefined;

type TiemposTucanUpdateAccessArgs = {
  role: TiemposTucanRole;
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

export function getTiemposTucanUpdateAccess({
  role,
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

  if (isWithinCierreRange("D", before, after, now)) {
    return { allowed: true, turno: "D" };
  }

  if (isWithinCierreRange("N", before, after, now)) {
    return { allowed: true, turno: "N" };
  }

  return { allowed: false, turno: null };
}
