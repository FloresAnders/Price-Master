import type { FondoCacheHit } from "@/services/fondo-cache";

type FondoCachedResourceResult<T> =
  | { data: T; source: "cache" | "server" }
  | { data: T; source: "stale-cache"; error: Error };

type FondoCachedResourceOptions<T> = {
  readCache: () => Promise<FondoCacheHit<T> | null>;
  loadRemote: () => Promise<T>;
  writeCache: (data: T) => Promise<void>;
  onCachedData: (data: T) => void;
};

const normalizeError = (error: unknown): Error =>
  error instanceof Error ? error : new Error(String(error || "Error desconocido"));

export async function loadFondoCachedResource<T>({
  readCache,
  loadRemote,
  writeCache,
  onCachedData,
}: FondoCachedResourceOptions<T>): Promise<FondoCachedResourceResult<T>> {
  let cached: FondoCacheHit<T> | null = null;
  try {
    cached = await readCache();
  } catch {
    cached = null;
  }

  if (cached) {
    onCachedData(cached.data);
    if (cached.freshness === "fresh") {
      return { data: cached.data, source: "cache" };
    }
  }

  try {
    const data = await loadRemote();
    try {
      await writeCache(data);
    } catch {
      // A successful server read remains usable if the auxiliary cache fails.
    }
    return { data, source: "server" };
  } catch (error) {
    if (cached) {
      return {
        data: cached.data,
        source: "stale-cache",
        error: normalizeError(error),
      };
    }
    throw error;
  }
}
