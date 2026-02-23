'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useActorOwnership } from '@/hooks/useActorOwnership';
import { getDefaultPermissions } from '@/utils/permissions';
import { EmpresasService } from '@/services/empresas';
import { FuncionesService, getFuncionIdLookupKeys, lookupGeneralByFuncionId } from '@/services/funciones';
import type { Empresas, UserPermissions } from '@/types/firestore';

type ReminderItem = {
  key: string; // unique per day
  empresaId: string;
  empresaName: string;
  turno: 'apertura' | 'cierre';
  funcionId: string;
  funcionNombre: string;
  funcionDescripcion?: string;
  reminderTimeCr: string; // HH:mm
};

const STORAGE_KEY = 'funciones_reminders_fired';

const getCostaRicaNow = (): { timeHHmm: string; dateKey: string } => {
  const now = new Date();

  try {
    const timeHHmm = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Costa_Rica',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Costa_Rica',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);

    const year = parts.find((p) => p.type === 'year')?.value ?? '';
    const month = parts.find((p) => p.type === 'month')?.value ?? '';
    const day = parts.find((p) => p.type === 'day')?.value ?? '';
    const dateKey = year && month && day ? `${year}-${month}-${day}` : '';

    return { timeHHmm: String(timeHHmm || '').trim(), dateKey };
  } catch {
    // Fallback: local time if Intl timeZone is not available
    const hh = String(now.getHours()).padStart(2, '0');
    const mm = String(now.getMinutes()).padStart(2, '0');
    const dateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    return { timeHHmm: `${hh}:${mm}`, dateKey };
  }
};

