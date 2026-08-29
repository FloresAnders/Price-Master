import { describe, expect, it, vi } from "vitest";
import { loadFondoCachedResource } from "@/app/fondogeneral/utils/cachedResourceLoader";

describe("Fondo cached resource loader", () => {
  it("returns fresh cache data without calling the remote loader", async () => {
    const loadRemote = vi.fn(async () => ["remote"]);

    const result = await loadFondoCachedResource({
      readCache: async () => ({
        data: ["cached"],
        freshness: "fresh" as const,
        storedAt: 1,
        expiresAt: 2,
      }),
      loadRemote,
      writeCache: vi.fn(),
      onCachedData: vi.fn(),
    });

    expect(result).toEqual({ data: ["cached"], source: "cache" });
    expect(loadRemote).not.toHaveBeenCalled();
  });

  it("shows stale data before replacing it with refreshed remote data", async () => {
    const events: string[] = [];

    const result = await loadFondoCachedResource({
      readCache: async () => ({
        data: ["stale"],
        freshness: "stale" as const,
        storedAt: 1,
        expiresAt: 2,
      }),
      loadRemote: async () => {
        events.push("remote");
        return ["fresh"];
      },
      writeCache: async (data) => {
        events.push(`write:${data[0]}`);
      },
      onCachedData: (data) => {
        events.push(`cache:${data[0]}`);
      },
    });

    expect(events).toEqual(["cache:stale", "remote", "write:fresh"]);
    expect(result).toEqual({ data: ["fresh"], source: "server" });
  });

  it("uses the remote loader when reading the cache throws", async () => {
    const result = await loadFondoCachedResource({
      readCache: async () => {
        throw new Error("cache unavailable");
      },
      loadRemote: async () => ["remote"],
      writeCache: async () => undefined,
      onCachedData: vi.fn(),
    });

    expect(result).toEqual({ data: ["remote"], source: "server" });
  });

  it("keeps stale data usable when the background refresh fails", async () => {
    const result = await loadFondoCachedResource({
      readCache: async () => ({
        data: ["stale"],
        freshness: "stale" as const,
        storedAt: 1,
        expiresAt: 2,
      }),
      loadRemote: async () => {
        throw new Error("offline");
      },
      writeCache: async () => undefined,
      onCachedData: vi.fn(),
    });

    expect(result).toEqual({
      data: ["stale"],
      source: "stale-cache",
      error: new Error("offline"),
    });
  });
});
