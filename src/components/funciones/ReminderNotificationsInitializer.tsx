'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActorOwnership } from '@/hooks/useActorOwnership';
import useToast from '@/hooks/useToast';
import { getDefaultPermissions } from '@/utils/permissions';
import { EmpresasService } from '@/services/empresas';
import { FuncionesService } from '@/services/funciones';
import type { Empresas, UserPermissions } from '@/types/firestore';

type ReminderItem = {
  empresaId: string;
  empresaName: string;
  turno: 'apertura' | 'cierre';
  funcionId: string;
  funcionNombre: string;
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
  const { showToast } = useToast();

  const [items, setItems] = React.useState<ReminderItem[]>([]);

  const firedRef = React.useRef<{ dateKey: string; set: Set<string> }>({ dateKey: '', set: new Set() });
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

    const generalById = new Map(
      generalDocs
        .map((d) => ({
          funcionId: String(d.funcionId || '').trim(),
          nombre: String(d.nombre || '').trim(),
          reminderTimeCr: d.reminderTimeCr ? String(d.reminderTimeCr).trim() : '',
        }))
        .filter((x) => x.funcionId && x.nombre)
        .map((x) => [x.funcionId, x] as const)
    );

    const nextItems: ReminderItem[] = [];

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
              const g = generalById.get(funcionId);
              const reminderTimeCr = String(g?.reminderTimeCr || '').trim();
              if (!reminderTimeCr) continue;

              nextItems.push({
                empresaId,
                empresaName: String(empresa?.name || empresaId),
                turno,
                funcionId,
                funcionNombre: String(g?.nombre || funcionId),
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
        persistFired();
      }

      const matching = items.filter((it) => it.reminderTimeCr === timeHHmm);
      if (matching.length === 0) return;

      for (const it of matching) {
        const key = `${dateKey}|${it.empresaId}|${it.turno}|${it.funcionId}|${it.reminderTimeCr}`;
        if (firedRef.current.set.has(key)) continue;
        firedRef.current.set.add(key);

        showToast(
          `Recordatorio (${it.turno === 'apertura' ? 'Apertura' : 'Cierre'}): ${it.funcionNombre} — ${it.empresaName}`,
          'info'
        );
      }

      persistFired();
    };

    tick();
    const interval = window.setInterval(tick, 15 * 1000);

    return () => {
      window.clearInterval(interval);
    };
  }, [authLoading, currentUser, hasNotificacionesPermission, items, persistFired, showToast]);

  return null;
}
