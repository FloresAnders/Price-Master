import { beforeEach, describe, expect, it, vi } from "vitest";

const versionDoc = vi.hoisted(() => ({
  subscribeToVersionDoc: vi.fn(() => vi.fn()),
}));

vi.mock("@/services/version-doc", () => versionDoc);

describe("version checker", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("uses the shared version subscription and releases it on stop", async () => {
    const unsubscribe = vi.fn();
    versionDoc.subscribeToVersionDoc.mockReturnValueOnce(unsubscribe);
    const { startVersionCheck, stopVersionCheck } = await import(
      "@/utils/versionChecker"
    );

    await startVersionCheck();
    stopVersionCheck();

    expect(versionDoc.subscribeToVersionDoc).toHaveBeenCalledTimes(1);
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
