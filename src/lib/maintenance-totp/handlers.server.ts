import { NextResponse } from "next/server";
import type { User } from "@/types/firestore";
import type { createMaintenanceTotpService } from "./service.server";

type MaintenanceTotpService = ReturnType<typeof createMaintenanceTotpService>;

interface EnrollmentHandlerDependencies {
  readSession(cookieHeader: string | null): Promise<{ user: User } | null>;
  service: MaintenanceTotpService;
  qrToDataUrl(value: string): Promise<string>;
}

const noStore = { "Cache-Control": "no-store" };

export function getMaintenanceRequestMeta(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for") || "";
  const ip =
    forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find(Boolean) ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";
  return {
    ip: ip.slice(0, 128),
    userAgent: (request.headers.get("user-agent") || "unknown").slice(0, 500),
  };
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

const forbiddenResponse = (status: 401 | 403) =>
  NextResponse.json(
    { ok: false, error: status === 401 ? "unauthorized" : "forbidden" },
    { status, headers: noStore },
  );

async function readSuperadmin(
  request: Request,
  readSession: EnrollmentHandlerDependencies["readSession"],
): Promise<User | NextResponse> {
  const authenticated = await readSession(request.headers.get("cookie"));
  if (!authenticated?.user.id) return forbiddenResponse(401);
  if (authenticated.user.role !== "superadmin") return forbiddenResponse(403);
  return authenticated.user;
}

const isResponse = (value: User | NextResponse): value is NextResponse =>
  value instanceof NextResponse;

async function readCode(request: Request): Promise<string> {
  const body = (await request.json().catch(() => null)) as {
    code?: unknown;
  } | null;
  return typeof body?.code === "string" ? body.code.trim() : "";
}

export function createMaintenanceEnrollmentHandlers(
  dependencies: EnrollmentHandlerDependencies,
) {
  return {
    async status(request: Request) {
      const user = await readSuperadmin(request, dependencies.readSession);
      if (isResponse(user)) return user;
      return NextResponse.json(
        { ok: true, ...(await dependencies.service.status(user.id!)) },
        { headers: noStore },
      );
    },

    async start(request: Request) {
      if (!isSameOriginRequest(request)) return forbiddenResponse(403);
      const user = await readSuperadmin(request, dependencies.readSession);
      if (isResponse(user)) return user;
      try {
        const enrollment = await dependencies.service.start({
          userId: user.id!,
          label: user.email || user.name,
          ...getMaintenanceRequestMeta(request),
        });
        const qrDataUrl = await dependencies.qrToDataUrl(enrollment.otpauthUri);
        return NextResponse.json(
          { ok: true, qrDataUrl },
          { headers: noStore },
        );
      } catch (error) {
        console.error("Maintenance TOTP enrollment start failed", error);
        return NextResponse.json(
          { ok: false, error: "maintenance_totp_failed" },
          { status: 500, headers: noStore },
        );
      }
    },

    async confirm(request: Request) {
      if (!isSameOriginRequest(request)) return forbiddenResponse(403);
      const user = await readSuperadmin(request, dependencies.readSession);
      if (isResponse(user)) return user;
      const result = await dependencies.service.confirm({
        userId: user.id!,
        code: await readCode(request),
        ...getMaintenanceRequestMeta(request),
      });
      if (result.ok) {
        return NextResponse.json({ ok: true }, { headers: noStore });
      }
      return NextResponse.json(
        { ok: false, error: "Código inválido" },
        {
          status: result.reason === "rate_limited" ? 429 : 400,
          headers: noStore,
        },
      );
    },

    async disable(request: Request) {
      if (!isSameOriginRequest(request)) return forbiddenResponse(403);
      const user = await readSuperadmin(request, dependencies.readSession);
      if (isResponse(user)) return user;
      await dependencies.service.disable({
        userId: user.id!,
        ...getMaintenanceRequestMeta(request),
      });
      return NextResponse.json({ ok: true }, { headers: noStore });
    },
  };
}
