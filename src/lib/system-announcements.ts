import { Timestamp, type FieldValue } from "firebase/firestore";

export const SYSTEM_ANNOUNCEMENTS_COLLECTION = "systemAnnouncements";
export const PUBLISHED_SYSTEM_ANNOUNCEMENTS_COLLECTION =
  "publishedSystemAnnouncements";
export const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";

export type AnnouncementType =
  | "info"
  | "maintenance"
  | "warning"
  | "new_feature";

export interface SystemAnnouncement {
  id: string;
  title: string;
  detail: string;
  type: AnnouncementType;
  active: boolean;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  allowDismiss: boolean;
  priority: number;
  scope: "global";
  archived: boolean;
  version: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  updatedBy: string;
}

export interface PublishedSystemAnnouncement {
  id: string;
  title: string;
  detail: string;
  type: AnnouncementType;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  allowDismiss: boolean;
  priority: number;
  scope: "global";
  version: number;
  publishedAt: Timestamp;
}

export interface AnnouncementDraft {
  title: string;
  detail: string;
  type: AnnouncementType;
  active: boolean;
  startsAtLocal: string;
  endsAtLocal: string;
  allowDismiss: boolean;
  priority: number;
  scope: "global";
  archived: boolean;
}

export type AnnouncementDraftErrors = Partial<
  Record<keyof AnnouncementDraft, string>
>;

export interface SystemAnnouncementWrite {
  title: string;
  detail: string;
  type: AnnouncementType;
  active: boolean;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
  allowDismiss: boolean;
  priority: number;
  scope: "global";
  archived: boolean;
  version: number;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  createdBy: string;
  updatedBy: string;
}

type TimestampLike = Timestamp | Date | null | undefined;
type VisibilityAnnouncement = {
  active?: boolean;
  archived?: boolean;
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
};
type SortableAnnouncement = VisibilityAnnouncement & {
  id: string;
  priority: number;
  createdAt?: Timestamp;
  publishedAt?: Timestamp;
};

const COSTA_RICA_UTC_OFFSET_HOURS = 6;
const DATETIME_LOCAL_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export function parseCostaRicaDateTimeLocal(value: string): Date | null {
  const match = DATETIME_LOCAL_PATTERN.exec(value.trim());
  if (!match) return null;

  const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = match;
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;

  const utc = new Date(
    Date.UTC(year, month - 1, day, hour + COSTA_RICA_UTC_OFFSET_HOURS, minute),
  );
  return formatCostaRicaDateTimeLocal(utc) === value.trim() ? utc : null;
}

function dateFromTimestampLike(value: TimestampLike): Date | null {
  if (!value) return null;
  return value instanceof Date ? value : value.toDate();
}

