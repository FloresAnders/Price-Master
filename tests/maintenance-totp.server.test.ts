import { describe, expect, it, vi } from "vitest";
import { generate } from "otplib";
import {
  decryptMaintenanceSecret,
  encryptMaintenanceSecret,
} from "@/lib/maintenance-totp/crypto.server";
import {
  createMaintenanceBypassToken,
  verifyMaintenanceBypassToken,
} from "@/lib/maintenance-totp/token.server";
import {
  createMaintenanceTotpSecret,
  createMaintenanceTotpUri,
  verifyMaintenanceTotpCode,
} from "@/lib/maintenance-totp/totp.server";
import {
  createMaintenanceTotpService,
  type MaintenanceAccessEvent,
  type MaintenanceTotpRecord,
  type MaintenanceTotpRepository,
  type RateLimitInput,
} from "@/lib/maintenance-totp/service.server";
import { buildFirebaseCustomTokenClaims } from "@/lib/firebase/custom-token-claims.server";
import { createMaintenanceEnrollmentHandlers } from "@/lib/maintenance-totp/handlers.server";
import { createMaintenanceBypassHandlers } from "@/lib/maintenance-totp/bypass-handlers.server";

const encryptionKey = Buffer.alloc(32, 7).toString("base64");
const jwtSecret = "j".repeat(48);

describe("maintenance TOTP crypto", () => {
  it("round-trips a secret without storing plaintext", () => {
    const encrypted = encryptMaintenanceSecret("JBSWY3DPEHPK3PXP", encryptionKey);

    expect(encrypted).not.toContain("JBSWY3DPEHPK3PXP");
    expect(decryptMaintenanceSecret(encrypted, encryptionKey)).toBe(
      "JBSWY3DPEHPK3PXP",
    );
  });

  it("rejects a tampered ciphertext", () => {
    const encrypted = encryptMaintenanceSecret("JBSWY3DPEHPK3PXP", encryptionKey);
    const parts = encrypted.split(".");
    const ciphertext = Buffer.from(parts[3], "base64url");
    ciphertext[0] ^= 1;
    parts[3] = ciphertext.toString("base64url");
    const tampered = parts.join(".");

    expect(() => decryptMaintenanceSecret(tampered, encryptionKey)).toThrow();
  });
});

describe("maintenance bypass JWT", () => {
  it("accepts a signed pass before expiry and exposes the superadmin identity", () => {
    const now = Date.UTC(2026, 9, 11, 18, 0, 0);
    const token = createMaintenanceBypassToken({
      superadminId: "anders-id",
      secret: jwtSecret,
      durationMinutes: 30,
      now,
    });

    expect(verifyMaintenanceBypassToken(token, jwtSecret, now + 29 * 60_000)).toEqual({
      active: true,
      superadminId: "anders-id",
      expiresAt: now + 30 * 60_000,
    });
  });

  it("rejects an expired pass and a token signed with another key", () => {
    const now = Date.UTC(2026, 9, 11, 18, 0, 0);
    const token = createMaintenanceBypassToken({
      superadminId: "alvaro-id",
      secret: jwtSecret,
      durationMinutes: 30,
      now,
    });

    expect(
      verifyMaintenanceBypassToken(token, jwtSecret, now + 30 * 60_000),
    ).toEqual({ active: false });
    expect(verifyMaintenanceBypassToken(token, "x".repeat(48), now)).toEqual({
      active: false,
    });
  });
});

