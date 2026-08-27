import { createHmac } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase-admin";
import { getWebAuthnConfig } from "@/lib/passkeys/config.server";
import { base64UrlRandom } from "@/lib/passkeys/crypto.server";
import type {
  AuthenticatedSession,
  AuthMethod,
  AuthSessionRecord,
} from "@/lib/passkeys/types";
import type { User } from "@/types/firestore";
import { SESSION_DURATION_HOURS } from "./session-policy";
import { getSessionTokenFromCookie } from "./session-cookie.server";

const SESSION_DURATION_MS = {
  superadmin: SESSION_DURATION_HOURS.superadmin * 60 * 60 * 1000,
  admin: SESSION_DURATION_HOURS.admin * 60 * 60 * 1000,
  user: SESSION_DURATION_HOURS.user * 60 * 60 * 1000,
} as const;
const TOUCH_INTERVAL_MS = 30 * 60 * 1000;
const USER_REVALIDATION_INTERVAL_MS = 60 * 60 * 1000;

export interface SessionRepository {
  save(record: AuthSessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  revoke(id: string, revokedAt: number, reason: string): Promise<void>;
  touch(
    id: string,
    lastSeenAt: number,
    expiresAt?: number,
    durationMs?: number,
    userValidatedAt?: number,
  ): Promise<void>;
  linkPasskeySession(id: string): Promise<void>;
}

interface SessionServiceDependencies {
  repository: SessionRepository;
  getUser(userId: string): Promise<User | null>;
  isPasskeyActive(credentialIdHash: string): Promise<boolean>;
  now?: () => number;
  randomToken?: () => string;
  randomId?: () => string;
  hashToken?: (token: string) => string;
}

interface CreateSessionInput {
  userId: string;
  role: "admin" | "user" | "superadmin";
  authMethod: AuthMethod;
  credentialIdHash?: string | null;
  keepActive?: boolean;
}

export function serializeSafeUser(user: User): Omit<User, "password"> {
  const safeUser = { ...user };
  delete safeUser.password;
  return safeUser;
}

export function createSessionService(dependencies: SessionServiceDependencies) {
  const now = dependencies.now ?? Date.now;
  const randomToken = dependencies.randomToken ?? (() => base64UrlRandom(32));
  const randomId = dependencies.randomId ?? (() => base64UrlRandom(18));
  const hashToken = dependencies.hashToken ?? sessionTokenHash;
  const rejectAndRevoke = async (
    record: AuthSessionRecord,
    revokedAt: number,
    reason: string,
  ) => {
    await dependencies.repository.revoke(record.id, revokedAt, reason);
    record.revokedAt = revokedAt;
    record.revokedReason = reason;
    return null;
  };

  return {
    async create(input: CreateSessionInput) {
      const createdAt = now();
      const token = randomToken();
      const record: AuthSessionRecord = {
        id: randomId(),
        userId: input.userId,
        tokenHash: hashToken(token),
        authMethod: input.authMethod,
        credentialIdHash: input.credentialIdHash ?? null,
        createdAt,
        lastSeenAt: createdAt,
        expiresAt: createdAt + SESSION_DURATION_MS[input.role],
        durationMs: SESSION_DURATION_MS[input.role],
        userValidatedAt: createdAt,
        keepActive: input.keepActive !== false,
        ...(input.authMethod === "passkey"
          ? { passkeyRevocationLinked: true }
          : {}),
        revokedAt: null,
        revokedReason: null,
      };
      await dependencies.repository.save(record);
      return { token, record };
    },

    async read(cookieHeader: string | null): Promise<AuthenticatedSession | null> {
      const token = getSessionTokenFromCookie(cookieHeader);
      if (!token) return null;
      const record = await dependencies.repository.findByTokenHash(
        hashToken(token),
      );
      const currentTime = now();
      if (!record || record.revokedAt !== null || record.expiresAt <= currentTime) {
        return null;
      }

      const user = await dependencies.getUser(record.userId);
      if (!user || user.isActive === false) {
        return rejectAndRevoke(record, currentTime, "user_inactive");
      }

      if (
        record.authMethod === "passkey" &&
        !record.credentialIdHash
      ) {
        return rejectAndRevoke(record, currentTime, "passkey_inactive");
      }
      if (
        record.authMethod === "passkey" &&
        record.passkeyRevocationLinked !== true
      ) {
        if (!(await dependencies.isPasskeyActive(record.credentialIdHash!))) {
          return rejectAndRevoke(record, currentTime, "passkey_inactive");
        }
        await dependencies.repository.linkPasskeySession(record.id);
        record.passkeyRevocationLinked = true;
      }

      if (
        record.keepActive !== false &&
        currentTime - record.lastSeenAt >= TOUCH_INTERVAL_MS
      ) {
        const role =
          user.role === "admin" || user.role === "superadmin"
            ? user.role
            : "user";
        const durationMs = SESSION_DURATION_MS[role];
        const renewedExpiresAt = currentTime + durationMs;
        await dependencies.repository.touch(
          record.id,
          currentTime,
          renewedExpiresAt,
          durationMs,
          currentTime,
        );
        record.lastSeenAt = currentTime;
        record.expiresAt = renewedExpiresAt;
        record.durationMs = durationMs;
        record.userValidatedAt = currentTime;
      }

      return { session: record, user: serializeSafeUser(user) };
    },

    async heartbeat(cookieHeader: string | null): Promise<AuthSessionRecord | null> {
      const token = getSessionTokenFromCookie(cookieHeader);
      if (!token) return null;
      const record = await dependencies.repository.findByTokenHash(
        hashToken(token),
      );
      const currentTime = now();
      if (!record || record.revokedAt !== null || record.expiresAt <= currentTime) {
        return null;
      }
      if (record.keepActive === false) return record;

      let durationMs = record.durationMs;
      let userValidatedAt: number | undefined;
      const userValidationDue =
        !durationMs ||
        currentTime - (record.userValidatedAt ?? record.createdAt) >=
          USER_REVALIDATION_INTERVAL_MS;
      if (userValidationDue) {
        const user = await dependencies.getUser(record.userId);
        if (!user || user.isActive === false) {
          return rejectAndRevoke(record, currentTime, "user_inactive");
        }
        if (
          record.authMethod === "passkey" &&
          !record.credentialIdHash
        ) {
          return rejectAndRevoke(record, currentTime, "passkey_inactive");
        }
        if (
          record.authMethod === "passkey" &&
          record.passkeyRevocationLinked !== true
        ) {
          if (!(await dependencies.isPasskeyActive(record.credentialIdHash!))) {
            return rejectAndRevoke(record, currentTime, "passkey_inactive");
          }
          await dependencies.repository.linkPasskeySession(record.id);
          record.passkeyRevocationLinked = true;
        }
        const role =
          user.role === "admin" || user.role === "superadmin"
            ? user.role
            : "user";
        durationMs = SESSION_DURATION_MS[role];
        userValidatedAt = currentTime;
      }

      if (!durationMs) {
        return rejectAndRevoke(record, currentTime, "invalid_session_duration");
      }

      if (currentTime - record.lastSeenAt >= TOUCH_INTERVAL_MS) {
        const renewedExpiresAt = currentTime + durationMs;
        await dependencies.repository.touch(
          record.id,
          currentTime,
          renewedExpiresAt,
          durationMs,
          userValidatedAt,
        );
        record.lastSeenAt = currentTime;
        record.expiresAt = renewedExpiresAt;
        record.durationMs = durationMs;
        if (userValidatedAt !== undefined) {
          record.userValidatedAt = userValidatedAt;
        }
      }
      return record;
    },

    async revoke(cookieHeader: string | null, reason: string) {
      const token = getSessionTokenFromCookie(cookieHeader);
      if (!token) return false;
      const record = await dependencies.repository.findByTokenHash(
        hashToken(token),
      );
      if (!record || record.revokedAt !== null) return false;
      await dependencies.repository.revoke(record.id, now(), reason);
      return true;
    },
  };
}

const toMillis = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis(): number }).toMillis();
  }
  return 0;
};

