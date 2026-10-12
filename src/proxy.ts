import { NextResponse, type NextRequest } from "next/server";
import {
  createProductionMaintenanceApiGuard,
  isMaintenanceGuardExemptPath,
} from "@/lib/maintenance/guard.server";

export async function proxy(request: NextRequest) {
  if (isMaintenanceGuardExemptPath(request.nextUrl.pathname)) {
    return NextResponse.next();
  }
  const blocked = await createProductionMaintenanceApiGuard()(request);
  return blocked || NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*"],
};
