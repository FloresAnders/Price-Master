import type { User } from "@/types/firestore";

export type SessionUser = Omit<User, "password">;

/**
 * Resolves which account an email-change request may act on.
 *
 * - Always allows the caller to change their own email.
 * - Allows changing another user only for callers that can reach the
 *   maintenance/user-editor surface (admins, superadmins, or anyone with the
 *   `mantenimiento` permission) — that is the same gate as the editor UI.
 * - Returns null when the caller is not allowed to act on the requested id.
 */
export function resolveEmailChangeTargetUserId(
  user: SessionUser | null | undefined,
  requestedUserId: unknown,
): string | null {
  const selfId = String(user?.id || "").trim();
  if (!selfId) return null;

  const requested = String(requestedUserId ?? "").trim();
  if (!requested || requested === selfId) return selfId;

  const canManageUsers =
    user?.role === "admin" ||
    user?.role === "superadmin" ||
    user?.permissions?.mantenimiento === true;

  return canManageUsers ? requested : null;
}
