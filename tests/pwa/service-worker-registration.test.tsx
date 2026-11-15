// @vitest-environment jsdom

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const registrarPath = resolve(
  process.cwd(),
  "src/components/pwa/ServiceWorkerRegistrar.tsx",
);

async function loadRegistrar() {
  expect(existsSync(registrarPath), "service worker registrar must exist").toBe(
    true,
  );
  return vi.importActual<
    typeof import("@/components/pwa/ServiceWorkerRegistrar")
  >("@/components/pwa/ServiceWorkerRegistrar");
}

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("service worker registration", () => {
  it("registers the root worker in production with cache bypass", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    const { default: ServiceWorkerRegistrar } = await loadRegistrar();

    render(<ServiceWorkerRegistrar />);

    await waitFor(() =>
      expect(register).toHaveBeenCalledWith("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      }),
    );
  });

  it("does not register outside production", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const register = vi.fn().mockResolvedValue({});
    vi.stubGlobal("navigator", { serviceWorker: { register } });
    const { default: ServiceWorkerRegistrar } = await loadRegistrar();

    render(<ServiceWorkerRegistrar />);

    await Promise.resolve();
    expect(register).not.toHaveBeenCalled();
  });

  it("tolerates browsers without the service worker API", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("navigator", {});
    const { default: ServiceWorkerRegistrar } = await loadRegistrar();

    expect(() => render(<ServiceWorkerRegistrar />)).not.toThrow();
  });

  it("handles registration rejection without an unhandled promise", async () => {
    const error = new Error("registration blocked");
    const container = {
      register: vi.fn().mockRejectedValue(error),
    } as unknown as ServiceWorkerContainer;
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { registerServiceWorker } = await loadRegistrar();

    await expect(registerServiceWorker(container)).resolves.toBeNull();
    expect(consoleError).toHaveBeenCalledWith(
      "Service worker registration failed:",
      error,
    );
  });

  it("serves /sw.js with forced revalidation headers", async () => {
    const { default: nextConfig } = await import("../../next.config");
    const entries = await nextConfig.headers?.();

    expect(entries).toContainEqual({
      source: "/sw.js",
      headers: [
        {
          key: "Cache-Control",
          value: "no-cache, no-store, must-revalidate",
        },
      ],
    });
  });
});
