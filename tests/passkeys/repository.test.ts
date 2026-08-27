import { describe, expect, it } from "vitest";
import {
  createPasskeyService,
  ensureSafePasskeySessionRevocation,
  PasskeyRepositoryError,
  type PasskeyStore,
} from "@/lib/passkeys/repository.server";
import type {
  PasskeyRecord,
  PasskeyUserRecord,
} from "@/lib/passkeys/types";

class MemoryPasskeyStore implements PasskeyStore {
  users = new Map<string, PasskeyUserRecord>();
  passkeys = new Map<string, PasskeyRecord>();
  revokedSessionCredentials: string[] = [];

  async getOrCreateUser(
    userId: string,
    create: () => PasskeyUserRecord,
  ) {
    const current = this.users.get(userId);
    if (current) return { ...current };
    const record = create();
    this.users.set(userId, { ...record });
    return record;
  }

  async savePasskey(record: PasskeyRecord) {
    if (this.passkeys.has(record.credentialIdHash)) {
      throw new PasskeyRepositoryError("credential_exists");
    }
    this.passkeys.set(record.credentialIdHash, { ...record });
  }

  async getPasskey(credentialIdHash: string) {
    return this.passkeys.get(credentialIdHash) ?? null;
  }

  async listPasskeys(userId: string) {
    return [...this.passkeys.values()].filter((item) => item.userId === userId);
  }

  async updatePasskey(
    credentialIdHash: string,
    changes: Partial<PasskeyRecord>,
  ) {
    const current = this.passkeys.get(credentialIdHash);
    if (!current) return null;
    const updated = { ...current, ...changes };
    this.passkeys.set(credentialIdHash, updated);
    return updated;
  }

  async revokePasskeyAndSessions(
    credentialIdHash: string,
    revokedAt: number,
    revokedBy: string,
  ) {
    this.revokedSessionCredentials.push(credentialIdHash);
    return this.updatePasskey(credentialIdHash, { revokedAt, revokedBy });
  }
}

const fixture = () => {
  const store = new MemoryPasskeyStore();
  const service = createPasskeyService({
    store,
    now: () => 1_700_000_000_000,
    randomUserHandle: () => "opaque-user-handle",
    hashCredentialId: (credentialId) => `hash:${credentialId}`,
  });
  return { service, store };
};

const record = (userId = "u1"): PasskeyRecord => ({
  credentialId: "credential-a",
  credentialIdHash: "hash:credential-a",
  userId,
  publicKey: "public-key",
  counter: 0,
  transports: ["internal"],
  deviceType: "multiDevice",
  backedUp: true,
  label: "Passkey sincronizada",
  createdAt: 1_700_000_000_000,
  lastUsedAt: null,
  revokedAt: null,
  revokedBy: null,
});

describe("passkey repository service", () => {
  it("rechaza una revocación que excedería el límite transaccional", () => {
    expect(() => ensureSafePasskeySessionRevocation(451)).toThrowError(
      expect.objectContaining({ code: "session_limit_exceeded" }),
    );
    expect(() => ensureSafePasskeySessionRevocation(450)).not.toThrow();
  });

  it("mantiene un identificador WebAuthn estable y opaco por usuario", async () => {
    const { service } = fixture();
    const first = await service.getOrCreatePasskeyUser("u1");
    const second = await service.getOrCreatePasskeyUser("u1");

    expect(first).toEqual({
      userId: "u1",
      webAuthnUserId: "opaque-user-handle",
      createdAt: 1_700_000_000_000,
    });
    expect(second).toEqual(first);
  });

  it("localiza una credencial por el hash de su identificador", async () => {
    const { service } = fixture();
    await service.savePasskey(record());

    expect(await service.getPasskeyByCredentialId("credential-a")).toMatchObject({
      userId: "u1",
      publicKey: "public-key",
    });
    expect(await service.getPasskeyByCredentialId("unknown")).toBeNull();
  });

  it("impide modificar passkeys ajenas y permite la intervención superadmin", async () => {
    const { service } = fixture();
    await service.savePasskey(record("owner"));

    await expect(
      service.renamePasskey("intruder", false, "hash:credential-a", "Oficina"),
    ).rejects.toBeInstanceOf(PasskeyRepositoryError);
    expect(
      await service.renamePasskey(
        "superadmin",
        true,
        "hash:credential-a",
        "  Oficina  ",
      ),
    ).toMatchObject({ label: "Oficina" });
  });

  it("revoca de forma idempotente sin borrar la credencial", async () => {
    const { service, store } = fixture();
    await service.savePasskey(record());

    const first = await service.revokePasskey(
      "u1",
      false,
      "hash:credential-a",
    );
    const second = await service.revokePasskey(
      "u1",
      false,
      "hash:credential-a",
    );

    expect(first).toMatchObject({
      revokedAt: 1_700_000_000_000,
      revokedBy: "u1",
    });
    expect(second).toEqual(first);
    expect(store.revokedSessionCredentials).toEqual(["hash:credential-a"]);
  });
});
