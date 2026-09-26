import { NextRequest, NextResponse } from "next/server";
import { EmailChangeCodeService } from "@/services/emailChangeCodeService";
import { getAdminDb } from "@/lib/firebase-admin";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { resolveEmailChangeTargetUserId } from "@/lib/auth/email-change.server";
import {
  consumeRateLimit,
  requestClientKey,
} from "@/lib/security/rate-limit.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 10;

const noStore = { "Cache-Control": "no-store" };

const isValidEmail = (value: string) => {
  const trimmed = String(value || "").trim();
  return trimmed.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};

export async function POST(request: NextRequest) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated?.user?.id) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401, headers: noStore },
      );
    }

    const body = await request.json().catch(() => null);
    const targetUserId = resolveEmailChangeTargetUserId(
      authenticated.user,
      body?.userId,
    );
    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 403, headers: noStore },
      );
    }

    const newEmail = typeof body?.newEmail === "string" ? body.newEmail : "";
    const code = body?.code;

    if (!newEmail || code === undefined || code === null) {
      return NextResponse.json(
        { success: false, error: "userId, newEmail y code son requeridos" },
        { status: 400, headers: noStore },
      );
    }

    if (!isValidEmail(newEmail)) {
      return NextResponse.json(
        { success: false, error: "Correo inválido" },
        { status: 400, headers: noStore },
      );
    }

    const limited = consumeRateLimit(
      `email-change-confirm:${requestClientKey(request)}:${targetUserId}`,
      RATE_LIMIT_MAX_ATTEMPTS,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiados intentos. Intenta más tarde." },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(limited.retryAfterSeconds),
          },
        },
      );
    }

    const normalizedNewEmail = String(newEmail).trim().toLowerCase();

    const validation = await EmailChangeCodeService.verifyAndConsume({
      userId: targetUserId,
      code,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || "Código inválido" },
        { status: 400, headers: noStore },
      );
    }

    const db = getAdminDb();

    // Evitar duplicados (revalidación en confirmación por posibles carreras).
    const existing = await db
      .collection("users")
      .where("email", "==", normalizedNewEmail)
      .limit(1)
      .get();
    if (!existing.empty && existing.docs[0].id !== targetUserId) {
      return NextResponse.json(
        { success: false, error: "Este correo ya está en uso" },
        { status: 400, headers: noStore },
      );
    }

    await db.collection("users").doc(targetUserId).update({
      email: normalizedNewEmail,
      emailUpdatedAt: Date.now(),
    });

    return NextResponse.json(
      {
        success: true,
        message: "Correo actualizado",
        email: normalizedNewEmail,
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Error en confirm-email-change:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo confirmar el cambio." },
      { status: 500, headers: noStore },
    );
  }
}
