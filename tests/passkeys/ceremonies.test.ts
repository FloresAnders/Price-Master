import { describe, expect, it } from "vitest";
import {
  createCeremonyService,
  PasskeyCeremonyError,
  type CeremonyStore,
} from "@/lib/passkeys/ceremonies.server";
import type {
  EnrollmentGrantRecord,
  WebAuthnCeremonyRecord,
} from "@/lib/passkeys/types";

class MemoryCeremonyStore implements CeremonyStore {
  ceremonies = new Map<string, WebAuthnCeremonyRecord>();
  grants = new Map<string, EnrollmentGrantRecord>();

  async saveCeremony(record: WebAuthnCeremonyRecord) {
    this.ceremonies.set(record.id, { ...record });
  }

  async consumeCeremony(
    id: string,
    browserBindingHash: string,
    now: number,
  ) {
    const record = this.ceremonies.get(id);
    if (
      !record ||
      record.browserBindingHash !== browserBindingHash ||
      record.consumedAt !== null ||
      record.expiresAt <= now
    ) {
      return null;
    }
    record.consumedAt = now;
    return { ...record };
  }

  async saveGrant(record: EnrollmentGrantRecord) {
    this.grants.set(record.id, { ...record });
  }

  async claimGrant(
    id: string,
    authSessionId: string,
    ceremonyId: string,
    now: number,
  ) {
    const record = this.grants.get(id);
    if (
      !record ||
      record.authSessionId !== authSessionId ||
      record.expiresAt <= now ||
      record.consumedAt !== null ||
      record.ceremonyId !== null
    ) {
      return null;
    }
    record.ceremonyId = ceremonyId;
    return { ...record };
  }

  async consumeGrant(id: string, ceremonyId: string, now: number) {
    const record = this.grants.get(id);
    if (
      !record ||
      record.ceremonyId !== ceremonyId ||
      record.consumedAt !== null ||
      record.expiresAt <= now
    ) {
      return false;
    }
    record.consumedAt = now;
    return true;
  }
}

const fixture = () => {
  const store = new MemoryCeremonyStore();
  let id = 0;
  const now = 1_700_000_000_000;
  const service = createCeremonyService({
    store,
    now: () => now,
    randomId: () => `id-${++id}`,
    hashBrowserBinding: (binding) => `hash:${binding}`,
  });
  return { now, service, store };
};

describe("passkey ceremonies", () => {
  it("crea y consume una ceremonia ligada al navegador una sola vez", async () => {
    const { service } = fixture();
    const created = await service.createCeremony({
      type: "authentication",
      challenge: "challenge",
      browserBinding: "browser-a",
    });

    expect(created).toMatchObject({
      id: "id-1",
      type: "authentication",
      challenge: "challenge",
      browserBindingHash: "hash:browser-a",
    });
    expect(
      await service.consumeCeremony(created.id, "browser-a"),
    ).toMatchObject({ id: "id-1", consumedAt: 1_700_000_000_000 });
    await expect(
      service.consumeCeremony(created.id, "browser-a"),
    ).rejects.toMatchObject({ code: "ceremony_invalid" });
  });

  it("no consume la ceremonia desde otro navegador", async () => {
    const { service } = fixture();
    const created = await service.createCeremony({
      type: "authentication",
      challenge: "challenge",
      browserBinding: "browser-a",
    });

    await expect(
      service.consumeCeremony(created.id, "browser-b"),
    ).rejects.toBeInstanceOf(PasskeyCeremonyError);
    expect(await service.consumeCeremony(created.id, "browser-a")).toBeTruthy();
  });

  it("rechaza ceremonias vencidas", async () => {
    const { now, service, store } = fixture();
    const created = await service.createCeremony({
      type: "registration",
      challenge: "challenge",
      browserBinding: "browser-a",
      userId: "u1",
      authSessionId: "s1",
    });
    store.ceremonies.get(created.id)!.expiresAt = now - 1;

    await expect(
      service.consumeCeremony(created.id, "browser-a"),
    ).rejects.toMatchObject({ code: "ceremony_invalid" });
  });

  it("liga una concesión de inscripción a sesión y ceremonia", async () => {
    const { service } = fixture();
    const grant = await service.createEnrollmentGrant("u1", "session-1");

    await expect(
      service.claimEnrollmentGrant(grant.id, "other-session", "ceremony-1"),
    ).rejects.toMatchObject({ code: "grant_invalid" });
    expect(
      await service.claimEnrollmentGrant(
        grant.id,
        "session-1",
        "ceremony-1",
      ),
    ).toMatchObject({ ceremonyId: "ceremony-1" });
    expect(
      await service.consumeEnrollmentGrant(grant.id, "ceremony-1"),
    ).toBe(true);
    await expect(
      service.consumeEnrollmentGrant(grant.id, "ceremony-1"),
    ).rejects.toMatchObject({ code: "grant_invalid" });
  });
});
