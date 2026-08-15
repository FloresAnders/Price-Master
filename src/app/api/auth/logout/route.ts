import { NextResponse } from "next/server";
import {
  clearAuthCookie,
} from "@/lib/auth/session-cookie.server";
import { revokeAuthSession } from "@/lib/auth/session-store.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  await revokeAuthSession(request.headers.get("cookie"), "logout");
  const response = NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } },
  );
  clearAuthCookie(response);
  return response;
}
