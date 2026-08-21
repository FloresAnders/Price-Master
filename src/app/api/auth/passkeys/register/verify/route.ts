import { NextResponse } from "next/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { getBrowserBinding } from "@/lib/passkeys/http.server";
import { getRegistrationService } from "@/lib/passkeys/registration.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    const browserBinding = getBrowserBinding(request);
    const body = await request.json();
    if (
      !browserBinding ||
      typeof body?.ceremonyId !== "string" ||
      !body?.response
    ) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: noStore },
      );
    }
    const passkey = await getRegistrationService().verify({
      authenticated,
      ceremonyId: body.ceremonyId,
      browserBinding,
      response: body.response as RegistrationResponseJSON,
    });
    return NextResponse.json(
      {
        ok: true,
        passkey: {
          id: passkey.credentialIdHash,
          label: passkey.label,
        },
      },
      { headers: noStore },
    );
  } catch (error) {
    console.warn("Passkey registration verification rejected", error);
    return NextResponse.json(
      { ok: false, error: "passkey_registration_failed" },
      { status: 400, headers: noStore },
    );
  }
}
