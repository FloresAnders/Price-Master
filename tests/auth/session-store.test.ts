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
  touches: Array<{ id: string; lastSeenAt: number; expiresAt?: number }> = [];
  linkedPasskeySessions: string[] = [];

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

  async touch(
    id: string,
    lastSeenAt: number,
    expiresAt?: number,
    durationMs?: number,
    userValidatedAt?: number,
  ) {
    this.touches.push({ id, lastSeenAt, expiresAt });
    for (const [hash, record] of this.records) {
      if (record.id === id) {
        this.records.set(hash, {
          ...record,
          lastSeenAt,
          ...(expiresAt === undefined ? {} : { expiresAt }),
          ...(durationMs === undefined ? {} : { durationMs }),
          ...(userValidatedAt === undefined ? {} : { userValidatedAt }),
        });
      }
    }
  }

  async linkPasskeySession(id: string) {
    this.linkedPasskeySessions.push(id);
    for (const record of this.records.values()) {
      if (record.id === id) record.passkeyRevocationLinked = true;
    }
  }
}

const createFixture = (user: User | null = activeUser) => {
  const repository = new MemorySessionRepository();
  const now = 1_700_000_000_000;
  let currentTime = now;
  let getUserCalls = 0;
  let passkeyValidationCalls = 0;
  const service = createSessionService({
    repository,
    getUser: async () => {
      getUserCalls += 1;
      return user;
    },
    isPasskeyActive: async (credentialIdHash) => {
      passkeyValidationCalls += 1;
      return credentialIdHash === "active-key";
    },
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
    getUserCalls: () => getUserCalls,
    passkeyValidationCalls: () => passkeyValidationCalls,
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
    expect(
      inactiveFixture.repository.records.get("hash:opaque-session-token"),
    ).toMatchObject({
      revokedAt: inactiveFixture.now,
      revokedReason: "user_inactive",
    });
  });

  it("invalida una sesión cuando su passkey deja de estar activa", async () => {
    const { repository, service } = createFixture();
    await service.create({
      userId: "u1",
      role: "user",
      authMethod: "passkey",
      credentialIdHash: "revoked-key",
    });
    repository.records.get("hash:opaque-session-token")!.passkeyRevocationLinked =
      false;

    expect(
      await service.read("pricemaster_auth=opaque-session-token"),
    ).toBeNull();
    expect(
      repository.records.get("hash:opaque-session-token"),
    ).toMatchObject({
      revokedAt: 1_700_000_000_000,
      revokedReason: "passkey_inactive",
    });
  });

  it("no relee la passkey de una sesión vinculada al mecanismo de revocación", async () => {
    const { passkeyValidationCalls, service } = createFixture();
    await service.create({
      userId: "u1",
      role: "user",
      authMethod: "passkey",
      credentialIdHash: "active-key",
    });

    const authenticated = await service.read(
      "pricemaster_auth=opaque-session-token",
    );

    expect(authenticated?.user.id).toBe("u1");
    expect(passkeyValidationCalls()).toBe(0);
  });

  it("valida y vincula una sola vez las sesiones passkey heredadas", async () => {
    const { passkeyValidationCalls, repository, service } = createFixture();
    await service.create({
      userId: "u1",
      role: "user",
      authMethod: "passkey",
      credentialIdHash: "active-key",
    });
    repository.records.get("hash:opaque-session-token")!.passkeyRevocationLinked =
      false;

    await service.read("pricemaster_auth=opaque-session-token");
    await service.read("pricemaster_auth=opaque-session-token");

    expect(passkeyValidationCalls()).toBe(1);
    expect(repository.linkedPasskeySessions).toEqual(["session-id"]);
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

    advance(31 * 60 * 1000);
    const authenticated = await service.read(
      "pricemaster_auth=opaque-session-token",
    );

    expect(authenticated?.session.expiresAt).toBe(
      now + 31 * 60 * 1000 + 5 * 60 * 60 * 1000,
    );
    expect(
      repository.records.get("hash:opaque-session-token")?.expiresAt,
    ).toBe(now + 31 * 60 * 1000 + 5 * 60 * 60 * 1000);
  });

  it("no toca ni renueva una sesión antes de treinta minutos", async () => {
    const { advance, repository, service } = createFixture({
      ...activeUser,
      role: "admin",
    });
    const issued = await service.create({
      userId: "u1",
      role: "admin",
      authMethod: "password",
      keepActive: true,
    });

    advance(10 * 60 * 1000);
    const authenticated = await service.read(
      "pricemaster_auth=opaque-session-token",
    );

    expect(authenticated?.session.expiresAt).toBe(issued.record.expiresAt);
    expect(repository.touches).toHaveLength(0);
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

    advance(31 * 60 * 1000);
    const authenticated = await service.read(
      "pricemaster_auth=opaque-session-token",
    );

    expect(issued.record.keepActive).toBe(false);
    expect(authenticated?.session.expiresAt).toBe(initialExpiration);
    expect(
      repository.records.get("hash:opaque-session-token")?.expiresAt,
    ).toBe(initialExpiration);
    expect(repository.touches).toHaveLength(0);
  });

  it("el heartbeat renueva usando solo el documento de sesión", async () => {
    const {
      advance,
      getUserCalls,
      passkeyValidationCalls,
      repository,
      service,
    } = createFixture({ ...activeUser, role: "admin" });
    await service.create({
      userId: "u1",
      role: "admin",
      authMethod: "password",
      keepActive: true,
    });

    advance(31 * 60 * 1000);
    const session = await service.heartbeat(
      "pricemaster_auth=opaque-session-token",
    );

    expect(session?.expiresAt).toBe(
      1_700_000_000_000 + 31 * 60 * 1000 + 5 * 60 * 60 * 1000,
    );
    expect(getUserCalls()).toBe(0);
    expect(passkeyValidationCalls()).toBe(0);
    expect(repository.touches).toHaveLength(1);
  });

  it("migra una sola vez la duración de una sesión heredada", async () => {
    const { advance, getUserCalls, repository, service } = createFixture({
      ...activeUser,
      role: "admin",
    });
    await service.create({
      userId: "u1",
      role: "admin",
      authMethod: "password",
      keepActive: true,
    });
    delete repository.records.get("hash:opaque-session-token")!.durationMs;

    advance(31 * 60 * 1000);
    await service.heartbeat("pricemaster_auth=opaque-session-token");
    advance(31 * 60 * 1000);
    await service.heartbeat("pricemaster_auth=opaque-session-token");

    expect(getUserCalls()).toBe(1);
    expect(
      repository.records.get("hash:opaque-session-token")?.durationMs,
    ).toBe(5 * 60 * 60 * 1000);
  });

  it("revalida al usuario como máximo una vez por hora de heartbeat", async () => {
    const { advance, getUserCalls, service } = createFixture({
      ...activeUser,
      role: "admin",
    });
    await service.create({
      userId: "u1",
      role: "admin",
      authMethod: "password",
      keepActive: true,
    });

    advance(31 * 60 * 1000);
    await service.heartbeat("pricemaster_auth=opaque-session-token");
    expect(getUserCalls()).toBe(0);

    advance(31 * 60 * 1000);
    await service.heartbeat("pricemaster_auth=opaque-session-token");
    expect(getUserCalls()).toBe(1);
  });

  it("ajusta la duración cuando el rol cambia durante la sesión", async () => {
    const mutableUser: User = { ...activeUser, role: "user" };
    const { advance, now, repository, service } = createFixture(mutableUser);
    await service.create({
      userId: "u1",
      role: "user",
      authMethod: "password",
      keepActive: true,
    });

    mutableUser.role = "admin";
    advance(61 * 60 * 1000);
    await service.heartbeat("pricemaster_auth=opaque-session-token");

    expect(
      repository.records.get("hash:opaque-session-token")?.durationMs,
    ).toBe(5 * 60 * 60 * 1000);
    expect(
      repository.records.get("hash:opaque-session-token")?.expiresAt,
    ).toBe(now + 61 * 60 * 1000 + 5 * 60 * 60 * 1000);
  });
});
