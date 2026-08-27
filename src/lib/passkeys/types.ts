import type { User } from "@/types/firestore";

export type AuthMethod = "password" | "passkey";
export type PasskeyDeviceType = "singleDevice" | "multiDevice";

export interface PasskeyUserRecord {
  userId: string;
  webAuthnUserId: string;
  createdAt: number;
}

export interface PasskeyRecord {
  credentialId: string;
  credentialIdHash: string;
  userId: string;
  publicKey: string;
  counter: number;
  transports: string[];
  deviceType: PasskeyDeviceType;
  backedUp: boolean;
  label: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
  revokedBy: string | null;
}

export interface WebAuthnCeremonyRecord {
  id: string;
  type: "registration" | "authentication";
  challenge: string;
  browserBindingHash: string;
  userId: string | null;
  authSessionId: string | null;
  enrollmentGrantId: string | null;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

export interface EnrollmentGrantRecord {
  id: string;
  userId: string;
  authSessionId: string;
  createdAt: number;
  expiresAt: number;
  ceremonyId: string | null;
  consumedAt: number | null;
}

export interface AuthSessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  authMethod: AuthMethod;
  credentialIdHash: string | null;
  createdAt: number;
  lastSeenAt: number;
  expiresAt: number;
  durationMs?: number;
  userValidatedAt?: number;
  keepActive?: boolean;
  passkeyRevocationLinked?: boolean;
  revokedAt: number | null;
  revokedReason: string | null;
}

export interface AuthenticatedSession {
  session: AuthSessionRecord;
  user: Omit<User, "password">;
}

export interface PublicPasskey {
  id: string;
  label: string;
  deviceType: PasskeyDeviceType;
  backedUp: boolean;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}
