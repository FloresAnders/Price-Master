import { createHash } from "node:crypto";
import {
  decryptMaintenanceSecret,
  encryptMaintenanceSecret,
} from "./crypto.server";
import {
  createMaintenanceTotpSecret,
  createMaintenanceTotpUri,
  verifyMaintenanceTotpCode,
} from "./totp.server";

const RATE_WINDOW_MS = 60_000;
const SUBJECT_ATTEMPTS_PER_WINDOW = 5;
const GLOBAL_ATTEMPTS_PER_WINDOW = 25;

export interface MaintenanceTotpRecord {
  userId: string;
  purpose: "maintenance";
  secretEncrypted: string;
  confirmedAt: number | null;
  lastUsedStep: number;
  createdAt: number;
  updatedAt: number;
}

export type MaintenanceAccessEventName =
  | "enroll_start"
  | "enroll"
  | "enroll_fail"
  | "disable"
  | "bypass_ok"
  | "bypass_fail"
  | "bypass_rate_limited";

export interface MaintenanceAccessEvent {
  event: MaintenanceAccessEventName;
  superadminUserId: string | null;
  ip: string;
  userAgent: string;
  createdAt: number;
}

export interface RateLimitInput {
  scope: "bypass" | "confirm";
  subjectHash: string;
  windowStart: number;
  subjectLimit: number;
  globalLimit: number;
}

export interface MaintenanceTotpRepository {
  getByUserId(userId: string): Promise<MaintenanceTotpRecord | null>;
  savePending(record: MaintenanceTotpRecord): Promise<void>;
  listConfirmed(): Promise<MaintenanceTotpRecord[]>;
  confirm(
    userId: string,
    secretEncrypted: string,
    step: number,
    now: number,
  ): Promise<boolean>;
  consumeStep(userId: string, step: number, now: number): Promise<boolean>;
  deleteByUserId(userId: string): Promise<boolean>;
  consumeRateLimit(input: RateLimitInput): Promise<boolean>;
  log(event: MaintenanceAccessEvent): Promise<void>;
}

interface MaintenanceTotpServiceDependencies {
  repository: MaintenanceTotpRepository;
  encryptionKey: string;
  now?: () => number;
  generateSecret?: () => string;
}

interface RequestMeta {
  ip: string;
  userAgent: string;
}

const cleanMeta = (meta: RequestMeta): RequestMeta => ({
  ip: String(meta.ip || "unknown").slice(0, 128),
  userAgent: String(meta.userAgent || "unknown").slice(0, 500),
});

const subjectHash = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex");

export function createMaintenanceTotpService({
  repository,
  encryptionKey,
  now = Date.now,
  generateSecret = createMaintenanceTotpSecret,
}: MaintenanceTotpServiceDependencies) {
  const allowAttempt = async (
    scope: RateLimitInput["scope"],
    subject: string,
    at: number,
  ) =>
    repository.consumeRateLimit({
      scope,
      subjectHash: subjectHash(subject),
      windowStart: Math.floor(at / RATE_WINDOW_MS) * RATE_WINDOW_MS,
      subjectLimit: SUBJECT_ATTEMPTS_PER_WINDOW,
      globalLimit: GLOBAL_ATTEMPTS_PER_WINDOW,
    });

  const writeLog = (
    event: MaintenanceAccessEventName,
    superadminUserId: string | null,
    meta: RequestMeta,
    createdAt: number,
  ) => {
    const clean = cleanMeta(meta);
    return repository.log({
      event,
      superadminUserId,
      ip: clean.ip,
      userAgent: clean.userAgent,
      createdAt,
    });
  };

  return {
    async start({
      userId,
      label,
      ...meta
    }: { userId: string; label: string } & RequestMeta) {
      const createdAt = now();
      const secret = generateSecret();
      const secretEncrypted = encryptMaintenanceSecret(secret, encryptionKey);
      await repository.savePending({
        userId,
        purpose: "maintenance",
        secretEncrypted,
        confirmedAt: null,
        lastUsedStep: 0,
        createdAt,
        updatedAt: createdAt,
      });
      await writeLog("enroll_start", userId, meta, createdAt);
      return { otpauthUri: createMaintenanceTotpUri(label, secret) };
    },

    async status(userId: string): Promise<
      | { active: false }
      | { active: true; confirmedAt: number }
    > {
      const record = await repository.getByUserId(userId);
      return record?.confirmedAt
        ? { active: true, confirmedAt: record.confirmedAt }
        : { active: false };
    },

    async confirm({
      userId,
      code,
      ...meta
    }: { userId: string; code: string } & RequestMeta): Promise<
      { ok: true } | { ok: false; reason: "invalid" | "rate_limited" }
    > {
      const attemptedAt = now();
      const clean = cleanMeta(meta);
      if (
        !(await allowAttempt(
          "confirm",
          `${userId}\n${clean.ip}`,
          attemptedAt,
        ))
      ) {
        await writeLog("enroll_fail", userId, clean, attemptedAt);
        return { ok: false, reason: "rate_limited" };
      }

      const record = await repository.getByUserId(userId);
      if (!record || record.confirmedAt) {
        await writeLog("enroll_fail", userId, clean, attemptedAt);
        return { ok: false, reason: "invalid" };
      }

      try {
        const secret = decryptMaintenanceSecret(
          record.secretEncrypted,
          encryptionKey,
        );
        const verification = await verifyMaintenanceTotpCode(
          code,
          secret,
          attemptedAt,
        );
        if (
          verification.valid &&
          (await repository.confirm(
            userId,
            record.secretEncrypted,
            verification.step,
            attemptedAt,
          ))
        ) {
          await writeLog("enroll", userId, clean, attemptedAt);
          return { ok: true };
        }
      } catch {
        // Do not expose or log secret/decryption details.
      }

      await writeLog("enroll_fail", userId, clean, attemptedAt);
      return { ok: false, reason: "invalid" };
    },

    async disable({ userId, ...meta }: { userId: string } & RequestMeta) {
      const disabledAt = now();
      await repository.deleteByUserId(userId);
      await writeLog("disable", userId, meta, disabledAt);
    },

    async bypass({ code, ...meta }: { code: string } & RequestMeta): Promise<
      | { ok: true; superadminId: string }
      | { ok: false; reason: "invalid" | "rate_limited" }
    > {
      const attemptedAt = now();
      const clean = cleanMeta(meta);
      if (!(await allowAttempt("bypass", clean.ip, attemptedAt))) {
        await writeLog("bypass_rate_limited", null, clean, attemptedAt);
        return { ok: false, reason: "rate_limited" };
      }

      const records = await repository.listConfirmed();
      for (const record of records) {
        try {
          const secret = decryptMaintenanceSecret(
            record.secretEncrypted,
            encryptionKey,
          );
          const verification = await verifyMaintenanceTotpCode(
            code,
            secret,
            attemptedAt,
          );
          if (
            verification.valid &&
            (await repository.consumeStep(
              record.userId,
              verification.step,
              attemptedAt,
            ))
          ) {
            await writeLog("bypass_ok", record.userId, clean, attemptedAt);
            return { ok: true, superadminId: record.userId };
          }
        } catch {
          // A corrupt record must not identify its owner or block other secrets.
        }
      }

      await writeLog("bypass_fail", null, clean, attemptedAt);
      return { ok: false, reason: "invalid" };
    },
  };
}
