import {
  addDoc,
  collection,
  doc,
  limitToLast,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  type FirestoreError,
  type Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { EmpresasService } from "@/services/empresas";
import { SchedulesService } from "@/services/schedules";
import { resolveManagerFromControlHorario } from "@/utils/controlHorarioManager";
import type { Empresas, User } from "@/types/firestore";

export type OwnerChatMessage = {
  id: string;
  ownerId: string;
  senderId: string;
  senderName: string;
  senderRole: User["role"];
  senderScheduleCompany?: string;
  senderScheduleManager?: string;
  text: string;
  createdAt: Timestamp | null;
};

export type OwnerChatScheduleInfo = {
  company: string;
  manager: string;
};

export type OwnerChatReadState = {
  lastReadAt: Timestamp | null;
  muted: boolean;
};

type OwnerChatCostaRicaParts = {
  year: number;
  month0: number;
  day: number;
  hour: number;
};

const ROOT_COLLECTION = "ownerChats";
const MESSAGES_SUBCOLLECTION = "messages";
const READS_SUBCOLLECTION = "reads";
const DEFAULT_LIMIT = 50;
const MAX_MESSAGE_LENGTH = 2000;
const MAX_COMPANY_NAME_LENGTH = 160;
const MAX_MANAGER_NAME_LENGTH = 120;

function normalizeId(value: unknown): string {
  return String(value || "").trim();
}

function sameText(left: unknown, right: unknown): boolean {
  const safeLeft = normalizeId(left).toLowerCase();
  const safeRight = normalizeId(right).toLowerCase();
  return Boolean(safeLeft && safeRight && safeLeft === safeRight);
}

function getEmpresaScheduleKeys(empresa: Empresas): string[] {
  return [empresa.ubicacion, empresa.name, empresa.id]
    .map(normalizeId)
    .filter(Boolean);
}

function getCostaRicaParts(date: Date): OwnerChatCostaRicaParts | null {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Costa_Rica",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const getPart = (type: string) =>
    parts.find((part) => part.type === type)?.value;
  const year = Number(getPart("year"));
  const month1 = Number(getPart("month"));
  const day = Number(getPart("day"));
  const hour = Number(getPart("hour"));

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month1) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour)
  ) {
    return null;
  }

  return { year, month0: Math.max(0, Math.min(11, month1 - 1)), day, hour };
}

async function resolveScheduleCompany(user: User): Promise<{
  keys: string[];
  company: string;
  empresa: Empresas | null;
}> {
  const assignedCompany = normalizeId(user.ownercompanie);
  const ownerId = normalizeId(user.ownerId);
  const keys = new Set<string>();
  if (assignedCompany) keys.add(assignedCompany);

  try {
    const empresas = await EmpresasService.getAllEmpresas();
    const exactMatches = assignedCompany
      ? empresas.filter((empresa) =>
          getEmpresaScheduleKeys(empresa).some((key) =>
            sameText(key, assignedCompany),
          ),
        )
      : [];
    const ownerMatches = ownerId
      ? empresas.filter((empresa) => sameText(empresa.ownerId, ownerId))
      : [];
    const selected =
      exactMatches[0] ||
      (!assignedCompany && ownerMatches.length === 1 ? ownerMatches[0] : null);

    if (selected) {
      getEmpresaScheduleKeys(selected).forEach((key) => keys.add(key));
      return {
        keys: Array.from(keys),
        company:
          normalizeId(selected.ubicacion) ||
          normalizeId(selected.name) ||
          assignedCompany ||
          normalizeId(selected.id),
        empresa: selected,
      };
    }
  } catch (error) {
    console.warn("Error resolving chat schedule company:", error);
  }

  return { keys: Array.from(keys), company: assignedCompany, empresa: null };
}

export async function resolveOwnerChatSenderSchedule(
  user: User,
  referenceDate = new Date(),
): Promise<OwnerChatScheduleInfo | null> {
  if (user.role !== "user") return null;

  const parts = getCostaRicaParts(referenceDate);
  if (!parts) return null;

  const { keys, company, empresa } = await resolveScheduleCompany(user);
  if (!empresa || keys.length === 0) return null;

  try {
    const scheduleLists = await Promise.all(
      keys.map((key) =>
        SchedulesService.getSchedulesByLocationYearMonth(
          key,
          parts.year,
          parts.month0,
        ).catch(() => []),
      ),
    );
    const resolution = resolveManagerFromControlHorario({
      nowISO: referenceDate.toISOString(),
      empresa,
      monthSchedules: scheduleLists.flat(),
    });

    if (resolution.mode !== "auto") return null;

    const manager = normalizeId(resolution.manager).slice(
      0,
      MAX_MANAGER_NAME_LENGTH,
    );

    return manager
      ? {
          company: company.slice(0, MAX_COMPANY_NAME_LENGTH),
          manager,
        }
      : null;
  } catch (error) {
    console.warn("Error resolving chat schedule manager:", error);
    return null;
  }
}

