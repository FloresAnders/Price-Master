import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constructorOptions: [] as Array<Record<string, unknown>>,
  search: vi.fn(),
  fetch: vi.fn(),
  simpleParser: vi.fn(),
}));

vi.mock("mailparser", () => ({
  simpleParser: mocks.simpleParser,
}));

vi.mock("imapflow", () => ({
  ImapFlow: class {
    constructor(options: Record<string, unknown>) {
      mocks.constructorOptions.push(options);
    }

    async connect() {}

    async getMailboxLock() {
      return { release: vi.fn() };
    }

    async search(query: unknown) {
      return mocks.search(query);
    }

    fetch(range: unknown, query: unknown) {
      return mocks.fetch(range, query);
    }

    async logout() {}
  },
}));

async function* messages(items: unknown[]) {
  for (const item of items) yield item;
}

describe("readBcrSinpeReport", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.constructorOptions.length = 0;
    mocks.search.mockResolvedValue([1, 2]);
    mocks.fetch
      .mockReturnValueOnce(
        messages([
          {
            uid: 1,
            envelope: {
              date: new Date("2026-08-21T13:00:00.000Z"),
              subject: "SINPEMOVIL - Notificacion de transaccion realizada",
            },
          },
          {
            uid: 2,
            envelope: {
              date: new Date("2026-08-21T13:05:00.000Z"),
              subject: "Otro correo BCR",
            },
          },
        ]),
      )
      .mockReturnValueOnce(
        messages([
          {
            uid: 1,
            envelope: {
              date: new Date("2026-08-21T13:00:00.000Z"),
              subject: "SINPEMOVIL - Notificacion de transaccion realizada",
            },
            source: Buffer.from("Monto: 1,250.00 Referencia: 12345"),
          },
        ]),
      );
    mocks.simpleParser.mockResolvedValue({
      text: "Monto: 1,250.00 Referencia: 12345",
      html: "",
      from: { text: "mensajero@bancobcr.com" },
    });
  });

  it("filtra encabezados antes de descargar cuerpos completos", async () => {
    const { readBcrSinpeReport } = await import("@/services/sinpe-imap.server");

    const result = await readBcrSinpeReport({
      email: "cuenta@gmail.com",
      password: "secret",
      start: new Date("2026-08-21T12:00:00.000Z"),
      end: new Date("2026-08-21T14:00:00.000Z"),
    });

    expect(mocks.constructorOptions[0]).toMatchObject({
      connectionTimeout: expect.any(Number),
      greetingTimeout: expect.any(Number),
      socketTimeout: expect.any(Number),
    });
    expect(mocks.fetch).toHaveBeenNthCalledWith(1, [1, 2], {
      uid: true,
      envelope: true,
    });
    expect(mocks.fetch).toHaveBeenNthCalledWith(2, [1], {
      uid: true,
      envelope: true,
      source: { maxLength: expect.any(Number) },
    });
    expect(mocks.simpleParser).toHaveBeenCalledTimes(1);
    expect(result.validTransactions).toBe(1);
    expect(result.total).toBe(1250);
  });

  it("no descarga cuerpos cuando ningun encabezado coincide", async () => {
    mocks.fetch.mockReset();
    mocks.fetch.mockReturnValueOnce(
      messages([
        {
          uid: 2,
          envelope: {
            date: new Date("2026-08-21T13:05:00.000Z"),
            subject: "Otro correo BCR",
          },
        },
      ]),
    );
    const { readBcrSinpeReport } = await import("@/services/sinpe-imap.server");

    const result = await readBcrSinpeReport({
      email: "cuenta@gmail.com",
      password: "secret",
      start: new Date("2026-08-21T12:00:00.000Z"),
      end: new Date("2026-08-21T14:00:00.000Z"),
    });

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.simpleParser).not.toHaveBeenCalled();
    expect(result.validTransactions).toBe(0);
  });
});
