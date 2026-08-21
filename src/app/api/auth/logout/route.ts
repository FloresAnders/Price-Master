import { NextResponse } from "next/server";
import {
  clearAuthCookie,
} from "@/lib/auth/session-cookie.server";
import { revokeAuthSession } from "@/lib/auth/session-store.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let response: NextResponse;
  try {
    await revokeAuthSession(request.headers.get("cookie"), "logout");
    response = NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("No se pudo revocar la sesión durante el logout", error);
    response = NextResponse.json(
      { ok: false, error: "logout_failed" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
  clearAuthCookie(response);
  return response;
}
