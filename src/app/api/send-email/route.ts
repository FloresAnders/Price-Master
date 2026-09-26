import { NextRequest, NextResponse } from "next/server";
import { EmailService } from "../../../services/email";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  consumeRateLimit,
  requestClientKey,
} from "@/lib/security/rate-limit.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type EmailPayload = {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
};

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_EMAILS = 20;
const MAX_SUBJECT_LENGTH = 200;
const MAX_BODY_LENGTH = 20_000;
const MAX_RECIPIENT_LENGTH = 320;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Optional allowlist. When set, only recipients whose address ends with one of
 * the configured domains (comma separated) may receive mail through the API.
 * Example: EMAIL_ALLOWED_RECIPIENT_DOMAINS="timemaster.cr,example.com"
 */
const allowedRecipientDomains = (): string[] =>
  String(process.env.EMAIL_ALLOWED_RECIPIENT_DOMAINS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

const isRecipientAllowed = (email: string): boolean => {
  const domains = allowedRecipientDomains();
  if (domains.length === 0) return true;
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 0) return false;
  const domain = email.slice(atIndex + 1).toLowerCase();
  return domains.some(
    (allowed) => domain === allowed || domain.endsWith(`.${allowed}`),
  );
};

const canSendEmail = (user: {
  role?: string;
  permissions?: { mantenimiento?: boolean } | null;
}): boolean =>
  user.role === "admin" ||
  user.role === "superadmin" ||
  user.permissions?.mantenimiento === true;

export async function GET(request: NextRequest) {
  const authenticated = await readAuthSession(request.headers.get("cookie"));
  if (!authenticated?.user?.id || !canSendEmail(authenticated.user)) {
    return NextResponse.json(
      { configured: false, error: "No autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.json({
    configured: true,
    message: "Email service configured via Firestore triggers",
  });
}

export async function POST(request: NextRequest) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    const user = authenticated?.user;
    if (!user?.id || !canSendEmail(user)) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    }

    const limited = consumeRateLimit(
      `send-email:${requestClientKey(request)}:${user.id}`,
      RATE_LIMIT_MAX_EMAILS,
      RATE_LIMIT_WINDOW_MS,
    );
    if (!limited.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Demasiados envíos. Intenta nuevamente en unos minutos.",
        },
        {
          status: 429,
          headers: {
            "Cache-Control": "no-store",
            "Retry-After": String(limited.retryAfterSeconds),
          },
        },
      );
    }

    const payload = (await request.json().catch(() => null)) as
      | EmailPayload
      | null;
    const to = typeof payload?.to === "string" ? payload.to.trim() : "";
    const subject =
      typeof payload?.subject === "string" ? payload.subject.trim() : "";
    const text = typeof payload?.text === "string" ? payload.text : "";

    if (!to || !subject || !text) {
      return NextResponse.json(
        {
          success: false,
          error: "Faltan campos obligatorios (to, subject, text)",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (
      to.length > MAX_RECIPIENT_LENGTH ||
      !EMAIL_PATTERN.test(to) ||
      !isRecipientAllowed(to)
    ) {
      return NextResponse.json(
        { success: false, error: "Destinatario no permitido." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    if (subject.length > MAX_SUBJECT_LENGTH || text.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { success: false, error: "El correo excede el tamaño permitido." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const html = typeof payload?.html === "string" ? payload.html : undefined;
    if (html && html.length > MAX_BODY_LENGTH) {
      return NextResponse.json(
        { success: false, error: "El correo excede el tamaño permitido." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    await EmailService.queueEmail({ to, subject, text, html });

    return NextResponse.json(
      {
        success: true,
        message: "Email queued successfully via Firestore trigger",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("API send-email error:", error);
    return NextResponse.json(
      { success: false, error: "No se pudo procesar el correo." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
