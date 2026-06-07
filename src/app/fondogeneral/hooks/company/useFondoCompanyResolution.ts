"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Empresas } from "../../../../types/firestore";
import { EmpresasService } from "../../../../services/empresas";
import { UsersService } from "../../../../services/users";

type FondoResolutionUser = {
  ownerId?: unknown;
  role?: string | null;
} | null;

type UseFondoCompanyResolutionParams = {
  user: FondoResolutionUser;
  authLoading: boolean;
  actorOwnerIds: string[];
  primaryOwnerId: string;
  assignedCompany: string;
  canSelectCompany: boolean;
  isAdminUser: boolean;
  company: string;
  adminCompany: string;
  setResolvedCompany: Dispatch<SetStateAction<string>>;
  setAdminCompany: Dispatch<SetStateAction<string>>;
};

const normalizeCompanyKey = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

const getEmpresaCompanyKey = (emp: Empresas) =>
  String(emp?.name || emp?.ubicacion || emp?.id || "").trim();

const getEmpresaCompanyCandidates = (emp: Empresas) =>
  [emp?.name, emp?.ubicacion, emp?.id].map(normalizeCompanyKey).filter(Boolean);

export function useFondoCompanyResolution({
  user,
  authLoading,
  actorOwnerIds,
  primaryOwnerId,
  assignedCompany,
  canSelectCompany,
  isAdminUser,
  company,
  adminCompany,
  setResolvedCompany,
  setAdminCompany,
}: UseFondoCompanyResolutionParams) {
  const allowedOwnerIds = useMemo(() => {
    const set = new Set<string>();
    actorOwnerIds.forEach((id) => {
      const normalized =
        typeof id === "string" ? id.trim() : String(id || "").trim();
      if (normalized) set.add(normalized);
    });
    if (user?.ownerId) {
      const normalized = String(user.ownerId).trim();
      if (normalized) set.add(normalized);
    }
    return set;
  }, [actorOwnerIds, user?.ownerId]);

  const allowedOwnerIdsKey = useMemo(
    () => Array.from(allowedOwnerIds).sort().join("|"),
    [allowedOwnerIds],
  );

  const resolvedOwnerId = useMemo(() => {
    const normalizedPrimary = (primaryOwnerId || "").trim();
    if (normalizedPrimary) return normalizedPrimary;
    const [firstAllowed] = Array.from(allowedOwnerIds);
    if (firstAllowed) return firstAllowed;
    return "";
  }, [allowedOwnerIds, primaryOwnerId]);

  const [ownerAdminEmail, setOwnerAdminEmail] = useState<string | null>(null);
  const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
  const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
  const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(
    null,
  );

  const sortedOwnerCompanies = useMemo(() => {
    const valueKey = (emp: Empresas) =>
      normalizeCompanyKey(emp?.name || emp?.ubicacion || emp?.id || "");

    const score = (emp: Empresas) =>
      (normalizeCompanyKey(emp?.id) ? 2 : 0) +
      (normalizeCompanyKey(emp?.name) ? 1 : 0) +
      (normalizeCompanyKey(emp?.ubicacion) ? 1 : 0);

    const byKey = new Map<string, Empresas>();
    ownerCompanies.forEach((emp) => {
      const key = valueKey(emp);
      if (!key) return;
      const existing = byKey.get(key);
      if (!existing || score(emp) > score(existing)) {
        byKey.set(key, emp);
      }
    });

    const deduped = Array.from(byKey.values());

    const ubicacionesWithNamed = new Set<string>();
    deduped.forEach((emp) => {
      const name = normalizeCompanyKey(emp?.name);
      const ubicacion = normalizeCompanyKey(emp?.ubicacion);
      if (name && ubicacion) ubicacionesWithNamed.add(ubicacion);
    });

    const cleaned = deduped.filter((emp) => {
      const name = normalizeCompanyKey(emp?.name);
      const ubicacion = normalizeCompanyKey(emp?.ubicacion);
      if (!name && ubicacion && ubicacionesWithNamed.has(ubicacion)) {
        return false;
      }
      return true;
    });

    return cleaned.sort((a, b) =>
      (a.name || a.ubicacion || "").localeCompare(
        b.name || b.ubicacion || "",
        "es",
        { sensitivity: "base" },
      ),
    );
  }, [ownerCompanies]);

  useEffect(() => {
    const normalizedAssignedCompany = normalizeCompanyKey(assignedCompany);

    if (authLoading || !user) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (!canSelectCompany && !normalizedAssignedCompany) {
      setOwnerCompanies([]);
      setResolvedCompany("");
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (isAdminUser && allowedOwnerIds.size === 0) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(
        "No se pudo determinar el ownerId asociado a tu cuenta.",
      );
      return;
    }

    let isMounted = true;
    setOwnerCompaniesLoading(true);
    setOwnerCompaniesError(null);

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isMounted) return;
        const filtered = isAdminUser
          ? empresas.filter((emp) => {
              const owner = (emp.ownerId || "").trim();
              if (!owner) return false;
              return allowedOwnerIds.has(owner);
            })
          : canSelectCompany
            ? empresas
            : empresas.filter((emp) =>
                getEmpresaCompanyCandidates(emp).includes(normalizedAssignedCompany),
              );
        setOwnerCompanies(filtered);
        if (canSelectCompany) {
          setAdminCompany((current) => {
            const normalizedCurrent = normalizeCompanyKey(current);
            if (normalizedCurrent.length > 0) {
              const exists = filtered.some((emp) =>
                getEmpresaCompanyCandidates(emp).includes(normalizedCurrent),
              );
              if (exists) return current;
            }

            const fallback = filtered[0];
            return fallback ? getEmpresaCompanyKey(fallback) : "";
          });
        }
        if (!canSelectCompany) {
          const fallback = filtered[0];
          setResolvedCompany(
            fallback ? getEmpresaCompanyKey(fallback) : assignedCompany,
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setOwnerCompanies([]);
        setOwnerCompaniesError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las empresas disponibles.",
        );
      })
      .finally(() => {
        if (isMounted) setOwnerCompaniesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    allowedOwnerIds,
    allowedOwnerIdsKey,
    assignedCompany,
    authLoading,
    canSelectCompany,
    isAdminUser,
    setAdminCompany,
    setResolvedCompany,
    user,
  ]);

  const activeOwnerId = useMemo(() => {
    if (canSelectCompany) {
      const normalizedCompany = normalizeCompanyKey(adminCompany);
      if (normalizedCompany.length > 0) {
        const match = ownerCompanies.find((emp) =>
          getEmpresaCompanyCandidates(emp).includes(normalizedCompany),
        );
        const ownerId =
          typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
        if (ownerId) return ownerId;
      }

      const fallbackAdminOwner =
        typeof ownerCompanies[0]?.ownerId === "string"
          ? ownerCompanies[0].ownerId.trim()
          : "";
      if (fallbackAdminOwner) return fallbackAdminOwner;
    }

    const normalizedAssignedCompany = normalizeCompanyKey(company);
    if (normalizedAssignedCompany.length > 0 && ownerCompanies.length > 0) {
      const match = ownerCompanies.find((emp) =>
        getEmpresaCompanyCandidates(emp).includes(normalizedAssignedCompany),
      );
      const ownerId =
        typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
      if (ownerId) return ownerId;
    }

    return resolvedOwnerId;
  }, [adminCompany, canSelectCompany, company, ownerCompanies, resolvedOwnerId]);

  useEffect(() => {
    let cancelled = false;

    if (!activeOwnerId) {
      setOwnerAdminEmail(null);
      return () => {
        cancelled = true;
      };
    }

    setOwnerAdminEmail(null);

    const loadAdminEmail = async () => {
      try {
        const admin = await UsersService.getPrimaryAdminByOwner(activeOwnerId);
        if (cancelled) return;
        const email =
          typeof admin?.email === "string" ? admin.email.trim() : "";
        setOwnerAdminEmail(email.length > 0 ? email : null);
      } catch (error) {
        if (cancelled) return;
        console.error(
          "Error loading owner admin email for daily closing notifications:",
          error,
        );
        setOwnerAdminEmail(null);
      }
    };

    void loadAdminEmail();

    return () => {
      cancelled = true;
    };
  }, [activeOwnerId]);

  const activeEmpresaForCompany = useMemo(() => {
    const normalizedSelected = normalizeCompanyKey(company);
    if (!normalizedSelected) return null;

    const matches = ownerCompanies.filter((emp) =>
      getEmpresaCompanyCandidates(emp).includes(normalizedSelected),
    );

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const score = (emp: Empresas) => {
      const name = normalizeCompanyKey(emp?.name);
      const ubicacion = normalizeCompanyKey(emp?.ubicacion);
      const id = normalizeCompanyKey(emp?.id);
      const exact =
        normalizedSelected === name ||
        normalizedSelected === ubicacion ||
        normalizedSelected === id
          ? 3
          : 0;
      const hasOpen = String(emp?.horarioApertura || "").trim() ? 2 : 0;
      const hasClose = String(emp?.horarioCierre || "").trim() ? 2 : 0;
      const hasEmployees =
        Array.isArray(emp?.empleados) && emp.empleados.length > 0 ? 1 : 0;
      return exact + hasOpen + hasClose + hasEmployees;
    };

    let best = matches[0];
    let bestScore = score(best);
    for (let i = 1; i < matches.length; i++) {
      const cur = matches[i];
      const curScore = score(cur);
      if (curScore > bestScore) {
        best = cur;
        bestScore = curScore;
      }
    }

    return best;
  }, [company, ownerCompanies]);

  return {
    ownerAdminEmail,
    ownerCompanies,
    ownerCompaniesLoading,
    ownerCompaniesError,
    sortedOwnerCompanies,
    activeOwnerId,
    activeEmpresaForCompany,
    allowedOwnerIds,
    resolvedOwnerId,
  };
}
