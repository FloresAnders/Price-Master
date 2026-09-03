import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  GenerateAuthenticationOptionsOpts,
  VerifiedAuthenticationResponse,
  VerifyAuthenticationResponseOpts,
} from "@simplewebauthn/server";
import { createAuthSession, serializeSafeUser } from "@/lib/auth/session-store.server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getCeremonyService } from "@/lib/passkeys/ceremonies.server";
import { getWebAuthnConfig, type WebAuthnConfig } from "@/lib/passkeys/config.server";
import { getPasskeyService } from "@/lib/passkeys/repository.server";
import type {
  AuthSessionRecord,
  PasskeyRecord,
  WebAuthnCeremonyRecord,
} from "@/lib/passkeys/types";
import type { User } from "@/types/firestore";

export class PasskeyAuthenticationError extends Error {
  constructor(
    public readonly code:
      | "authentication_invalid"
      | "authentication_context_mismatch"
      | "counter_anomaly",
  ) {
    super(code);
    this.name = "PasskeyAuthenticationError";
  }
}

interface AuthenticationPasskeys {
  getPasskeyByCredentialId(credentialId: string): Promise<PasskeyRecord | null>;
  updateAfterAuthentication(
    credentialIdHash: string,
    changes: Pick<PasskeyRecord, "counter" | "backedUp" | "lastUsedAt">,
  ): Promise<PasskeyRecord | null>;
}

interface AuthenticationCeremonies {
  createCeremony(input: {
    type: "authentication";
    challenge: string;
    browserBinding: string;
  }): Promise<WebAuthnCeremonyRecord>;
  consumeCeremony(
    ceremonyId: string,
    browserBinding: string,
  ): Promise<WebAuthnCeremonyRecord>;
}

interface AuthenticationDependencies {
  config: WebAuthnConfig;
  passkeys: AuthenticationPasskeys;
  ceremonies: AuthenticationCeremonies;
  getUser(userId: string): Promise<User | null>;
  createSession(input: {
    userId: string;
    role: "admin" | "user" | "superadmin";
    authMethod: "passkey";
    credentialIdHash: string;
    keepActive?: boolean;
  }): Promise<{ token: string; record: AuthSessionRecord }>;
  now?: () => number;
  generateOptions?: (
    options: GenerateAuthenticationOptionsOpts,
  ) => Promise<Awaited<ReturnType<typeof generateAuthenticationOptions>>>;
  verifyResponse?: (
    options: VerifyAuthenticationResponseOpts,
  ) => Promise<VerifiedAuthenticationResponse>;
}

export function createAuthenticationService(
  dependencies: AuthenticationDependencies,
) {
  const now = dependencies.now ?? Date.now;
  const generateOptions =
    dependencies.generateOptions ?? generateAuthenticationOptions;
  const verifyResponse =
    dependencies.verifyResponse ?? verifyAuthenticationResponse;

  return {
    async createOptions(browserBinding: string) {
      const options = await generateOptions({
        rpID: dependencies.config.rpID,
        allowCredentials: [],
        userVerification: "required",
      });
      const ceremony = await dependencies.ceremonies.createCeremony({
        type: "authentication",
        challenge: options.challenge,
        browserBinding,
      });
      return { ceremonyId: ceremony.id, options };
    },

    async verify(input: {
      ceremonyId: string;
      browserBinding: string;
      response: AuthenticationResponseJSON;
      keepActive?: boolean;
    }) {
      const ceremony = await dependencies.ceremonies.consumeCeremony(
        input.ceremonyId,
        input.browserBinding,
      );
      if (ceremony.type !== "authentication") {
        throw new PasskeyAuthenticationError(
          "authentication_context_mismatch",
        );
      }

      const passkey = await dependencies.passkeys.getPasskeyByCredentialId(
        input.response.id,
      );
      if (!passkey || passkey.revokedAt !== null) {
        throw new PasskeyAuthenticationError("authentication_invalid");
      }
      const user = await dependencies.getUser(passkey.userId);
      if (
        !user?.id ||
        user.isActive === false ||
        !user.role
      ) {
        throw new PasskeyAuthenticationError("authentication_invalid");
      }

      const verification = await verifyResponse({
        response: input.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: dependencies.config.origins,
        expectedRPID: dependencies.config.rpID,
        credential: {
          id: passkey.credentialId,
          publicKey: Uint8Array.from(
            Buffer.from(passkey.publicKey, "base64url"),
          ),
          counter: passkey.counter,
          transports:
            passkey.transports as VerifyAuthenticationResponseOpts["credential"]["transports"],
        },
        requireUserVerification: true,
      });
      const info = verification.authenticationInfo;
      if (
        !verification.verified ||
        !info.userVerified ||
        info.credentialID !== passkey.credentialId
      ) {
        throw new PasskeyAuthenticationError("authentication_invalid");
      }
      if (
        (passkey.counter !== 0 || info.newCounter !== 0) &&
        info.newCounter <= passkey.counter
      ) {
        console.warn("Passkey counter anomaly", {
          credentialIdHash: passkey.credentialIdHash,
          previousCounter: passkey.counter,
          newCounter: info.newCounter,
        });
        throw new PasskeyAuthenticationError("counter_anomaly");
      }

      await dependencies.passkeys.updateAfterAuthentication(
        passkey.credentialIdHash,
        {
          counter: info.newCounter,
          backedUp: info.credentialBackedUp,
          lastUsedAt: now(),
        },
      );
      const issued = await dependencies.createSession({
        userId: user.id,
        role: user.role,
        authMethod: "passkey",
        credentialIdHash: passkey.credentialIdHash,
        keepActive: input.keepActive !== false,
      });
      return {
        token: issued.token,
        record: issued.record,
        user: serializeSafeUser(user),
      };
    },
  };
}

export function getAuthenticationService() {
  return createAuthenticationService({
    config: getWebAuthnConfig(),
    passkeys: getPasskeyService(),
    ceremonies: getCeremonyService(),
    async getUser(userId) {
      const snapshot = await getAdminDb().collection("users").doc(userId).get();
      return snapshot.exists
        ? ({ id: snapshot.id, ...snapshot.data() } as User)
        : null;
    },
    createSession: createAuthSession,
  });
}
