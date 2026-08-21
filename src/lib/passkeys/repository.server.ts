import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import {
  base64UrlRandom,
  sha256Base64Url,
} from "@/lib/passkeys/crypto.server";
import type {
  PasskeyRecord,
  PasskeyUserRecord,
} from "@/lib/passkeys/types";

export class PasskeyRepositoryError extends Error {
  constructor(
    public readonly code:
      | "credential_exists"
      | "passkey_not_found"
      | "forbidden"
      | "invalid_label",
  ) {
    super(code);
    this.name = "PasskeyRepositoryError";
  }
}

export interface PasskeyStore {
  getOrCreateUser(
    userId: string,
    create: () => PasskeyUserRecord,
  ): Promise<PasskeyUserRecord>;
  savePasskey(record: PasskeyRecord): Promise<void>;
  getPasskey(credentialIdHash: string): Promise<PasskeyRecord | null>;
  listPasskeys(userId: string): Promise<PasskeyRecord[]>;
  updatePasskey(
    credentialIdHash: string,
    changes: Partial<PasskeyRecord>,
  ): Promise<PasskeyRecord | null>;
}

interface PasskeyServiceDependencies {
  store: PasskeyStore;
  now?: () => number;
  randomUserHandle?: () => string;
  hashCredentialId?: (credentialId: string) => string;
}

export function createPasskeyService(dependencies: PasskeyServiceDependencies) {
  const now = dependencies.now ?? Date.now;
  const randomUserHandle =
    dependencies.randomUserHandle ?? (() => base64UrlRandom(32));
  const hashCredentialId =
    dependencies.hashCredentialId ?? sha256Base64Url;

  const requireAuthorized = async (
    actorId: string,
    isSuperAdmin: boolean,
    credentialIdHash: string,
  ) => {
    const passkey = await dependencies.store.getPasskey(credentialIdHash);
    if (!passkey) throw new PasskeyRepositoryError("passkey_not_found");
    if (!isSuperAdmin && passkey.userId !== actorId) {
      throw new PasskeyRepositoryError("forbidden");
    }
    return passkey;
  };

  return {
    getOrCreatePasskeyUser(userId: string) {
      return dependencies.store.getOrCreateUser(userId, () => ({
        userId,
        webAuthnUserId: randomUserHandle(),
        createdAt: now(),
      }));
    },

    async savePasskey(record: PasskeyRecord) {
      const normalized = {
        ...record,
        credentialIdHash: hashCredentialId(record.credentialId),
      };
      await dependencies.store.savePasskey(normalized);
      return normalized;
    },

    getPasskeyByCredentialId(credentialId: string) {
      return dependencies.store.getPasskey(hashCredentialId(credentialId));
    },

    listUserPasskeys(userId: string) {
      return dependencies.store.listPasskeys(userId);
    },

    async renamePasskey(
      actorId: string,
      isSuperAdmin: boolean,
      credentialIdHash: string,
      label: string,
    ) {
      await requireAuthorized(actorId, isSuperAdmin, credentialIdHash);
      const normalized = label.trim().replace(/\s+/g, " ");
      if (normalized.length < 1 || normalized.length > 80) {
        throw new PasskeyRepositoryError("invalid_label");
      }
      return dependencies.store.updatePasskey(credentialIdHash, {
        label: normalized,
      });
    },

    async revokePasskey(
      actorId: string,
      isSuperAdmin: boolean,
      credentialIdHash: string,
    ) {
      const passkey = await requireAuthorized(
        actorId,
        isSuperAdmin,
        credentialIdHash,
      );
      if (passkey.revokedAt !== null) return passkey;
      return dependencies.store.updatePasskey(credentialIdHash, {
        revokedAt: now(),
        revokedBy: actorId,
      });
    },

    async updateAfterAuthentication(
      credentialIdHash: string,
      changes: Pick<PasskeyRecord, "counter" | "backedUp" | "lastUsedAt">,
    ) {
      return dependencies.store.updatePasskey(credentialIdHash, changes);
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

const passkeyFromData = (
  id: string,
  data: FirebaseFirestore.DocumentData,
): PasskeyRecord => ({
  ...(data as Omit<PasskeyRecord, "credentialIdHash">),
  credentialIdHash: id,
  createdAt: toMillis(data.createdAt),
  lastUsedAt: data.lastUsedAt ? toMillis(data.lastUsedAt) : null,
  revokedAt: data.revokedAt ? toMillis(data.revokedAt) : null,
});

function firestorePasskeyStore(): PasskeyStore {
  const db = getAdminDb();
  const users = db.collection("passkeyUsers");
  const passkeys = db.collection("passkeys");
  return {
    async getOrCreateUser(userId, create) {
      return db.runTransaction(async (transaction) => {
        const reference = users.doc(userId);
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          const data = snapshot.data()!;
          return {
            userId,
            webAuthnUserId: data.webAuthnUserId,
            createdAt: toMillis(data.createdAt),
          };
        }
        const record = create();
        transaction.create(reference, {
          ...record,
          createdAt: Timestamp.fromMillis(record.createdAt),
        });
        return record;
      });
    },
    async savePasskey(record) {
      await db.runTransaction(async (transaction) => {
        const reference = passkeys.doc(record.credentialIdHash);
        const snapshot = await transaction.get(reference);
        if (snapshot.exists) {
          throw new PasskeyRepositoryError("credential_exists");
        }
        transaction.create(reference, {
          ...record,
          createdAt: Timestamp.fromMillis(record.createdAt),
        });
      });
    },
    async getPasskey(credentialIdHash) {
      const snapshot = await passkeys.doc(credentialIdHash).get();
      return snapshot.exists
        ? passkeyFromData(snapshot.id, snapshot.data()!)
        : null;
    },
    async listPasskeys(userId) {
      const snapshot = await passkeys.where("userId", "==", userId).get();
      return snapshot.docs
        .map((document) => passkeyFromData(document.id, document.data()))
        .sort((left, right) => right.createdAt - left.createdAt);
    },
    async updatePasskey(credentialIdHash, changes) {
      const reference = passkeys.doc(credentialIdHash);
      const firestoreChanges: Record<string, unknown> = { ...changes };
      for (const field of ["lastUsedAt", "revokedAt"] as const) {
        const value = changes[field];
        if (typeof value === "number") {
          firestoreChanges[field] = Timestamp.fromMillis(value);
        }
      }
      await reference.update(firestoreChanges);
      const snapshot = await reference.get();
      return snapshot.exists
        ? passkeyFromData(snapshot.id, snapshot.data()!)
        : null;
    },
  };
}

export function getPasskeyService() {
  return createPasskeyService({ store: firestorePasskeyStore() });
}
