import type { User } from "@/types/firestore";

interface SinpeNotificationAccess {
  role: User["role"];
  hasSinpePermission: boolean;
  preference: boolean | undefined;
  preferenceLoaded?: boolean;
}

export function canConfigureSinpeNotifications(role: User["role"]): boolean {
  return role === "admin" || role === "superadmin";
}

export function canReceiveSinpeNotifications({
  role,
  hasSinpePermission,
  preference,
  preferenceLoaded,
}: SinpeNotificationAccess): boolean {
  if (!hasSinpePermission) return false;
  if (canConfigureSinpeNotifications(role)) {
    if (preferenceLoaded === false) return false;
    return preference !== false;
  }
  return true;
}
