import { describe, expect, it } from "vitest";

import {
  MAINTENANCE_CONFIG_CACHE_TTL_MS,
  createMaintenanceConfigCache,
} from "@/lib/maintenance/config-cache.server";
import { normalizeMaintenanceConfig } from "@/lib/maintenance/config";

const inactiveConfig = normalizeMaintenanceConfig(null);
const activeConfig = normalizeMaintenanceConfig({
  global: { enabled: true, message: "Mantenimiento activo" },
});

describe("createMaintenanceConfigCache", () => {
  it("reutiliza el valor antes de vencer el TTL", async () => {
    let now = 0;
    let loads = 0;
    const cache = createMaintenanceConfigCache({
      now: () => now,
      load: async () => {
        loads += 1;
        return inactiveConfig;
      },
    });

    expect(await cache.read()).toBe(inactiveConfig);
    now = MAINTENANCE_CONFIG_CACHE_TTL_MS - 1;
    expect(await cache.read()).toBe(inactiveConfig);
    expect(loads).toBe(1);
  });

  it("recarga al alcanzar el limite del TTL", async () => {
    let now = 0;
    let loads = 0;
    const cache = createMaintenanceConfigCache({
      now: () => now,
      load: async () => {
        loads += 1;
        return loads === 1 ? inactiveConfig : activeConfig;
      },
    });

    expect(await cache.read()).toBe(inactiveConfig);
    now = MAINTENANCE_CONFIG_CACHE_TTL_MS;
    expect(await cache.read()).toBe(activeConfig);
    expect(loads).toBe(2);
  });

  it("comparte una sola carga entre misses concurrentes", async () => {
    let loads = 0;
    let resolveLoad!: (value: typeof inactiveConfig) => void;
    const pending = new Promise<typeof inactiveConfig>((resolve) => {
      resolveLoad = resolve;
    });
    const cache = createMaintenanceConfigCache({
      load: async () => {
        loads += 1;
        return pending;
      },
    });

    const first = cache.read();
    const second = cache.read();
    resolveLoad(inactiveConfig);

    await expect(first).resolves.toBe(inactiveConfig);
    await expect(second).resolves.toBe(inactiveConfig);
    expect(loads).toBe(1);
  });

  it("usa el ultimo valor valido y espera cinco segundos antes de reintentar", async () => {
    let now = 0;
    let loads = 0;
    const cache = createMaintenanceConfigCache({
      now: () => now,
      load: async () => {
        loads += 1;
        if (loads === 2) throw new Error("firestore_unavailable");
        return loads === 1 ? inactiveConfig : activeConfig;
      },
    });

    expect(await cache.read()).toBe(inactiveConfig);
    now = MAINTENANCE_CONFIG_CACHE_TTL_MS;
    expect(await cache.read()).toBe(inactiveConfig);
    expect(loads).toBe(2);

    now += 4_999;
    expect(await cache.read()).toBe(inactiveConfig);
    expect(loads).toBe(2);

    now += 1;
    expect(await cache.read()).toBe(activeConfig);
    expect(loads).toBe(3);
  });

  it("propaga el error cuando nunca hubo un valor valido", async () => {
    const cache = createMaintenanceConfigCache({
      load: async () => {
        throw new Error("firestore_unavailable");
      },
    });

    await expect(cache.read()).rejects.toThrow("firestore_unavailable");
  });

  it("clear obliga una nueva carga", async () => {
    let loads = 0;
    const cache = createMaintenanceConfigCache({
      load: async () => {
        loads += 1;
        return loads === 1 ? inactiveConfig : activeConfig;
      },
    });

    expect(await cache.read()).toBe(inactiveConfig);
    cache.clear();
    expect(await cache.read()).toBe(activeConfig);
    expect(loads).toBe(2);
  });
});
