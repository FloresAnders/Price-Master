import { NextResponse } from "next/server";
import { readAuthSession } from "@/lib/auth/session-store.server";
import type { AuthenticatedSession } from "@/lib/passkeys/types";
import { canConfigureSinpeNotifications } from "@/components/sinpe/sinpeNotificationPreference";
import { writeSinpeNotificationPreference } from "@/services/sinpe-notification-preferences.server";

export const runtime = "nodejs";

const noStore = { "Cache-Control": "private, no-store" };

interface SinpeNotificationPreferenceDependencies {
  readSession(
    cookieHeader: string | null,
  ): Promise<AuthenticatedSession | null>;
  updatePreference(userId: string, enabled: boolean): Promise<void>;
}

export function createSinpeNotificationPreferencePatch(
  dependencies: SinpeNotificationPreferenceDependencies,
) {
  return async (request: Request) => {
    try {
      const authenticated = await dependencies.readSession(
        request.headers.get("cookie"),
      );
      if (!authenticated?.user.id) {
        return NextResponse.json(
          { error: "No autorizado." },
          { status: 401, headers: noStore },
        );
      }

      const role = authenticated.user.role;
      if (!canConfigureSinpeNotifications(role)) {
        return NextResponse.json(
          { error: "Esta preferencia solo está disponible para administradores." },
          { status: 403, headers: noStore },
        );
      }

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        body = null;
      }
      const enabled = (body as { enabled?: unknown } | null)?.enabled;
      if (typeof enabled !== "boolean") {
        return NextResponse.json(
          { error: "La preferencia debe ser un valor booleano." },
          { status: 400, headers: noStore },
        );
      }

      await dependencies.updatePreference(authenticated.user.id, enabled);
      return NextResponse.json(
        { sinpeNotificationsEnabled: enabled },
        { headers: noStore },
      );
    } catch (error) {
      console.error(
        "[sinpe-notifications] preference update failed:",
        error instanceof Error ? error.message : "unknown_error",
      );
      return NextResponse.json(
        { error: "No se pudo guardar la preferencia de notificaciones SINPE." },
        { status: 500, headers: noStore },
      );
    }
  };
}

export const PATCH = createSinpeNotificationPreferencePatch({
  readSession: readAuthSession,
  updatePreference: writeSinpeNotificationPreference,
});
