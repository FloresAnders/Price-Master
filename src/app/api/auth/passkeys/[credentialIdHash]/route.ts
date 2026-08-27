import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  getPasskeyService,
  PasskeyRepositoryError,
} from "@/lib/passkeys/repository.server";
import { toPublicPasskey } from "../route";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

type RouteContext = {
  params: Promise<{ credentialIdHash: string }>;
};

const authenticate = async (request: Request) => {
  const authenticated = await readAuthSession(request.headers.get("cookie"));
  return authenticated?.user.id ? authenticated : null;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const authenticated = await authenticate(request);
    if (!authenticated?.user.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    const { credentialIdHash } = await context.params;
    const body = await request.json();
    const label = typeof body?.label === "string" ? body.label : "";
    const passkey = await getPasskeyService().renamePasskey(
      authenticated.user.id,
      authenticated.user.role === "superadmin",
      credentialIdHash,
      label,
    );
    if (!passkey) throw new Error("passkey_not_found");
    return NextResponse.json(
      { ok: true, passkey: toPublicPasskey(passkey) },
      { headers: noStore },
    );
  } catch (error) {
    console.warn("Passkey rename rejected", error);
    return NextResponse.json(
      { ok: false, error: "passkey_management_failed" },
      { status: 400, headers: noStore },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const authenticated = await authenticate(request);
    if (!authenticated?.user.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    const { credentialIdHash } = await context.params;
    const passkey = await getPasskeyService().revokePasskey(
      authenticated.user.id,
      authenticated.user.role === "superadmin",
      credentialIdHash,
    );
    if (!passkey) throw new Error("passkey_not_found");
    return NextResponse.json(
      { ok: true, passkey: toPublicPasskey(passkey) },
      { headers: noStore },
    );
  } catch (error) {
    if (
      error instanceof PasskeyRepositoryError &&
      error.code === "session_limit_exceeded"
    ) {
      console.error("Passkey session revocation limit exceeded", error);
      return NextResponse.json(
        { ok: false, error: "passkey_session_limit_exceeded" },
        { status: 409, headers: noStore },
      );
    }
    console.warn("Passkey revoke rejected", error);
    return NextResponse.json(
      { ok: false, error: "passkey_management_failed" },
      { status: 400, headers: noStore },
    );
  }
}
