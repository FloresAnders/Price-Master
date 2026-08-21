import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { getPasskeyService } from "@/lib/passkeys/repository.server";
import type { PasskeyRecord, PublicPasskey } from "@/lib/passkeys/types";

export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };

export const toPublicPasskey = (passkey: PasskeyRecord): PublicPasskey => ({
  id: passkey.credentialIdHash,
  label: passkey.label,
  deviceType: passkey.deviceType,
  backedUp: passkey.backedUp,
  createdAt: passkey.createdAt,
  lastUsedAt: passkey.lastUsedAt,
  revokedAt: passkey.revokedAt,
});

export async function GET(request: Request) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated?.user.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }
    const requestedUserId = new URL(request.url).searchParams.get("userId");
    const targetUserId = requestedUserId || authenticated.user.id;
    if (
      targetUserId !== authenticated.user.id &&
      authenticated.user.role !== "superadmin"
    ) {
      return NextResponse.json(
        { ok: false, error: "forbidden" },
        { status: 403, headers: noStore },
      );
    }
    const passkeys = await getPasskeyService().listUserPasskeys(targetUserId);
    return NextResponse.json(
      { ok: true, passkeys: passkeys.map(toPublicPasskey) },
      { headers: noStore },
    );
  } catch (error) {
    console.error("Passkey list failed", error);
    return NextResponse.json(
      { ok: false, error: "passkey_management_failed" },
      { status: 500, headers: noStore },
    );
  }
}
