import {
  doc,
  runTransaction,
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import { subscribeToVersionDoc, type VersionDocSnapshot } from "@/services/version-doc";
import type { Empresas } from "@/types/firestore";
import {
  buildCompanyMaintenanceIdentifiers,
  buildCompanyMaintenanceKey,
  buildCompanyMaintenanceWrite,
  normalizeMaintenanceConfig,
  normalizeMaintenanceMessage,
  type MaintenanceConfig,
} from "@/lib/maintenance/config";

export {
  DEFAULT_MAINTENANCE_MESSAGE,
  buildCompanyMaintenanceIdentifiers,
  buildCompanyMaintenanceKey,
  createDefaultMaintenanceConfig,
  getMaintenanceBlock,
  normalizeMaintenanceConfig,
  type MaintenanceBlock,
  type MaintenanceConfig,
  type MaintenanceTarget,
} from "@/lib/maintenance/config";
export { normalizeMaintenanceIdentifier } from "@/lib/maintenance/identifier";

const versionRef = () => doc(db, "version", "current");

export const normalizeMaintenanceConfigFromVersionSnapshot = (
  snapshot: VersionDocSnapshot | null,
): MaintenanceConfig => normalizeMaintenanceConfig(snapshot?.data?.maintenance);

export const subscribeToMaintenance = (
  onValue: (config: MaintenanceConfig) => void,
  onError?: (error: unknown) => void,
): Unsubscribe =>
  subscribeToVersionDoc(
    (snapshot) => {
      onValue(normalizeMaintenanceConfigFromVersionSnapshot(snapshot));
    },
    onError,
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
  const reference = versionRef();
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const config = normalizeMaintenanceConfig(snapshot.data()?.maintenance);
    transaction.set(
      reference,
      {
        maintenance: {
          global: {
            enabled,
            message: normalizeMaintenanceMessage(message),
            enabledAt: enabled ? existingEnabledAt || serverTimestamp() : null,
            enabledBy: enabled ? existingEnabledBy || auditActor : null,
            updatedAt: serverTimestamp(),
            updatedBy: auditActor,
          },
          activeCompanyIdentifiers: config.activeCompanyIdentifiers,
        },
      },
      { merge: true },
    );
  });
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
  const reference = versionRef();
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(reference);
    const config = normalizeMaintenanceConfig(snapshot.data()?.maintenance);
    const target = {
      enabled,
      message: normalizeMaintenanceMessage(message),
      companyId: String(company.id || companyKey).trim(),
      companyName: String(company.name || "").trim(),
      companyLocation: String(company.ubicacion || "").trim(),
      identifiers: buildCompanyMaintenanceIdentifiers(company),
      enabledAt: enabled ? existingEnabledAt || serverTimestamp() : null,
      enabledBy: enabled ? existingEnabledBy || auditActor : null,
      updatedAt: serverTimestamp(),
      updatedBy: auditActor,
    };
    const companyWrite = buildCompanyMaintenanceWrite(
      config,
      companyKey,
      target,
    );
    transaction.set(
      reference,
      { maintenance: companyWrite },
      { merge: true },
    );
  });
};
