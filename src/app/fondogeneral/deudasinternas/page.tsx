"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CircleDollarSign,
  Eye,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActorOwnership } from "@/hooks/useActorOwnership";
import { getDefaultPermissions } from "@/utils/permissions";
import { EmpresasService } from "@/services/empresas";
import { UsersService } from "@/services/users";
import { EmpleadosService } from "@/services/empleados";
import {
  buildPartyKey,
  InternalDebtsService,
  type InternalDebt,
  type InternalDebtMovementType,
  type InternalDebtParty,
  type InternalDebtPartyType,
} from "@/services/internal-debts";
import type { Empleado, Empresas, User } from "@/types/firestore";

type ActorOption = InternalDebtParty & {
  key: string;
  ownerId?: string;
  searchText: string;
};

type DebtFormState = {
  debtorKey: string;
  creditorKey: string;
  amount: string;
  date: string;
  reason: string;
  reference: string;
};

type MovementFormState = {
  type: InternalDebtMovementType;
  amount: string;
  date: string;
  reason: string;
  reference: string;
};

const todayInputValue = () => new Date().toISOString().slice(0, 10);

const crcFormatter = new Intl.NumberFormat("es-CR", {
  style: "currency",
  currency: "CRC",
  maximumFractionDigits: 0,
});

const EMPTY_DEBT_FORM: DebtFormState = {
  debtorKey: "",
  creditorKey: "",
  amount: "",
  date: todayInputValue(),
  reason: "",
  reference: "",
};

const EMPTY_MOVEMENT_FORM: MovementFormState = {
  type: "payment",
  amount: "",
  date: todayInputValue(),
  reason: "",
  reference: "",
};

function getDateValue(value: unknown): string {
  if (!value) return "";
  if (value instanceof Date) return value.toLocaleDateString("es-CR");
  if (typeof value === "string") return value;
  if (typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("es-CR");
  }
  return "";
}

function normalizeSearch(value: string): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function createActor(
  type: InternalDebtPartyType,
  id: string,
  name: string,
  roleLabel: string,
  ownerId?: string,
): ActorOption | null {
  const safeId = String(id || "").trim();
  const safeName = String(name || "").trim();
  if (!safeId || !safeName) return null;
  const party = { type, id: safeId, name: safeName, roleLabel };
  return {
    ...party,
    key: buildPartyKey(party),
    ownerId,
    searchText: normalizeSearch(`${safeName} ${roleLabel} ${type}`),
  };
}