function firestoreSessionRepository(): SessionRepository {
  const collection = getAdminDb().collection("authSessions");
  return {
    async save(record) {
      await collection.doc(record.id).set({
        ...record,
        createdAt: Timestamp.fromMillis(record.createdAt),
        lastSeenAt: Timestamp.fromMillis(record.lastSeenAt),
        expiresAt: Timestamp.fromMillis(record.expiresAt),
      });
    },
    async findByTokenHash(tokenHash) {
      const snapshot = await collection
        .where("tokenHash", "==", tokenHash)
        .limit(1)
        .get();
      if (snapshot.empty) return null;
      const document = snapshot.docs[0];
      const data = document.data();
      return {
        ...(data as Omit<AuthSessionRecord, "id">),
        id: document.id,
        createdAt: toMillis(data.createdAt),
        lastSeenAt: toMillis(data.lastSeenAt),
        expiresAt: toMillis(data.expiresAt),
        revokedAt: data.revokedAt ? toMillis(data.revokedAt) : null,
      };
    },
    async revoke(id, revokedAt, reason) {
      await collection.doc(id).update({
        revokedAt: Timestamp.fromMillis(revokedAt),
        revokedReason: reason,
      });
    },
    async touch(id, lastSeenAt, expiresAt, durationMs, userValidatedAt) {
      await collection.doc(id).update({
        lastSeenAt: Timestamp.fromMillis(lastSeenAt),
        ...(expiresAt === undefined
          ? {}
          : { expiresAt: Timestamp.fromMillis(expiresAt) }),
        ...(durationMs === undefined ? {} : { durationMs }),
        ...(userValidatedAt === undefined ? {} : { userValidatedAt }),
      });
    },
    async linkPasskeySession(id) {
      await collection.doc(id).update({ passkeyRevocationLinked: true });
    },
  };
}

function sessionTokenHash(token: string) {
  const secret = getWebAuthnConfig().sessionSecret;
  return createHmac("sha256", secret)
    .update(token, "utf8")
    .digest("base64url");
}

function productionSessionService() {
  return createSessionService({
    repository: firestoreSessionRepository(),
    async getUser(userId) {
      const snapshot = await getAdminDb().collection("users").doc(userId).get();
      return snapshot.exists
        ? ({ id: snapshot.id, ...snapshot.data() } as User)
        : null;
    },
    async isPasskeyActive(credentialIdHash) {
      const snapshot = await getAdminDb()
        .collection("passkeys")
        .doc(credentialIdHash)
        .get();
      return snapshot.exists && !snapshot.data()?.revokedAt;
    },
  });
}

export async function createAuthSession(input: CreateSessionInput) {
  return productionSessionService().create(input);
}

export async function readAuthSession(cookieHeader: string | null) {
  return productionSessionService().read(cookieHeader);
}

export async function heartbeatAuthSession(cookieHeader: string | null) {
  return productionSessionService().heartbeat(cookieHeader);
}

export async function revokeAuthSession(
  cookieHeader: string | null,
  reason = "logout",
) {
  return productionSessionService().revoke(cookieHeader, reason);
}
