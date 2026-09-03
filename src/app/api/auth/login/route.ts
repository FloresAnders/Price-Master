import { NextResponse } from "next/server";
// Force Node runtime for login route (sensitive, do not run on Edge functions)
export const runtime = "nodejs";
import { UsersService } from "@/services/users";
import {
  verifyPasswordServer,
  hashPasswordServer,
} from "@/lib/auth/password.server";
import {
  getSessionCookieMaxAge,
  setAuthCookie,
} from "@/lib/auth/session-cookie.server";
import {
  createAuthSession,
  serializeSafeUser,
} from "@/lib/auth/session-store.server";
import { getCeremonyService } from "@/lib/passkeys/ceremonies.server";
import {
  clearLoginAttempts,
  consumeLoginAttempt,
} from "@/lib/auth/login-rate-limit.server";

export async function POST(request: Request) {
  try {
    const { username, password, enrollPasskey, keepSessionActive } =
      await request.json();

    if (
      typeof username !== "string" ||
      typeof password !== "string" ||
      username.trim().length < 1 ||
      username.trim().length > 80 ||
      password.length > 1024
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid input" },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const attempt = consumeLoginAttempt(request, username);
    if (!attempt.allowed) {
      return NextResponse.json(
        { ok: false, error: "Demasiados intentos. Intenta nuevamente pronto." },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(attempt.retryAfterSeconds),
          },
        },
      );
    }

    const user = await UsersService.findActiveUserByUsername(username);

    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Acceso denegado" },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    let isValid = false;
    if (user.password) {
      if (user.password.startsWith("$argon2")) {
        isValid = await verifyPasswordServer(password, user.password);
      } else {
        // Legacy plain text password: compare and optionally rehash
        isValid = user.password === password;
        if (isValid && user.id) {
          try {
            const newHash = await hashPasswordServer(password);
            await UsersService.updateUser(user.id, { password: newHash });
            user.password = newHash;
          } catch (err) {
            console.warn(
              "Failed to upgrade legacy password hash for user",
              user.id,
              err,
            );
          }
        }
      }
    }
    const safeUser = serializeSafeUser(user) as any;
    // Agregar bandera para superadmin
    const isSuperAdmin = safeUser.role === "superadmin";
    if (!isValid) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized", isSuperAdmin },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (user.id && !user.nameNormalized) {
      try {
        await UsersService.backfillUsernameLookup(user.id, username);
      } catch (error) {
        console.warn("Failed to backfill normalized username", user.id, error);
      }
    }
    clearLoginAttempts(request, username);

    let enrollmentGrantId: string | undefined;
    let issued:
      | Awaited<ReturnType<typeof createAuthSession>>
      | undefined;
    if (safeUser.id) {
      issued = await createAuthSession({
        userId: safeUser.id,
        role: safeUser.role || "user",
        authMethod: "password",
        keepActive: keepSessionActive !== false,
      });
      if (enrollPasskey === true) {
        const grant = await getCeremonyService().createEnrollmentGrant(
          safeUser.id,
          issued.record.id,
        );
        enrollmentGrantId = grant.id;
      }
    }

    const response = NextResponse.json(
      {
        ok: true,
        user: safeUser,
        ...(enrollmentGrantId ? { enrollmentGrantId } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
    if (issued) {
      const maxAge = getSessionCookieMaxAge(
        issued.record.keepActive !== false,
        issued.record.expiresAt,
      );
      setAuthCookie(response, issued.token, maxAge);
    }
    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal Server Error" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
