import { NextRequest, NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  canAccessSinpeEmpresa,
  canUseSinpeReports,
  getSinpeEmpresa,
} from "@/services/sinpe-access.server";
import { configureGmailWatch } from "@/services/sinpe-gmail.server";

export const runtime = "nodejs";
export const maxDuration = 30;

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: NextRequest) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    const user = authenticated?.user;
    if (!user?.id) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401, headers: noStore },
      );
    }
    if (
      (user.role !== "admin" && user.role !== "superadmin") ||
      !canUseSinpeReports(user)
    ) {
      return NextResponse.json(
        { error: "No tienes permiso para configurar Gmail Watch." },
        { status: 403, headers: noStore },
      );
    }

    const body = (await request.json()) as {
      empresaId?: string;
      email?: string;
      refreshToken?: string;
    };
    const empresaId = String(body.empresaId || "").trim();
    const empresa = await getSinpeEmpresa(empresaId);
    if (!empresa) {
      return NextResponse.json(
        { error: "Empresa no encontrada." },
        { status: 404, headers: noStore },
      );
    }
    if (empresa.isActive === false) {
      return NextResponse.json(
        { error: "La empresa está deshabilitada." },
        { status: 400, headers: noStore },
      );
    }
    if (!canAccessSinpeEmpresa(user, empresa)) {
      return NextResponse.json(
        { error: "No tienes acceso a esta empresa." },
        { status: 403, headers: noStore },
      );
    }

    const result = await configureGmailWatch({
      empresa,
      email: String(body.email || ""),
      refreshToken:
        typeof body.refreshToken === "string" ? body.refreshToken : undefined,
    });
    return NextResponse.json(result, { headers: noStore });
  } catch (error) {
    console.error(
      "[gmail-watch] registration failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { error: "No se pudo registrar Gmail Watch." },
      { status: 500, headers: noStore },
    );
  }
}
