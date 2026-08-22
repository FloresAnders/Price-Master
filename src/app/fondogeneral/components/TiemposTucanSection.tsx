"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useActorOwnership } from "../../../hooks/useActorOwnership";
import { useAuth } from "../../../hooks/useAuth";
import { EmpresasService } from "../../../services/empresas";
import { canAccessTiemposTucan } from "../../../components/layout/fondoNavigation";
import { getDefaultPermissions } from "../../../utils/permissions";
import { GenteCrystalTiemposPanel } from "./GenteCrystalTiemposPanel";
import {
  buildGenteCrystalCompanyOptions,
  resolveGenteCrystalCompanySelection,
  type GenteCrystalCompanyOption,
} from "./genteCrystalTiempos";

const COMPANY_STORAGE_KEY = "fg_selected_company_shared";

export function TiemposTucanSection() {
  const { user, loading } = useAuth();
  const { ownerIds } = useActorOwnership(user || {});
  const [companyOptions, setCompanyOptions] = useState<
    GenteCrystalCompanyOption[]
  >([]);
  const [companyId, setCompanyId] = useState("");
  const [companiesLoading, setCompaniesLoading] = useState(true);
  const [companiesError, setCompaniesError] = useState("");
  const [loadedScopeKey, setLoadedScopeKey] = useState("");

  const permissions = user
    ? user.permissions || getDefaultPermissions(user.role || "user")
    : null;
  const isPrivileged =
    user?.role === "admin" || user?.role === "superadmin";
  const hasReporteTiemposAccess = canAccessTiemposTucan(permissions);
  const companyScopeKey = [
    user?.id || "",
    user?.role || "",
    user?.ownerId || "",
    user?.ownercompanie || "",
    ownerIds.join(","),
  ].join("|");
  const companyScopeLoading =
    companiesLoading || loadedScopeKey !== companyScopeKey;

  useEffect(() => {
    if (!user || !hasReporteTiemposAccess) return;

    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setCompaniesLoading(true);
      setCompaniesError("");
      void EmpresasService.getAllEmpresas()
        .then((companies) => {
          if (cancelled) return;
          const options = buildGenteCrystalCompanyOptions(
            user,
            companies,
            ownerIds,
          );
          const stored =
            window.localStorage.getItem(COMPANY_STORAGE_KEY) || "";
          setCompanyOptions(options);
          setCompanyId((current) =>
            resolveGenteCrystalCompanySelection(
              current || stored,
              user.ownercompanie || "",
              options,
            ),
          );
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          console.error("Error loading Tiempos companies:", error);
          setCompanyOptions([]);
          setCompanyId("");
          setCompaniesError("No se pudieron cargar las empresas.");
        })
        .finally(() => {
          if (!cancelled) {
            setLoadedScopeKey(companyScopeKey);
            setCompaniesLoading(false);
          }
        });
    });

    return () => {
      cancelled = true;
    };
  }, [companyScopeKey, hasReporteTiemposAccess, ownerIds, user]);

  const selectedOption = useMemo(
    () => companyOptions.find((option) => option.value === companyId),
    [companyId, companyOptions],
  );

  const handleCompanyChange = useCallback(
    (nextCompanyId: string) => {
      if (!companyOptions.some((option) => option.value === nextCompanyId)) {
        return;
      }
      const previous = companyId;
      setCompanyId(nextCompanyId);
      try {
        window.localStorage.setItem(COMPANY_STORAGE_KEY, nextCompanyId);
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: COMPANY_STORAGE_KEY,
            oldValue: previous,
            newValue: nextCompanyId,
            storageArea: window.localStorage,
          }),
        );
      } catch (error) {
        console.error("Error saving Tiempos company:", error);
      }
    },
    [companyId, companyOptions],
  );

  return (
    <div className="w-full bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-8">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-6 text-center">
        Tiempos/Tucan
      </h2>
      <div className="grid w-full grid-cols-1 xl:grid-cols-2 gap-4">
        <section className="min-h-40 space-y-4 rounded-lg border border-[var(--input-border)] bg-[var(--background)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Tiempos
          </h3>

          {loading ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Cargando empresas...
            </p>
          ) : !user ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Inicia sesión para consultar los movimientos.
            </p>
          ) : !hasReporteTiemposAccess ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-950/15 px-3 py-4 text-sm text-amber-100">
              No tienes permiso para consultar Reporte Tiempos.
            </p>
          ) : companyScopeLoading ? (
            <p className="py-8 text-center text-sm text-[var(--muted-foreground)]">
              Cargando empresas...
            </p>
          ) : companiesError ? (
            <p
              role="alert"
              className="rounded-md border border-red-500/35 bg-red-950/20 px-3 py-4 text-sm text-red-200"
            >
              {companiesError}
            </p>
          ) : !companyId ? (
            <p className="rounded-md border border-amber-500/30 bg-amber-950/15 px-3 py-4 text-sm text-amber-100">
              No hay una empresa asignada para consultar.
            </p>
          ) : (
            <>
              {isPrivileged ? (
                <label className="grid gap-1 text-sm text-[var(--muted-foreground)]">
                  <span className="font-medium text-[var(--foreground)]">
                    Empresa
                  </span>
                  <select
                    value={companyId}
                    onChange={(event) =>
                      handleCompanyChange(event.target.value)
                    }
                    className="h-10 rounded-md border border-[var(--input-border)] bg-[var(--background)] px-3 text-[var(--foreground)] outline-none transition focus:border-cyan-500"
                  >
                    {companyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="rounded-md border border-[var(--input-border)] bg-[var(--card-bg)]/60 px-3 py-2">
                  <p className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                    Empresa
                  </p>
                  <p className="font-semibold text-[var(--foreground)]">
                    {selectedOption?.label || companyId}
                  </p>
                </div>
              )}

              <GenteCrystalTiemposPanel
                companyId={companyId}
                userRole={user.role}
                cierreFondoVentasMinutesBeforeEnd={
                  selectedOption?.cierreFondoVentasMinutesBeforeEnd
                }
                cierreFondoVentasMinutesAfterEnd={
                  selectedOption?.cierreFondoVentasMinutesAfterEnd
                }
              />
            </>
          )}
        </section>
        <section className="min-h-40 rounded-lg border border-[var(--input-border)] bg-[var(--background)] p-6">
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Tucan
          </h3>
          <p className="text-[var(--muted-foreground)]">
            Management of time tracking and Tucan-related functionalities.
          </p>
        </section>
      </div>
    </div>
  );
}
