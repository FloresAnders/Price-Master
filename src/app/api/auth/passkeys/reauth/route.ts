import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { verifyPasswordServer } from "@/lib/auth/password.server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getCeremonyService } from "@/lib/passkeys/ceremonies.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated?.user.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    const body = await request.json();
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: noStore },
      );
    }
    const snapshot = await getAdminDb()
      .collection("users")
      .doc(authenticated.user.id)
      .get();
    const user = snapshot.exists ? snapshot.data() : null;
    const storedPassword =
      typeof user?.password === "string" ? user.password : "";
    const valid =
      user?.isActive !== false &&
      storedPassword.length > 0 &&
      (storedPassword.startsWith("$argon2")
        ? await verifyPasswordServer(password, storedPassword)
        : password === storedPassword);
    if (!valid) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    const grant = await getCeremonyService().createEnrollmentGrant(
      authenticated.user.id,
      authenticated.session.id,
    );
    return NextResponse.json(
      { ok: true, enrollmentGrantId: grant.id },
      { headers: noStore },
    );
  } catch (error) {
    console.warn("Passkey reauthentication rejected", error);
    return NextResponse.json(
      { ok: false, error: "reauthentication_failed" },
      { status: 400, headers: noStore },
    );
  }
}