describe("maintenance TOTP", () => {
  it("creates an authenticator URI for the individual superadmin", () => {
    const secret = createMaintenanceTotpSecret();
    const uri = createMaintenanceTotpUri("anders", secret);

    expect(secret.length).toBeGreaterThanOrEqual(20);
    expect(uri).toContain("otpauth://totp/");
    expect(decodeURIComponent(uri)).toContain("Time-Master · Mantenimiento:anders");
  });

  it("accepts only six digits and returns the matched step for anti-replay", async () => {
    const secret = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";
    const now = Date.UTC(2026, 9, 11, 18, 0, 15);
    const epoch = Math.floor(now / 1000);
    const code = await generate({ secret, epoch, period: 30 });

    await expect(verifyMaintenanceTotpCode(code, secret, now)).resolves.toEqual({
      valid: true,
      step: Math.floor(epoch / 30),
    });
    await expect(
      verifyMaintenanceTotpCode("12345", secret, now),
    ).resolves.toEqual({ valid: false });
  });
});

class MemoryMaintenanceRepository implements MaintenanceTotpRepository {
  records = new Map<string, MaintenanceTotpRecord>();
  events: MaintenanceAccessEvent[] = [];
  limits = new Map<string, number>();

  async getByUserId(userId: string) {
    return this.records.get(userId) ?? null;
  }

  async savePending(record: MaintenanceTotpRecord) {
    this.records.set(record.userId, { ...record });
  }

  async listConfirmed() {
    return [...this.records.values()].filter(
      (record) => record.confirmedAt !== null,
    );
  }

  async confirm(userId: string, secretEncrypted: string, step: number, now: number) {
    const record = this.records.get(userId);
    if (!record || record.secretEncrypted !== secretEncrypted || record.confirmedAt) {
      return false;
    }
    this.records.set(userId, {
      ...record,
      confirmedAt: now,
      lastUsedStep: step,
      updatedAt: now,
    });
    return true;
  }

  async consumeStep(userId: string, step: number, now: number) {
    const record = this.records.get(userId);
    if (!record || !record.confirmedAt || step <= record.lastUsedStep) return false;
    this.records.set(userId, { ...record, lastUsedStep: step, updatedAt: now });
    return true;
  }

  async deleteByUserId(userId: string) {
    return this.records.delete(userId);
  }

  async consumeRateLimit(input: RateLimitInput) {
    const globalKey = `${input.scope}:global:${input.windowStart}`;
    const subjectKey = `${input.scope}:${input.subjectHash}:${input.windowStart}`;
    const globalCount = this.limits.get(globalKey) ?? 0;
    const subjectCount = this.limits.get(subjectKey) ?? 0;
    if (globalCount >= input.globalLimit || subjectCount >= input.subjectLimit) {
      return false;
    }
    this.limits.set(globalKey, globalCount + 1);
    this.limits.set(subjectKey, subjectCount + 1);
    return true;
  }

  async log(event: MaintenanceAccessEvent) {
    this.events.push(event);
  }
}

