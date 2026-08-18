import { NextResponse } from "next/server";
import { UsersService } from "@/services/users";
import {
  AUTH_COOKIE_NAME,
  readUserIdFromSessionCookie,
  sessionCookieOptions,
} from "@/lib/auth/session-cookie.server";

export const runtime = "nodejs";

function sanitizeUser(user: Record<string, any> | null) {
  if (!user) return null;
  const safeUser = { ...user } as Record<string, any>;
  delete safeUser.password;
  return safeUser;
}

export async function GET(request: Request) {
  const userId = readUserIdFromSessionCookie(
    request.headers.get("cookie"),
  );

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "No active session" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const user = await UsersService.getUserById(userId);
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Session user not found" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      {
        ok: true,
        user: sanitizeUser(user),
        session: {
          authMethod: "password",
          expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Session route error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const userId = readUserIdFromSessionCookie(cookieHeader);

  if (!userId) {
    return NextResponse.json(
      { ok: false, error: "No active session" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const response = NextResponse.json(
    { ok: true, userId },
    { headers: { "Cache-Control": "no-store" } },
  );

  response.cookies.set(AUTH_COOKIE_NAME, cookieHeader ?? "", {
    ...sessionCookieOptions(),
    maxAge: sessionCookieOptions().maxAge,
  });

  return response;
}
