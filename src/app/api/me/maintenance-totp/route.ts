import { getMaintenanceEnrollmentHandlers } from "@/lib/maintenance-totp/production.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return getMaintenanceEnrollmentHandlers().status(request);
}

export async function DELETE(request: Request) {
  return getMaintenanceEnrollmentHandlers().disable(request);
}