describe("maintenance TOTP service", () => {
  it("enrolls each superadmin separately and rejects reuse of one time step", async () => {
    const repository = new MemoryMaintenanceRepository();
    const now = Date.UTC(2026, 9, 11, 18, 0, 15);
    const service = createMaintenanceTotpService({
      repository,
      encryptionKey,
      now: () => now,
    });
    const enrollment = await service.start({
      userId: "anders-id",
      label: "anders",
      ip: "203.0.113.4",
      userAgent: "vitest",
    });
    const secret = new URL(enrollment.otpauthUri).searchParams.get("secret");
    expect(secret).toBeTruthy();
    expect(repository.records.get("anders-id")?.secretEncrypted).not.toContain(
      secret!,
    );
    const code = await generate({
      secret: secret!,
      epoch: Math.floor(now / 1000),
      period: 30,
    });

    await expect(
      service.confirm({
        userId: "anders-id",
        code,
        ip: "203.0.113.4",
        userAgent: "vitest",
      }),
    ).resolves.toEqual({ ok: true });
    await expect(service.status("anders-id")).resolves.toMatchObject({
      active: true,
    });

    // Confirmation consumes this step, so the same code cannot create a pass.
    await expect(
      service.bypass({ code, ip: "203.0.113.4", userAgent: "vitest" }),
    ).resolves.toEqual({ ok: false, reason: "invalid" });

    const nextNow = now + 30_000;
    const nextCode = await generate({
      secret: secret!,
      epoch: Math.floor(nextNow / 1000),
      period: 30,
    });
    const nextService = createMaintenanceTotpService({
      repository,
      encryptionKey,
      now: () => nextNow,
    });
    await expect(
      nextService.bypass({
        code: nextCode,
        ip: "203.0.113.4",
        userAgent: "vitest",
      }),
    ).resolves.toEqual({ ok: true, superadminId: "anders-id" });
    await expect(
      nextService.bypass({
        code: nextCode,
        ip: "203.0.113.4",
        userAgent: "vitest",
      }),
    ).resolves.toEqual({ ok: false, reason: "invalid" });
    expect(repository.events).toContainEqual(
      expect.objectContaining({
        event: "bypass_ok",
        superadminUserId: "anders-id",
      }),
    );
  });

  it("rate-limits the sixth bypass attempt in one minute", async () => {
    const repository = new MemoryMaintenanceRepository();
    const now = Date.UTC(2026, 9, 11, 18, 0, 15);
    const service = createMaintenanceTotpService({
      repository,
      encryptionKey,
      now: () => now,
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        service.bypass({
          code: "000000",
          ip: "198.51.100.8",
          userAgent: "vitest",
        }),
      ).resolves.toEqual({ ok: false, reason: "invalid" });
    }
    await expect(
      service.bypass({
        code: "000000",
        ip: "198.51.100.8",
        userAgent: "vitest",
      }),
    ).resolves.toEqual({ ok: false, reason: "rate_limited" });
  });

  it("disabling a secret prevents future codes from creating passes", async () => {
    const repository = new MemoryMaintenanceRepository();
    const now = Date.UTC(2026, 9, 11, 18, 0, 15);
    const service = createMaintenanceTotpService({
      repository,
      encryptionKey,
      now: () => now,
    });
    const enrollment = await service.start({
      userId: "alvaro-id",
      label: "alvaro",
      ip: "203.0.113.9",
      userAgent: "vitest",
    });
    const secret = new URL(enrollment.otpauthUri).searchParams.get("secret")!;
    const code = await generate({
      secret,
      epoch: Math.floor(now / 1000),
      period: 30,
    });
    expect(
      await service.confirm({
        userId: "alvaro-id",
        code,
        ip: "203.0.113.9",
        userAgent: "vitest",
      }),
    ).toEqual({ ok: true });

    await service.disable({
      userId: "alvaro-id",
      ip: "203.0.113.9",
      userAgent: "vitest",
    });
    await expect(service.status("alvaro-id")).resolves.toEqual({ active: false });
    await expect(
      service.bypass({ code, ip: "203.0.113.9", userAgent: "vitest" }),
    ).resolves.toEqual({ ok: false, reason: "invalid" });
  });
});

describe("maintenance enrollment HTTP authorization", () => {
  it("returns 403 for user/admin and never starts enrollment", async () => {
    const start = vi.fn();
    const handlers = createMaintenanceEnrollmentHandlers({
      readSession: async () => ({
        user: { id: "admin-id", name: "admin", role: "admin" },
      }),
      service: { start } as never,
      qrToDataUrl: vi.fn(),
    });
    const response = await handlers.start(
      new Request("https://timemaster.app/api/me/maintenance-totp/start", {
        method: "POST",
        headers: { origin: "https://timemaster.app" },
      }),
    );

    expect(response.status).toBe(403);
    expect(start).not.toHaveBeenCalled();
  });

  it("lets a superadmin receive the one-time QR payload", async () => {
    const start = vi.fn().mockResolvedValue({
      otpauthUri: "otpauth://totp/example?secret=SECRET",
    });
    const handlers = createMaintenanceEnrollmentHandlers({
      readSession: async () => ({
        user: {
          id: "super-id",
          name: "anders",
          email: "anders@example.com",
          role: "superadmin",
        },
      }),
      service: { start } as never,
      qrToDataUrl: async () => "data:image/png;base64,qr",
    });
    const response = await handlers.start(
      new Request("https://timemaster.app/api/me/maintenance-totp/start", {
        method: "POST",
        headers: {
          origin: "https://timemaster.app",
          "x-forwarded-for": "203.0.113.11",
          "user-agent": "vitest",
        },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      qrDataUrl: "data:image/png;base64,qr",
    });
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "super-id", label: "anders@example.com" }),
    );
  });
});

