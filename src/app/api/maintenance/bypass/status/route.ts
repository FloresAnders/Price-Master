import { getMaintenanceBypassHandlers } from "@/lib/maintenance-totp/production.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return getMaintenanceBypassHandlers().status(request);
}
