import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  sessionCookieOptions,
} from "@/shared/lib/auth/session-cookie.server";

export const runtime = "nodejs";

export async function POST() {
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
  });
  return response;
}
