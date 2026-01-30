'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Users, Lock as LockIcon, Building2, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useActorOwnership } from '../../hooks/useActorOwnership';
import { hasPermission } from '../../utils/permissions';
import { EmpresasService } from '../../services/empresas';
import type { Empresas, EmpresaEmpleado } from '../../types/firestore';

type EmpresaOption = {
  key: string;
  label: string;
};

function normalizeStr(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function getEmpresaKey(e: Partial<Empresas>) {
  const id = String(e.id ?? '').trim();
  const ubic = String(e.ubicacion ?? '').trim();
  const name = String(e.name ?? '').trim();
  return [id || 'no-id', ubic || name || 'no-name'].join('::');
}

function getEmpresaLabel(e: Partial<Empresas>) {
  const name = String(e.name ?? '').trim();
  const ubic = String(e.ubicacion ?? '').trim();
  if (name && ubic && normalizeStr(name) !== normalizeStr(ubic)) return `${name} (${ubic})`;
  return name || ubic || String(e.id ?? 'Empresa');
}

function matchEmpresaByCompanyKey(e: Partial<Empresas>, companyKey: string) {
  const key = normalizeStr(companyKey);
  if (!key) return false;
  const name = normalizeStr(e.name);
  const ubic = normalizeStr(e.ubicacion);
  return name === key || ubic === key || name.includes(key) || ubic.includes(key) || key.includes(name) || key.includes(ubic);
}

function sortEmpleados(list: EmpresaEmpleado[]) {
  return [...(list || [])]
    .filter((x) => String(x?.Empleado ?? '').trim().length > 0)
    .sort((a, b) => String(a.Empleado || '').localeCompare(String(b.Empleado || ''), 'es', { sensitivity: 'base' }));
}

export default function EmpleadosProximamente() {
  const { user } = useAuth();
  const { ownerIds } = useActorOwnership(user || {});

  const [empresas, setEmpresas] = useState<Empresas[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedEmpresaKey, setSelectedEmpresaKey] = useState<string>('');
  const [search, setSearch] = useState('');

  const canUse = hasPermission(user?.permissions, 'empleados');

  useEffect(() => {
    if (!canUse) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const all = await EmpresasService.getAllEmpresas();
        if (cancelled) return;
        setEmpresas(all || []);
      } catch (e) {
        console.error('Error loading empresas:', e);
        if (!cancelled) setError('No se pudieron cargar las empresas.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [canUse]);

  const role = user?.role || 'user';
  const isSuperAdmin = role === 'superadmin';
  const isAdmin = role === 'admin';
  const isUser = role === 'user';

  const allowedEmpresas = useMemo(() => {
    const all = empresas || [];
    if (!user) return [];

    if (isSuperAdmin) return all;

    const ownerIdSet = new Set((ownerIds || []).map((id) => String(id)));
    const companyKey = String(user.ownercompanie || '').trim();

    // Admin: show empresas owned by the actor. Fallback-match by ownercompanie if present.
    if (isAdmin) {
      return all.filter((e) => {
        if (!e) return false;
        const ownerMatch = e.ownerId && ownerIdSet.has(String(e.ownerId));
        const companyMatch = companyKey ? matchEmpresaByCompanyKey(e, companyKey) : false;
        return Boolean(ownerMatch || companyMatch);
      });
    }

    // User: show only the user's assigned company.
    if (isUser) {
      const byCompany = companyKey
        ? all.filter((e) => matchEmpresaByCompanyKey(e, companyKey))
        : [];
      if (byCompany.length > 0) return byCompany;

      // Fallback: if there's an ownerId relationship, use it.
      const fallbackOwnerId = String(user.ownerId || user.id || '').trim();
      if (fallbackOwnerId) {
        return all.filter((e) => String(e.ownerId || '') === fallbackOwnerId);
      }
      return [];
    }

    // Unknown roles -> safest: none
    return [];
  }, [empresas, isAdmin, isSuperAdmin, isUser, ownerIds, user]);

  const empresaOptions: EmpresaOption[] = useMemo(() => {
    return (allowedEmpresas || [])
      .map((e) => ({ key: getEmpresaKey(e), label: getEmpresaLabel(e) }))
      .filter((x) => x.key && x.label)
      .sort((a, b) => a.label.localeCompare(b.label, 'es', { sensitivity: 'base' }));
  }, [allowedEmpresas]);

  // Default selection for admin: assigned company if matches; else first available.
  useEffect(() => {
    if (!user) return;
    if (!isAdmin) return;
    if (!empresaOptions.length) return;

    setSelectedEmpresaKey((prev) => {
      if (prev) return prev;
      const assigned = String(user.ownercompanie || '').trim();
      if (assigned) {
        const match = allowedEmpresas.find((e) => matchEmpresaByCompanyKey(e, assigned));
        if (match) return getEmpresaKey(match);
      }
      return empresaOptions[0]!.key;
    });
  }, [allowedEmpresas, empresaOptions, isAdmin, user]);

  const effectiveSelectedEmpresaKey = isAdmin ? selectedEmpresaKey : '';

  const visibleEmpresas = useMemo(() => {
    if (isSuperAdmin) return allowedEmpresas;
    if (isAdmin) {
      if (!effectiveSelectedEmpresaKey) return [];
      return (allowedEmpresas || []).filter((e) => getEmpresaKey(e) === effectiveSelectedEmpresaKey);
    }
    // user
    return allowedEmpresas;
  }, [allowedEmpresas, effectiveSelectedEmpresaKey, isAdmin, isSuperAdmin]);

  const searchNorm = normalizeStr(search);

  const renderEmpleadoList = (empleados: EmpresaEmpleado[]) => {
    const sorted = sortEmpleados(empleados);
    const filtered = searchNorm
      ? sorted.filter((emp) => normalizeStr(emp.Empleado).includes(searchNorm))
      : sorted;

    if (filtered.length === 0) {
      return (
        <div className="text-sm text-[var(--muted-foreground)]">
          {sorted.length === 0 ? 'No hay empleados registrados.' : 'No hay coincidencias para tu búsqueda.'}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map((emp, idx) => (
          <div
            key={`${normalizeStr(emp.Empleado)}::${idx}`}
            className="bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] p-4"
          >
            <div className="font-semibold text-[var(--foreground)]">{String(emp.Empleado || '').trim()}</div>
            <div className="mt-1 text-xs text-[var(--muted-foreground)]">
              Horas/turno: {Number(emp.hoursPerShift || 0)} · CCSS: {String(emp.ccssType || 'TC')}
            </div>
            {Number(emp.extraAmount || 0) !== 0 && (
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">Extra: {Number(emp.extraAmount)}</div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (!canUse) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso Restringido</h3>
          <p className="text-[var(--muted-foreground)]">No tienes permisos para acceder a Empleados.</p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex items-center gap-3">
            <Users className="w-10 h-10 text-[var(--primary)]" />
            <div>
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Empleados</h2>
              <p className="text-sm text-[var(--muted-foreground)]">
                {isSuperAdmin
                  ? 'Viendo todas las empresas.'
                  : isAdmin
                    ? 'Selecciona una empresa para ver sus empleados.'
                    : 'Viendo tu empresa asignada.'}
              </p>
            </div>
          </div>

          <div className="flex-1" />

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            {isAdmin && (
              <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                <Building2 className="w-4 h-4" />
                <select
                  value={selectedEmpresaKey}
                  onChange={(e) => setSelectedEmpresaKey(e.target.value)}
                  className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2 text-[var(--foreground)]"
                >
                  {empresaOptions.map((opt) => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
              <Search className="w-4 h-4" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar empleado..."
                className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-md px-3 py-2 text-[var(--foreground)]"
              />
            </label>
          </div>
        </div>
      </div>

      {loading && (
        <div className="text-sm text-[var(--muted-foreground)]">Cargando empresas...</div>
      )}

      {error && (
        <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] p-4 text-sm text-red-500">
          {error}
        </div>
      )}

      {!loading && !error && visibleEmpresas.length === 0 && (
        <div className="bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] p-6">
          <div className="text-[var(--foreground)] font-semibold">Sin empresas</div>
          <div className="text-sm text-[var(--muted-foreground)] mt-1">
            {isAdmin
              ? 'No se encontraron empresas asociadas a tu usuario.'
              : 'No se pudo resolver tu empresa asignada o no hay empresas registradas.'}
          </div>
        </div>
      )}

      {!loading && !error && visibleEmpresas.map((empresa) => {
        const label = getEmpresaLabel(empresa);
        const empleados = Array.isArray(empresa.empleados) ? empresa.empleados : [];
        return (
          <div key={getEmpresaKey(empresa)} className="bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--foreground)]">{label}</div>
                <div className="text-sm text-[var(--muted-foreground)]">
                  {sortEmpleados(empleados).length} empleado(s)
                </div>
              </div>
            </div>

            <div className="mt-4">{renderEmpleadoList(empleados)}</div>
          </div>
        );
      })}
    </div>
  );
}
