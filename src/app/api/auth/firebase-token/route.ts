import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { normalizeUserPermissions } from "@/utils/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store" };

/**
 * Exchanges a valid server session (`timemaster_auth` cookie) for a Firebase
 * custom token. The browser signs in with it so `request.auth` is populated and
 * the Firestore rules (which rely on `isSignedIn()`) apply. The token carries
 * only the small set of claims the rules read, to stay well under Firebase's
 * 1000-byte custom claim limit.
 */
export async function GET(request: Request) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    const user = authenticated?.user;
    if (!user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }

    const permissions = normalizeUserPermissions(
      user.permissions,
      user.role || "user",
    );

    const claims = {
      role: user.role || "user",
      ownerId: user.ownerId || "",
      ownercompanie: user.ownercompanie || "",
      eliminate: user.eliminate === true,
      authPurpose: "timemaster-app",
      // Only the flags the security rules read, both nested and flat.
      permissions: {
        anotaciones: permissions.anotaciones === true,
        tiempos: permissions.tiempos === true,
        registroTiempos: permissions.registroTiempos === true,
        deudasInternas: permissions.deudasInternas === true,
      },
      anotaciones: permissions.anotaciones === true,
      tiempos: permissions.tiempos === true,
      registroTiempos: permissions.registroTiempos === true,
      deudasInternas: permissions.deudasInternas === true,
    };

    const token = await getAdminAuth().createCustomToken(user.id, claims);

    return NextResponse.json({ ok: true, token }, { headers: noStore });
  } catch (error) {
    console.error("firebase-token error:", error);
    return NextResponse.json(
      { ok: false, error: "internal_server_error" },
      { status: 500, headers: noStore },
    );
  }
}
