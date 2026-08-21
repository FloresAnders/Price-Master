import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const authenticated = await readAuthSession(request.headers.get("cookie"));
  if (!authenticated) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401, headers: noStore },
    );
  }

  return NextResponse.json(
    {
      ok: true,
      user: authenticated.user,
      session: {
        authMethod: authenticated.session.authMethod,
        expiresAt: authenticated.session.expiresAt,
      },
    },
    { headers: noStore },
  );
}
