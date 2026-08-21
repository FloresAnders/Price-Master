import { NextResponse } from "next/server";
import type { AuthenticationResponseJSON } from "@simplewebauthn/server";
import { setAuthCookie } from "@/lib/auth/session-cookie.server";
import { getAuthenticationService } from "@/lib/passkeys/authentication.server";
import { getBrowserBinding } from "@/lib/passkeys/http.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
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
    const authenticated = await getAuthenticationService().verify({
      ceremonyId: body.ceremonyId,
      browserBinding,
      response: body.response as AuthenticationResponseJSON,
    });
    const response = NextResponse.json(
      { ok: true, user: authenticated.user },
      { headers: noStore },
    );
    const maxAge = Math.max(
      0,
      Math.floor((authenticated.record.expiresAt - Date.now()) / 1000),
    );
    setAuthCookie(response, authenticated.token, maxAge);
    return response;
  } catch (error) {
    console.warn("Passkey authentication verification rejected", error);
    return NextResponse.json(
      { ok: false, error: "passkey_authentication_failed" },
      { status: 401, headers: noStore },
    );
  }
}
