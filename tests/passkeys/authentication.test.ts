import { describe, expect, it, vi } from "vitest";
import type {
  GenerateAuthenticationOptionsOpts,
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import {
  createAuthenticationService,
  PasskeyAuthenticationError,
} from "@/lib/passkeys/authentication.server";
import type { PasskeyRecord } from "@/lib/passkeys/types";

const passkey: PasskeyRecord = {
  credentialId: "credential-id",
  credentialIdHash: "credential-hash",
  userId: "u1",
  publicKey: "AQID",
  counter: 7,
  transports: ["internal"],
  deviceType: "multiDevice",
  backedUp: true,
  label: "Passkey sincronizada",
  createdAt: 1,
  lastUsedAt: null,
  revokedAt: null,
  revokedBy: null,
};

const fixture = () => {
  const updates: unknown[] = [];
  const sessions: unknown[] = [];
  const generateOptions = vi.fn(
    async (
      _options: GenerateAuthenticationOptionsOpts,
    ): Promise<PublicKeyCredentialRequestOptionsJSON> => ({
      challenge: "challenge",
      rpId: "timemaster.example",
      allowCredentials: [],
      userVerification: "required",
    }),
  );
  const verifyResponse = vi.fn(
    async (
      _options: VerifyAuthenticationResponseOpts,
    ): Promise<VerifiedAuthenticationResponse> => ({
      verified: true,
      authenticationInfo: {
        credentialID: "credential-id",
        newCounter: 8,
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: "https://timemaster.example",
        rpID: "timemaster.example",
      },
    }),
  );
  let storedPasskey: PasskeyRecord | null = { ...passkey };
  const service = createAuthenticationService({
    config: {
      rpName: "Time Master",
      rpID: "timemaster.example",
      origins: ["https://timemaster.example"],
      sessionSecret: "a".repeat(32),
    },
    now: () => 1_700_000_000_000,
    generateOptions,
    verifyResponse,
    passkeys: {
      getPasskeyByCredentialId: async () => storedPasskey,
      updateAfterAuthentication: async (credentialIdHash, changes) => {
        updates.push([credentialIdHash, changes]);
        storedPasskey = storedPasskey
          ? { ...storedPasskey, ...changes }
          : null;
        return storedPasskey;
      },
    },
    ceremonies: {
      createCeremony: async (input) => ({
        ...input,
        id: "ceremony-id",
        browserBindingHash: "binding-hash",
        userId: null,
        authSessionId: null,
        enrollmentGrantId: null,
        createdAt: 1,
        expiresAt: 2,
        consumedAt: null,
      }),
      consumeCeremony: async () => ({
        id: "ceremony-id",
        type: "authentication" as const,
        challenge: "challenge",
        browserBindingHash: "binding-hash",
        userId: null,
        authSessionId: null,
        enrollmentGrantId: null,
        createdAt: 1,
        expiresAt: 2,
        consumedAt: 2,
      }),
    },
    getUser: async () => ({
      id: "u1",
      name: "ALCHACAS",
      password: "must-not-leak",
      role: "user",
      isActive: true,
    }),
    createSession: async (input) => {
      sessions.push(input);
      return {
        token: "opaque-session-token",
        record: {
          id: "session-id",
          userId: "u1",
          tokenHash: "hash",
          authMethod: "passkey" as const,
          credentialIdHash: "credential-hash",
          createdAt: 1,
          lastSeenAt: 1,
          expiresAt: 3_000,
          revokedAt: null,
          revokedReason: null,
        },
      };
    },
  });

  return {
    generateOptions,
    service,
    sessions,
    updates,
    verifyResponse,
    setPasskey: (value: PasskeyRecord | null) => {
      storedPasskey = value;
    },
  };
};

describe("discoverable passkey authentication", () => {
  it("genera opciones sin identificar previamente al usuario", async () => {
    const { generateOptions, service } = fixture();

    const result = await service.createOptions("browser-binding");

    expect(result).toMatchObject({
      ceremonyId: "ceremony-id",
      options: { challenge: "challenge", allowCredentials: [] },
    });
    expect(generateOptions).toHaveBeenCalledWith({
      rpID: "timemaster.example",
      allowCredentials: [],
      userVerification: "required",
    });
  });

  it("verifica la credencial, actualiza su uso y crea una sesión vinculada", async () => {
    const { service, sessions, updates, verifyResponse } = fixture();

    const result = await service.verify({
      ceremonyId: "ceremony-id",
      browserBinding: "browser-binding",
      response: { id: "credential-id" } as never,
    });

    expect(verifyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "challenge",
        expectedOrigin: ["https://timemaster.example"],
        expectedRPID: "timemaster.example",
        requireUserVerification: true,
        credential: {
          id: "credential-id",
          publicKey: Uint8Array.from([1, 2, 3]),
          counter: 7,
          transports: ["internal"],
        },
      }),
    );
    expect(updates).toEqual([
      [
        "credential-hash",
        {
          counter: 8,
          backedUp: true,
          lastUsedAt: 1_700_000_000_000,
        },
      ],
    ]);
    expect(sessions).toEqual([
      {
        userId: "u1",
        role: "user",
        authMethod: "passkey",
        credentialIdHash: "credential-hash",
      },
    ]);
    expect(result).toMatchObject({
      token: "opaque-session-token",
      user: { id: "u1", name: "ALCHACAS" },
    });
    expect(result.user).not.toHaveProperty("password");
  });

  it("rechaza credenciales revocadas o usuarios inactivos", async () => {
    const revoked = fixture();
    revoked.setPasskey({ ...passkey, revokedAt: 10 });
    await expect(
      revoked.service.verify({
        ceremonyId: "ceremony-id",
        browserBinding: "browser-binding",
        response: { id: "credential-id" } as never,
      }),
    ).rejects.toBeInstanceOf(PasskeyAuthenticationError);

    const unknown = fixture();
    unknown.setPasskey(null);
    await expect(
      unknown.service.verify({
        ceremonyId: "ceremony-id",
        browserBinding: "browser-binding",
        response: { id: "credential-id" } as never,
      }),
    ).rejects.toBeInstanceOf(PasskeyAuthenticationError);
  });

  it("rechaza el retroceso de un contador no nulo", async () => {
    const { service, verifyResponse } = fixture();
    verifyResponse.mockResolvedValueOnce({
      verified: true,
      authenticationInfo: {
        credentialID: "credential-id",
        newCounter: 7,
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: "https://timemaster.example",
        rpID: "timemaster.example",
      },
    });

    await expect(
      service.verify({
        ceremonyId: "ceremony-id",
        browserBinding: "browser-binding",
        response: { id: "credential-id" } as never,
      }),
    ).rejects.toMatchObject({ code: "counter_anomaly" });
  });
});
