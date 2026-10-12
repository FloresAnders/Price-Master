import QRCode from "qrcode";
import { readAuthSession } from "@/lib/auth/session-store.server";
import { getAdminAuth } from "@/lib/firebase-admin";
import { buildFirebaseCustomTokenClaims } from "@/lib/firebase/custom-token-claims.server";
import { createMaintenanceBypassHandlers } from "./bypass-handlers.server";
import { getMaintenanceEncryptionKey } from "./crypto.server";
import { createMaintenanceEnrollmentHandlers } from "./handlers.server";
import { firestoreMaintenanceTotpRepository } from "./repository.server";
import { createMaintenanceTotpService } from "./service.server";
import {
  getBypassDurationMinutes,
  getMaintenanceJwtSecret,
} from "./token.server";

export function getMaintenanceTotpService() {
  return createMaintenanceTotpService({
    repository: firestoreMaintenanceTotpRepository(),
    encryptionKey: getMaintenanceEncryptionKey(),
  });
}

export function getMaintenanceEnrollmentHandlers() {
  return createMaintenanceEnrollmentHandlers({
    readSession: readAuthSession,
    service: getMaintenanceTotpService(),
    qrToDataUrl: (value) => QRCode.toDataURL(value, { width: 280, margin: 1 }),
  });
}

export function getMaintenanceBypassHandlers() {
  return createMaintenanceBypassHandlers({
    readSession: readAuthSession,
    service: getMaintenanceTotpService(),
    jwtSecret: getMaintenanceJwtSecret(),
    durationMinutes: getBypassDurationMinutes(),
    async createFirebaseToken(user, expiresAt) {
      return getAdminAuth().createCustomToken(
        user.id!,
        buildFirebaseCustomTokenClaims(user, {
          maintenanceBypassExpiresAt: expiresAt,
        }),
      );
    },
  });
}
