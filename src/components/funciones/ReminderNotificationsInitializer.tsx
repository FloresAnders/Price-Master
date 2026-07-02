"use client";

import React from "react";
import { Check } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import { getDefaultPermissions } from "@/utils/permissions";
import { EmpresasService } from "@/services/empresas";
import {
  filterFuncionesGeneralesForEmpresa,
  FuncionesService,
  getFuncionIdLookupKeys,
  lookupGeneralByFuncionId,
} from "@/services/funciones";
import type { Empresas, UserPermissions } from "@/types/firestore";
import { normalizeReminderTimesCr } from "./reminderTimes";
import {
  groupReminderSources,
  type QueuedReminderItem,
  type ReminderSourceItem,
} from "./reminderQueue";

const STORAGE_KEY = "funciones_reminders_fired";

const getCostaRicaNow = (): { timeHHmm: string; dateKey: string } => {
  const now = new Date();

  try {
    const timeHHmm = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Costa_Rica",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(now);

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Costa_Rica",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);

    const year = parts.find((p) => p.type === "year")?.value ?? "";
    const month = parts.find((p) => p.type === "month")?.value ?? "";
    const day = parts.find((p) => p.type === "day")?.value ?? "";
    const dateKey = year && month && day ? `${year}-${month}-${day}` : "";

    return { timeHHmm: String(timeHHmm || "").trim(), dateKey };
  } catch {
    // Fallback: local time if Intl timeZone is not available
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    return { timeHHmm: `${hh}:${mm}`, dateKey };
  }
};

