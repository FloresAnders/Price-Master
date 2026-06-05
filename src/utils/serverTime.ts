import {
  doc,
  getDocFromServer,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/config/firebase";

let cachedServerTime: Date | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 15_000;

function cacheClockMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let id: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        id = setTimeout(
          () => reject(new Error("No se pudo validar la hora del servidor")),
          ms,
        );
      }),
    ]);
  } finally {
    if (id) clearTimeout(id);
  }
}

async function fromFirestore(): Promise<Date | null> {
  try {
    const ref = doc(db, "_serverTime", "now");
    await withTimeout(
      setDoc(ref, { now: serverTimestamp() }, { merge: true }),
      5000,
    );
    const snap = await withTimeout(getDocFromServer(ref), 5000);
    const ts = snap.data()?.now as Timestamp | undefined;
    const serverDate = ts?.toDate?.();
    if (!serverDate || Number.isNaN(serverDate.getTime())) return null;
    return serverDate;
  } catch {
    return null;
  }
}

export async function getAuthoritativeNow(): Promise<Date> {
  const now = cacheClockMs();
  if (cachedServerTime && now - cachedAt < CACHE_TTL_MS) {
    return new Date(cachedServerTime.getTime() + Math.max(0, now - cachedAt));
  }

  const serverDate = await fromFirestore();
  if (serverDate) {
    cachedServerTime = serverDate;
    cachedAt = cacheClockMs();
    return new Date(serverDate.getTime());
  }

  throw new Error("No se pudo validar la hora del servidor");
}

export async function getAuthoritativeNowISO(): Promise<string> {
  const d = await getAuthoritativeNow();
  return d.toISOString();
}

export async function getAuthoritativeNowMs(): Promise<number> {
  const d = await getAuthoritativeNow();
  return d.getTime();
}
