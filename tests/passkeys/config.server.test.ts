import { describe, expect, it } from "vitest";
import { getWebAuthnConfig } from "@/lib/passkeys/config.server";

const androidOrigin =
  "android:apk-key-hash:6P9PYHqtQboKi6ZRrp4N5XPnvQHNpT4wpZuUTRwwk3M";

const productionEnv = (origins: string) => ({
  NODE_ENV: "production",
  TIMEMASTER_WEBAUTHN_RP_ID: "www.timemaster.es",
  TIMEMASTER_WEBAUTHN_ORIGINS: origins,
  PRICE_MASTER_SESSION_SECRET: "12345678901234567890123456789012",
});

describe("getWebAuthnConfig Android origins", () => {
  it("accepts the exact HTTPS and signed Android APK origins", () => {
    const config = getWebAuthnConfig(
      productionEnv(`https://www.timemaster.es,${androidOrigin}`),
    );

    expect(config.origins).toEqual([
      "https://www.timemaster.es",
      androidOrigin,
    ]);
  });

  it.each([
    "android:apk-key-hash:not-a-sha256-hash",
    `${androidOrigin}=`,
    "capacitor://www.timemaster.es",
  ])("rejects untrusted non-web origin %s", (origin) => {
    expect(() => getWebAuthnConfig(productionEnv(origin))).toThrow(
      "TIMEMASTER_WEBAUTHN_ORIGINS contains an invalid protocol.",
    );
  });
});