export function formatCostaRicaDateTimeLocal(value: TimestampLike): string {
  const date = dateFromTimestampLike(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: COSTA_RICA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function formatCostaRicaDateTime(value: TimestampLike): string {
  const date = dateFromTimestampLike(value);
  if (!date || Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es-CR", {
    timeZone: COSTA_RICA_TIME_ZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

const timestampMillis = (value: Timestamp | null | undefined): number | null =>
  value ? value.toMillis() : null;

export function isAnnouncementVisible(
  announcement: VisibilityAnnouncement,
  now: Date = new Date(),
): boolean {
  if (announcement.active === false || announcement.archived === true) return false;
  const nowMillis = now.getTime();
  const startsAt = timestampMillis(announcement.startsAt);
  const endsAt = timestampMillis(announcement.endsAt);
  return (startsAt === null || startsAt <= nowMillis) &&
    (endsAt === null || nowMillis < endsAt);
}

export function sortVisibleAnnouncements<T extends SortableAnnouncement>(
  announcements: T[],
  now: Date = new Date(),
): T[] {
  return announcements
    .filter((announcement) => isAnnouncementVisible(announcement, now))
    .sort((left, right) => {
      if (left.priority !== right.priority) return right.priority - left.priority;
      const leftPublished = (left.publishedAt || left.createdAt)?.toMillis() || 0;
      const rightPublished = (right.publishedAt || right.createdAt)?.toMillis() || 0;
      if (leftPublished !== rightPublished) return rightPublished - leftPublished;
      return left.id.localeCompare(right.id);
    });
}

export function getNextAnnouncementBoundary(
  announcements: VisibilityAnnouncement[],
  now: Date = new Date(),
): number | null {
  const nowMillis = now.getTime();
  let next: number | null = null;
  for (const announcement of announcements) {
    if (announcement.active === false || announcement.archived === true) continue;
    for (const boundary of [announcement.startsAt, announcement.endsAt]) {
      const value = timestampMillis(boundary);
      if (value !== null && value > nowMillis && (next === null || value < next)) {
        next = value;
      }
    }
  }
  return next;
}

export function validateAnnouncementDraft(
  draft: AnnouncementDraft,
): AnnouncementDraftErrors {
  const errors: AnnouncementDraftErrors = {};
  const title = draft.title.trim();
  const detail = draft.detail.trim();
  if (!title) errors.title = "El título es obligatorio.";
  else if (title.length > 100) errors.title = "El título no puede superar 100 caracteres.";
  if (!detail) errors.detail = "El detalle es obligatorio.";
  else if (detail.length > 300) errors.detail = "El detalle no puede superar 300 caracteres.";
  if (!Number.isInteger(draft.priority) || draft.priority < -1000 || draft.priority > 1000) {
    errors.priority = "La prioridad debe ser un entero entre -1000 y 1000.";
  }

  const startsAt = draft.startsAtLocal
    ? parseCostaRicaDateTimeLocal(draft.startsAtLocal)
    : null;
  const endsAt = draft.endsAtLocal
    ? parseCostaRicaDateTimeLocal(draft.endsAtLocal)
    : null;
  if (draft.startsAtLocal && !startsAt) errors.startsAtLocal = "Fecha de inicio inválida.";
  if (draft.endsAtLocal && !endsAt) errors.endsAtLocal = "Fecha de finalización inválida.";
  if (startsAt && endsAt && endsAt.getTime() <= startsAt.getTime()) {
    errors.endsAtLocal = "La finalización debe ser posterior al inicio.";
  }
  return errors;
}

export function draftToTimestamps(draft: AnnouncementDraft): {
  startsAt: Timestamp | null;
  endsAt: Timestamp | null;
} {
  const startsAt = draft.startsAtLocal
    ? parseCostaRicaDateTimeLocal(draft.startsAtLocal)
    : null;
  const endsAt = draft.endsAtLocal
    ? parseCostaRicaDateTimeLocal(draft.endsAtLocal)
    : null;
  return {
    startsAt: startsAt ? Timestamp.fromDate(startsAt) : null,
    endsAt: endsAt ? Timestamp.fromDate(endsAt) : null,
  };
}

export function announcementToDraft(
  announcement?: SystemAnnouncement | null,
): AnnouncementDraft {
  return {
    title: announcement?.title || "",
    detail: announcement?.detail || "",
    type: announcement?.type || "info",
    active: announcement?.active ?? true,
    startsAtLocal: formatCostaRicaDateTimeLocal(announcement?.startsAt),
    endsAtLocal: formatCostaRicaDateTimeLocal(announcement?.endsAt),
    allowDismiss: announcement?.allowDismiss ?? false,
    priority: announcement?.priority ?? 0,
    scope: "global",
    archived: announcement?.archived ?? false,
  };
}

export function buildPublishedAnnouncement(
  announcement: Omit<SystemAnnouncement, "id"> | SystemAnnouncement,
  publishedAt: Timestamp,
): Omit<PublishedSystemAnnouncement, "id"> {
  return {
    title: announcement.title,
    detail: announcement.detail,
    type: announcement.type,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
    allowDismiss: announcement.allowDismiss,
    priority: announcement.priority,
    scope: "global",
    version: announcement.version,
    publishedAt,
  };
}
