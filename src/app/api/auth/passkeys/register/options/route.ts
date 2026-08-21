import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  ensureBrowserBinding,
  setBrowserBindingCookie,
} from "@/lib/passkeys/http.server";
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
    const body = await request.json();
    const enrollmentGrantId =
      typeof body?.enrollmentGrantId === "string"
        ? body.enrollmentGrantId
        : "";
    if (!enrollmentGrantId) {
      return NextResponse.json(
        { ok: false, error: "invalid_request" },
        { status: 400, headers: noStore },
      );
    }
    const browserBinding = ensureBrowserBinding(request);
    const result = await getRegistrationService().createOptions({
      authenticated,
      enrollmentGrantId,
      browserBinding: browserBinding.value,
    });
    const response = NextResponse.json(
      { ok: true, ...result },
      { headers: noStore },
    );
    if (browserBinding.isNew) {
      setBrowserBindingCookie(response, browserBinding.value);
    }
    return response;
  } catch (error) {
    console.warn("Passkey registration options rejected", error);
    return NextResponse.json(
      { ok: false, error: "passkey_registration_failed" },
      { status: 400, headers: noStore },
    );
  }
}
