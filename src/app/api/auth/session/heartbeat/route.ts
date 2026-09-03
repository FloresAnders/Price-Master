import { NextResponse } from "next/server";
import { heartbeatAuthSession } from "@/lib/auth/session-store.server";
import {
  getSessionCookieMaxAge,
  getSessionTokenFromCookie,
  setAuthCookie,
} from "@/lib/auth/session-cookie.server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const session = await heartbeatAuthSession(cookieHeader);
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      session: {
        authMethod: session.authMethod,
        expiresAt: session.expiresAt,
      },
    },
    { headers: noStore },
  );
  const token = getSessionTokenFromCookie(cookieHeader);
  if (token) {
    const maxAge = getSessionCookieMaxAge(
      session.keepActive !== false,
      session.expiresAt,
    );
    setAuthCookie(response, token, maxAge);
  }
  return response;
}
