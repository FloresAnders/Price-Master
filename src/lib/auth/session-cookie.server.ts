import type { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "pricemaster_auth";

export function getSessionTokenFromCookie(
  cookieHeader: string | null,
): string | null {
  const encoded = String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${AUTH_COOKIE_NAME}=`))
    ?.slice(AUTH_COOKIE_NAME.length + 1);

  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export function sessionCookieOptions(
  maxAge: number | undefined,
  secure = process.env.NODE_ENV === "production",
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    ...(maxAge === undefined ? {} : { maxAge }),
  };
}

export function getSessionCookieMaxAge(
  keepActive: boolean,
  expiresAt: number,
  now = Date.now(),
): number | undefined {
  if (!keepActive) return undefined;
  return Math.max(0, Math.floor((expiresAt - now) / 1000));
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  maxAge?: number,
) {
  response.cookies.set(
    AUTH_COOKIE_NAME,
    token,
    sessionCookieOptions(maxAge),
  );
}

export function clearAuthCookie(response: NextResponse) {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...sessionCookieOptions(0),
    maxAge: 0,
  });
}

export async function readUserIdFromSessionCookie(
  cookieHeader: string | null,
) {
  const { readAuthSession } = await import("./session-store.server");
  return (await readAuthSession(cookieHeader))?.user.id || "";
}
