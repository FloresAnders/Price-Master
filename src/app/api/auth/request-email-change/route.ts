import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "@/services/email";
import { EmailChangeCodeService } from "@/services/emailChangeCodeService";
import { buildEmailChangeVerificationTemplate } from "@/services/email-templates/cambio-correo";
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
const RATE_LIMIT_MAX_REQUESTS = 5;

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

    const limited = consumeRateLimit(
      `email-change-request:${requestClientKey(request)}:${targetUserId}`,
      RATE_LIMIT_MAX_REQUESTS,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!limited.allowed) {
      return NextResponse.json(
        { success: false, error: "Demasiadas solicitudes. Intenta más tarde." },
        {
          status: 429,
          headers: {
            ...noStore,
            "Retry-After": String(limited.retryAfterSeconds),
          },
        },
      );
    }

    const userSnap = await getAdminDb()
      .collection("users")
      .doc(targetUserId)
      .get();

    if (!userSnap.exists) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado" },
        { status: 404, headers: noStore },
      );
    }

    const currentEmailRaw = userSnap.data()?.email ?? "";
    const currentEmail = String(currentEmailRaw || "")
      .trim()
      .toLowerCase();
    if (!currentEmail || !isValidEmail(currentEmail)) {
      return NextResponse.json(
        {
          success: false,
          error: "El usuario no tiene un correo válido configurado",
        },
        { status: 400, headers: noStore },
      );
    }

    const { code, expiresAt } = await EmailChangeCodeService.createCode(
      targetUserId,
    );

    const template = buildEmailChangeVerificationTemplate({
      code,
      expiresAt,
    });

    await EmailService.queueEmail({
      // Seguridad: envía el código al correo actual (propietario de la cuenta).
      // Así se evita que alguien cambie el correo de otra cuenta apuntando el código a su propio correo.
      to: currentEmail,
      subject: template.subject,
      text: template.text,
      html: template.html,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Código enviado",
        expiresAt,
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Error en request-email-change:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo procesar la solicitud." },
      { status: 500, headers: noStore },
    );
  }
}
