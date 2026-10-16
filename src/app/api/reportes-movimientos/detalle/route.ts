import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import {
  ReportDetailAccessError,
  getAuthorizedReportDetailItems,
} from "@/services/reportes-detail.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStore = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const authenticated = await readAuthSession(request.headers.get("cookie"));
    if (!authenticated?.user?.id) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401, headers: noStore },
      );
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json(
        { ok: false, error: "invalid_json" },
        { status: 400, headers: noStore },
      );
    }

    const items = await getAuthorizedReportDetailItems(
      authenticated.user,
      body,
    );
    return NextResponse.json({ ok: true, items }, { headers: noStore });
  } catch (error) {
    if (error instanceof ReportDetailAccessError) {
      return NextResponse.json(
        { ok: false, error: error.code },
        { status: error.status, headers: noStore },
      );
    }
    console.error("report-detail error:", error);
    return NextResponse.json(
      { ok: false, error: "internal_server_error" },
      { status: 500, headers: noStore },
    );
  }
}
