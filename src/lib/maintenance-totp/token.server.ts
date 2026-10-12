import { createHmac, timingSafeEqual } from "node:crypto";

export const MAINTENANCE_BYPASS_COOKIE = "maint_bypass";
const DEFAULT_BYPASS_MINUTES = 30;
const MAX_BYPASS_MINUTES = 120;

interface BypassPayload {
  bypass: true;
  sa: string;
  iat: number;
  exp: number;
}

export interface VerifiedMaintenanceBypass {
  active: true;
  superadminId: string;
  expiresAt: number;
}

export type MaintenanceBypassVerification =
  | VerifiedMaintenanceBypass
  | { active: false };

const encodeJson = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

function validJwtSecret(secret: string): string {
  if (Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("Maintenance JWT secret must be at least 32 bytes.");
  }
  return secret;
}

function signature(input: string, secret: string): Buffer {
  return createHmac("sha256", validJwtSecret(secret)).update(input).digest();
}

export function getBypassDurationMinutes(
  env: Record<string, string | undefined> = process.env,
): number {
  const parsed = Number.parseInt(env.BYPASS_MINUTES || "", 10);
  if (!Number.isFinite(parsed)) return DEFAULT_BYPASS_MINUTES;
  return Math.min(MAX_BYPASS_MINUTES, Math.max(1, parsed));
}

export function getMaintenanceJwtSecret(
  env: Record<string, string | undefined> = process.env,
): string {
  const secret =
    env.MAINTENANCE_BYPASS_JWT_SECRET?.trim() || env.JWT_SECRET?.trim() || "";
  if (!secret) {
    throw new Error(
      "MAINTENANCE_BYPASS_JWT_SECRET or JWT_SECRET is required.",
    );
  }
  return validJwtSecret(secret);
}

export function createMaintenanceBypassToken({
  superadminId,
  secret,
  durationMinutes,
  now = Date.now(),
}: {
  superadminId: string;
  secret: string;
  durationMinutes: number;
  now?: number;
}): string {
  const actor = superadminId.trim();
  if (!actor) throw new Error("A superadmin id is required.");
  const issuedAt = Math.floor(now / 1000);
  const durationSeconds = Math.floor(durationMinutes * 60);
  if (!Number.isFinite(durationSeconds) || durationSeconds < 60) {
    throw new Error("Invalid maintenance bypass duration.");
  }

  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson({
    bypass: true,
    sa: actor,
    iat: issuedAt,
    exp: issuedAt + durationSeconds,
  } satisfies BypassPayload);
  const body = `${header}.${payload}`;
  return `${body}.${signature(body, secret).toString("base64url")}`;
}

export function verifyMaintenanceBypassToken(
  token: string | null | undefined,
  secret: string,
  now = Date.now(),
): MaintenanceBypassVerification {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) return { active: false };
    const [headerEncoded, payloadEncoded, signatureEncoded] = parts;
    const body = `${headerEncoded}.${payloadEncoded}`;
    const receivedSignature = Buffer.from(signatureEncoded, "base64url");
    const expectedSignature = signature(body, secret);
    if (
      receivedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(receivedSignature, expectedSignature)
    ) {
      return { active: false };
    }

    const header = JSON.parse(
      Buffer.from(headerEncoded, "base64url").toString("utf8"),
    ) as Record<string, unknown>;
    const payload = JSON.parse(
      Buffer.from(payloadEncoded, "base64url").toString("utf8"),
    ) as Partial<BypassPayload>;
    const nowSeconds = Math.floor(now / 1000);
    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      payload.bypass !== true ||
      typeof payload.sa !== "string" ||
      !payload.sa ||
      typeof payload.exp !== "number" ||
      payload.exp <= nowSeconds
    ) {
      return { active: false };
    }

    return {
      active: true,
      superadminId: payload.sa,
      expiresAt: payload.exp * 1000,
    };
  } catch {
    return { active: false };
  }
}

export function maintenanceBypassCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: Math.max(0, Math.floor(maxAgeSeconds)),
  };
}

export function getMaintenanceBypassTokenFromCookie(
  cookieHeader: string | null,
): string | null {
  const encoded = String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${MAINTENANCE_BYPASS_COOKIE}=`))
    ?.slice(MAINTENANCE_BYPASS_COOKIE.length + 1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export function verifyMaintenanceBypassCookie(
  cookieHeader: string | null,
  env: Record<string, string | undefined> = process.env,
  now = Date.now(),
): MaintenanceBypassVerification {
  const token = getMaintenanceBypassTokenFromCookie(cookieHeader);
  if (!token) return { active: false };
  return verifyMaintenanceBypassToken(token, getMaintenanceJwtSecret(env), now);
}
