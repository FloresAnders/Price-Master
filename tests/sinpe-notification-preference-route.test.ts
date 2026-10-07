import { describe, expect, it } from "vitest";
import { createSinpeNotificationPreferencePatch } from "@/app/api/users/sinpe-notifications/route";
import type { AuthenticatedSession } from "@/lib/passkeys/types";

const sessionFor = (
  role: "admin" | "superadmin" | "user",
): AuthenticatedSession =>
  ({
    user: {
      id: `${role}-123`,
      name: role,
      role,
    },
    session: {
      id: "session-123",
      userId: `${role}-123`,
      tokenHash: "hash",
      authMethod: "password",
      credentialIdHash: null,
      createdAt: 1,
      lastSeenAt: 1,
      expiresAt: 2,
      keepActive: true,
      revokedAt: null,
      revokedReason: null,
    },
  }) as AuthenticatedSession;

const makeRequest = (body: unknown) =>
  new Request("http://localhost/api/users/sinpe-notifications", {
    method: "PATCH",
    headers: {
      cookie: "timemaster_auth=session-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("PATCH /api/users/sinpe-notifications", () => {
  it.each(["admin", "superadmin"] as const)(
    "actualiza solo la preferencia del %s autenticado",
    async (role) => {
      const updates: Array<{ userId: string; enabled: boolean }> = [];
      const cookieHeaders: Array<string | null> = [];
      const handler = createSinpeNotificationPreferencePatch({
        readSession: async (cookieHeader) => {
          cookieHeaders.push(cookieHeader);
          return sessionFor(role);
        },
        updatePreference: async (userId, enabled) => {
          updates.push({ userId, enabled });
        },
      });

      const response = await handler(
        makeRequest({ enabled: false, userId: "otro-usuario" }),
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        sinpeNotificationsEnabled: false,
      });
      expect(updates).toEqual([{ userId: `${role}-123`, enabled: false }]);
      expect(cookieHeaders).toEqual(["timemaster_auth=session-token"]);
    },
  );

  it("rechaza una solicitud sin sesion", async () => {
    let updateCalls = 0;
    const handler = createSinpeNotificationPreferencePatch({
      readSession: async () => null,
      updatePreference: async () => {
        updateCalls += 1;
      },
    });

    const response = await handler(makeRequest({ enabled: true }));

    expect(response.status).toBe(401);
    expect(updateCalls).toBe(0);
  });

  it("impide que un usuario regular cambie la preferencia", async () => {
    let updateCalls = 0;
    const handler = createSinpeNotificationPreferencePatch({
      readSession: async () => sessionFor("user"),
      updatePreference: async () => {
        updateCalls += 1;
      },
    });

    const response = await handler(makeRequest({ enabled: true }));

    expect(response.status).toBe(403);
    expect(updateCalls).toBe(0);
  });

  it("rechaza valores que no sean booleanos", async () => {
    let updateCalls = 0;
    const handler = createSinpeNotificationPreferencePatch({
      readSession: async () => sessionFor("admin"),
      updatePreference: async () => {
        updateCalls += 1;
      },
    });

    const response = await handler(makeRequest({ enabled: "false" }));

    expect(response.status).toBe(400);
    expect(updateCalls).toBe(0);
  });
});
