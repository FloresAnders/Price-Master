import { createHash } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import type {
  MaintenanceAccessEvent,
  MaintenanceTotpRecord,
  MaintenanceTotpRepository,
  RateLimitInput,
} from "./service.server";

const secretDocumentId = (userId: string): string =>
  createHash("sha256").update(userId, "utf8").digest("hex");

const toMillis = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
};

const mapRecord = (data: Record<string, unknown>): MaintenanceTotpRecord => ({
  userId: String(data.userId || ""),
  purpose: "maintenance",
  secretEncrypted: String(data.secretEncrypted || ""),
  confirmedAt: data.confirmedAt ? toMillis(data.confirmedAt) : null,
  lastUsedStep: Number(data.lastUsedStep || 0),
  createdAt: toMillis(data.createdAt),
  updatedAt: toMillis(data.updatedAt),
});

export function firestoreMaintenanceTotpRepository(): MaintenanceTotpRepository {
  const db = getAdminDb();
  const secrets = db.collection("totpSecrets");
  const accessLogs = db.collection("maintenanceAccessLogs");
  const rateLimits = db.collection("maintenanceRateLimits");

  return {
    async getByUserId(userId) {
      const snapshot = await secrets.doc(secretDocumentId(userId)).get();
      return snapshot.exists ? mapRecord(snapshot.data() || {}) : null;
    },

    async savePending(record) {
      await secrets.doc(secretDocumentId(record.userId)).set({
        ...record,
        confirmedAt: null,
        createdAt: Timestamp.fromMillis(record.createdAt),
        updatedAt: Timestamp.fromMillis(record.updatedAt),
      });
    },

    async listConfirmed() {
      const snapshot = await secrets.get();
      return snapshot.docs
        .map((document) => mapRecord(document.data()))
        .filter(
          (record) =>
            record.purpose === "maintenance" &&
            record.confirmedAt !== null &&
            Boolean(record.userId && record.secretEncrypted),
        );
    },

    async confirm(userId, secretEncrypted, step, now) {
      const reference = secrets.doc(secretDocumentId(userId));
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const data = snapshot.data();
        if (
          !snapshot.exists ||
          data?.userId !== userId ||
          data?.secretEncrypted !== secretEncrypted ||
          data?.confirmedAt
        ) {
          return false;
        }
        transaction.update(reference, {
          confirmedAt: Timestamp.fromMillis(now),
          lastUsedStep: step,
          updatedAt: Timestamp.fromMillis(now),
        });
        return true;
      });
    },

    async consumeStep(userId, step, now) {
      const reference = secrets.doc(secretDocumentId(userId));
      return db.runTransaction(async (transaction) => {
        const snapshot = await transaction.get(reference);
        const data = snapshot.data();
        if (
          !snapshot.exists ||
          data?.userId !== userId ||
          !data?.confirmedAt ||
          step <= Number(data.lastUsedStep || 0)
        ) {
          return false;
        }
        transaction.update(reference, {
          lastUsedStep: step,
          updatedAt: Timestamp.fromMillis(now),
        });
        return true;
      });
    },

    async deleteByUserId(userId) {
      const reference = secrets.doc(secretDocumentId(userId));
      const snapshot = await reference.get();
      if (!snapshot.exists) return false;
      await reference.delete();
      return true;
    },

    async consumeRateLimit(input: RateLimitInput) {
      const globalReference = rateLimits.doc(`${input.scope}-global`);
      const subjectReference = rateLimits.doc(
        `${input.scope}-${input.subjectHash}`,
      );
      return db.runTransaction(async (transaction) => {
        const [globalSnapshot, subjectSnapshot] = await Promise.all([
          transaction.get(globalReference),
          transaction.get(subjectReference),
        ]);
        const globalData = globalSnapshot.data();
        const subjectData = subjectSnapshot.data();
        const globalCount =
          globalData?.windowStart === input.windowStart
            ? Number(globalData.count || 0)
            : 0;
        const subjectCount =
          subjectData?.windowStart === input.windowStart
            ? Number(subjectData.count || 0)
            : 0;
        if (
          globalCount >= input.globalLimit ||
          subjectCount >= input.subjectLimit
        ) {
          return false;
        }
        const expiresAt = Timestamp.fromMillis(input.windowStart + 86_400_000);
        transaction.set(globalReference, {
          scope: input.scope,
          kind: "global",
          windowStart: input.windowStart,
          count: globalCount + 1,
          expiresAt,
        });
        transaction.set(subjectReference, {
          scope: input.scope,
          kind: "subject",
          subjectHash: input.subjectHash,
          windowStart: input.windowStart,
          count: subjectCount + 1,
          expiresAt,
        });
        return true;
      });
    },

    async log(event: MaintenanceAccessEvent) {
      await accessLogs.add({
        ...event,
        createdAt: Timestamp.fromMillis(event.createdAt),
      });
    },
  };
}
