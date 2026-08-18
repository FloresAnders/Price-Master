import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { ok: false, error: "Passkey feature is not enabled yet." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}

export async function PATCH() {
  return NextResponse.json(
    { ok: false, error: "Passkey feature is not enabled yet." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE() {
  return NextResponse.json(
    { ok: false, error: "Passkey feature is not enabled yet." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
