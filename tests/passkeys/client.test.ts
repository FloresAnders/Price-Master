// @vitest-environment jsdom

import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  authenticateWithPasskey,
  isPasskeySupported,
  PasskeyClientError,
  registerPasskey,
} from "@/lib/passkeys/client";
import {
  clearPasskeyPreference,
  getPasskeyPreference,
} from "@/lib/passkeys/preference.client";

const { startRegistration, startAuthentication } = vi.hoisted(() => ({
  startRegistration: vi.fn(),
  startAuthentication: vi.fn(),
}));

vi.mock("@simplewebauthn/browser", () => ({
  startRegistration,
  startAuthentication,
}));

const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

beforeEach(async () => {
  vi.stubGlobal("PublicKeyCredential", class PublicKeyCredential {});
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: {},
  });
  await clearPasskeyPreference();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("passkey browser client", () => {
  it("detects WebAuthn support", () => {
    expect(isPasskeySupported()).toBe(true);
  });

  it("registers a passkey using server options and verifies the response", async () => {
    const options = {
      challenge: "challenge",
      rp: { id: "localhost", name: "Time Master" },
      user: { id: "AQID", name: "ALCHACAS", displayName: "ALCHACAS" },
      pubKeyCredParams: [{ type: "public-key" as const, alg: -7 }],
    };
    const credentialResponse = {
      id: "credential",
      rawId: "credential",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "e30",
        attestationObject: "o2NmbXRkbm9uZQ",
        transports: ["internal" as const],
      },
    };
    startRegistration.mockResolvedValueOnce(credentialResponse);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ ok: true, ceremonyId: "registration-1", options }),
      )
      .mockResolvedValueOnce(
        response({
          ok: true,
          passkey: { id: "credential-hash", label: "Este dispositivo" },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await registerPasskey("grant-1");

    expect(result).toEqual({ id: "credential-hash", label: "Este dispositivo" });
    expect(startRegistration).toHaveBeenCalledWith({ optionsJSON: options });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/passkeys/register/options",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({ enrollmentGrantId: "grant-1" }),
      }),
    );
    await expect(getPasskeyPreference()).resolves.toMatchObject({
      passkeyAvailable: true,
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/passkeys/register/verify",
      expect.objectContaining({
        body: JSON.stringify({
          ceremonyId: "registration-1",
          response: credentialResponse,
        }),
      }),
    );
    await expect(getPasskeyPreference()).resolves.toMatchObject({
      passkeyAvailable: true,
    });
  });

  it("authenticates without sending a username", async () => {
    const options = {
      challenge: "challenge",
      rpId: "localhost",
      allowCredentials: [],
      userVerification: "required" as const,
    };
    const credentialResponse = {
      id: "credential",
      rawId: "credential",
      type: "public-key" as const,
      clientExtensionResults: {},
      response: {
        clientDataJSON: "e30",
        authenticatorData: "AA",
        signature: "AA",
        userHandle: "AQ",
      },
    };
    startAuthentication.mockResolvedValueOnce(credentialResponse);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({ ok: true, ceremonyId: "authentication-1", options }),
      )
      .mockResolvedValueOnce(
        response({ ok: true, user: { id: "user-1", username: "ALCHACAS" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await authenticateWithPasskey();

    expect(result).toEqual({ id: "user-1", username: "ALCHACAS" });
    expect(startAuthentication).toHaveBeenCalledWith({ optionsJSON: options });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth/passkeys/authenticate/options",
      expect.objectContaining({ method: "POST", credentials: "same-origin" }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth/passkeys/authenticate/verify",
      expect.objectContaining({
        body: JSON.stringify({
          ceremonyId: "authentication-1",
          response: credentialResponse,
        }),
      }),
    );
  });

  it("maps a cancelled operating-system prompt to a stable error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        response({
          ok: true,
          ceremonyId: "authentication-1",
          options: {
            challenge: "challenge",
            rpId: "localhost",
            allowCredentials: [],
            userVerification: "required",
          },
        }),
      ),
    );
    startAuthentication.mockRejectedValueOnce(
      new DOMException("The operation was cancelled", "NotAllowedError"),
    );

    await expect(authenticateWithPasskey()).rejects.toMatchObject({
      code: "cancelled",
    } satisfies Partial<PasskeyClientError>);
  });

  it("does not invoke WebAuthn when the server rejects the ceremony", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(response({ ok: false, error: "unauthorized" }, 401)),
    );

    await expect(registerPasskey("expired-grant")).rejects.toMatchObject({
      code: "failed",
    });
    expect(startRegistration).not.toHaveBeenCalled();
  });
});
