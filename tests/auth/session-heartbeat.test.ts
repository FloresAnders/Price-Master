import { describe, expect, it } from "vitest";
import {
  SESSION_HEARTBEAT_INTERVAL_MS,
  claimSessionHeartbeatLease,
  releaseSessionHeartbeatLease,
} from "@/lib/auth/session-heartbeat";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("cross-tab session heartbeat lease", () => {
  it("permite solo una renovación por ventana entre pestañas", () => {
    const storage = new MemoryStorage();
    const now = 1_700_000_000_000;

    expect(claimSessionHeartbeatLease(storage, "tab-a", now)).toBe(true);
    expect(claimSessionHeartbeatLease(storage, "tab-b", now)).toBe(false);
    expect(
      claimSessionHeartbeatLease(
        storage,
        "tab-b",
        now + SESSION_HEARTBEAT_INTERVAL_MS - 1,
      ),
    ).toBe(false);
    expect(
      claimSessionHeartbeatLease(
        storage,
        "tab-b",
        now + SESSION_HEARTBEAT_INTERVAL_MS,
      ),
    ).toBe(true);
  });

  it("libera la ventana únicamente si pertenece a la pestaña indicada", () => {
    const storage = new MemoryStorage();
    const now = 1_700_000_000_000;
    claimSessionHeartbeatLease(storage, "tab-a", now);

    releaseSessionHeartbeatLease(storage, "tab-b");
    expect(claimSessionHeartbeatLease(storage, "tab-b", now)).toBe(false);

    releaseSessionHeartbeatLease(storage, "tab-a");
    expect(claimSessionHeartbeatLease(storage, "tab-b", now)).toBe(true);
  });
});
