"use client";

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import type { User } from "@/types/firestore";
import { markPasskeySuccessful } from "./preference.client";

export type PasskeyClientErrorCode =
  | "cancelled"
  | "network"
  | "unsupported"
  | "failed";

export class PasskeyClientError extends Error {
  constructor(
    public readonly code: PasskeyClientErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PasskeyClientError";
  }
}

type SafeUser = Omit<User, "password">;
type RegisteredPasskey = { id: string; label: string };

export function isPasskeySupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.credentials
  );
}

function mapError(error: unknown): PasskeyClientError {
  if (error instanceof PasskeyClientError) return error;
  if (
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "AbortError")
  ) {
    return new PasskeyClientError(
      "cancelled",
      "La verificación del dispositivo fue cancelada.",
      { cause: error },
    );
  }
  if (error instanceof TypeError) {
    return new PasskeyClientError(
      "network",
      "No se pudo conectar con TimeMaster.",
      { cause: error },
    );
  }
  return new PasskeyClientError(
    "failed",
    "No se pudo completar la verificación con passkey.",
    { cause: error },
  );
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
  } catch (error) {
    throw new PasskeyClientError(
      "network",
      "No se pudo conectar con TimeMaster.",
      { cause: error },
    );
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { ok?: boolean })
    | null;
  if (!response.ok || !payload || payload.ok === false) {
    throw new PasskeyClientError(
      "failed",
      "El servidor rechazó la operación con passkey.",
    );
  }
  return payload;
}

function assertSupport(): void {
  if (!isPasskeySupported()) {
    throw new PasskeyClientError(
      "unsupported",
      "Este navegador no admite passkeys.",
    );
  }
}

export async function registerPasskey(
  enrollmentGrantId: string,
): Promise<RegisteredPasskey> {
  assertSupport();
  try {
    const start = await postJson<{
      ceremonyId: string;
      options: PublicKeyCredentialCreationOptionsJSON;
    }>("/api/auth/passkeys/register/options", { enrollmentGrantId });
    const credential = await startRegistration({ optionsJSON: start.options });
    const verified = await postJson<{ passkey: RegisteredPasskey }>(
      "/api/auth/passkeys/register/verify",
      { ceremonyId: start.ceremonyId, response: credential },
    );
    await markPasskeySuccessful();
    return verified.passkey;
  } catch (error) {
    throw mapError(error);
  }
}

export async function authenticateWithPasskey(
  keepSessionActive = true,
): Promise<SafeUser> {
  assertSupport();
  try {
    const start = await postJson<{
      ceremonyId: string;
      options: PublicKeyCredentialRequestOptionsJSON;
    }>("/api/auth/passkeys/authenticate/options");
    const credential = await startAuthentication({ optionsJSON: start.options });
    const verified = await postJson<{ user: SafeUser }>(
      "/api/auth/passkeys/authenticate/verify",
      {
        ceremonyId: start.ceremonyId,
        response: credential,
        keepSessionActive,
      },
    );
    await markPasskeySuccessful();
    return verified.user;
  } catch (error) {
    throw mapError(error);
  }
}