export default function ReminderNotificationsInitializer() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { ownerIds: actorOwnerIds } = useActorOwnership(currentUser);

  const [items, setItems] = React.useState<Array<Omit<ReminderItem, 'key'>>>([]);
  const [queue, setQueue] = React.useState<ReminderItem[]>([]);
  const [active, setActive] = React.useState<ReminderItem | null>(null);

  const firedRef = React.useRef<{ dateKey: string; set: Set<string> }>({ dateKey: '', set: new Set() });
  const pendingRef = React.useRef<Set<string>>(new Set());
  const lastMinuteRef = React.useRef<string>('');

  const hasNotificacionesPermission = React.useMemo(() => {
    if (!currentUser) return false;
    const perms: UserPermissions = currentUser.permissions
      ? currentUser.permissions
      : getDefaultPermissions(currentUser.role || 'user');
    return perms.notificaciones === true;
  }, [currentUser]);

  // Load fired state from localStorage (once).
  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { dateKey?: string; firedKeys?: string[] } | null;
      if (!parsed || typeof parsed !== 'object') return;

      const dateKey = typeof parsed.dateKey === 'string' ? parsed.dateKey : '';
      const firedKeys = Array.isArray(parsed.firedKeys) ? parsed.firedKeys.map(String) : [];

      firedRef.current = { dateKey, set: new Set(firedKeys) };
    } catch {
      // ignore
    }
  }, []);

  const persistFired = React.useCallback(() => {
    if (typeof window === 'undefined') return;
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

    const role = currentUser.role || 'user';
    let empresas: Empresas[] = [];
    if (role === 'superadmin') {
      empresas = normalized;
    } else if (role === 'user') {
      const companyKey = String(currentUser.ownercompanie || '').trim().toLowerCase();
      if (companyKey) {
        empresas = normalized.filter((e) => {
          const name = String(e?.name || '').trim().toLowerCase();
          const ubicacion = String(e?.ubicacion || '').trim().toLowerCase();
          const id = String(e?.id || '').trim().toLowerCase();
          return name === companyKey || ubicacion === companyKey || id === companyKey;
        });
      } else {
        const ownerId = String(currentUser.ownerId || '').trim();
        empresas = ownerId
          ? normalized.filter((e) => String(e?.ownerId || '').trim() === ownerId)
          : [];
      }
    } else {
      const allowed = new Set((actorOwnerIds || []).map((id) => String(id)).filter(Boolean));
      if (allowed.size > 0) {
        empresas = normalized.filter((e) => e && e.ownerId && allowed.has(String(e.ownerId)));
      } else {
        const fallbackAllowed = new Set([currentUser.id, currentUser.ownerId].map((x) => String(x || '').trim()).filter(Boolean));
        empresas = normalized.filter((e) => e && e.ownerId && fallbackAllowed.has(String(e.ownerId)));
      }
    }

    const generalDocs = await FuncionesService.listFuncionesGeneralesAs({
      ownerIds: (actorOwnerIds || []).map((x) => String(x)),
      role: currentUser.role,
    });

    const generalById = new Map<string, { funcionId: string; nombre: string; descripcion?: string; reminderTimeCr?: string }>();
    for (const d of generalDocs) {
      const funcionId = String(d.funcionId || '').trim();
      const nombre = String(d.nombre || '').trim();
      if (!funcionId || !nombre) continue;

      const value = {
        funcionId,
        nombre,
        descripcion: d.descripcion ? String(d.descripcion).trim() : '',
        reminderTimeCr: d.reminderTimeCr ? String(d.reminderTimeCr).trim() : '',
      };

      for (const key of getFuncionIdLookupKeys(funcionId)) {
        if (!generalById.has(key)) generalById.set(key, value);
      }
    }

    const nextItems: Array<Omit<ReminderItem, 'key'>> = [];

    await Promise.all(
      empresas
        .map((e) => ({ empresa: e, empresaId: String(e?.id || '').trim() }))
        .filter((x) => x.empresaId)
        .map(async ({ empresa, empresaId }) => {
          const doc = await FuncionesService.getEmpresaFunciones({ empresaId });

          const aperturaIds = Array.from(
            new Set(
              (Array.isArray(doc?.funcionesApertura) ? doc!.funcionesApertura! : (Array.isArray(doc?.funciones) ? doc!.funciones! : []))
                .map((x) => String(x).trim())
                .filter(Boolean)
            )
          );

          const cierreIds = Array.from(
            new Set(
              (Array.isArray(doc?.funcionesCierre) ? doc!.funcionesCierre! : [])
                .map((x) => String(x).trim())
                .filter(Boolean)
            )
          );

          const pushItems = (turno: 'apertura' | 'cierre', funcionIds: string[]) => {
            for (const funcionId of funcionIds) {
              const g = lookupGeneralByFuncionId(generalById, funcionId);
              const reminderTimeCr = String(g?.reminderTimeCr || '').trim();
              if (!reminderTimeCr) continue;

              nextItems.push({
                empresaId,
                empresaName: String(empresa?.name || empresaId),
                turno,
                funcionId,
                funcionNombre: String(g?.nombre || 'Función no encontrada'),
                funcionDescripcion:
                  String(g?.descripcion || '').trim() || (g ? undefined : `ID: ${funcionId}`),
                reminderTimeCr,
              });
            }
          };

          pushItems('apertura', aperturaIds);
          pushItems('cierre', cierreIds);
        })
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
        console.warn('ReminderNotificationsInitializer: failed to refresh data', err);
      }
    };

    void load();
    const interval = window.setInterval(() => {
      if (cancelled) return;
      void load();
    }, 5 * 60 * 1000);

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

      const nextToEnqueue: ReminderItem[] = [];
      for (const it of matching) {
        const key = `${dateKey}|${it.empresaId}|${it.turno}|${it.funcionId}|${it.reminderTimeCr}`;
        if (firedRef.current.set.has(key)) continue;
        if (pendingRef.current.has(key)) continue;
        pendingRef.current.add(key);
        nextToEnqueue.push({ key, ...it });
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
  }, [active?.key, authLoading, currentUser, hasNotificacionesPermission, items, persistFired]);

  // Promote from queue to active.
  React.useEffect(() => {
    if (active) return;
    if (queue.length === 0) return;
    setActive(queue[0]);
    setQueue((prev) => prev.slice(1));
  }, [active, queue]);

  const handleDone = React.useCallback(() => {
    if (!active) return;

    const dateKey = firedRef.current.dateKey;
    if (dateKey) {
      firedRef.current.set.add(active.key);
      persistFired();
    }

    pendingRef.current.delete(active.key);
    setActive(null);
  }, [active, persistFired]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full h-full max-w-5xl max-h-[92vh] bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-2xl p-6 md:p-10 overflow-auto">
        <button
          type="button"
          onClick={handleDone}
          className="absolute top-4 right-4 inline-flex items-center gap-2 rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] hover:opacity-90"
          aria-label="Listo"
          title="Listo"
        >
          <Check className="w-4 h-4" />
          <span className="text-xs">Listo</span>
        </button>

        <div className="space-y-4">
          <div className="text-sm text-[var(--muted-foreground)]">
            Recordatorio {active.turno === 'apertura' ? 'de Apertura' : 'de Cierre'} — {active.empresaName}
          </div>
          <div className="text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight">
            {active.funcionNombre}
          </div>
          {active.funcionDescripcion ? (
            <div className="text-base md:text-lg text-[var(--foreground)] whitespace-pre-wrap">
              {active.funcionDescripcion}
            </div>
          ) : (
            <div className="text-base md:text-lg text-[var(--muted-foreground)]">
              (Sin descripción)
            </div>
          )}

          <div className="pt-4 text-sm text-[var(--muted-foreground)]">
            Hora CR: {active.reminderTimeCr}
            {queue.length > 0 ? ` · Pendientes: ${queue.length}` : ''}
          </div>
        </div>
      </div>
    </div>
  );
}
