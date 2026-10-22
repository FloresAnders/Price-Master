import type { Empresas, User } from "@/types/firestore";
import { normalizeMaintenanceIdentifier } from "./identifier";

export const DEFAULT_MAINTENANCE_MESSAGE =
  "Estamos realizando actualizaciones. Intenta nuevamente en unos minutos.";

export interface MaintenanceTarget {
  enabled: boolean;
  message: string;
  enabledAt?: unknown;
  enabledBy?: string | null;
  updatedAt?: unknown;
  updatedBy?: string | null;
  companyId?: string;
  companyName?: string;
  companyLocation?: string;
  identifiers?: string[];
}

export interface MaintenanceConfig {
  global: MaintenanceTarget;
  companies: Record<string, MaintenanceTarget>;
  activeCompanyIdentifiers: string[];
}

export interface MaintenanceBlock {
  scope: "global" | "company";
  target: MaintenanceTarget;
}

export const normalizeMaintenanceMessage = (value: unknown): string => {
  const message = typeof value === "string" ? value.trim() : "";
  return (message || DEFAULT_MAINTENANCE_MESSAGE).slice(0, 500);
};

export const uniqueMaintenanceIdentifiers = (values: unknown[]): string[] =>
  Array.from(
    new Set(values.map(normalizeMaintenanceIdentifier).filter(Boolean)),
  );

export const buildCompanyMaintenanceKey = (company: Empresas): string => {
  const id = String(company.id || "").trim();
  if (id) return id;

  const fallback = normalizeMaintenanceIdentifier(
    `${company.name || ""} ${company.ubicacion || ""}`,
  ).replace(/\s+/g, "-");
  if (!fallback) {
    throw new Error("La empresa necesita un identificador para mantenimiento.");
  }
  return fallback;
};

export const buildCompanyMaintenanceIdentifiers = (
  company: Empresas,
): string[] =>
  uniqueMaintenanceIdentifiers([
    company.id,
    company.name,
    company.ubicacion,
    `${company.name || ""} ${company.ubicacion || ""}`,
    `${company.ubicacion || ""} ${company.name || ""}`,
  ]);

const normalizeTarget = (
  value: unknown,
  fallback?: Partial<MaintenanceTarget>,
): MaintenanceTarget => {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rawIdentifiers = Array.isArray(raw.identifiers)
    ? raw.identifiers
    : fallback?.identifiers || [];

  return {
    enabled: raw.enabled === true,
    message: normalizeMaintenanceMessage(raw.message),
    enabledAt: raw.enabledAt,
    enabledBy: typeof raw.enabledBy === "string" ? raw.enabledBy : null,
    updatedAt: raw.updatedAt,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
    companyId:
      typeof raw.companyId === "string"
        ? raw.companyId.trim()
        : fallback?.companyId,
    companyName:
      typeof raw.companyName === "string"
        ? raw.companyName.trim()
        : fallback?.companyName,
    companyLocation:
      typeof raw.companyLocation === "string"
        ? raw.companyLocation.trim()
        : fallback?.companyLocation,
    identifiers: uniqueMaintenanceIdentifiers([
      ...rawIdentifiers,
      raw.companyId,
      raw.companyName,
      raw.companyLocation,
      fallback?.companyId,
      fallback?.companyName,
      fallback?.companyLocation,
    ]),
  };
};

export const deriveActiveCompanyIdentifiers = (
  companies: Record<string, MaintenanceTarget>,
): string[] =>
  uniqueMaintenanceIdentifiers(
    Object.entries(companies).flatMap(([key, target]) =>
      target.enabled
        ? [
            key,
            target.companyId,
            target.companyName,
            target.companyLocation,
            ...(target.identifiers || []),
          ]
        : [],
    ),
  );

export const buildCompanyMaintenanceWrite = (
  config: MaintenanceConfig,
  companyKey: string,
  target: MaintenanceTarget,
): Pick<MaintenanceConfig, "companies" | "activeCompanyIdentifiers"> => {
  const companies = {
    ...config.companies,
    [companyKey]: target,
  };
  return {
    companies,
    activeCompanyIdentifiers: deriveActiveCompanyIdentifiers(companies),
  };
};

export const createDefaultMaintenanceConfig = (): MaintenanceConfig => ({
  global: normalizeTarget(null),
  companies: {},
  activeCompanyIdentifiers: [],
});

export const normalizeMaintenanceConfig = (
  value: unknown,
): MaintenanceConfig => {
  const raw =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const rawCompanies =
    raw.companies && typeof raw.companies === "object"
      ? (raw.companies as Record<string, unknown>)
      : {};
  const companies = Object.fromEntries(
    Object.entries(rawCompanies).map(([key, target]) => [
      key,
      normalizeTarget(target, { companyId: key }),
    ]),
  );

  return {
    global: normalizeTarget(raw.global),
    companies,
    activeCompanyIdentifiers: deriveActiveCompanyIdentifiers(companies),
  };
};

export const hasActiveMaintenance = (
  config: MaintenanceConfig,
): boolean =>
  config.global.enabled ||
  Object.values(config.companies).some((target) => target.enabled);

export const getMaintenanceBlock = (
  config: MaintenanceConfig,
  user: User | null | undefined,
): MaintenanceBlock | null => {
  if (!user || user.role !== "user") return null;
  if (config.global.enabled) {
    return { scope: "global", target: config.global };
  }

  const companyIdentifier = normalizeMaintenanceIdentifier(user.ownercompanie);
  if (!companyIdentifier) return null;

  for (const [key, target] of Object.entries(config.companies)) {
    if (!target.enabled) continue;
    const identifiers = uniqueMaintenanceIdentifiers([
      key,
      target.companyId,
      target.companyName,
      target.companyLocation,
      ...(target.identifiers || []),
    ]);
    if (identifiers.includes(companyIdentifier)) {
      return { scope: "company", target };
    }
  }

  return null;
};
