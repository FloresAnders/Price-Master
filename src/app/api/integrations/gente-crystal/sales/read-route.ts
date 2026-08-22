import { NextResponse } from "next/server.js";
import { getTiemposTucanUpdateAccess } from "../../../../../app/fondogeneral/utils/tiemposTucanUpdateAccess.ts";
import type { GenteCrystalSalesReader } from "../../../../../lib/gente-crystal/firestore-sales-reader.ts";
import {
  GENTE_CRYSTAL_TIMEZONE,
  GenteCrystalSalesReadError,
  buildCostaRicaDayRange,
  canReadGenteCrystalCompany,
  readCompanyDocumentId,
  type GenteCrystalReadCompany,
  type GenteCrystalReadUser,
} from "../../../../../lib/gente-crystal/read-sales.ts";

export interface GenteCrystalSalesGetDependencies {
  readUserId: (cookieHeader: string | null) => Promise<string>;
  getUser: (userId: string) => Promise<GenteCrystalReadUser | null>;
  getCompany: (
    companyId: string,
  ) => Promise<GenteCrystalReadCompany | null>;
  createReader: () => GenteCrystalSalesReader;
  now?: () => Date;
  logError?: (message: string, error: unknown) => void;
}

function jsonError(error: string, status: number) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function createGenteCrystalSalesGet(
  dependencies: GenteCrystalSalesGetDependencies,
) {
  return async function GET(request: Request) {
    try {
      const url = new URL(request.url);
      const companyId = readCompanyDocumentId(
        url.searchParams.get("companyId"),
      );
      const range = buildCostaRicaDayRange(
        url.searchParams.get("date") || "",
      );
      const userId = await dependencies.readUserId(
        request.headers.get("cookie"),
      );
      if (!userId) return jsonError("unauthorized", 401);

      const user = await dependencies.getUser(userId);
      if (!user?.isActive) return jsonError("unauthorized", 401);

      const company = await dependencies.getCompany(companyId);
      if (
        !company ||
        !canReadGenteCrystalCompany({ ...user, id: userId }, company)
      ) {
        return jsonError("forbidden", 403);
      }

      const updateAccess = getTiemposTucanUpdateAccess({
        role: user.role,
        minutesBeforeEnd: company.cierreFondoVentasMinutesBeforeEnd,
        minutesAfterEnd: company.cierreFondoVentasMinutesAfterEnd,
        now: (dependencies.now ?? (() => new Date()))(),
      });
      if (!updateAccess.allowed) {
        return jsonError("update_window_closed", 403);
      }

      const result = await dependencies
        .createReader()
        .listDaily(companyId, range);
      return NextResponse.json(
        {
          ok: true,
          companyId,
          date: range.date,
          timezone: GENTE_CRYSTAL_TIMEZONE,
          ...result,
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      if (error instanceof GenteCrystalSalesReadError) {
        return jsonError(error.code, error.status);
      }
      (dependencies.logError ?? console.error)(
        "gente-crystal/sales read error:",
        error,
      );
      return jsonError("internal_server_error", 500);
    }
  };
}
