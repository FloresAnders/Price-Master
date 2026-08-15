import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  base64UrlRandom,
  sha256Base64Url,
} from "@/lib/passkeys/crypto.server";
import type {
  EnrollmentGrantRecord,
  WebAuthnCeremonyRecord,
} from "@/lib/passkeys/types";

const CEREMONY_DURATION_MS = 5 * 60 * 1000;
const GRANT_DURATION_MS = 5 * 60 * 1000;

export class PasskeyCeremonyError extends Error {
  constructor(public readonly code: "ceremony_invalid" | "grant_invalid") {
    super(code);
    this.name = "PasskeyCeremonyError";
  }
}

export interface CeremonyStore {
  saveCeremony(record: WebAuthnCeremonyRecord): Promise<void>;
  consumeCeremony(
    id: string,
    browserBindingHash: string,
    now: number,
  ): Promise<WebAuthnCeremonyRecord | null>;
  saveGrant(record: EnrollmentGrantRecord): Promise<void>;
  claimGrant(
    id: string,
    authSessionId: string,
    ceremonyId: string,
    now: number,
  ): Promise<EnrollmentGrantRecord | null>;
  consumeGrant(id: string, ceremonyId: string, now: number): Promise<boolean>;
}

interface CreateCeremonyInput {
  type: "registration" | "authentication";
  challenge: string;
  browserBinding: string;
  userId?: string | null;
  authSessionId?: string | null;
  enrollmentGrantId?: string | null;
}

interface CeremonyServiceDependencies {
  store: CeremonyStore;
  now?: () => number;
  randomId?: () => string;
  hashBrowserBinding?: (binding: string) => string;
}

export function createCeremonyService(
  dependencies: CeremonyServiceDependencies,
) {
  const now = dependencies.now ?? Date.now;
  const randomId = dependencies.randomId ?? (() => base64UrlRandom(24));
  const hashBrowserBinding =
    dependencies.hashBrowserBinding ?? sha256Base64Url;

  return {
    async createCeremony(
      input: CreateCeremonyInput,
    ): Promise<WebAuthnCeremonyRecord> {
      const createdAt = now();
      const record: WebAuthnCeremonyRecord = {
        id: randomId(),
        type: input.type,
        challenge: input.challenge,
        browserBindingHash: hashBrowserBinding(input.browserBinding),
        userId: input.userId ?? null,
        authSessionId: input.authSessionId ?? null,
        enrollmentGrantId: input.enrollmentGrantId ?? null,
        createdAt,
        expiresAt: createdAt + CEREMONY_DURATION_MS,
        consumedAt: null,
      };
      await dependencies.store.saveCeremony(record);
      return record;
    },

    async consumeCeremony(id: string, browserBinding: string) {
      const record = await dependencies.store.consumeCeremony(
        id,
        hashBrowserBinding(browserBinding),
        now(),
      );
      if (!record) throw new PasskeyCeremonyError("ceremony_invalid");
      return record;
    },

    async createEnrollmentGrant(userId: string, authSessionId: string) {
      const createdAt = now();
      const record: EnrollmentGrantRecord = {
        id: randomId(),
        userId,
        authSessionId,
        createdAt,
        expiresAt: createdAt + GRANT_DURATION_MS,
        ceremonyId: null,
        consumedAt: null,
      };
      await dependencies.store.saveGrant(record);
      return record;
    },

    async claimEnrollmentGrant(
      id: string,
      authSessionId: string,
      ceremonyId: string,
    ) {
      const record = await dependencies.store.claimGrant(
        id,
        authSessionId,
        ceremonyId,
        now(),
      );
      if (!record) throw new PasskeyCeremonyError("grant_invalid");
      return record;
    },

    async consumeEnrollmentGrant(id: string, ceremonyId: string) {
      const consumed = await dependencies.store.consumeGrant(
        id,
        ceremonyId,
        now(),
      );
      if (!consumed) throw new PasskeyCeremonyError("grant_invalid");
      return true;
    },
  };
}

const toMillis = (value: unknown) => {
  if (typeof value === "number") return value;
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
};

const ceremonyFromData = (
  id: string,
  data: FirebaseFirestore.DocumentData,
): WebAuthnCeremonyRecord => ({
  ...(data as Omit<WebAuthnCeremonyRecord, "id">),
  id,
  createdAt: toMillis(data.createdAt),
  expiresAt: toMillis(data.expiresAt),
  consumedAt: data.consumedAt ? toMillis(data.consumedAt) : null,
});

const grantFromData = (
  id: string,
  data: FirebaseFirestore.DocumentData,
): EnrollmentGrantRecord => ({
  ...(data as Omit<EnrollmentGrantRecord, "id">),
  id,
  createdAt: toMillis(data.createdAt),
  expiresAt: toMillis(data.expiresAt),
  consumedAt: data.consumedAt ? toMillis(data.consumedAt) : null,
});

function firestoreCeremonyStore(): CeremonyStore {
  const db = getAdminDb();
  const ceremonies = db.collection("webauthnCeremonies");
  const grants = db.collection("passkeyEnrollmentGrants");
  return {
    async saveCeremony(record) {
      await ceremonies.doc(record.id).set({
        ...record,
        createdAt: Timestamp.fromMillis(record.createdAt),
        expiresAt: Timestamp.fromMillis(record.expiresAt),
      });
    },
    async consumeCeremony(id, browserBindingHash, currentTime) {
      return db.runTransaction(async (transaction) => {
        const reference = ceremonies.doc(id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return null;
        const record = ceremonyFromData(snapshot.id, snapshot.data()!);
        if (
          record.browserBindingHash !== browserBindingHash ||
          record.consumedAt !== null ||
          record.expiresAt <= currentTime
        ) {
          return null;
        }
        transaction.update(reference, {
          consumedAt: Timestamp.fromMillis(currentTime),
        });
        return { ...record, consumedAt: currentTime };
      });
    },
    async saveGrant(record) {
      await grants.doc(record.id).set({
        ...record,
        createdAt: Timestamp.fromMillis(record.createdAt),
        expiresAt: Timestamp.fromMillis(record.expiresAt),
      });
    },
    async claimGrant(id, authSessionId, ceremonyId, currentTime) {
      return db.runTransaction(async (transaction) => {
        const reference = grants.doc(id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return null;
        const record = grantFromData(snapshot.id, snapshot.data()!);
        if (
          record.authSessionId !== authSessionId ||
          record.consumedAt !== null ||
          record.ceremonyId !== null ||
          record.expiresAt <= currentTime
        ) {
          return null;
        }
        transaction.update(reference, { ceremonyId });
        return { ...record, ceremonyId };
      });
    },
    async consumeGrant(id, ceremonyId, currentTime) {
      return db.runTransaction(async (transaction) => {
        const reference = grants.doc(id);
        const snapshot = await transaction.get(reference);
        if (!snapshot.exists) return false;
        const record = grantFromData(snapshot.id, snapshot.data()!);
        if (
          record.ceremonyId !== ceremonyId ||
          record.consumedAt !== null ||
          record.expiresAt <= currentTime
        ) {
          return false;
        }
        transaction.update(reference, {
          consumedAt: Timestamp.fromMillis(currentTime),
        });
        return true;
      });
    },
  };
}

export function getCeremonyService() {
  return createCeremonyService({ store: firestoreCeremonyStore() });
}
