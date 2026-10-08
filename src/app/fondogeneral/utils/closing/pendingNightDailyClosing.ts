import type { PendingNightDailyClosing } from "@/services/movimientos-fondos";

export type { PendingNightDailyClosing } from "@/services/movimientos-fondos";

export function shouldBypassPendingNightDailyClosing(args: {
  isAdminOrSuperAdmin: boolean;
  bloquearCierre?: boolean | null;
}): boolean {
  return args.isAdminOrSuperAdmin || args.bloquearCierre === false;
}

export function buildPendingNightDailyClosing(args: {
  movementId: string;
  turno?: "D" | "N";
  createdAt: string;
  operationalDateKey: string;
  manager: string;
  minutesAfterEnd: number;
  horarioApertura?: string | null;
  horarioCierre?: string | null;
  singleClosing?: boolean;
}): PendingNightDailyClosing | null {
  if (args.singleClosing) return null;
  if (args.turno !== "N") return null;

  const createdAtMs = Date.parse(args.createdAt);
  const minutesAfterEnd = Math.max(
    0,
    Number.isFinite(Number(args.minutesAfterEnd))
      ? Math.trunc(Number(args.minutesAfterEnd))
      : 0,
  );
  if (
    !Number.isFinite(createdAtMs) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(args.operationalDateKey) ||
    !args.movementId.trim()
  ) {
    return null;
  }

  const parseMinuteOfDay = (value: unknown): number | null => {
    const match = String(value || "")
      .trim()
      .match(/^(\d{2}):(\d{2})$/);
    if (!match) return null;
    const hour = Number(match[1]);
    const minute = Number(match[2]);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return hour * 60 + minute;
  };
  const openingMinute = parseMinuteOfDay(args.horarioApertura);
  const closingMinute = parseMinuteOfDay(args.horarioCierre);
  const [year, month, day] = args.operationalDateKey.split("-").map(Number);
  const scheduledEndMs =
    closingMinute === null
      ? null
      : Date.UTC(
          year,
          month - 1,
          day +
            (openingMinute !== null && closingMinute <= openingMinute ? 1 : 0),
          6,
          closingMinute,
        );
  const dueAtMs =
    (scheduledEndMs !== null && Number.isFinite(scheduledEndMs)
      ? scheduledEndMs
      : createdAtMs) +
    minutesAfterEnd * 60_000;

  return {
    version: 1,
    movementId: args.movementId,
    turno: "N",
    createdAt: new Date(createdAtMs).toISOString(),
    dueAt: new Date(dueAtMs).toISOString(),
    operationalDateKey: args.operationalDateKey,
    manager: String(args.manager || "").trim(),
    minutesAfterEnd,
  };
}

export function getPendingNightDailyClosingStatus(
  pending: PendingNightDailyClosing | null | undefined,
  nowISO: string,
): "none" | "waiting" | "due" {
  if (!pending) return "none";
  const dueAtMs = Date.parse(pending.dueAt);
  const nowMs = Date.parse(nowISO);
  if (!Number.isFinite(dueAtMs) || !Number.isFinite(nowMs)) return "none";
  return nowMs >= dueAtMs ? "due" : "waiting";
}

export function clearPendingNightDailyClosingForSavedClosing(
  pending: PendingNightDailyClosing | null | undefined,
  closing: {
    turno?: "D" | "N";
    operationalDateKey?: string | null;
  },
): PendingNightDailyClosing | null {
  if (!pending) return null;
  if (
    closing.turno === "N" &&
    closing.operationalDateKey === pending.operationalDateKey
  ) {
    return null;
  }
  return pending;
}