export function getEffectiveOwnerChatId(user: User | null): string {
  if (!user) return "";
  if (user.role === "superadmin") return "";

  const userId = normalizeId(user.id);
  const ownerId = normalizeId(user.ownerId);

  if (user.role === "admin" && user.eliminate === false) {
    return userId || ownerId;
  }

  return ownerId || userId;
}

export function normalizeChatText(text: string): string {
  return text.replace(/\s+\n/g, "\n").trim().slice(0, MAX_MESSAGE_LENGTH);
}

export function subscribeOwnerChatMessages(
  ownerId: string,
  callback: (messages: OwnerChatMessage[]) => void,
  onError?: (error: FirestoreError) => void,
  messageLimit = DEFAULT_LIMIT,
): Unsubscribe {
  const safeOwnerId = normalizeId(ownerId);
  if (!safeOwnerId) return () => {};

  const messagesRef = collection(
    db,
    ROOT_COLLECTION,
    safeOwnerId,
    MESSAGES_SUBCOLLECTION,
  );
  const messagesQuery = query(
    messagesRef,
    orderBy("createdAt", "asc"),
    limitToLast(Math.max(1, Math.trunc(messageLimit))),
  );

  return onSnapshot(
    messagesQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((messageDoc) => {
          const data = messageDoc.data();
          return {
            id: messageDoc.id,
            ownerId: normalizeId(data.ownerId),
            senderId: normalizeId(data.senderId),
            senderName: normalizeId(data.senderName) || "Usuario",
            senderRole: data.senderRole,
            senderScheduleCompany: normalizeId(data.senderScheduleCompany) || undefined,
            senderScheduleManager: normalizeId(data.senderScheduleManager) || undefined,
            text: String(data.text || ""),
            createdAt: data.createdAt || null,
          };
        }),
      );
    },
    onError,
  );
}

export async function sendOwnerChatMessage(
  ownerId: string,
  user: User,
  rawText: string,
): Promise<void> {
  const safeOwnerId = normalizeId(ownerId);
  const senderId = normalizeId(user.id);
  const text = normalizeChatText(rawText);

  if (!safeOwnerId || !senderId || !text) return;

  const schedule = await resolveOwnerChatSenderSchedule(user);

  await addDoc(
    collection(db, ROOT_COLLECTION, safeOwnerId, MESSAGES_SUBCOLLECTION),
    {
      ownerId: safeOwnerId,
      senderId,
      senderName: normalizeId(user.fullName) || normalizeId(user.name),
      senderRole: user.role || "user",
      ...(schedule
        ? {
            senderScheduleCompany: schedule.company,
            senderScheduleManager: schedule.manager,
          }
        : {}),
      text,
      createdAt: serverTimestamp(),
    },
  );
}

export function subscribeOwnerChatReadState(
  ownerId: string,
  userId: string,
  callback: (state: OwnerChatReadState) => void,
  onError?: (error: FirestoreError) => void,
): Unsubscribe {
  const safeOwnerId = normalizeId(ownerId);
  const safeUserId = normalizeId(userId);
  if (!safeOwnerId || !safeUserId) return () => {};

  const readRef = doc(
    db,
    ROOT_COLLECTION,
    safeOwnerId,
    READS_SUBCOLLECTION,
    safeUserId,
  );

  return onSnapshot(
    readRef,
    (snapshot) => {
      const data = snapshot.data();
      callback({
        lastReadAt: data?.lastReadAt || null,
        muted: data?.muted === true,
      });
    },
    onError,
  );
}

export async function markOwnerChatRead(
  ownerId: string,
  user: User,
): Promise<void> {
  const safeOwnerId = normalizeId(ownerId);
  const safeUserId = normalizeId(user.id);
  if (!safeOwnerId || !safeUserId) return;

  await setDoc(
    doc(db, ROOT_COLLECTION, safeOwnerId, READS_SUBCOLLECTION, safeUserId),
    {
      ownerId: safeOwnerId,
      userId: safeUserId,
      userName: normalizeId(user.fullName) || normalizeId(user.name),
      lastReadAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function setOwnerChatMuted(
  ownerId: string,
  user: User,
  muted: boolean,
): Promise<void> {
  const safeOwnerId = normalizeId(ownerId);
  const safeUserId = normalizeId(user.id);
  if (!safeOwnerId || !safeUserId) return;

  await setDoc(
    doc(db, ROOT_COLLECTION, safeOwnerId, READS_SUBCOLLECTION, safeUserId),
    {
      ownerId: safeOwnerId,
      userId: safeUserId,
      userName: normalizeId(user.fullName) || normalizeId(user.name),
      muted,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
