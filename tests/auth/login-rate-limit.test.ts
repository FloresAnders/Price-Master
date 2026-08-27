import { afterEach, describe, expect, it, vi } from "vitest";
import { consumeLoginAttempt } from "@/lib/auth/login-rate-limit.server";

describe("login rate limiting", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("no permite evadir el límite falsificando encabezados de proxy", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "false");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("K_SERVICE", "");
    vi.stubEnv("FUNCTION_TARGET", "");
    const username = `rate-${Math.random()}`;
    const now = Date.now();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = consumeLoginAttempt(
        new Request("http://localhost/api/auth/login", {
          headers: { "x-forwarded-for": `203.0.113.${attempt + 1}` },
        }),
        username,
        now,
      );
      expect(result.allowed).toBe(true);
    }

    const limited = consumeLoginAttempt(
      new Request("http://localhost/api/auth/login", {
        headers: { "x-forwarded-for": "198.51.100.200" },
      }),
      username,
      now,
    );

    expect(limited.allowed).toBe(false);
  });

  it("no confía automáticamente en X-Forwarded-For por variables del hosting", () => {
    vi.stubEnv("TRUST_PROXY_HEADERS", "false");
    vi.stubEnv("K_SERVICE", "production-service");
    const username = `hosting-rate-${Math.random()}`;
    const now = Date.now();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        consumeLoginAttempt(
          new Request("http://localhost/api/auth/login", {
            headers: { "x-forwarded-for": `198.51.100.${attempt + 1}` },
          }),
          username,
          now,
        ).allowed,
      ).toBe(true);
    }

    expect(
      consumeLoginAttempt(
        new Request("http://localhost/api/auth/login", {
          headers: { "x-forwarded-for": "203.0.113.200" },
        }),
        username,
        now,
      ).allowed,
    ).toBe(false);
  });
});
