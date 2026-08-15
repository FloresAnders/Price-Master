import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  GenerateRegistrationOptionsOpts,
  RegistrationResponseJSON,
  VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type { WebAuthnConfig } from "@/lib/passkeys/config.server";
import { getWebAuthnConfig } from "@/lib/passkeys/config.server";
import { sha256Base64Url } from "@/lib/passkeys/crypto.server";
import { getCeremonyService } from "@/lib/passkeys/ceremonies.server";
import { getPasskeyService } from "@/lib/passkeys/repository.server";
import type {
  AuthenticatedSession,
  PasskeyRecord,
  PasskeyUserRecord,
  WebAuthnCeremonyRecord,
} from "@/lib/passkeys/types";

export class PasskeyRegistrationError extends Error {
  constructor(
    public readonly code:
      | "registration_invalid"
      | "registration_context_mismatch",
  ) {
    super(code);
    this.name = "PasskeyRegistrationError";
  }
}

interface RegistrationPasskeys {
  getOrCreatePasskeyUser(userId: string): Promise<PasskeyUserRecord>;
  listUserPasskeys(
    userId: string,
  ): Promise<Array<Pick<PasskeyRecord, "credentialId" | "transports" | "revokedAt">>>;
  savePasskey(record: PasskeyRecord): Promise<PasskeyRecord>;
}

interface RegistrationCeremonies {
  createCeremony(input: {
    type: "registration";
    challenge: string;
    browserBinding: string;
    userId: string;
    authSessionId: string;
    enrollmentGrantId: string;
  }): Promise<WebAuthnCeremonyRecord>;
  consumeCeremony(
    ceremonyId: string,
    browserBinding: string,
  ): Promise<WebAuthnCeremonyRecord>;
  claimEnrollmentGrant(
    grantId: string,
    authSessionId: string,
    ceremonyId: string,
  ): Promise<unknown>;
  consumeEnrollmentGrant(
    grantId: string,
    ceremonyId: string,
  ): Promise<unknown>;
}

interface RegistrationServiceDependencies {
  config: WebAuthnConfig;
  passkeys: RegistrationPasskeys;
  ceremonies: RegistrationCeremonies;
  now?: () => number;
  generateOptions?: (
    options: GenerateRegistrationOptionsOpts,
  ) => Promise<Awaited<ReturnType<typeof generateRegistrationOptions>>>;
  verifyResponse?: (options: {
    response: RegistrationResponseJSON;
    expectedChallenge: string;
    expectedOrigin: string[];
    expectedRPID: string;
    requireUserVerification: true;
  }) => Promise<VerifiedRegistrationResponse>;
}

interface RegistrationContext {
  authenticated: AuthenticatedSession;
  enrollmentGrantId: string;
  browserBinding: string;
}

export function createRegistrationService(
  dependencies: RegistrationServiceDependencies,
) {
  const now = dependencies.now ?? Date.now;
  const generateOptions =
    dependencies.generateOptions ?? generateRegistrationOptions;
  const verifyResponse =
    dependencies.verifyResponse ?? verifyRegistrationResponse;

  return {
    async createOptions(context: RegistrationContext) {
      const userId = context.authenticated.user.id;
      if (!userId) throw new PasskeyRegistrationError("registration_invalid");
      const passkeyUser = await dependencies.passkeys.getOrCreatePasskeyUser(
        userId,
      );
      const currentPasskeys = await dependencies.passkeys.listUserPasskeys(
        userId,
      );
      const options = await generateOptions({
        rpName: dependencies.config.rpName,
        rpID: dependencies.config.rpID,
        userID: Buffer.from(passkeyUser.webAuthnUserId, "base64url"),
        userName: context.authenticated.user.name,
        userDisplayName:
          context.authenticated.user.fullName ||
          context.authenticated.user.name,
        attestationType: "none",
        excludeCredentials: currentPasskeys
          .filter((passkey) => passkey.revokedAt === null)
          .map((passkey) => ({
            id: passkey.credentialId,
            transports: passkey.transports as GenerateRegistrationOptionsOpts["excludeCredentials"] extends Array<infer T>
              ? T extends { transports?: infer U }
                ? U
                : never
              : never,
          })),
        authenticatorSelection: {
          residentKey: "required",
          userVerification: "required",
        },
      });
      const ceremony = await dependencies.ceremonies.createCeremony({
        type: "registration",
        challenge: options.challenge,
        browserBinding: context.browserBinding,
        userId,
        authSessionId: context.authenticated.session.id,
        enrollmentGrantId: context.enrollmentGrantId,
      });
      await dependencies.ceremonies.claimEnrollmentGrant(
        context.enrollmentGrantId,
        context.authenticated.session.id,
        ceremony.id,
      );
      return { ceremonyId: ceremony.id, options };
    },

    async verify(
      context: Omit<RegistrationContext, "enrollmentGrantId"> & {
        ceremonyId: string;
        response: RegistrationResponseJSON;
      },
    ) {
      const userId = context.authenticated.user.id;
      if (!userId) throw new PasskeyRegistrationError("registration_invalid");
      const ceremony = await dependencies.ceremonies.consumeCeremony(
        context.ceremonyId,
        context.browserBinding,
      );
      if (
        ceremony.type !== "registration" ||
        ceremony.userId !== userId ||
        ceremony.authSessionId !== context.authenticated.session.id ||
        !ceremony.enrollmentGrantId
      ) {
        throw new PasskeyRegistrationError("registration_context_mismatch");
      }

      const verification = await verifyResponse({
        response: context.response,
        expectedChallenge: ceremony.challenge,
        expectedOrigin: dependencies.config.origins,
        expectedRPID: dependencies.config.rpID,
        requireUserVerification: true,
      });
      if (
        !verification.verified ||
        !verification.registrationInfo.userVerified
      ) {
        throw new PasskeyRegistrationError("registration_invalid");
      }

      const info = verification.registrationInfo;
      const createdAt = now();
      const record: PasskeyRecord = {
        credentialId: info.credential.id,
        credentialIdHash: sha256Base64Url(info.credential.id),
        userId,
        publicKey: Buffer.from(info.credential.publicKey).toString("base64url"),
        counter: info.credential.counter,
        transports: [...(info.credential.transports ?? [])],
        deviceType: info.credentialDeviceType,
        backedUp: info.credentialBackedUp,
        label:
          info.credentialDeviceType === "multiDevice"
            ? "Passkey sincronizada"
            : "Passkey de este dispositivo",
        createdAt,
        lastUsedAt: null,
        revokedAt: null,
        revokedBy: null,
      };
      const saved = await dependencies.passkeys.savePasskey(record);
      await dependencies.ceremonies.consumeEnrollmentGrant(
        ceremony.enrollmentGrantId,
        ceremony.id,
      );
      return saved;
    },
  };
}

export function getRegistrationService() {
  return createRegistrationService({
    config: getWebAuthnConfig(),
    passkeys: getPasskeyService(),
    ceremonies: getCeremonyService(),
  });
}
