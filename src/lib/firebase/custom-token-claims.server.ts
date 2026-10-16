import type { User } from "@/types/firestore";
import { normalizeUserPermissions } from "@/utils/permissions";
import { normalizeMaintenanceIdentifier } from "@/lib/maintenance/identifier";

export function buildFirebaseCustomTokenClaims(
  user: User,
  options: { maintenanceBypassExpiresAt?: number } = {},
) {
  const permissions = normalizeUserPermissions(
    user.permissions,
    user.role || "user",
  );
  const bypassExpiresAt = options.maintenanceBypassExpiresAt;

  return {
    role: user.role || "user",
    ownerId: user.ownerId || "",
    ownercompanie: user.ownercompanie || "",
    ownercompanieNormalized: normalizeMaintenanceIdentifier(
      user.ownercompanie,
    ),
    eliminate: user.eliminate === true,
    authPurpose: "timemaster-app",
    permissions: {
      anotaciones: permissions.anotaciones === true,
      fondogeneral: permissions.fondogeneral === true,
      fondogeneralBCR: permissions.fondogeneralBCR === true,
      fondogeneralBN: permissions.fondogeneralBN === true,
      fondogeneralBAC: permissions.fondogeneralBAC === true,
      cajaNegra: permissions.cajaNegra === true,
      tucan: permissions.tucan === true,
      tiempos: permissions.tiempos === true,
      registroTiempos: permissions.registroTiempos === true,
      deudasInternas: permissions.deudasInternas === true,
    },
    anotaciones: permissions.anotaciones === true,
    tiempos: permissions.tiempos === true,
    registroTiempos: permissions.registroTiempos === true,
    deudasInternas: permissions.deudasInternas === true,
    ...(Number.isFinite(bypassExpiresAt) && Number(bypassExpiresAt) > 0
      ? { maintenanceBypassExpiresAt: Number(bypassExpiresAt) }
      : {}),
  };
}
