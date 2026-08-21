import { describe, expect, it } from "vitest";
import { getWebAuthnConfig } from "@/lib/passkeys/config.server";

describe("getWebAuthnConfig", () => {
  it("rechaza una configuración de producción incompleta", () => {
    expect(() => getWebAuthnConfig({ NODE_ENV: "production" })).toThrow(
      /TIMEMASTER_WEBAUTHN_RP_ID/,
    );
  });

  it("rechaza secretos de sesión débiles en producción", () => {
    expect(() =>
      getWebAuthnConfig({
        NODE_ENV: "production",
        TIMEMASTER_WEBAUTHN_RP_ID: "timemaster.example",
        TIMEMASTER_WEBAUTHN_ORIGINS: "https://timemaster.example",
        PRICE_MASTER_SESSION_SECRET: "short",
      }),
    ).toThrow(/32 caracteres/);
  });

  it("normaliza la lista explícita de orígenes", () => {
    const config = getWebAuthnConfig({
      NODE_ENV: "production",
      TIMEMASTER_WEBAUTHN_RP_NAME: "Time Master",
      TIMEMASTER_WEBAUTHN_RP_ID: "timemaster.example",
      TIMEMASTER_WEBAUTHN_ORIGINS:
        " https://timemaster.example,https://admin.timemaster.example/ ",
      PRICE_MASTER_SESSION_SECRET: "a".repeat(32),
    });

    expect(config).toEqual({
      rpName: "Time Master",
      rpID: "timemaster.example",
      origins: [
        "https://timemaster.example",
        "https://admin.timemaster.example",
      ],
      sessionSecret: "a".repeat(32),
    });
  });

  it("usa valores locales seguros fuera de producción", () => {
    expect(getWebAuthnConfig({ NODE_ENV: "development" })).toEqual({
      rpName: "Time Master",
      rpID: "localhost",
      origins: ["http://localhost:3000"],
      sessionSecret: "timemaster-local-development-session-secret",
    });
  });
});
