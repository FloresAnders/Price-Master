import type { MaintenanceConfig } from "./config";

export const MAINTENANCE_CONFIG_CACHE_TTL_MS = 15_000;
const MAINTENANCE_CONFIG_RETRY_AFTER_ERROR_MS = 5_000;

interface MaintenanceConfigCacheOptions {
  load: () => Promise<MaintenanceConfig>;
  now?: () => number;
  ttlMs?: number;
  retryAfterErrorMs?: number;
}

interface MaintenanceConfigCache {
  read(): Promise<MaintenanceConfig>;
  clear(): void;
}

export function createMaintenanceConfigCache({
  load,
  now = Date.now,
  ttlMs = MAINTENANCE_CONFIG_CACHE_TTL_MS,
  retryAfterErrorMs = MAINTENANCE_CONFIG_RETRY_AFTER_ERROR_MS,
}: MaintenanceConfigCacheOptions): MaintenanceConfigCache {
  let cached: MaintenanceConfig | null = null;
  let expiresAt = 0;
  let inFlight: Promise<MaintenanceConfig> | null = null;
  let generation = 0;

  const read = (): Promise<MaintenanceConfig> => {
    if (cached && now() < expiresAt) return Promise.resolve(cached);
    if (inFlight) return inFlight;

    const loadGeneration = generation;
    const pending = Promise.resolve()
      .then(load)
      .then((next) => {
        if (loadGeneration === generation) {
          cached = next;
          expiresAt = now() + ttlMs;
        }
        return next;
      })
      .catch((error: unknown) => {
        if (!cached) throw error;
        if (loadGeneration === generation) {
          expiresAt = now() + retryAfterErrorMs;
        }
        return cached;
      })
      .finally(() => {
        if (inFlight === pending) inFlight = null;
      });

    inFlight = pending;
    return pending;
  };

  return {
    read,
    clear() {
      generation += 1;
      cached = null;
      expiresAt = 0;
      inFlight = null;
    },
  };
}
