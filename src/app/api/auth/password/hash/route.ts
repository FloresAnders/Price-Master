import { NextResponse } from "next/server";
// Force Node runtime for hashing endpoint
export const runtime = "nodejs";
import { hashPasswordServer } from "@/lib/auth/password.server";
import {
  consumeRateLimit,
  requestClientKey,
} from "@/lib/security/rate-limit.server";

// This endpoint must stay callable before authentication: the login modal
// derives a local password hash right after a successful sign-in. It is
// therefore protected with a burst rate limit (Argon2 is CPU-expensive) and a
// hard input cap instead of a session check.
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const MAX_PASSWORD_LENGTH = 1024;

export async function POST(request: Request) {
  try {
    const limited = consumeRateLimit(
      `password-hash:${requestClientKey(request)}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { error: "Demasiadas solicitudes." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limited.retryAfterSeconds),
          },
        },
      );
    }

    const body = (await request.json().catch(() => null)) as {
      password?: unknown;
    } | null;
    const password = body?.password;

    if (
      typeof password !== "string" ||
      password.length === 0 ||
      password.length > MAX_PASSWORD_LENGTH
    ) {
      return NextResponse.json(
        { error: "Invalid password" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const hash = await hashPasswordServer(password);
    return NextResponse.json(
      { hash },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error hashing password:", error);
    return NextResponse.json(
      { error: "Hashing failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
