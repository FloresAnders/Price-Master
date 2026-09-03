import { describe, expect, it } from "vitest";

import {
  getSessionCookieMaxAge,
  sessionCookieOptions,
} from "@/lib/auth/session-cookie.server";

describe("getSessionCookieMaxAge", () => {
  it("creates a browser-session cookie when persistence is disabled", () => {
    expect(getSessionCookieMaxAge(false, 20_000, 1_000)).toBeUndefined();
    expect(sessionCookieOptions(undefined, false)).not.toHaveProperty("maxAge");
  });

  it("keeps the cookie until server expiration when persistence is enabled", () => {
    expect(getSessionCookieMaxAge(true, 20_500, 500)).toBe(20);
  });

  it("never returns a negative persistent lifetime", () => {
    expect(getSessionCookieMaxAge(true, 500, 1_000)).toBe(0);
  });
});