function getActorIcon(type: InternalDebtPartyType) {
  if (type === "empresa") return Building2;
  if (type === "empleado") return UsersRound;
  return UserRound;
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-[var(--input-border)] bg-[#0b1118] p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-[var(--muted-foreground)] hover:bg-[var(--hover-bg)] hover:text-[var(--foreground)]"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActorSelect({
  label,
  value,
  actors,
  onChange,
}: {
  label: string;
  value: string;
  actors: ActorOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
      >
        <option value="">Selecciona una parte</option>
        {actors.map((actor) => (
          <option key={actor.key} value={actor.key}>
            {actor.name} - {actor.roleLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function DeudasInternasPage() {
  const { user, loading: authLoading } = useAuth();
  const { ownerIds, primaryOwnerId } = useActorOwnership(user);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canUse = Boolean(permissions.deudasInternas);
  const [actors, setActors] = useState<ActorOption[]>([]);
  const [ownerAdminPartyKeys, setOwnerAdminPartyKeys] = useState<string[]>([]);
  const [debts, setDebts] = useState<InternalDebt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | InternalDebtPartyType>(
    "all",
  );
  const [roleFilter, setRoleFilter] = useState<"all" | "debtor" | "creditor">(
    "all",
  );
  const [showCreate, setShowCreate] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<InternalDebt | null>(null);
  const [debtForm, setDebtForm] = useState<DebtFormState>(EMPTY_DEBT_FORM);
  const [movementForm, setMovementForm] =
    useState<MovementFormState>(EMPTY_MOVEMENT_FORM);

  const ownerSet = useMemo(() => new Set(ownerIds), [ownerIds]);
  const actorPartyKeys = useMemo(() => {
    const keys = new Set<string>();
    if (user?.id) keys.add(`user:${user.id}`);
    actors
      .filter((actor) => actor.type === "empresa")
      .forEach((actor) => keys.add(actor.key));
    return Array.from(keys);
  }, [actors, user?.id]);
  const readPartyKeys = useMemo(
    () => (user?.id ? [`user:${user.id}`] : []),
    [user?.id],
  );

  const actorByKey = useMemo(() => {
    const map = new Map<string, ActorOption>();
    actors.forEach((actor) => map.set(actor.key, actor));
    return map;
  }, [actors]);

  const loadActors = useCallback(async () => {
    if (!primaryOwnerId || !canUse) {
      setActors([]);
      return [];
    }

    const [empresas, users] = await Promise.all([
      EmpresasService.getAllEmpresas(),
      UsersService.getAllUsersAs(user || null),
    ]);
    const visibleEmpresas = (empresas as Empresas[]).filter((empresa) =>
      ownerSet.has(String(empresa.ownerId || "")),
    );
    const empleadosByEmpresa = await Promise.all(
      visibleEmpresas.map((empresa) =>
        EmpleadosService.getByEmpresaId(String(empresa.id || "")),
      ),
    );
    const nextActors = new Map<string, ActorOption>();

    visibleEmpresas.forEach((empresa) => {
      const actor = createActor(
        "empresa",
        String(empresa.id || empresa.name),
        empresa.name,
        "Empresa",
        empresa.ownerId,
      );
      if (actor) nextActors.set(actor.key, actor);
    });

    const ownerAdmins = (users as User[]).filter(
      (candidate) =>
        candidate.role === "admin" &&
        (ownerSet.has(String(candidate.ownerId || "")) ||
          ownerSet.has(String(candidate.id || ""))),
    );
    setOwnerAdminPartyKeys(
      ownerAdmins
        .map((candidate) => (candidate.id ? `user:${candidate.id}` : ""))
        .filter(Boolean),
    );

    ownerAdmins
      .filter(
        (candidate) =>
          candidate.role === "admin" &&
          (ownerSet.has(String(candidate.ownerId || "")) ||
            ownerSet.has(String(candidate.id || ""))),
      )
      .forEach((candidate) => {
        const actor = createActor(
          "user",
          String(candidate.id || ""),
          candidate.fullName || candidate.name,
          "Admin",
          candidate.ownerId,
        );
        if (actor) nextActors.set(actor.key, actor);
      });

    empleadosByEmpresa.flat().forEach((empleado: Empleado) => {
      const actor = createActor(
        "empleado",
        String(empleado.id || `${empleado.empresaId}:${empleado.Empleado}`),
        empleado.Empleado,
        "Colaborador",
        empleado.ownerId || primaryOwnerId,
      );
      if (actor) nextActors.set(actor.key, actor);
    });

    const list = Array.from(nextActors.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "es"),
    );
    setActors(list);
    return list;
  }, [canUse, ownerSet, primaryOwnerId, user]);

  const loadDebts = useCallback(
    async (keys = readPartyKeys) => {
      if (!primaryOwnerId || !canUse || keys.length === 0) {
        setDebts([]);
        return;
      }
      const list = await InternalDebtsService.getVisibleDebts(
        primaryOwnerId,
        keys,
      );
      setDebts(list);
    },
    [canUse, primaryOwnerId, readPartyKeys],
  );

  const refresh = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);
    setError("");
    try {
      await loadActors();
      await loadDebts();
    } catch (err) {
      console.error("Error loading internal debts:", err);
      setError("No se pudieron cargar las deudas internas.");
    } finally {
      setLoading(false);
    }
  }, [authLoading, loadActors, loadDebts]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredDebts = useMemo(() => {
    const query = normalizeSearch(search);
    return debts.filter((debt) => {
      const debtorKey = buildPartyKey(debt.debtor);
      const creditorKey = buildPartyKey(debt.creditor);
      const visibleParty =
        roleFilter === "creditor" ? debt.debtor : debt.creditor;
      const typeMatch =
        typeFilter === "all" ||
        debt.debtor.type === typeFilter ||
        debt.creditor.type === typeFilter;
      const roleMatch =
        roleFilter === "all" ||
        (roleFilter === "debtor" && actorPartyKeys.includes(debtorKey)) ||
        (roleFilter === "creditor" && actorPartyKeys.includes(creditorKey));
      const text = normalizeSearch(
        `${debt.debtor.name} ${debt.creditor.name} ${visibleParty.name} ${debt.reason}`,
      );
      return typeMatch && roleMatch && (!query || text.includes(query));
    });
  }, [actorPartyKeys, debts, roleFilter, search, typeFilter]);

  const stats = useMemo(() => {
    const payable = debts.filter((debt) =>
      actorPartyKeys.includes(buildPartyKey(debt.creditor)),
    ).length;
    return {
      visible: debts.length,
      involved: debts.length,
      payable,
    };
  }, [actorPartyKeys, debts]);

  const handleCreateDebt = async (event: React.FormEvent) => {
    event.preventDefault();
    const debtor = actorByKey.get(debtForm.debtorKey);
    const creditor = actorByKey.get(debtForm.creditorKey);
    if (!debtor || !creditor || !user || !primaryOwnerId) return;
    setSaving(true);
    setError("");
    try {
      const visibilityKeys = new Set([`user:${user.id || ""}`, debtForm.debtorKey]);
      if (debtor.type === "empresa" || creditor.type === "empresa") {
        ownerAdminPartyKeys.forEach((key) => visibilityKeys.add(key));
      }
      if (debtor.type === "empleado" || creditor.type === "empleado") {
        ownerAdminPartyKeys.forEach((key) => visibilityKeys.add(key));
      }
      await InternalDebtsService.createDebt({
        ownerId: primaryOwnerId,
        debtor,
        creditor,
        amount: Number(debtForm.amount),
        reason: debtForm.reason,
        reference: debtForm.reference,
        date: debtForm.date,
        createdById: String(user.id || ""),
        createdByName: user.fullName || user.name,
        actorPartyKeys: Array.from(visibilityKeys),
      });
      setDebtForm({ ...EMPTY_DEBT_FORM, date: todayInputValue() });
      setShowCreate(false);
      await loadDebts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddMovement = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedDebt || !user) return;
    setSaving(true);
    setError("");
    try {
      await InternalDebtsService.addMovement(
        String(selectedDebt.id || ""),
        {
          type: movementForm.type,
          amount: Number(movementForm.amount),
          reason: movementForm.reason,
          reference: movementForm.reference,
          date: movementForm.date,
          createdById: String(user.id || ""),
          createdByName: user.fullName || user.name,
        },
        actorPartyKeys,
      );
      setMovementForm({ ...EMPTY_MOVEMENT_FORM, date: todayInputValue() });
      setSelectedDebt(null);
      await loadDebts();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  if (!canUse) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-6 text-center">
        <ShieldAlert className="mb-3 h-8 w-8 text-red-500" />
        <h1 className="text-lg font-semibold text-[var(--foreground)]">
          Acceso restringido
        </h1>
        <p className="mt-2 max-w-md text-sm text-[var(--muted-foreground)]">
          Necesitas el permiso Deudas internas para usar esta sección.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              Deudas internas
            </h1>
            <span className="rounded bg-[var(--muted)] px-2 py-0.5 text-[10px] font-bold text-[var(--muted-foreground)]">
              BETA
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            Administra deudas entre empresas y personas dentro del mismo ownerId.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-center">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {stats.visible}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              deudas visibles
            </div>
          </div>
          <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-center">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {stats.involved}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              involucradas
            </div>
          </div>
          <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-center">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              {stats.payable}
            </div>
            <div className="text-[10px] text-[var(--muted-foreground)]">
              abonos por acreedor
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="col-span-3 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 sm:col-span-1"
          >
            <Plus className="h-4 w-4" />
            Agregar deuda
          </button>
        </div>
      </div>

      <div className="mb-4 grid gap-2 rounded-lg border border-[var(--input-border)] bg-[#0b1118] p-3 md:grid-cols-[1fr_190px_190px_auto]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar empresa o persona"
            className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] py-2 pl-9 pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(event.target.value as "all" | InternalDebtPartyType)
          }
          className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
        >
          <option value="all">Empresa / Persona</option>
          <option value="empresa">Empresa</option>
          <option value="user">Admin</option>
          <option value="empleado">Colaborador</option>
        </select>
        <select
          value={roleFilter}
          onChange={(event) =>
            setRoleFilter(event.target.value as "all" | "debtor" | "creditor")
          }
          className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
        >
          <option value="all">Deudor / Acreedor</option>
          <option value="debtor">Soy deudor</option>
          <option value="creditor">Soy acreedor</option>
        </select>
        <button
          type="button"
          onClick={() => {
            setSearch("");
            setTypeFilter("all");
            setRoleFilter("all");
          }}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
        >
          <RotateCcw className="h-4 w-4" />
          Limpiar
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {filteredDebts.map((debt) => {
          const displayParty = actorPartyKeys.includes(buildPartyKey(debt.debtor))
            ? debt.creditor
            : debt.debtor;
          const Icon = getActorIcon(displayParty.type);
          return (
            <button
              type="button"
              key={debt.id}
              onClick={() => setSelectedDebt(debt)}
              className="group rounded-lg border border-[var(--input-border)] bg-[#0e161d] p-4 text-left transition hover:border-[var(--accent)]/70 hover:bg-[#111d26]"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-[var(--foreground)]">
                      {displayParty.name}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)]">
                      {displayParty.roleLabel}
                    </div>
                  </div>
                </div>
                <span className="rounded bg-[var(--muted)] px-2 py-1 text-[10px] font-bold uppercase text-[var(--muted-foreground)]">
                  {displayParty.type === "empresa" ? "Empresa" : "Persona"}
                </span>
              </div>
              <div className="text-xs text-[var(--muted-foreground)]">
                Monto total
              </div>
              <div className="mt-1 text-xl font-bold text-red-400">
                {crcFormatter.format(debt.balance || 0)}
              </div>
              <div className="mt-2 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                Motivo: {debt.reason}
              </div>
              <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                Actualizado: {getDateValue(debt.updatedAt)}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[var(--input-border)] pt-3 text-xs font-semibold text-blue-300">
                <span>Ver detalle</span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </div>
            </button>
          );
        })}
      </div>

      {filteredDebts.length === 0 && (
        <div className="rounded-lg border border-dashed border-[var(--input-border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          No hay deudas internas visibles con los filtros actuales.
        </div>
      )}

      {showCreate && (
        <ModalShell
          title="Agregar deuda"
          subtitle="Registra una nueva deuda entre empresas o personas del mismo ownerId."
          onClose={() => setShowCreate(false)}
        >
          <form onSubmit={handleCreateDebt} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <ActorSelect
                label="Deudor"
                value={debtForm.debtorKey}
                actors={actors}
                onChange={(value) =>
                  setDebtForm((prev) => ({ ...prev, debtorKey: value }))
                }
              />
              <ActorSelect
                label="Acreedor"
                value={debtForm.creditorKey}
                actors={actors}
                onChange={(value) =>
                  setDebtForm((prev) => ({ ...prev, creditorKey: value }))
                }
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  Monto
                </span>
                <input
                  type="number"
                  min="1"
                  value={debtForm.amount}
                  onChange={(event) =>
                    setDebtForm((prev) => ({
                      ...prev,
                      amount: event.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                  Fecha
                </span>
                <input
                  type="date"
                  value={debtForm.date}
                  onChange={(event) =>
                    setDebtForm((prev) => ({ ...prev, date: event.target.value }))
                  }
                  className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
                />
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Motivo
              </span>
              <textarea
                value={debtForm.reason}
                onChange={(event) =>
                  setDebtForm((prev) => ({ ...prev, reason: event.target.value }))
                }
                className="min-h-[84px] w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">
                Referencia interna opcional
              </span>
              <input
                value={debtForm.reference}
                onChange={(event) =>
                  setDebtForm((prev) => ({
                    ...prev,
                    reference: event.target.value,
                  }))
                }
                className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs text-blue-200">
              Solo el deudor puede registrar la deuda. El acreedor registra los
              abonos.
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Guardar deuda
              </button>
            </div>
          </form>
        </ModalShell>
      )}

      {selectedDebt && (
        <ModalShell
          title="Detalle deuda"
          subtitle={`${selectedDebt.debtor.name} debe a ${selectedDebt.creditor.name}`}
          onClose={() => setSelectedDebt(null)}
        >
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Deudor</div>
              <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {selectedDebt.debtor.name}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">
                Acreedor
              </div>
              <div className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                {selectedDebt.creditor.name}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] p-3">
              <div className="text-xs text-[var(--muted-foreground)]">Saldo</div>
              <div className="mt-1 text-lg font-bold text-red-400">
                {crcFormatter.format(selectedDebt.balance || 0)}
              </div>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-[var(--input-border)]">
            {(selectedDebt.movements || []).map((movement) => (
              <div
                key={movement.id}
                className="flex items-start justify-between gap-3 border-b border-[var(--input-border)] p-3 last:border-b-0"
              >
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                    <CircleDollarSign className="h-4 w-4" />
                    {movement.type === "payment" ? "Abono" : "Cargo"}
                  </div>
                  <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {movement.reason}
                  </div>
                  <div className="mt-1 text-[11px] text-[var(--muted-foreground)]">
                    {movement.date} - {movement.createdByName}
                  </div>
                </div>
                <div
                  className={`text-sm font-bold ${
                    movement.type === "payment" ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {movement.type === "payment" ? "-" : "+"}
                  {crcFormatter.format(movement.amount || 0)}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddMovement} className="space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <select
                value={movementForm.type}
                onChange={(event) =>
                  setMovementForm((prev) => ({
                    ...prev,
                    type: event.target.value as InternalDebtMovementType,
                  }))
                }
                className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
              >
                <option value="payment">Registrar abono</option>
                <option value="charge">Agregar cargo</option>
              </select>
              <input
                type="number"
                min="1"
                value={movementForm.amount}
                onChange={(event) =>
                  setMovementForm((prev) => ({
                    ...prev,
                    amount: event.target.value,
                  }))
                }
                placeholder="Monto"
                className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
              />
              <input
                type="date"
                value={movementForm.date}
                onChange={(event) =>
                  setMovementForm((prev) => ({ ...prev, date: event.target.value }))
                }
                className="rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
              />
            </div>
            <input
              value={movementForm.reason}
              onChange={(event) =>
                setMovementForm((prev) => ({ ...prev, reason: event.target.value }))
              }
              placeholder="Motivo del movimiento"
              className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
            />
            <input
              value={movementForm.reference}
              onChange={(event) =>
                setMovementForm((prev) => ({
                  ...prev,
                  reference: event.target.value,
                }))
              }
              placeholder="Referencia opcional"
              className="w-full rounded-lg border border-[var(--input-border)] bg-[#0d141b] px-3 py-2 text-sm text-[var(--foreground)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelectedDebt(null)}
                className="rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)]"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                <Eye className="h-4 w-4" />
                Guardar movimiento
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
