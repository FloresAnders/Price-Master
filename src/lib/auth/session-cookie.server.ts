import crypto from "crypto";

export const AUTH_COOKIE_NAME = "pricemaster_auth";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type SessionPayload = {
  userId: string;
  exp: number;
};

const base64url = (value: string | Buffer) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

function getSecret() {
  return (
    process.env.PRICE_MASTER_SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    "price-master-session"
  );
}

function sign(payload: string) {
  return base64url(
    crypto.createHmac("sha256", getSecret()).update(payload).digest(),
  );
}

export function createSessionCookieValue(userId: string) {
  const payload = base64url(
    JSON.stringify({
      userId,
      exp: Date.now() + MAX_AGE_SECONDS * 1000,
    } satisfies SessionPayload),
  );
  return `${payload}.${sign(payload)}`;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  };
}

export function readUserIdFromSessionCookie(cookieHeader: string | null) {
  const cookie = String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`));
  const value = cookie?.slice(AUTH_COOKIE_NAME.length + 1);
  if (!value) return "";

  const [payload, signature] = value.split(".");
  if (!payload || !signature || sign(payload) !== signature) return "";

  try {
    const decoded = JSON.parse(
      Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64")
        .toString("utf8"),
    ) as SessionPayload;
    if (!decoded.userId || Date.now() > decoded.exp) return "";
    return decoded.userId;
  } catch {
    return "";
  }
}
