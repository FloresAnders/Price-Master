import { createCipheriv } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdminDb: vi.fn(),
  getGmailMessageMetadata: vi.fn(),
  getGmailRawMessage: vi.fn(),
  listGmailHistory: vi.fn(),
  parseSinpeEmail: vi.fn(),
}));

vi.mock("@/lib/firebase-admin", () => ({
  getAdminDb: mocks.getAdminDb,
}));

vi.mock("@/services/gmail-api.server", () => ({
  createGmailWatch: vi.fn(),
  getGmailHeader: (
    metadata: { payload?: { headers?: Array<{ name?: string; value?: string }> } },
    name: string,
  ) =>
    metadata.payload?.headers?.find(
      (header) => header.name?.toLowerCase() === name.toLowerCase(),
    )?.value || "",
  getGmailMessageMetadata: mocks.getGmailMessageMetadata,
  getGmailRawMessage: mocks.getGmailRawMessage,
  GmailApiError: class GmailApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  listGmailHistory: mocks.listGmailHistory,
  listRecentGmailMessageIds: vi.fn(),
}));

vi.mock("@/services/sinpe-email.server", () => ({
  BCR_SINPE_FROM: "mensajero@bancobcr.com",
  BCR_SINPE_SUBJECT: "SINPEMOVIL - Notificacion de transaccion realizada",
  isBcrSinpeMessage: vi.fn(() => true),
  parseSinpeEmail: mocks.parseSinpeEmail,
}));

import { processGmailNotification } from "@/services/sinpe-gmail.server";

const TEST_EMAIL = "palmares@example.com";
const TEST_KEY = Buffer.alloc(32, 7);

function encryptedRefreshToken(value: string): string {
  const iv = Buffer.alloc(12, 3);
  const cipher = createCipheriv("aes-256-gcm", TEST_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    "v1",
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

function createFirestoreDouble() {
  const created: Array<{ path: string; data: Record<string, unknown> }> = [];
  const sets: Array<{ path: string; data: Record<string, unknown> }> = [];

  const snapshots = new Map<string, { exists: boolean; id: string; data: () => unknown }>([
    [
      "gmailAccountMappings/mapping",
      {
        exists: true,
        id: "mapping",
        data: () => ({ empresaId: "DELIKOR PALMARES" }),
      },
    ],
    [
      "gmailIntegrations/DELIKOR PALMARES",
      {
        exists: true,
        id: "DELIKOR PALMARES",
        data: () => ({
          empresaId: "DELIKOR PALMARES",
          email: TEST_EMAIL,
          normalizedEmail: TEST_EMAIL,
          refreshTokenCipher: encryptedRefreshToken("refresh-token"),
          enabled: true,
        }),
      },
    ],
    [
      "gmailWatches/DELIKOR PALMARES",
      {
        exists: true,
        id: "DELIKOR PALMARES",
        data: () => ({
          empresaId: "DELIKOR PALMARES",
          email: TEST_EMAIL,
          historyId: "100",
          expiration: Date.now() + 86_400_000,
        }),
      },
    ],
    [
      "empresas/DELIKOR PALMARES",
      {
        exists: true,
        id: "DELIKOR PALMARES",
        data: () => ({ name: "DELIKOR PALMARES", isActive: true }),
      },
    ],
  ]);

  const documentRef = (path: string) => ({
    path,
    collection: (name: string) => collectionRef(`${path}/${name}`),
    get: async () =>
      snapshots.get(path) || { exists: false, id: path.split("/").at(-1) || "", data: () => undefined },
  });
  const collectionRef = (path: string) => ({
    doc: (id: string) =>
      documentRef(path === "gmailAccountMappings" ? `${path}/mapping` : `${path}/${id}`),
  });
  const db = {
    collection: (name: string) => collectionRef(name),
    runTransaction: async (
      operation: (transaction: {
        get: (ref: ReturnType<typeof documentRef>) => Promise<unknown>;
        create: (ref: ReturnType<typeof documentRef>, data: Record<string, unknown>) => void;
        set: (ref: ReturnType<typeof documentRef>, data: Record<string, unknown>) => void;
      }) => Promise<unknown>,
    ) =>
      operation({
        get: (ref) => ref.get(),
        create: (ref, data) => created.push({ path: ref.path, data }),
        set: (ref, data) => sets.push({ path: ref.path, data }),
      }),
  };

  return { db, created, sets };
}

describe("processGmailNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.GMAIL_TOKEN_ENCRYPTION_KEY = TEST_KEY.toString("hex");
  });

  it("continua con mensajes validos y avanza el checkpoint despues de uno no parseable", async () => {
    const firestore = createFirestoreDouble();
    mocks.getAdminDb.mockReturnValue(firestore.db);
    mocks.listGmailHistory.mockResolvedValue({
      messageIds: ["invalid-message", "valid-message"],
      historyId: "200",
    });
    mocks.getGmailMessageMetadata.mockImplementation(async (_token, messageId) => ({
      id: messageId,
      internalDate: "1792336800000",
      payload: {
        headers: [
          { name: "From", value: "mensajero@bancobcr.com" },
          {
            name: "Subject",
            value: "SINPEMOVIL - Notificacion de transaccion realizada",
          },
        ],
      },
    }));
    mocks.getGmailRawMessage.mockImplementation(async (_token, messageId) =>
      Buffer.from(messageId),
    );
    mocks.parseSinpeEmail
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        reference: "123456789",
        amount: 1,
        customerName: "Cliente de prueba",
        phone: "",
        bank: "",
        reason: "",
        date: "2026-10-18",
        time: "10:20",
        receivedAt: new Date("2026-10-18T16:20:00.000Z"),
        from: "mensajero@bancobcr.com",
        subject: "SINPEMOVIL - Notificacion de transaccion realizada",
        rawMessageId: "valid-message",
      });

    const result = await processGmailNotification({
      emailAddress: TEST_EMAIL,
      historyId: "200",
    });

    expect(result).toEqual({ status: "processed", created: 1 });
    expect(firestore.created).toHaveLength(1);
    expect(firestore.created[0]?.data.gmailMessageId).toBe("valid-message");
    expect(firestore.sets).toContainEqual(
      expect.objectContaining({
        path: "gmailWatches/DELIKOR PALMARES",
        data: expect.objectContaining({ historyId: "200" }),
      }),
    );
  });
});
