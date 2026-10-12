import { getMaintenanceBypassHandlers } from "@/lib/maintenance-totp/production.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return getMaintenanceBypassHandlers().bypass(request);
}
