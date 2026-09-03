import { describe, expect, it, vi } from "vitest";

import { createAuthenticationService } from "@/lib/passkeys/authentication.server";

describe("passkey session persistence", () => {
  it("forwards the browser persistence choice to the server session", async () => {
    const createSession = vi.fn().mockResolvedValue({
      token: "session-token",
      record: { id: "session-id" },
    });
    const service = createAuthenticationService({
      config: {
        rpID: "example.test",
        rpName: "TimeMaster",
        origins: ["https://example.test"],
        sessionSecret: "test-session-secret",
      },
      passkeys: {
        getPasskeyByCredentialId: vi.fn().mockResolvedValue({
          credentialId: "credential-id",
          credentialIdHash: "credential-hash",
          userId: "user-id",
          publicKey: Buffer.from("public-key").toString("base64url"),
          counter: 0,
          transports: [],
          deviceType: "singleDevice",
          backedUp: false,
          label: "Equipo",
          createdAt: 1,
          lastUsedAt: null,
          revokedAt: null,
          revokedBy: null,
        }),
        updateAfterAuthentication: vi.fn().mockResolvedValue({}),
      },
      ceremonies: {
        createCeremony: vi.fn(),
        consumeCeremony: vi.fn().mockResolvedValue({
          type: "authentication",
          challenge: "challenge",
        }),
      },
      getUser: vi.fn().mockResolvedValue({
        id: "user-id",
        name: "BETO",
        role: "admin",
      }),
      createSession,
      verifyResponse: vi.fn().mockResolvedValue({
        verified: true,
        authenticationInfo: {
          userVerified: true,
          credentialID: "credential-id",
          newCounter: 0,
          credentialBackedUp: false,
        },
      }),
    });

    await service.verify({
      ceremonyId: "ceremony-id",
      browserBinding: "browser-binding",
      response: { id: "credential-id" } as never,
      keepActive: false,
    });

    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({ keepActive: false }),
    );
  });
});
