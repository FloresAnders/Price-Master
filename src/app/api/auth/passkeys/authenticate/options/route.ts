import { NextResponse } from "next/server";
import { getAuthenticationService } from "@/lib/passkeys/authentication.server";
import {
  ensureBrowserBinding,
  setBrowserBindingCookie,
} from "@/lib/passkeys/http.server";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const browserBinding = ensureBrowserBinding(request);
    const result = await getAuthenticationService().createOptions(
      browserBinding.value,
    );
    const response = NextResponse.json(
      { ok: true, ...result },
      { headers: noStore },
    );
    if (browserBinding.isNew) {
      setBrowserBindingCookie(response, browserBinding.value);
    }
    return response;
  } catch (error) {
    console.warn("Passkey authentication options rejected", error);
    return NextResponse.json(
      { ok: false, error: "passkey_authentication_failed" },
      { status: 400, headers: noStore },
    );
  }
}
