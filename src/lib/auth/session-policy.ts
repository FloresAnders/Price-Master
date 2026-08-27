export const SESSION_DURATION_HOURS = {
  superadmin: 5,
  admin: 5,
  user: 30 * 24,
} as const;

export type SessionRole = keyof typeof SESSION_DURATION_HOURS;
