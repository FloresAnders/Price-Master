export const SESSION_HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000;

const SESSION_HEARTBEAT_LEASE_KEY = "pricemaster_session_heartbeat_lease";

type HeartbeatLease = {
  ownerId: string;
  expiresAt: number;
};

function readLease(storage: Storage): HeartbeatLease | null {
  try {
    const parsed = JSON.parse(
      storage.getItem(SESSION_HEARTBEAT_LEASE_KEY) || "null",
    ) as Partial<HeartbeatLease> | null;
    if (
      !parsed ||
      typeof parsed.ownerId !== "string" ||
      typeof parsed.expiresAt !== "number"
    ) {
      return null;
    }
    return { ownerId: parsed.ownerId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

export function claimSessionHeartbeatLease(
  storage: Storage,
  ownerId: string,
  now = Date.now(),
): boolean {
  const current = readLease(storage);
  if (current && current.expiresAt > now) return false;

  const next: HeartbeatLease = {
    ownerId,
    expiresAt: now + SESSION_HEARTBEAT_INTERVAL_MS,
  };
  try {
    storage.setItem(SESSION_HEARTBEAT_LEASE_KEY, JSON.stringify(next));
    const stored = readLease(storage);
    return stored?.ownerId === ownerId && stored.expiresAt === next.expiresAt;
  } catch {
    return true;
  }
}

export function releaseSessionHeartbeatLease(
  storage: Storage,
  ownerId: string,
) {
  try {
    if (readLease(storage)?.ownerId === ownerId) {
      storage.removeItem(SESSION_HEARTBEAT_LEASE_KEY);
    }
  } catch {
    // El almacenamiento puede estar deshabilitado; no hay lease que liberar.
  }
}
