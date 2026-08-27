import { describe, expect, it } from "vitest";
import type { User } from "@/types/firestore";
import {
  createSessionService,
  type SessionRepository,
} from "@/lib/auth/session-store.server";
import type { AuthSessionRecord } from "@/lib/passkeys/types";

const activeUser: User = {
  id: "u1",
  name: "ALCHACAS",
  password: "must-not-leak",
  role: "user",
  isActive: true,
  eliminate: true,
};

class MemorySessionRepository implements SessionRepository {
  records = new Map<string, AuthSessionRecord>();

  async save(record: AuthSessionRecord) {
    this.records.set(record.tokenHash, { ...record });
  }

  async findByTokenHash(tokenHash: string) {
    return this.records.get(tokenHash) ?? null;
  }

  async revoke(id: string, revokedAt: number, reason: string) {
    for (const [hash, record] of this.records) {
      if (record.id === id) {
        this.records.set(hash, { ...record, revokedAt, revokedReason: reason });
      }
    }
  }

  async touch(id: string, lastSeenAt: number, expiresAt?: number) {
    for (const [hash, record] of this.records) {
      if (record.id === id) {
        this.records.set(hash, {
          ...record,
          lastSeenAt,
          ...(expiresAt === undefined ? {} : { expiresAt }),
        });
      }
    }
  }
}

const createFixture = (user: User | null = activeUser) => {
  const repository = new MemorySessionRepository();
  const now = 1_700_000_000_000;
  let currentTime = now;
  const service = createSessionService({
    repository,
    getUser: async () => user,
    isPasskeyActive: async (credentialIdHash) => credentialIdHash === "active-key",
    now: () => currentTime,
    randomToken: () => "opaque-session-token",
    randomId: () => "session-id",
    hashToken: (token) => `hash:${token}`,
  });
  return {
    now,
    repository,
    service,
    advance: (milliseconds: number) => {
      currentTime += milliseconds;
    },
  };
};

describe("server session service", () => {
  it("persiste solamente el hash del token opaco", async () => {
    const { repository, service } = createFixture();

    const issued = await service.create({
      userId: "u1",
      role: "user",
      authMethod: "password",
    });

    expect(issued.token).toBe("opaque-session-token");
    expect(repository.records.has("opaque-session-token")).toBe(false);
    expect(repository.records.get("hash:opaque-session-token")).toMatchObject({
      id: "session-id",
      userId: "u1",
      authMethod: "password",
      credentialIdHash: null,
      keepActive: true,
    });
  });

  it("hidrata un usuario activo sin devolver la contraseña", async () => {
    const { service } = createFixture();
    await service.create({ userId: "u1", role: "user", authMethod: "password" });

    const authenticated = await service.read(
      "other=value; pricemaster_auth=opaque-session-token",
    );

    expect(authenticated?.user).toEqual({
      id: "u1",
      name: "ALCHACAS",
      role: "user",
      isActive: true,
      eliminate: true,
    });
  });

  it("rechaza sesiones vencidas, revocadas o de usuarios inactivos", async () => {
    const expiredFixture = createFixture();
    await expiredFixture.service.create({
      userId: "u1",
      role: "user",
      authMethod: "password",
    });
    const expired = expiredFixture.repository.records.get(
      "hash:opaque-session-token",
    )!;
    expired.expiresAt = expiredFixture.now - 1;
    expect(
      await expiredFixture.service.read("pricemaster_auth=opaque-session-token"),
    ).toBeNull();

    const revokedFixture = createFixture();
    await revokedFixture.service.create({
      userId: "u1",
      role: "user",
      authMethod: "password",
    });
    await revokedFixture.service.revoke(
      "pricemaster_auth=opaque-session-token",
      "logout",
    );
    expect(
      await revokedFixture.service.read("pricemaster_auth=opaque-session-token"),
    ).toBeNull();

    const inactiveFixture = createFixture({ ...activeUser, isActive: false });
    await inactiveFixture.service.create({
      userId: "u1",
      role: "user",
      authMethod: "password",
    });
    expect(
      await inactiveFixture.service.read("pricemaster_auth=opaque-session-token"),
    ).toBeNull();
  });

  it("invalida una sesión cuando su passkey deja de estar activa", async () => {
    const { service } = createFixture();
    await service.create({
      userId: "u1",
      role: "user",
      authMethod: "passkey",
      credentialIdHash: "revoked-key",
    });

    expect(
      await service.read("pricemaster_auth=opaque-session-token"),
    ).toBeNull();
  });

  it("conserva las duraciones actuales por rol", async () => {
    const { now, service } = createFixture();

    const userSession = await service.create({
      userId: "u1",
      role: "user",
      authMethod: "password",
    });
    const adminSession = await service.create({
      userId: "u2",
      role: "admin",
      authMethod: "password",
    });

    expect(userSession.record.expiresAt - now).toBe(30 * 24 * 60 * 60 * 1000);
    expect(adminSession.record.expiresAt - now).toBe(5 * 60 * 60 * 1000);
  });

  it("renueva el vencimiento por rol de una sesión activa", async () => {
    const { advance, now, repository, service } = createFixture({
      ...activeUser,
      role: "admin",
    });
    await service.create({
      userId: "u1",
      role: "admin",
      authMethod: "password",
      keepActive: true,
    });

    advance(10 * 60 * 1000);
    const authenticated = await service.read(
      "pricemaster_auth=opaque-session-token",
    );

    expect(authenticated?.session.expiresAt).toBe(
      now + 10 * 60 * 1000 + 5 * 60 * 60 * 1000,
    );
    expect(
      repository.records.get("hash:opaque-session-token")?.expiresAt,
    ).toBe(now + 10 * 60 * 1000 + 5 * 60 * 60 * 1000);
  });

  it("conserva el vencimiento inicial cuando la renovación está desactivada", async () => {
    const { advance, repository, service } = createFixture({
      ...activeUser,
      role: "admin",
    });
    const issued = await service.create({
      userId: "u1",
      role: "admin",
      authMethod: "password",
      keepActive: false,
    });
    const initialExpiration = issued.record.expiresAt;

    advance(10 * 60 * 1000);
    const authenticated = await service.read(
      "pricemaster_auth=opaque-session-token",
    );

    expect(issued.record.keepActive).toBe(false);
    expect(authenticated?.session.expiresAt).toBe(initialExpiration);
    expect(
      repository.records.get("hash:opaque-session-token")?.expiresAt,
    ).toBe(initialExpiration);
  });
});
