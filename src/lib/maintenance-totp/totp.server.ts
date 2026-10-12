import { generateSecret, generateURI, verify } from "otplib";

const TOTP_PERIOD_SECONDS = 30;
const TOTP_ISSUER = "Time-Master · Mantenimiento";

export function createMaintenanceTotpSecret(): string {
  return generateSecret();
}

export function createMaintenanceTotpUri(
  username: string,
  secret: string,
): string {
  const label = username.trim();
  if (!label) throw new Error("A TOTP account label is required.");
  return generateURI({
    issuer: TOTP_ISSUER,
    label,
    secret,
    digits: 6,
    period: TOTP_PERIOD_SECONDS,
  });
}

export async function verifyMaintenanceTotpCode(
  code: string,
  secret: string,
  now = Date.now(),
): Promise<{ valid: true; step: number } | { valid: false }> {
  const token = code.trim();
  if (!/^\d{6}$/.test(token)) return { valid: false };

  const result = await verify({
    secret,
    token,
    epoch: Math.floor(now / 1000),
    period: TOTP_PERIOD_SECONDS,
    epochTolerance: TOTP_PERIOD_SECONDS,
  });
  if (
    !result.valid ||
    !("timeStep" in result) ||
    typeof result.timeStep !== "number"
  ) {
    return { valid: false };
  }

  return {
    valid: true,
    step: result.timeStep,
  };
}
