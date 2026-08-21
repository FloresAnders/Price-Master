import type { NextResponse } from "next/server";
import { base64UrlRandom } from "@/lib/passkeys/crypto.server";

export const BROWSER_BINDING_COOKIE = "timemaster_webauthn_browser";
const BROWSER_BINDING_MAX_AGE = 365 * 24 * 60 * 60;

export function getBrowserBinding(request: Request): string | null {
  const value = String(request.headers.get("cookie") || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${BROWSER_BINDING_COOKIE}=`))
    ?.slice(BROWSER_BINDING_COOKIE.length + 1);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function ensureBrowserBinding(
  request: Request,
  generate: () => string = () => base64UrlRandom(32),
) {
  const existing = getBrowserBinding(request);
  return existing
    ? { value: existing, isNew: false }
    : { value: generate(), isNew: true };
}

export function setBrowserBindingCookie(response: NextResponse, value: string) {
  response.cookies.set(BROWSER_BINDING_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: BROWSER_BINDING_MAX_AGE,
  });
}
