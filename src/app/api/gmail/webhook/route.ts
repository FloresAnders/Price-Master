import { after, NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import {
  enqueueGmailNotification,
  processGmailWebhookJob,
  type GmailNotificationPayload,
} from "@/services/sinpe-gmail.server";

export const runtime = "nodejs";
export const maxDuration = 60;

const noStore = { "Cache-Control": "private, no-store" };
const verifier = new OAuth2Client();

const requiredEnv = (name: string) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for Pub/Sub validation.`);
  return value;
};

const verifyPubSubRequest = async (request: NextRequest) => {
  const bearer = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!bearer) return false;
  const ticket = await verifier.verifyIdToken({
    idToken: bearer,
    audience: requiredEnv("GMAIL_PUBSUB_AUDIENCE"),
  });
  const payload = ticket.getPayload();
  return Boolean(
    payload?.email_verified &&
      payload.email === requiredEnv("GMAIL_PUBSUB_PUSH_SERVICE_ACCOUNT_EMAIL"),
  );
};

const decodeNotification = (data: string): GmailNotificationPayload => {
  const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf8")) as {
    emailAddress?: unknown;
    historyId?: unknown;
  };
  return {
    emailAddress: String(decoded.emailAddress || ""),
    historyId: String(decoded.historyId || ""),
  };
};

export async function POST(request: NextRequest) {
  try {
    if (!(await verifyPubSubRequest(request))) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401, headers: noStore },
      );
    }
    const body = (await request.json()) as {
      subscription?: string;
      message?: { data?: string; messageId?: string };
    };
    if (body.subscription !== requiredEnv("GMAIL_PUBSUB_SUBSCRIPTION")) {
      return NextResponse.json(
        { error: "Suscripción no válida." },
        { status: 403, headers: noStore },
      );
    }
    const data = String(body.message?.data || "");
    if (!data) {
      return NextResponse.json(
        { error: "Mensaje Pub/Sub incompleto." },
        { status: 400, headers: noStore },
      );
    }

    const notification = decodeNotification(data);
    const jobId = await enqueueGmailNotification(notification);
    after(async () => {
      try {
        await processGmailWebhookJob(jobId);
      } catch {
        // The persisted job remains retryable by the daily recovery cron.
      }
    });
    console.info("[gmail-webhook] authenticated event queued");
    return new NextResponse(null, { status: 202, headers: noStore });
  } catch (error) {
    console.error(
      "[gmail-webhook] rejected event:",
      error instanceof Error ? error.message : "unknown_error",
    );
    return NextResponse.json(
      { error: "No se pudo recibir el evento." },
      { status: 400, headers: noStore },
    );
  }
}
