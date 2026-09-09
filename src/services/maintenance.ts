import {
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { Empresas, User } from "@/types/firestore";

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
}

export interface MaintenanceBlock {
  scope: "global" | "company";
  target: MaintenanceTarget;
}

const maintenanceRef = () => doc(db, "systemConfig", "maintenance");

const normalizeMessage = (value: unknown): string => {
  const message = typeof value === "string" ? value.trim() : "";
  return (message || DEFAULT_MAINTENANCE_MESSAGE).slice(0, 500);
};

export const normalizeMaintenanceIdentifier = (value: unknown): string =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const uniqueIdentifiers = (values: unknown[]): string[] =>
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
  uniqueIdentifiers([
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
    message: normalizeMessage(raw.message),
    enabledAt: raw.enabledAt,
    enabledBy:
      typeof raw.enabledBy === "string" ? raw.enabledBy : null,
    updatedAt: raw.updatedAt,
    updatedBy:
      typeof raw.updatedBy === "string" ? raw.updatedBy : null,
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
    identifiers: uniqueIdentifiers([
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

export const createDefaultMaintenanceConfig = (): MaintenanceConfig => ({
  global: normalizeTarget(null),
  companies: {},
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
  };
};

export const getMaintenanceBlock = (
  config: MaintenanceConfig,
  user: User | null | undefined,
): MaintenanceBlock | null => {
  if (!user || user.role === "superadmin") return null;
  if (config.global.enabled) {
    return { scope: "global", target: config.global };
  }

  const companyIdentifier = normalizeMaintenanceIdentifier(user.ownercompanie);
  if (!companyIdentifier) return null;

  for (const [key, target] of Object.entries(config.companies)) {
    if (!target.enabled) continue;
    const identifiers = uniqueIdentifiers([
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

export const subscribeToMaintenance = (
  onValue: (config: MaintenanceConfig) => void,
  onError?: (error: unknown) => void,
): Unsubscribe =>
  onSnapshot(
    maintenanceRef(),
    (snapshot) => {
      onValue(
        snapshot.exists()
          ? normalizeMaintenanceConfig(snapshot.data())
          : createDefaultMaintenanceConfig(),
      );
    },
    (error) => onError?.(error),
  );

interface MaintenanceWriteBase {
  enabled: boolean;
  message: string;
  actor: string;
  existingEnabledAt?: unknown;
  existingEnabledBy?: string | null;
}

export const setGlobalMaintenance = async ({
  enabled,
  message,
  actor,
  existingEnabledAt,
  existingEnabledBy,
}: MaintenanceWriteBase): Promise<void> => {
  const auditActor = actor.trim() || "superadmin";
  await setDoc(
    maintenanceRef(),
    {
      global: {
        enabled,
        message: normalizeMessage(message),
        enabledAt: enabled ? existingEnabledAt || serverTimestamp() : null,
        enabledBy: enabled ? existingEnabledBy || auditActor : null,
        updatedAt: serverTimestamp(),
        updatedBy: auditActor,
      },
    },
    { merge: true },
  );
};

export const setCompanyMaintenance = async ({
  company,
  enabled,
  message,
  actor,
  existingEnabledAt,
  existingEnabledBy,
}: MaintenanceWriteBase & { company: Empresas }): Promise<void> => {
  const companyKey = buildCompanyMaintenanceKey(company);
  const auditActor = actor.trim() || "superadmin";
  await setDoc(
    maintenanceRef(),
    {
      companies: {
        [companyKey]: {
          enabled,
          message: normalizeMessage(message),
          companyId: String(company.id || companyKey).trim(),
          companyName: String(company.name || "").trim(),
          companyLocation: String(company.ubicacion || "").trim(),
          identifiers: buildCompanyMaintenanceIdentifiers(company),
          enabledAt: enabled ? existingEnabledAt || serverTimestamp() : null,
          enabledBy: enabled ? existingEnabledBy || auditActor : null,
          updatedAt: serverTimestamp(),
          updatedBy: auditActor,
        },
      },
    },
    { merge: true },
  );
};