export default function ReminderNotificationsInitializer() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { ownerIds: actorOwnerIds } = useActorOwnership(currentUser);

  const [items, setItems] = React.useState<ReminderSourceItem[]>([]);
  const [queue, setQueue] = React.useState<QueuedReminderItem[]>([]);
  const [active, setActive] = React.useState<QueuedReminderItem | null>(null);
  const [blockRemaining, setBlockRemaining] = React.useState(0);

  const firedRef = React.useRef<{ dateKey: string; set: Set<string> }>({
    dateKey: "",
    set: new Set(),
  });
  const pendingRef = React.useRef<Set<string>>(new Set());
  const lastMinuteRef = React.useRef<string>("");

  const hasNotificacionesPermission = React.useMemo(() => {
    if (!currentUser) return false;
    const perms: UserPermissions = currentUser.permissions
      ? currentUser.permissions
      : getDefaultPermissions(currentUser.role || "user");
    return perms.notificaciones === true;
  }, [currentUser]);

  // Load fired state from localStorage (once).
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        dateKey?: string;
        firedKeys?: string[];
      } | null;
      if (!parsed || typeof parsed !== "object") return;

      const dateKey = typeof parsed.dateKey === "string" ? parsed.dateKey : "";
      const firedKeys = Array.isArray(parsed.firedKeys)
        ? parsed.firedKeys.map(String)
        : [];

      firedRef.current = { dateKey, set: new Set(firedKeys) };
    } catch {
      // ignore
    }
  }, []);

  const persistFired = React.useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = {
        dateKey: firedRef.current.dateKey,
        firedKeys: Array.from(firedRef.current.set.values()),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  const refreshData = React.useCallback(async () => {
    if (!currentUser) return;

    const allEmpresas = await EmpresasService.getAllEmpresas();
    const normalized = Array.isArray(allEmpresas) ? allEmpresas : [];

    const role = String(currentUser.role || "user")
      .trim()
      .toLowerCase();
    let empresas: Empresas[] = [];
    if (role === "superadmin" || role === "admin") {
      empresas = normalized;
    } else if (role === "user") {
      const companyKey = String(currentUser.ownercompanie || "")
        .trim()
        .toLowerCase();
      if (companyKey) {
        empresas = normalized.filter((e) => {
          const name = String(e?.name || "")
            .trim()
            .toLowerCase();
          const ubicacion = String(e?.ubicacion || "")
            .trim()
            .toLowerCase();
          const id = String(e?.id || "")
            .trim()
            .toLowerCase();
          return (
            name === companyKey || ubicacion === companyKey || id === companyKey
          );
        });
      } else {
        const ownerId = String(currentUser.ownerId || "").trim();
        empresas = ownerId
          ? normalized.filter(
              (e) => String(e?.ownerId || "").trim() === ownerId,
            )
          : [];
      }
    } else {
      const allowed = new Set(
        (actorOwnerIds || []).map((id) => String(id)).filter(Boolean),
      );
      if (allowed.size > 0) {
        empresas = normalized.filter(
          (e) => e && e.ownerId && allowed.has(String(e.ownerId)),
        );
      } else {
        const fallbackAllowed = new Set(
          [currentUser.id, currentUser.ownerId]
            .map((x) => String(x || "").trim())
            .filter(Boolean),
        );
        empresas = normalized.filter(
          (e) => e && e.ownerId && fallbackAllowed.has(String(e.ownerId)),
        );
      }
    }

    const generalDocs = await FuncionesService.listFuncionesGeneralesAs({
      ownerIds: (actorOwnerIds || []).map((x) => String(x)),
      role: currentUser.role,
    });

    const nextItems: ReminderSourceItem[] = [];

    await Promise.all(
      empresas
        .map((e) => ({ empresa: e, empresaId: String(e?.id || "").trim() }))
        .filter((x) => x.empresaId)
        .map(async ({ empresa, empresaId }) => {
          const doc = await FuncionesService.getEmpresaFunciones({ empresaId });

          const visibleGeneralDocs = filterFuncionesGeneralesForEmpresa(
            generalDocs as any,
            {
              ownerId: String(empresa?.ownerId || "").trim(),
              empresaId,
            },
          );

          const generalById = new Map<
            string,
            {
              funcionId: string;
              nombre: string;
              descripcion?: string;
              reminderTimeCr?: string;
              reminderTimesCr?: string[];
              blockOnReminder?: boolean;
              blockSeconds?: number;
            }
          >();
          for (const d of visibleGeneralDocs as any[]) {
            const funcionId = String((d as any).funcionId || "").trim();
            const nombre = String((d as any).nombre || "").trim();
            if (!funcionId || !nombre) continue;

            const value = {
              funcionId,
              nombre,
              descripcion: (d as any).descripcion
                ? String((d as any).descripcion).trim()
                : "",
              reminderTimeCr: normalizeReminderTimesCr(d as any)[0] || "",
              reminderTimesCr: normalizeReminderTimesCr(d as any),
              blockOnReminder: (d as any).blockOnReminder === true,
              blockSeconds:
                typeof (d as any).blockSeconds === "number"
                  ? (d as any).blockSeconds
                  : undefined,
            };

            for (const key of getFuncionIdLookupKeys(funcionId)) {
              if (!generalById.has(key)) generalById.set(key, value);
            }
          }

          const funcionesIds: string[] = Array.from(
            new Set(
              (Array.isArray((doc as any)?.funciones)
                ? (doc as any).funciones
                : []
              )
                .map((x: unknown) => String(x).trim())
                .filter(Boolean),
            ),
          );

          for (const funcionId of funcionesIds) {
            const g = lookupGeneralByFuncionId(generalById, funcionId);
            for (const reminderTimeCr of normalizeReminderTimesCr(g as any)) {
              nextItems.push({
                empresaId,
                empresaName: String(empresa?.name || empresaId),
                funcionId,
                funcionNombre: String(g?.nombre || "Función no encontrada"),
                funcionDescripcion:
                  String(g?.descripcion || "").trim() ||
                  (g ? undefined : `ID: ${funcionId}`),
                reminderTimeCr,
                blockOnReminder: g?.blockOnReminder,
                blockSeconds: g?.blockSeconds,
              });
            }
          }
        }),
    );

    setItems(nextItems);
  }, [actorOwnerIds, currentUser]);

  // Refresh reminders list.
  React.useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;
    if (!hasNotificacionesPermission) return;

    let cancelled = false;

    const load = async () => {
      try {
        await refreshData();
      } catch (err) {
        // Silent: this is a background feature.
        console.warn(
          "ReminderNotificationsInitializer: failed to refresh data",
          err,
        );
      }
    };

    void load();
    const interval = window.setInterval(
      () => {
        if (cancelled) return;
        void load();
      },
      5 * 60 * 1000,
    );

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [authLoading, currentUser, hasNotificacionesPermission, refreshData]);

  // Tick every few seconds to catch the matching minute.
  React.useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;
    if (!hasNotificacionesPermission) return;
    if (items.length === 0) return;

    const tick = () => {
      const { timeHHmm, dateKey } = getCostaRicaNow();
      if (!timeHHmm || !dateKey) return;

      // Only evaluate once per minute.
      if (lastMinuteRef.current === `${dateKey} ${timeHHmm}`) return;
      lastMinuteRef.current = `${dateKey} ${timeHHmm}`;

      // Reset daily fired keys.
      if (firedRef.current.dateKey !== dateKey) {
        firedRef.current = { dateKey, set: new Set() };
        pendingRef.current = new Set();
        persistFired();
      }

      const matching = items.filter((it) => it.reminderTimeCr === timeHHmm);
      if (matching.length === 0) return;

      const { queued: nextToEnqueue, pendingKeys } = groupReminderSources({
        dateKey,
        items: matching,
        firedKeys: firedRef.current.set,
        pendingKeys: pendingRef.current,
      });

      for (const key of pendingKeys) {
        pendingRef.current.add(key);
      }

      if (nextToEnqueue.length === 0) return;

      setQueue((prev) => {
        const prevKeys = new Set(prev.map((x) => x.key));
        const merged = [...prev];
        for (const n of nextToEnqueue) {
          if (!prevKeys.has(n.key) && active?.key !== n.key) merged.push(n);
        }
        return merged;
      });
    };

    tick();
    const interval = window.setInterval(tick, 15 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [
    active?.key,
    authLoading,
    currentUser,
    hasNotificacionesPermission,
    items,
    persistFired,
  ]);

  // Promote from queue to active.
  React.useEffect(() => {
    if (active) return;
    if (queue.length === 0) return;
    setActive(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [active, queue]);

  React.useEffect(() => {
    if (!active) {
      setBlockRemaining(0);
      return;
    }

    const seconds =
      active.blockOnReminder === true &&
      Number.isSafeInteger(active.blockSeconds) &&
      Number(active.blockSeconds) > 0
        ? Number(active.blockSeconds)
        : 0;
    setBlockRemaining(seconds);
    if (seconds <= 0) return;

    const interval = window.setInterval(() => {
      setBlockRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [active]);

  const handleDone = React.useCallback(() => {
    if (!active) return;
    if (blockRemaining > 0) return;

    const dateKey = firedRef.current.dateKey;
    if (dateKey) {
      for (const key of active.keys) {
        firedRef.current.set.add(key);
      }
      persistFired();
    }

    for (const key of active.keys) {
      pendingRef.current.delete(key);
    }
    setActive(null);
  }, [active, blockRemaining, persistFired]);

  if (!active) return null;
  const closeBlocked = blockRemaining > 0;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full h-full max-w-5xl max-h-[92vh] bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-2xl p-6 md:p-10 overflow-auto">
        <div className="absolute top-4 right-4 flex items-center gap-2">
          {closeBlocked ? (
            <span className="text-xs font-medium text-[var(--foreground)]">
              Puedes cerrar en: {blockRemaining}s
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleDone}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={closeBlocked}
            aria-label="Listo"
            title={
              closeBlocked ? `Puedes cerrar en: ${blockRemaining}s` : "Listo"
            }
          >
            <Check className="w-4 h-4" />
            <span className="text-xs">Listo</span>
          </button>
        </div>

        <div className="space-y-4">
          <div className="text-sm text-[var(--muted-foreground)]">
            Recordatorio — {active.empresaName}
          </div>
          <div className="space-y-5">
            {active.funciones.map((funcion) => (
              <div key={funcion.funcionId} className="space-y-2">
                <div className="text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight">
                  {funcion.funcionNombre}
                </div>
                {funcion.funcionDescripcion ? (
                  <div className="text-base md:text-lg text-[var(--foreground)] whitespace-pre-wrap">
                    {funcion.funcionDescripcion}
                  </div>
                ) : (
                  <div className="text-base md:text-lg text-[var(--muted-foreground)]">
                    (Sin descripción)
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="pt-4 text-sm text-[var(--muted-foreground)]">
            Hora CR: {active.reminderTimeCr}
            {queue.length > 0 ? ` · Pendientes: ${queue.length}` : ""}
          </div>
        </div>
      </div>
    </div>
  );
}
