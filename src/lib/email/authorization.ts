type EmailPermissionSet = {
  mantenimiento?: boolean;
  fondogeneral?: boolean;
};

export function canQueueEmail(user: {
  role?: string;
  permissions?: EmailPermissionSet | null;
}): boolean {
  return (
    user.role === "admin" ||
    user.role === "superadmin" ||
    user.permissions?.mantenimiento === true ||
    user.permissions?.fondogeneral === true
  );
}
