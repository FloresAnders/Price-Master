"use client";

import { useEffect, useMemo, useRef } from "react";
import { Banknote, Building2, Phone, ReceiptText, X } from "lucide-react";
import { toast } from "sonner";
import { getApps, initializeApp } from "firebase/app";
import {
  getAuth,
  inMemoryPersistence,
  setPersistence,
  signInWithCustomToken,
  signOut,
  type Auth,
} from "firebase/auth";
import {
  collection,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
} from "firebase/firestore";
import { firebaseConfig, firestoreDatabaseId } from "@/config/firebase";
import { useAuth } from "@/hooks/useAuth";
import { normalizeUserPermissions } from "@/utils/permissions";

const STORAGE_KEY = "timemaster_seen_sinpe_events_v1";
const REPLAY_WINDOW_MS = 2 * 60 * 1000;
const MAX_SEEN_EVENTS = 200;
const REALTIME_REFRESH_MS = 45 * 60 * 1000;
const REALTIME_FIREBASE_APP_NAME = "sinpe-realtime";
let persistenceReady: Promise<void> | null = null;

const ensureInMemoryAuth = (auth: Auth) => {
  if (!persistenceReady) {
    persistenceReady = setPersistence(auth, inMemoryPersistence).catch(
      (error) => {
        persistenceReady = null;
        throw error;
      },
    );
  }
  return persistenceReady;
};

type SinpeRealtimeEvent = {
  id: string;
  empresaId: string;
  empresaName: string;
  reference: string;
  amount: number;
  customerName: string;
  phone: string;
  bank: string;
  reason: string;
  date: string;
  time: string;
  receivedAt?: Timestamp;
};

const readSeenEvents = (storageKey: string) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
};

const persistSeenEvents = (storageKey: string, seen: Set<string>) => {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify([...seen].slice(-MAX_SEEN_EVENTS)),
    );
  } catch {
    // Notifications remain functional when browser storage is unavailable.
  }
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(amount);

function SinpeNotificationCard({
  event,
  toastId,
}: {
  event: SinpeRealtimeEvent;
  toastId: string | number;
}) {
  return (
    <section
      aria-label={`Nuevo SINPE por ${formatAmount(event.amount)}`}
      className="w-[min(92vw,390px)] overflow-hidden rounded-2xl border border-emerald-300/25 bg-[#071520]/95 text-white shadow-2xl shadow-black/45 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/10 bg-emerald-400/10 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <Banknote className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
              Nuevo SINPE
            </p>
            <p className="truncate text-xs text-white/55">{event.empresaName}</p>
          </div>
        </div>
        <button
          type="button"
          aria-label="Cerrar notificación SINPE"
          onClick={() => toast.dismiss(toastId)}
          className="rounded-lg p-1.5 text-white/55 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <p className="text-3xl font-black tracking-tight text-emerald-300">
          {formatAmount(event.amount)}
        </p>
        <div>
          <p className="text-lg font-semibold leading-tight">
            {event.customerName || "Cliente SINPE"}
          </p>
          <p className="mt-1 text-sm text-white/70">
            Ref: {event.reference || "No indicada"}
          </p>
        </div>

        <div className="grid gap-2 text-sm text-white/70">
          {event.phone && (
            <p className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-emerald-300/80" aria-hidden="true" />
              {event.phone}
            </p>
          )}
          {event.bank && (
            <p className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-300/80" aria-hidden="true" />
              {event.bank}
            </p>
          )}
          {event.reason && (
            <p className="flex items-start gap-2">
              <ReceiptText className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300/80" aria-hidden="true" />
              <span>{event.reason}</span>
            </p>
          )}
        </div>
        <p className="text-right text-xs text-white/45">
          {[event.date, event.time].filter(Boolean).join(" · ")}
        </p>
      </div>
    </section>
  );
}

export default function SinpeNotificationsInitializer() {
  const { user, loading } = useAuth();
  const seenRef = useRef<Set<string>>(new Set());
  const permissions = useMemo(
    () => normalizeUserPermissions(user?.permissions, user?.role || "user"),
    [user],
  );
  const seenStorageKey = `${STORAGE_KEY}:${user?.id || "anonymous"}`;

  useEffect(() => {
    seenRef.current = readSeenEvents(seenStorageKey);
  }, [seenStorageKey]);

  useEffect(() => {
    if (loading || !user || permissions.reportessinpe !== true) return;
    let cancelled = false;
    let unsubscribers: Array<() => void> = [];
    const realtimeApp =
      getApps().find((app) => app.name === REALTIME_FIREBASE_APP_NAME) ||
      initializeApp(firebaseConfig, REALTIME_FIREBASE_APP_NAME);
    const realtimeAuth = getAuth(realtimeApp);
    const realtimeDb =
      firestoreDatabaseId === "(default)"
        ? getFirestore(realtimeApp)
        : getFirestore(realtimeApp, firestoreDatabaseId);

    const connect = async () => {
      const response = await fetch("/api/gmail/realtime", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        token?: string;
        empresas?: Array<{ id?: string; name?: string }>;
      } | null;
      if (!response.ok || !payload?.token) {
        throw new Error("SINPE realtime authorization failed.");
      }
      await ensureInMemoryAuth(realtimeAuth);
      await signInWithCustomToken(realtimeAuth, payload.token);
      if (cancelled) {
        await signOut(realtimeAuth).catch(() => undefined);
        return;
      }

      const nextUnsubscribers: Array<() => void> = [];
      const listenFrom = Timestamp.fromMillis(Date.now() - REPLAY_WINDOW_MS);
      for (const empresa of payload.empresas || []) {
        const empresaId = String(empresa.id || "").trim();
        if (!empresaId) continue;
        const eventsQuery = query(
          collection(realtimeDb, "sinpeEvents", empresaId, "events"),
          where("createdAt", ">=", listenFrom),
          orderBy("createdAt", "asc"),
          limit(25),
        );
        nextUnsubscribers.push(
          onSnapshot(
            eventsQuery,
            (snapshot) => {
              for (const change of snapshot.docChanges()) {
                if (change.type !== "added") continue;
                const seenKey = `${empresaId}:${change.doc.id}`;
                if (seenRef.current.has(seenKey)) continue;
                seenRef.current.add(seenKey);
                persistSeenEvents(seenStorageKey, seenRef.current);
                const event: SinpeRealtimeEvent = {
                  id: change.doc.id,
                  ...(change.doc.data() as Omit<SinpeRealtimeEvent, "id">),
                };
                toast.custom(
                  (toastId) => (
                    <SinpeNotificationCard event={event} toastId={toastId} />
                  ),
                  { duration: 12_000 },
                );
              }
            },
            (error) => {
              console.warn(
                `[sinpe-realtime] listener unavailable for company ${empresaId}`,
                error.code,
              );
            },
          ),
        );
      }
      if (cancelled) {
        for (const unsubscribe of nextUnsubscribers) unsubscribe();
        await signOut(realtimeAuth).catch(() => undefined);
        return;
      }
      const previousUnsubscribers = unsubscribers;
      unsubscribers = nextUnsubscribers;
      for (const unsubscribe of previousUnsubscribers) unsubscribe();
    };

    const start = () => {
      void connect().catch(() => {
        console.warn("[sinpe-realtime] company access could not be resolved");
      });
    };
    start();
    const refreshInterval = window.setInterval(start, REALTIME_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(refreshInterval);
      for (const unsubscribe of unsubscribers) unsubscribe();
      void signOut(realtimeAuth).catch(() => undefined);
    };
  }, [loading, permissions.reportessinpe, seenStorageKey, user?.id]);

  return null;
}
