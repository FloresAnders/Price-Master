import { describe, expect, it, vi } from "vitest";
import type {
  GenerateRegistrationOptionsOpts,
  PublicKeyCredentialCreationOptionsJSON,
  VerifiedRegistrationResponse,
  VerifyRegistrationResponseOpts,
} from "@simplewebauthn/server";
import {
  createRegistrationService,
  PasskeyRegistrationError,
} from "@/lib/passkeys/registration.server";
import type { PasskeyRecord } from "@/lib/passkeys/types";

const fixture = () => {
  const saved: PasskeyRecord[] = [];
  const claimed: unknown[][] = [];
  const consumed: unknown[][] = [];
  const generateOptions = vi.fn(
    async (
      _options: GenerateRegistrationOptionsOpts,
    ): Promise<PublicKeyCredentialCreationOptionsJSON> => ({
      challenge: "generated-challenge",
      rp: { name: "Time Master", id: "timemaster.example" },
      user: { id: "AQID", name: "ALCHACAS", displayName: "Álvaro Chaves" },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
    }),
  );
  const verifyResponse = vi.fn(
    async (
      _options: VerifyRegistrationResponseOpts,
    ): Promise<VerifiedRegistrationResponse> => ({
      verified: true,
      registrationInfo: {
        fmt: "none",
        aaguid: "00000000-0000-0000-0000-000000000000",
        credential: {
          id: "credential-id",
          publicKey: Uint8Array.from([1, 2, 3]),
          counter: 7,
          transports: ["internal"],
        },
        credentialType: "public-key",
        attestationObject: Uint8Array.from([]),
        userVerified: true,
        credentialDeviceType: "multiDevice",
        credentialBackedUp: true,
        origin: "https://timemaster.example",
        rpID: "timemaster.example",
      },
    }),
  );
  const service = createRegistrationService({
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
      getOrCreatePasskeyUser: async () => ({
        userId: "u1",
        webAuthnUserId: "AQID",
        createdAt: 1_600_000_000_000,
      }),
      listUserPasskeys: async () => [
        {
          credentialId: "existing-active",
          transports: ["internal"],
          revokedAt: null,
        },
        {
          credentialId: "existing-revoked",
          transports: ["hybrid"],
          revokedAt: 1,
        },
      ],
      savePasskey: async (record) => {
        saved.push(record);
        return record;
      },
    },
    ceremonies: {
      createCeremony: async (input) => ({
        ...input,
        id: "ceremony-id",
        browserBindingHash: "binding-hash",
        createdAt: 1_700_000_000_000,
        expiresAt: 1_700_000_300_000,
        consumedAt: null,
      }),
      consumeCeremony: async () => ({
        id: "ceremony-id",
        type: "registration" as const,
        challenge: "generated-challenge",
        browserBindingHash: "binding-hash",
        userId: "u1",
        authSessionId: "session-id",
        enrollmentGrantId: "grant-id",
        createdAt: 1_700_000_000_000,
        expiresAt: 1_700_000_300_000,
        consumedAt: 1_700_000_000_001,
      }),
      claimEnrollmentGrant: async (...args) => {
        claimed.push(args);
        return true;
      },
      consumeEnrollmentGrant: async (...args) => {
        consumed.push(args);
        return true;
      },
    },
  });

  return {
    claimed,
    consumed,
    generateOptions,
    saved,
    service,
    verifyResponse,
  };
};

const session = {
  session: {
    id: "session-id",
    userId: "u1",
    tokenHash: "hash",
    authMethod: "password" as const,
    credentialIdHash: null,
    createdAt: 1,
    lastSeenAt: 1,
    expiresAt: 2,
    revokedAt: null,
    revokedReason: null,
  },
  user: {
    id: "u1",
    name: "ALCHACAS",
    fullName: "Álvaro Chaves",
    role: "user" as const,
    isActive: true,
  },
};

describe("passkey registration service", () => {
  it("genera opciones descubribles y excluye solo passkeys activas", async () => {
    const { claimed, generateOptions, service } = fixture();

    const result = await service.createOptions({
      authenticated: session,
      enrollmentGrantId: "grant-id",
      browserBinding: "browser-binding",
    });

    expect(result).toMatchObject({
      ceremonyId: "ceremony-id",
      options: { challenge: "generated-challenge" },
    });
    expect(generateOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        rpName: "Time Master",
        rpID: "timemaster.example",
        userName: "ALCHACAS",
        userDisplayName: "Álvaro Chaves",
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
        excludeCredentials: [
          { id: "existing-active", transports: ["internal"] },
        ],
      }),
    );
    expect(claimed).toEqual([["grant-id", "session-id", "ceremony-id"]]);
  });

  it("guarda únicamente material verificado por el servidor", async () => {
    const { consumed, saved, service, verifyResponse } = fixture();

    const result = await service.verify({
      authenticated: session,
      ceremonyId: "ceremony-id",
      browserBinding: "browser-binding",
      response: { id: "untrusted-id" } as never,
    });

    expect(verifyResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedChallenge: "generated-challenge",
        expectedOrigin: ["https://timemaster.example"],
        expectedRPID: "timemaster.example",
        requireUserVerification: true,
      }),
    );
    expect(saved).toEqual([
      expect.objectContaining({
        credentialId: "credential-id",
        publicKey: "AQID",
        counter: 7,
        transports: ["internal"],
        deviceType: "multiDevice",
        backedUp: true,
        label: "Passkey sincronizada",
        userId: "u1",
      }),
    ]);
    expect(consumed).toEqual([["grant-id", "ceremony-id"]]);
    expect(result.label).toBe("Passkey sincronizada");
  });

  it("rechaza respuestas no verificadas sin guardar credenciales", async () => {
    const { saved, service, verifyResponse } = fixture();
    verifyResponse.mockResolvedValueOnce({ verified: false });

    await expect(
      service.verify({
        authenticated: session,
        ceremonyId: "ceremony-id",
        browserBinding: "browser-binding",
        response: { id: "invalid" } as never,
      }),
    ).rejects.toBeInstanceOf(PasskeyRegistrationError);
    expect(saved).toEqual([]);
  });
});
