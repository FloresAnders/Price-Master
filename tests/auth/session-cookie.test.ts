import { describe, expect, it } from "vitest";
import {
  AUTH_COOKIE_NAME,
  getSessionTokenFromCookie,
  sessionCookieOptions,
} from "@/lib/auth/session-cookie.server";

describe("session cookie", () => {
  it("extrae únicamente la cookie de autenticación", () => {
    expect(
      getSessionTokenFromCookie(
        "theme=dark; pricemaster_auth=opaque-token; unrelated=value",
      ),
    ).toBe("opaque-token");
    expect(getSessionTokenFromCookie("theme=dark")).toBeNull();
    expect(AUTH_COOKIE_NAME).toBe("pricemaster_auth");
  });

  it("crea una cookie inaccesible para JavaScript", () => {
    expect(sessionCookieOptions(3600, true)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 3600,
    });
  });
});
