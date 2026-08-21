import type { NextResponse } from "next/server";

export const AUTH_COOKIE_NAME = "pricemaster_auth";
const DEFAULT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

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
  maxAge = DEFAULT_MAX_AGE_SECONDS,
  secure = process.env.NODE_ENV === "production",
) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge,
  };
}

export function setAuthCookie(
  response: NextResponse,
  token: string,
  maxAge: number,
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
