import type { OwnerChatMessage } from "@/services/owner-chat";

const CHAT_TIME_ZONE = "America/Costa_Rica";

export const OWNER_CHAT_PINNED_STORAGE_KEY =
  "timemaster-owner-chat-pinned";

type CalendarDate = {
  year: number;
  month: number;
  day: number;
};

function getCalendarDate(date: Date): CalendarDate | null {
  if (Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CHAT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const year = readPart("year");
  const month = readPart("month");
  const day = readPart("day");

  if (![year, month, day].every(Number.isFinite)) return null;
  return { year, month, day };
}

function calendarDayNumber(date: CalendarDate): number {
  return Math.trunc(Date.UTC(date.year, date.month - 1, date.day) / 86_400_000);
}

export function getOwnerChatMessageDate(
  message: OwnerChatMessage | undefined,
): Date | null {
  const date = message?.createdAt?.toDate?.();
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export function getOwnerChatDateKey(date: Date): string {
  const calendarDate = getCalendarDate(date);
  if (!calendarDate) return "";

  return [calendarDate.year, calendarDate.month, calendarDate.day]
    .map((part, index) =>
      index === 0 ? String(part) : String(part).padStart(2, "0"),
    )
    .join("-");
}

export function formatOwnerChatDateLabel(
  date: Date,
  now = new Date(),
): string {
  const messageDate = getCalendarDate(date);
  const currentDate = getCalendarDate(now);
  if (!messageDate || !currentDate) return "";

  const daysAgo =
    calendarDayNumber(currentDate) - calendarDayNumber(messageDate);
  if (daysAgo === 0) return "Hoy";
  if (daysAgo === 1) return "Ayer";

  return new Intl.DateTimeFormat("es-CR", {
    timeZone: CHAT_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function shouldShowOwnerChatDateDivider(
  messages: OwnerChatMessage[],
  index: number,
): boolean {
  const currentDate = getOwnerChatMessageDate(messages[index]);
  if (!currentDate) return false;
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previousDate = getOwnerChatMessageDate(messages[previousIndex]);
    if (!previousDate) continue;
    return getOwnerChatDateKey(currentDate) !== getOwnerChatDateKey(previousDate);
  }

  return true;
}

export function readOwnerChatPinnedPreference(): boolean {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(OWNER_CHAT_PINNED_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeOwnerChatPinnedPreference(pinned: boolean): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(OWNER_CHAT_PINNED_STORAGE_KEY, String(pinned));
  } catch {
    // The chat remains usable when browser storage is unavailable.
  }
}
