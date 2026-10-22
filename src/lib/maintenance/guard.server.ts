import type { User } from "@/types/firestore";
import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSessionTokenFromCookie } from "@/lib/auth/session-cookie.server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { verifyMaintenanceBypassCookie } from "@/lib/maintenance-totp/token.server";
import { createMaintenanceConfigCache } from "./config-cache.server";
import {
  getMaintenanceBlock,
  hasActiveMaintenance,
  normalizeMaintenanceConfig,
  type MaintenanceBlock,
  type MaintenanceConfig,
} from "./config";

export type MaintenanceAccessDecision =
  | { allowed: true }
  | { allowed: false; block: MaintenanceBlock };

export function evaluateMaintenanceAccess({
  config,
  user,
  bypassActive,
}: {
  config: MaintenanceConfig;
  user: User | null | undefined;
  bypassActive: boolean;
}): MaintenanceAccessDecision {
  const block = getMaintenanceBlock(config, user);
  if (!block || bypassActive) return { allowed: true };
  return { allowed: false, block };
}

interface MaintenanceApiGuardDependencies {
  hasSessionToken(cookieHeader: string | null): boolean;
  readSession(cookieHeader: string | null): Promise<{ user: User } | null>;
  readConfig(): Promise<MaintenanceConfig>;
  verifyBypass(cookieHeader: string | null): boolean;
}

export function createMaintenanceApiGuard(
  dependencies: MaintenanceApiGuardDependencies,
) {
  return async (request: Request): Promise<NextResponse | null> => {
    const cookieHeader = request.headers.get("cookie");
    if (!dependencies.hasSessionToken(cookieHeader)) return null;

    const config = await dependencies.readConfig();
    if (!hasActiveMaintenance(config)) return null;

    const authenticated = await dependencies.readSession(cookieHeader);
    if (!authenticated?.user) return null;

    const decision = evaluateMaintenanceAccess({
      config,
      user: authenticated.user,
      bypassActive: dependencies.verifyBypass(cookieHeader),
    });
    return decision.allowed
      ? null
      : NextResponse.json(
          { maintenance: true },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
  };
}

export function isMaintenanceGuardExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/maintenance/") ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/auth/firebase-token" ||
    pathname === "/api/auth/session" ||
    pathname.startsWith("/api/auth/session/")
  );
}

const productionMaintenanceConfigCache = createMaintenanceConfigCache({
  async load() {
    const snapshot = await getAdminDb().collection("version").doc("current").get();
    return normalizeMaintenanceConfig(snapshot.data()?.maintenance);
  },
});

export function createProductionMaintenanceApiGuard() {
  return createMaintenanceApiGuard({
    hasSessionToken: (cookieHeader) =>
      Boolean(getSessionTokenFromCookie(cookieHeader)),
    readSession: readAuthSession,
    readConfig: () => productionMaintenanceConfigCache.read(),
    verifyBypass(cookieHeader) {
      try {
        return verifyMaintenanceBypassCookie(cookieHeader).active;
      } catch {
        return false;
      }
    },
  });
}
