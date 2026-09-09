"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Power,
  RefreshCw,
  Save,
  ShieldAlert,
} from "lucide-react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useMaintenance } from "@/contexts/MaintenanceContext";
import { useAuth } from "@/hooks/useAuth";
import useToast from "@/hooks/useToast";
import { EmpresasService } from "@/services/empresas";
import {
  DEFAULT_MAINTENANCE_MESSAGE,
  buildCompanyMaintenanceKey,
  setCompanyMaintenance,
  setGlobalMaintenance,
} from "@/services/maintenance";
import type { Empresas } from "@/types/firestore";

type PendingChange =
  | { kind: "global"; enabled: boolean }
  | { kind: "company"; enabled: boolean; company: Empresas }
  | null;

const companyLabel = (company: Empresas): string => {
  const name = String(company.name || "").trim();
  const location = String(company.ubicacion || "").trim();
  if (name && location && name !== location) return `${name} — ${location}`;
  return name || location || String(company.id || "Empresa");
};

export default function MaintenanceEditorSection() {
  const { user } = useAuth();
  const { config, loading: configLoading, error } = useMaintenance();
  const { showToast } = useToast();
  const [companies, setCompanies] = useState<Empresas[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [globalMessage, setGlobalMessage] = useState(
    DEFAULT_MAINTENANCE_MESSAGE,
  );
  const [companyMessages, setCompanyMessages] = useState<
    Record<string, string>
  >({});
  const [savingTarget, setSavingTarget] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange>(null);

  const actor = String(user?.id || user?.email || user?.name || "superadmin");

  const loadCompanies = useCallback(async () => {
    setCompaniesLoading(true);
    try {
      const nextCompanies = await EmpresasService.getAllEmpresas();
      setCompanies(
        [...nextCompanies].sort((left, right) =>
          companyLabel(left).localeCompare(companyLabel(right), "es", {
            sensitivity: "base",
          }),
        ),
      );
    } catch (loadError) {
      console.error("No se pudieron cargar las empresas", loadError);
      showToast("No se pudieron cargar las empresas", "error");
    } finally {
      setCompaniesLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    setGlobalMessage(config.global.message || DEFAULT_MAINTENANCE_MESSAGE);
    setCompanyMessages(
      Object.fromEntries(
        Object.entries(config.companies).map(([key, target]) => [
          key,
          target.message || DEFAULT_MAINTENANCE_MESSAGE,
        ]),
      ),
    );
  }, [config]);

  const enabledCompanies = useMemo(
    () => Object.values(config.companies).filter((target) => target.enabled).length,
    [config.companies],
  );

  if (user?.role !== "superadmin") {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-700 dark:text-red-300">
        Solo SuperAdmin puede cambiar el modo de mantenimiento.
      </div>
    );
  }

  const saveGlobal = async (enabled: boolean) => {
    setSavingTarget("global");
    try {
      await setGlobalMaintenance({
        enabled,
        message: globalMessage,
        actor,
        existingEnabledAt: config.global.enabledAt,
        existingEnabledBy: config.global.enabledBy,
      });
      showToast(
        enabled
          ? "Mantenimiento general activado"
          : "Mantenimiento general desactivado",
        "success",
      );
    } catch (saveError) {
      console.error("No se pudo actualizar el mantenimiento general", saveError);
      showToast("No se pudo actualizar el mantenimiento general", "error");
    } finally {
      setSavingTarget(null);
      setPendingChange(null);
    }
  };

  const saveCompany = async (company: Empresas, enabled: boolean) => {
    const key = buildCompanyMaintenanceKey(company);
    setSavingTarget(key);
    try {
      await setCompanyMaintenance({
        company,
        enabled,
        message:
          companyMessages[key] ||
          config.companies[key]?.message ||
          DEFAULT_MAINTENANCE_MESSAGE,
        actor,
        existingEnabledAt: config.companies[key]?.enabledAt,
        existingEnabledBy: config.companies[key]?.enabledBy,
      });
      showToast(
        enabled
          ? `Mantenimiento activado para ${companyLabel(company)}`
          : `Mantenimiento desactivado para ${companyLabel(company)}`,
        "success",
      );
    } catch (saveError) {
      console.error("No se pudo actualizar el mantenimiento de empresa", saveError);
      showToast("No se pudo actualizar el mantenimiento de empresa", "error");
    } finally {
      setSavingTarget(null);
      setPendingChange(null);
    }
  };

  const confirmPendingChange = () => {
    if (!pendingChange) return;
    if (pendingChange.kind === "global") {
      void saveGlobal(pendingChange.enabled);
      return;
    }
    void saveCompany(pendingChange.company, pendingChange.enabled);
  };

  const pendingLabel =
    pendingChange?.kind === "company"
      ? companyLabel(pendingChange.company)
      : "todo Time-Master";

  return (
    <section className="space-y-6">
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
          <p>
            Al activar mantenimiento, usuarios afectados pierden acceso al
            layout completo en tiempo real. SuperAdmin conserva acceso para
            desactivarlo.
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : null}

      <article className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                <Power className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-semibold text-[var(--foreground)]">
                  Mantenimiento general
                </h4>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Bloquea Time-Master para todos, excepto SuperAdmin.
                </p>
              </div>
            </div>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${
              config.global.enabled
                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
            }`}
          >
            {config.global.enabled ? "ACTIVO" : "NORMAL"}
          </span>
        </div>

        <label className="mt-5 block text-sm font-medium text-[var(--foreground)]">
          Mensaje para usuarios
        </label>
        <textarea
          value={globalMessage}
          onChange={(event) => setGlobalMessage(event.target.value)}
          maxLength={500}
          rows={3}
          className="mt-2 w-full resize-y rounded-xl border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
        />
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          {config.global.enabled ? (
            <button
              type="button"
              onClick={() => void saveGlobal(true)}
              disabled={savingTarget !== null || configLoading}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> Guardar mensaje
            </button>
          ) : null}
          <button
            type="button"
            onClick={() =>
              setPendingChange({
                kind: "global",
                enabled: !config.global.enabled,
              })
            }
            disabled={savingTarget !== null || configLoading}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
              config.global.enabled
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-red-600 hover:bg-red-700"
            }`}
          >
            <Power className="h-4 w-4" />
            {config.global.enabled ? "Desactivar" : "Activar"}
          </button>
        </div>
      </article>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-[var(--foreground)]">
            Mantenimiento por empresa
          </h4>
          <p className="text-sm text-[var(--muted-foreground)]">
            {enabledCompanies} empresa{enabledCompanies === 1 ? "" : "s"} en
            mantenimiento.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCompanies()}
          disabled={companiesLoading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm text-[var(--foreground)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${companiesLoading ? "animate-spin" : ""}`}
          />
          Actualizar empresas
        </button>
      </div>

      {companiesLoading ? (
        <div className="rounded-2xl border border-[var(--input-border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          Cargando empresas…
        </div>
      ) : companies.length === 0 ? (
        <div className="rounded-2xl border border-[var(--input-border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
          No hay empresas disponibles.
        </div>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => {
            const key = buildCompanyMaintenanceKey(company);
            const target = config.companies[key];
            const enabled = target?.enabled === true;
            const message =
              companyMessages[key] ||
              target?.message ||
              DEFAULT_MAINTENANCE_MESSAGE;

            return (
              <article
                key={key}
                className="rounded-2xl border border-[var(--input-border)] bg-[var(--card-bg)] p-4"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
                      <Building2 className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-[var(--foreground)]">
                        {companyLabel(company)}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          enabled
                            ? "text-red-600 dark:text-red-300"
                            : "text-emerald-600 dark:text-emerald-300"
                        }`}
                      >
                        {enabled ? "Mantenimiento activo" : "Operación normal"}
                      </p>
                    </div>
                  </div>

                  <input
                    value={message}
                    onChange={(event) =>
                      setCompanyMessages((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                    }
                    maxLength={500}
                    aria-label={`Mensaje de mantenimiento para ${companyLabel(company)}`}
                    className="min-w-0 flex-[2] rounded-lg border border-[var(--input-border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--foreground)] outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                  />

                  <div className="flex shrink-0 flex-wrap justify-end gap-2">
                    {enabled ? (
                      <button
                        type="button"
                        onClick={() => void saveCompany(company, true)}
                        disabled={savingTarget !== null}
                        className="inline-flex items-center gap-2 rounded-lg border border-[var(--input-border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--hover-bg)] disabled:opacity-50"
                      >
                        <Save className="h-4 w-4" /> Guardar
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        setPendingChange({
                          kind: "company",
                          enabled: !enabled,
                          company,
                        })
                      }
                      disabled={savingTarget !== null}
                      className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                        enabled
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-red-600 hover:bg-red-700"
                      }`}
                    >
                      <Power className="h-4 w-4" />
                      {enabled ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={pendingChange !== null}
        title={
          pendingChange?.enabled
            ? "Activar mantenimiento"
            : "Desactivar mantenimiento"
        }
        message={
          pendingChange?.enabled
            ? `Se bloqueará completamente el acceso para ${pendingLabel}.`
            : `Se restaurará el acceso para ${pendingLabel}.`
        }
        confirmText={pendingChange?.enabled ? "Activar" : "Desactivar"}
        cancelText="Cancelar"
        loading={savingTarget !== null}
        onConfirm={confirmPendingChange}
        onCancel={() => setPendingChange(null)}
        actionType="change"
      />
    </section>
  );
}
