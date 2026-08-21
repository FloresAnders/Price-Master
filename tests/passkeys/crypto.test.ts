import { describe, expect, it } from "vitest";
import {
  base64UrlRandom,
  sha256Base64Url,
  safeEqual,
} from "@/lib/passkeys/crypto.server";

describe("passkey crypto helpers", () => {
  it("produce el SHA-256 base64url esperado", () => {
    expect(sha256Base64Url("credential")).toBe(
      "4mW29WRgGh_o3EJ4XNGKhovYAT61iZVg55JIdnpoPms",
    );
  });

  it("genera valores aleatorios base64url con la longitud solicitada", () => {
    const first = base64UrlRandom(32);
    const second = base64UrlRandom(32);

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second).not.toBe(first);
  });

  it("compara valores sin aceptar longitudes o contenidos diferentes", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "other")).toBe(false);
    expect(safeEqual("same", "same-but-longer")).toBe(false);
  });
});