describe("Firebase maintenance claims", () => {
  it("normalizes the company and includes only a finite temporary bypass", () => {
    const claims = buildFirebaseCustomTokenClaims(
      {
        id: "user-id",
        name: "caja",
        role: "user",
        ownercompanie: "DELIKOR SINÁI",
      },
      { maintenanceBypassExpiresAt: 1_791_742_400_000 },
    );

    expect(claims).toMatchObject({
      role: "user",
      ownercompanie: "DELIKOR SINÁI",
      ownercompanieNormalized: "delikor sinai",
      maintenanceBypassExpiresAt: 1_791_742_400_000,
    });
  });
});

describe("maintenance bypass HTTP", () => {
  it("sets a strict httpOnly pass and returns a Firebase token for the session user", async () => {
    const now = Date.UTC(2026, 9, 11, 18, 0, 0);
    const createFirebaseToken = vi.fn().mockResolvedValue("firebase-custom-token");
    const handlers = createMaintenanceBypassHandlers({
      service: {
        bypass: vi.fn().mockResolvedValue({
          ok: true,
          superadminId: "anders-id",
        }),
      } as never,
      readSession: async () => ({
        user: {
          id: "user-id",
          name: "caja",
          role: "user",
          ownercompanie: "DELIKOR SINAI",
        },
      }),
      createFirebaseToken,
      jwtSecret,
      durationMinutes: 30,
      now: () => now,
    });
    const response = await handlers.bypass(
      new Request("https://timemaster.app/api/maintenance/bypass", {
        method: "POST",
        headers: {
          origin: "https://timemaster.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "123456" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      expiresAt: now + 30 * 60_000,
      firebaseToken: "firebase-custom-token",
    });
    expect(response.headers.get("set-cookie")).toMatch(
      /maint_bypass=.*HttpOnly.*SameSite=strict/i,
    );
    expect(createFirebaseToken).toHaveBeenCalledWith(
      expect.objectContaining({ id: "user-id" }),
      now + 30 * 60_000,
    );
  });

  it("returns one generic error for an invalid code and 429 after rate limit", async () => {
    const invalidHandlers = createMaintenanceBypassHandlers({
      service: {
        bypass: vi.fn().mockResolvedValue({ ok: false, reason: "invalid" }),
      } as never,
      readSession: async () => null,
      createFirebaseToken: vi.fn(),
      jwtSecret,
      durationMinutes: 30,
    });
    const makeRequest = () =>
      new Request("https://timemaster.app/api/maintenance/bypass", {
        method: "POST",
        headers: {
          origin: "https://timemaster.app",
          "content-type": "application/json",
        },
        body: JSON.stringify({ code: "000000" }),
      });
    const invalid = await invalidHandlers.bypass(makeRequest());
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      ok: false,
      error: "Código inválido",
    });

    const limitedHandlers = createMaintenanceBypassHandlers({
      service: {
        bypass: vi
          .fn()
          .mockResolvedValue({ ok: false, reason: "rate_limited" }),
      } as never,
      readSession: async () => null,
      createFirebaseToken: vi.fn(),
      jwtSecret,
      durationMinutes: 30,
    });
    expect((await limitedHandlers.bypass(makeRequest())).status).toBe(429);
  });
});
