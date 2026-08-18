import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { ok: false, error: "Passkey feature is not enabled yet." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
