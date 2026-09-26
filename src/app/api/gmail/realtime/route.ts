import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminAuth, getAdminDb } from "@/lib/firebase-admin";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  canAccessSinpeEmpresa,
  canUseSinpeReports,
} from "@/services/sinpe-access.server";
import type { Empresas } from "@/types/firestore";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };
const REALTIME_SESSION_MS = 55 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated?.user.id || !canUseSinpeReports(authenticated.user)) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401, headers: noStore },
      );
    }

    const empresasSnapshot = await getAdminDb().collection("empresas").get();
    const empresas = empresasSnapshot.docs
      .map((snapshot) => ({
        id: snapshot.id,
        ...snapshot.data(),
      }) as Empresas)
      .filter(
        (empresa) =>
          empresa.isActive !== false &&
          canAccessSinpeEmpresa(authenticated.user, empresa),
      );
    const empresaIds = empresas
      .map((empresa) => String(empresa.id || "").trim())
      .filter(Boolean);
    const sessionExpiresAt = Number(authenticated.session.expiresAt || 0);
    const expiresAt = Math.min(
      sessionExpiresAt || Number.POSITIVE_INFINITY,
      Date.now() + REALTIME_SESSION_MS,
    );
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      return NextResponse.json(
        { error: "La sesión expiró." },
        { status: 401, headers: noStore },
      );
    }

    await getAdminDb()
      .collection("sinpeRealtimeSessions")
      .doc(authenticated.user.id)
      .set({
        userId: authenticated.user.id,
        empresaIds,
        expiresAt: Timestamp.fromMillis(expiresAt),
        updatedAt: Timestamp.now(),
      });
    const token = await getAdminAuth().createCustomToken(
      authenticated.user.id,
      { authPurpose: "sinpe-realtime" },
    );

    return NextResponse.json(
      {
        token,
        expiresAt,
        empresas: empresas.map((empresa) => ({
          id: String(empresa.id || ""),
          name: empresa.name || empresa.ubicacion || String(empresa.id || ""),
        })),
      },
      { headers: noStore },
    );
  } catch (error) {
    console.error(
      "[sinpe-realtime] token creation failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { error: "No se pudo iniciar el canal SINPE." },
      { status: 500, headers: noStore },
    );
  }
}
