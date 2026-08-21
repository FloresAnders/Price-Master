import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

const toBase64Url = (value: Buffer) =>
  value
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

export function base64UrlRandom(bytes: number): string {
  if (!Number.isInteger(bytes) || bytes < 1) {
    throw new Error("bytes must be a positive integer");
  }
  return toBase64Url(randomBytes(bytes));
}

export function sha256Base64Url(value: string): string {
  return toBase64Url(createHash("sha256").update(value, "utf8").digest());
}

export function safeEqual(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "utf8");
  const rightBytes = Buffer.from(right, "utf8");
  if (leftBytes.length !== rightBytes.length) return false;
  return timingSafeEqual(leftBytes, rightBytes);
}
