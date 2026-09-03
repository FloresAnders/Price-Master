import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  getSessionCookieMaxAge,
  getSessionTokenFromCookie,
  setAuthCookie,
} from "@/lib/auth/session-cookie.server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const authenticated = await readAuthSession(cookieHeader);
  if (!authenticated) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  const response = NextResponse.json(
    {
      ok: true,
      user: authenticated.user,
      session: {
        id: authenticated.session.id,
        authMethod: authenticated.session.authMethod,
        keepActive: authenticated.session.keepActive !== false,
        createdAt: authenticated.session.createdAt,
        lastSeenAt: authenticated.session.lastSeenAt,
        expiresAt: authenticated.session.expiresAt,
      },
    },
    { headers: noStore },
  );
  const token = getSessionTokenFromCookie(cookieHeader);
  if (token) {
    const maxAge = getSessionCookieMaxAge(
      authenticated.session.keepActive !== false,
      authenticated.session.expiresAt,
    );
    setAuthCookie(response, token, maxAge);
  }
  return response;
}
