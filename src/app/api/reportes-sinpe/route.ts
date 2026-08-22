import { NextRequest, NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { EmpresasService } from "@/services/empresas";
import { readBcrSinpeReport } from "@/services/sinpe-imap.server";
import type { Empresas, User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";

export const runtime = "nodejs";

const MAX_RANGE_MS = 48 * 60 * 60 * 1000;
const API_TIMEOUT_MS = 15_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_ATTEMPTS = 6;
const noStore = { "Cache-Control": "no-store" };
const attempts = new Map<string, { count: number; resetAt: number }>();

class SinpeReportTimeoutError extends Error {
  constructor() {
    super("SINPE report timeout");
    this.name = "SinpeReportTimeoutError";
  }
}

const parseRangeDate = (date: unknown, time: unknown) => {
  if (typeof date !== "string" || typeof time !== "string") return null;
  const parsed = new Date(`${date}T${time}:00-06:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizeKey = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

const rateLimitKey = (request: NextRequest, userId: string) => {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  return `${ip}:${userId}`;
};

const isRateLimited = (key: string) => {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  return current.count > RATE_LIMIT_MAX_ATTEMPTS;
};

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new SinpeReportTimeoutError()),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });

const canAccessEmpresa = (user: Omit<User, "password">, empresa: Empresas) => {
  if (user.role === "superadmin") return true;

  if (user.role === "admin") {
    const allowedOwners = new Set<string>();
    const ownerId = normalizeKey(user.ownerId);
    const userId = normalizeKey(user.id);
    if (ownerId) allowedOwners.add(ownerId);
    if (user.eliminate === false && userId) allowedOwners.add(userId);
    return allowedOwners.has(normalizeKey(empresa.ownerId));
  }

  if (user.role !== "user") return false;
  const assigned = normalizeKey(user.ownercompanie);
  if (!assigned) return false;
  return [empresa.id, empresa.name, empresa.ubicacion]
    .map(normalizeKey)
    .filter(Boolean)
    .includes(assigned);
};

export async function POST(request: NextRequest) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated?.user.id) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401, headers: noStore },
      );
    }

    const permissions = normalizeUserPermissions(
      authenticated.user.permissions,
      authenticated.user.role || "user",
    );
    if (!permissions.reportessinpe) {
      return NextResponse.json(
        { error: "No tienes permisos para usar Reportes SINPE." },
        { status: 403, headers: noStore },
      );
    }

    if (isRateLimited(rateLimitKey(request, authenticated.user.id))) {
      return NextResponse.json(
        { error: "Demasiadas consultas SINPE. Intenta de nuevo en un minuto." },
        { status: 429, headers: noStore },
      );
    }

    const body = (await request.json()) as {
      empresaId?: string;
      startDate?: string;
      startTime?: string;
      endDate?: string;
      endTime?: string;
    };

    const empresaId = String(body.empresaId || "").trim();
    const start = parseRangeDate(body.startDate, body.startTime);
    const end = parseRangeDate(body.endDate, body.endTime);

    if (!empresaId || !start || !end) {
      return NextResponse.json(
        { error: "Datos de consulta incompletos." },
        { status: 400, headers: noStore },
      );
    }

    if (start > end) {
      return NextResponse.json(
        { error: "Rango inválido: inicio mayor que fin." },
        { status: 400, headers: noStore },
      );
    }

    if (end.getTime() - start.getTime() > MAX_RANGE_MS) {
      return NextResponse.json(
        { error: "Rango demasiado amplio. Consulta como máximo 48 horas." },
        { status: 400, headers: noStore },
      );
    }

    const empresa = await EmpresasService.getEmpresaById(empresaId);
    if (empresa && !canAccessEmpresa(authenticated.user, empresa)) {
      return NextResponse.json(
        { error: "No tienes acceso a esta empresa." },
        { status: 403, headers: noStore },
      );
    }

    const email = empresa?.correoConfigEmail?.trim();
    const password = empresa?.correoConfigPassword?.trim();

    if (!empresa || !email || !password) {
      return NextResponse.json(
        { error: "Empresa sin configuración de correo." },
        { status: 400, headers: noStore },
      );
    }

    const report = await withTimeout(
      readBcrSinpeReport({
        email,
        password,
        start,
        end,
      }),
      API_TIMEOUT_MS,
    );

    return NextResponse.json(report, { headers: noStore });
  } catch (error) {
    if (error instanceof SinpeReportTimeoutError) {
      return NextResponse.json(
        { error: "La consulta SINPE tardó demasiado. Reduce el rango e intenta de nuevo." },
        { status: 504, headers: noStore },
      );
    }

    console.error("[REPORTES-SINPE] Error:", error);
    return NextResponse.json(
      { error: "No se pudo leer el correo SINPE." },
      { status: 500, headers: noStore },
    );
  }
}
