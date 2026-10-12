import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = "v1";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function decodeEncryptionKey(value: string): Buffer {
  const trimmed = value.trim();
  const key = /^[a-f\d]{64}$/i.test(trimmed)
    ? Buffer.from(trimmed, "hex")
    : Buffer.from(trimmed, "base64");

  if (key.length !== 32) {
    throw new Error("TOTP_ENCRYPTION_KEY must contain exactly 32 bytes.");
  }
  return key;
}

export function encryptMaintenanceSecret(
  plaintext: string,
  encryptionKey: string,
): string {
  if (!plaintext) throw new Error("Cannot encrypt an empty TOTP secret.");

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(
    "aes-256-gcm",
    decodeEncryptionKey(encryptionKey),
    iv,
  );
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptMaintenanceSecret(
  envelope: string,
  encryptionKey: string,
): string {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded, ...extra] =
    envelope.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !ivEncoded ||
    !tagEncoded ||
    !ciphertextEncoded ||
    extra.length > 0
  ) {
    throw new Error("Invalid encrypted TOTP secret.");
  }

  const iv = Buffer.from(ivEncoded, "base64url");
  const tag = Buffer.from(tagEncoded, "base64url");
  const ciphertext = Buffer.from(ciphertextEncoded, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || !ciphertext.length) {
    throw new Error("Invalid encrypted TOTP secret.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    decodeEncryptionKey(encryptionKey),
    iv,
  );
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}

export function getMaintenanceEncryptionKey(
  env: Record<string, string | undefined> = process.env,
): string {
  const key = env.TOTP_ENCRYPTION_KEY?.trim();
  if (!key) throw new Error("TOTP_ENCRYPTION_KEY is required.");
  decodeEncryptionKey(key);
  return key;
}
