'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useActorOwnership } from '@/hooks/useActorOwnership';
import { getDefaultPermissions } from '@/utils/permissions';
import { EmpresasService } from '@/services/empresas';
import { FuncionesService } from '@/services/funciones';
import type { Empresas, UserPermissions } from '@/types/firestore';

type EmpresaFuncionesResolved = {
  empresa: Empresas;
  apertura: Array<{ funcionId: string; nombre: string; descripcion?: string; reminderTimeCr?: string }>;
  cierre: Array<{ funcionId: string; nombre: string; descripcion?: string; reminderTimeCr?: string }>;
};

export function FuncionesTab() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const { ownerIds: actorOwnerIds } = useActorOwnership(currentUser);

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<EmpresaFuncionesResolved[]>([]);

  const hasNotificacionesPermission = React.useMemo(() => {
    if (!currentUser) return false;
    const perms: UserPermissions = currentUser.permissions
      ? currentUser.permissions
      : getDefaultPermissions(currentUser.role || 'user');
    return perms.notificaciones === true;
  }, [currentUser]);

  React.useEffect(() => {
    if (authLoading) return;
    if (!currentUser) return;
    if (!hasNotificacionesPermission) return;

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
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

        empresas.sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''), 'es'));

        const generalDocs = await FuncionesService.listFuncionesGeneralesAs({
          ownerIds: (actorOwnerIds || []).map((x) => String(x)),
          role: currentUser.role,
        });

        const generalById = new Map(
          generalDocs
            .map((d) => ({
              funcionId: String(d.funcionId || '').trim(),
              nombre: String(d.nombre || '').trim(),
              descripcion: d.descripcion ? String(d.descripcion).trim() : '',
              reminderTimeCr: d.reminderTimeCr ? String(d.reminderTimeCr).trim() : '',
            }))
            .filter((x) => x.funcionId && x.nombre)
            .map((x) => [x.funcionId, x] as const)
        );

        const resolved = await Promise.all(
          empresas.map(async (empresa) => {
            const empresaId = String(empresa?.id || '').trim();
            if (!empresaId) {
              return null;
            }

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

            const mapIds = (ids: string[]) =>
              ids
                .map((funcionId) => {
                  const g = generalById.get(funcionId);
                  return {
                    funcionId,
                    nombre: g?.nombre || funcionId,
                    descripcion: String(g?.descripcion || '').trim() || undefined,
                    reminderTimeCr: g?.reminderTimeCr ? g.reminderTimeCr : undefined,
                  };
                })
                .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

            return {
              empresa,
              apertura: mapIds(aperturaIds),
              cierre: mapIds(cierreIds),
            } satisfies EmpresaFuncionesResolved;
          })
        );

        if (cancelled) return;
        setData(resolved.filter(Boolean) as EmpresaFuncionesResolved[]);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'No se pudieron cargar las funciones por empresa.';
        setError(msg);
        setData([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [actorOwnerIds, authLoading, currentUser, hasNotificacionesPermission]);

  if (authLoading) {
    return (
      <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-[var(--muted-foreground)]">Cargando…</div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-[var(--muted-foreground)]">Debes iniciar sesión.</div>
      </div>
    );
  }

  if (!hasNotificacionesPermission) {
    return (
      <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
        <div className="text-[var(--muted-foreground)]">No tienes permiso para ver Funciones.</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-4">
      <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-[var(--foreground)]">Funciones</h2>
        <p className="text-sm text-[var(--muted-foreground)]">
          Funciones asignadas por empresa (Apertura / Cierre)
        </p>
      </div>

      <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-6">
        {loading ? (
          <div className="text-[var(--muted-foreground)]">Cargando funciones…</div>
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : data.length === 0 ? (
          <div className="text-[var(--muted-foreground)]">No hay empresas disponibles.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {data.map((row) => (
              <div
                key={String(row.empresa.id)}
                className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-base font-semibold text-[var(--foreground)]">{row.empresa.name}</div>
                    {row.empresa.ubicacion ? (
                      <div className="text-xs text-[var(--muted-foreground)]">{row.empresa.ubicacion}</div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border border-[var(--input-border)] rounded-lg p-3">
                    <div className="text-sm font-semibold text-[var(--foreground)] mb-2">Turno de apertura</div>
                    {row.apertura.length === 0 ? (
                      <div className="text-sm text-[var(--muted-foreground)]">Sin funciones asignadas.</div>
                    ) : (
                      <ul className="divide-y divide-[var(--input-border)]">
                        {row.apertura.map((f) => (
                          <li key={`a-${f.funcionId}`} className="py-2 text-sm text-[var(--foreground)] flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate">{f.nombre}</div>
                              {f.descripcion ? (
                                <div className="text-xs text-[var(--muted-foreground)] leading-snug break-words">
                                  {f.descripcion}
                                </div>
                              ) : null}
                            </div>
                            {f.reminderTimeCr ? (
                              <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                                {f.reminderTimeCr}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="border border-[var(--input-border)] rounded-lg p-3">
                    <div className="text-sm font-semibold text-[var(--foreground)] mb-2">Turno de cierre</div>
                    {row.cierre.length === 0 ? (
                      <div className="text-sm text-[var(--muted-foreground)]">Sin funciones asignadas.</div>
                    ) : (
                      <ul className="divide-y divide-[var(--input-border)]">
                        {row.cierre.map((f) => (
                          <li key={`c-${f.funcionId}`} className="py-2 text-sm text-[var(--foreground)] flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate">{f.nombre}</div>
                              {f.descripcion ? (
                                <div className="text-xs text-[var(--muted-foreground)] leading-snug break-words">
                                  {f.descripcion}
                                </div>
                              ) : null}
                            </div>
                            {f.reminderTimeCr ? (
                              <span className="text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                                {f.reminderTimeCr}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
