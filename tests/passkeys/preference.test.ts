// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearPasskeyPreference,
  getPasskeyPreference,
  markPasskeySuccessful,
} from "@/lib/passkeys/preference.client";

describe("passkey device preference", () => {
  beforeEach(async () => {
    await clearPasskeyPreference();
  });

  it("starts inactive without storing biometric or credential data", async () => {
    await expect(getPasskeyPreference()).resolves.toEqual({
      passkeyAvailable: false,
      lastSuccessfulUse: null,
    });
  });

  it("remembers only that a passkey succeeded on this browser", async () => {
    await markPasskeySuccessful(1_723_727_200_000);

    const preference = await getPasskeyPreference();

    expect(preference).toEqual({
      passkeyAvailable: true,
      lastSuccessfulUse: 1_723_727_200_000,
    });
    expect(Object.keys(preference).sort()).toEqual([
      "lastSuccessfulUse",
      "passkeyAvailable",
    ]);
  });

  it("can be cleared without affecting a server credential", async () => {
    await markPasskeySuccessful(100);
    await clearPasskeyPreference();

    await expect(getPasskeyPreference()).resolves.toEqual({
      passkeyAvailable: false,
      lastSuccessfulUse: null,
    });
  });
});
