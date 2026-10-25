export const DEFAULT_FONDO_MOVEMENT_INTERVAL_SECONDS = 60;
export const MAX_FONDO_MOVEMENT_INTERVAL_SECONDS = Math.floor(
  Number.MAX_SAFE_INTEGER / 1000,
);

export function normalizeFondoMovementIntervalSeconds(
  value: unknown,
): number {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_FONDO_MOVEMENT_INTERVAL_SECONDS;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_FONDO_MOVEMENT_INTERVAL_SECONDS;
  }
  return Math.min(
    MAX_FONDO_MOVEMENT_INTERVAL_SECONDS,
    Math.max(0, Math.round(parsed)),
  );
}

export function getFondoMovementCooldownMs(value: unknown): number {
  return normalizeFondoMovementIntervalSeconds(value) * 1000;
}

export function getFondoMovementCooldownRemainingMs(
  lastCreatedAtMs: number,
  nowMs: number,
  intervalSeconds: unknown,
): number {
  if (!Number.isFinite(lastCreatedAtMs) || lastCreatedAtMs <= 0) return 0;
  const cooldownMs = getFondoMovementCooldownMs(intervalSeconds);
  if (cooldownMs === 0) return 0;
  return Math.max(
    0,
    cooldownMs - (nowMs - lastCreatedAtMs),
  );
}
