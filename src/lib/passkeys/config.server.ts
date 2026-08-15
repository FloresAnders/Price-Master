export interface WebAuthnConfig {
  rpName: string;
  rpID: string;
  origins: string[];
  sessionSecret: string;
}

type Environment = Record<string, string | undefined>;

const normalizeOrigins = (raw: string, production: boolean) => {
  const origins = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error("TIMEMASTER_WEBAUTHN_ORIGINS contains an invalid protocol.");
      }
      if (production && url.protocol !== "https:") {
        throw new Error("TIMEMASTER_WEBAUTHN_ORIGINS must use HTTPS in production.");
      }
      return url.origin;
    });

  if (origins.length === 0) {
    throw new Error("TIMEMASTER_WEBAUTHN_ORIGINS is required.");
  }

  return [...new Set(origins)];
};

export function getWebAuthnConfig(
  env: Environment = process.env,
): WebAuthnConfig {
  const production = env.NODE_ENV === "production";
  const rpName = env.TIMEMASTER_WEBAUTHN_RP_NAME?.trim() || "Time Master";
  const rpID =
    env.TIMEMASTER_WEBAUTHN_RP_ID?.trim() || (production ? "" : "localhost");
  const originsRaw =
    env.TIMEMASTER_WEBAUTHN_ORIGINS?.trim() ||
    (production ? "" : "http://localhost:3000");
  const sessionSecret =
    env.PRICE_MASTER_SESSION_SECRET?.trim() ||
    (production ? "" : "timemaster-local-development-session-secret");

  if (!rpID) {
    throw new Error("TIMEMASTER_WEBAUTHN_RP_ID is required in production.");
  }
  if (!originsRaw) {
    throw new Error("TIMEMASTER_WEBAUTHN_ORIGINS is required in production.");
  }
  if (sessionSecret.length < 32) {
    throw new Error(
      "PRICE_MASTER_SESSION_SECRET must contain at least 32 caracteres.",
    );
  }

  return {
    rpName,
    rpID,
    origins: normalizeOrigins(originsRaw, production),
    sessionSecret,
  };
}
