import { NextResponse } from "next/server.js";
import { getTiemposTucanUpdateAccess } from "../../../../fondogeneral/utils/tiemposTucanUpdateAccess.ts";
import type { BcrReceiptsReader } from "../../../../../lib/bcr/firestore-receipts-reader.ts";
import {
  BCR_TIMEZONE,
  BcrReceiptsReadError,
  buildBcrCostaRicaDayRange,
  canReadBcrCompany,
  readBcrCompanyDocumentId,
  type BcrReadCompany,
  type BcrReadUser,
} from "../../../../../lib/bcr/read-receipts.ts";

export interface BcrReceiptsGetDependencies {
  readUserId: (cookieHeader: string | null) => Promise<string>;
  getUser: (userId: string) => Promise<BcrReadUser | null>;
  getCompany: (companyId: string) => Promise<BcrReadCompany | null>;
  createReader: () => BcrReceiptsReader;
  now?: () => Date;
  getShiftChangeMin?: (
    company: BcrReadCompany,
    now: Date,
  ) => Promise<number | null>;
  logError?: (message: string, error: unknown) => void;
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function createBcrReceiptsGet(dependencies: BcrReceiptsGetDependencies) {
  return async function GET(request: Request) {
    try {
      const url = new URL(request.url);
      const companyId = readBcrCompanyDocumentId(url.searchParams.get("companyId"));
      const range = buildBcrCostaRicaDayRange(url.searchParams.get("date") || "");
      const userId = await dependencies.readUserId(request.headers.get("cookie"));
      if (!userId) return jsonError("unauthorized", 401);

      const user = await dependencies.getUser(userId);
      if (!user?.isActive) return jsonError("unauthorized", 401);

      const company = await dependencies.getCompany(companyId);
      if (!company || !canReadBcrCompany({ ...user, id: userId }, company)) {
        return jsonError("forbidden", 403);
      }

      const now = (dependencies.now ?? (() => new Date()))();
      const shiftChangeMin = dependencies.getShiftChangeMin
        ? await dependencies.getShiftChangeMin(company, now)
        : null;
      const updateAccess = getTiemposTucanUpdateAccess({
        role: user.role,
        horarioApertura: company.horarioApertura,
        horarioCierre: company.horarioCierre,
        shiftChangeMin,
        minutesBeforeEnd: company.cierreFondoVentasMinutesBeforeEnd,
        minutesAfterEnd: company.cierreFondoVentasMinutesAfterEnd,
        now,
      });
      if (!updateAccess.allowed) return jsonError("update_window_closed", 403);

      const result = await dependencies.createReader().listDaily(companyId, range);
      return NextResponse.json(
        {
          ok: true,
          companyId,
          date: range.date,
          timezone: BCR_TIMEZONE,
          ...result,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (error instanceof BcrReceiptsReadError) {
        return jsonError(error.code, error.status);
      }
      (dependencies.logError ?? console.error)("bcr/receipts read error:", error);
      return jsonError("internal_server_error", 500);
    }
  };
}
