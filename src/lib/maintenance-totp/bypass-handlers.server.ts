import { NextResponse } from "next/server";
import type { User } from "@/types/firestore";
import type { createMaintenanceTotpService } from "./service.server";
import {
  createMaintenanceBypassToken,
  MAINTENANCE_BYPASS_COOKIE,
  maintenanceBypassCookieOptions,
  verifyMaintenanceBypassToken,
  getMaintenanceBypassTokenFromCookie,
} from "./token.server";
import {
  getMaintenanceRequestMeta,
  isSameOriginRequest,
} from "./handlers.server";

type MaintenanceTotpService = ReturnType<typeof createMaintenanceTotpService>;

interface BypassHandlerDependencies {
  service: MaintenanceTotpService;
  readSession(cookieHeader: string | null): Promise<{ user: User } | null>;
  createFirebaseToken(user: User, expiresAt: number): Promise<string>;
  jwtSecret: string;
  durationMinutes: number;
  now?: () => number;
}

const noStore = { "Cache-Control": "no-store" };

async function readCode(request: Request): Promise<string> {
  const body = (await request.json().catch(() => null)) as {
    code?: unknown;
  } | null;
  return typeof body?.code === "string" ? body.code.trim() : "";
}

export function createMaintenanceBypassHandlers({
  service,
  readSession,
  createFirebaseToken,
  jwtSecret,
  durationMinutes,
  now = Date.now,
}: BypassHandlerDependencies) {
  return {
    async bypass(request: Request) {
      if (!isSameOriginRequest(request)) {
        return NextResponse.json(
          { ok: false, error: "forbidden" },
          { status: 403, headers: noStore },
        );
      }

      const result = await service.bypass({
        code: await readCode(request),
        ...getMaintenanceRequestMeta(request),
      });
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: "Código inválido" },
          {
            status: result.reason === "rate_limited" ? 429 : 400,
            headers: noStore,
          },
        );
      }

      const issuedAt = now();
      const expiresAt = issuedAt + durationMinutes * 60_000;
      const token = createMaintenanceBypassToken({
        superadminId: result.superadminId,
        secret: jwtSecret,
        durationMinutes,
        now: issuedAt,
      });
      const authenticated = await readSession(request.headers.get("cookie"));
      const firebaseToken = authenticated?.user.id
        ? await createFirebaseToken(authenticated.user, expiresAt)
        : undefined;
      const response = NextResponse.json(
        {
          ok: true,
          expiresAt,
          ...(firebaseToken ? { firebaseToken } : {}),
        },
        { headers: noStore },
      );
      response.cookies.set(
        MAINTENANCE_BYPASS_COOKIE,
        token,
        maintenanceBypassCookieOptions(durationMinutes * 60),
      );
      return response;
    },

    async status(request: Request) {
      const token = getMaintenanceBypassTokenFromCookie(
        request.headers.get("cookie"),
      );
      const status = verifyMaintenanceBypassToken(token, jwtSecret, now());
      return NextResponse.json(status, { headers: noStore });
    },
  };
}
