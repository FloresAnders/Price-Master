import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  processPendingGmailWebhookJobs,
  renewExpiringGmailWatches,
} from "@/services/sinpe-gmail.server";

export const runtime = "nodejs";
export const maxDuration = 60;

const noStore = { "Cache-Control": "private, no-store" };

const validCronSecret = (request: NextRequest) => {
  const configured = process.env.CRON_SECRET?.trim() || "";
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!configured || configured.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(configured), Buffer.from(provided));
};

export async function GET(request: NextRequest) {
  if (!validCronSecret(request)) {
    return NextResponse.json(
      { error: "No autorizado." },
      { status: 401, headers: noStore },
    );
  }

  try {
    const renewals = await renewExpiringGmailWatches();
    const recoveredJobs = await processPendingGmailWebhookJobs();
    return NextResponse.json(
      { renewals, recoveredJobs },
      { headers: noStore },
    );
  } catch (error) {
    console.error(
      "[gmail-watch] renewal cron failed:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { error: "No se pudo completar la renovación." },
      { status: 500, headers: noStore },
    );
  }
}
