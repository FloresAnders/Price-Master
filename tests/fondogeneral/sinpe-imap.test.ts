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

    async search(query: unknown, options?: unknown) {
      return mocks.search(query, options);
    }

    fetch(range: unknown, query: unknown, options?: unknown) {
      return mocks.fetch(range, query, options);
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
    expect(mocks.search).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "mensajero@bancobcr.com",
        subject: "SINPEMOVIL",
      }),
      { uid: true },
    );
    expect(mocks.fetch).toHaveBeenNthCalledWith(1, [1, 2], {
      uid: true,
      envelope: true,
      internalDate: true,
    }, { uid: true });
    expect(mocks.fetch).toHaveBeenNthCalledWith(2, [1], {
      uid: true,
      envelope: true,
      source: { maxLength: expect.any(Number) },
    }, { uid: true });
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

  it("lee correos BCR SINPE reales con asunto acentuado, monto y numero de referencia", async () => {
    mocks.fetch.mockReset();
    mocks.fetch
      .mockReturnValueOnce(
        messages([
          {
            uid: 22,
            envelope: {
              date: new Date("2026-08-22T17:31:00.000Z"),
              subject: "SINPEMOVIL - Notificación de transacción realizada",
            },
          },
        ]),
      )
      .mockReturnValueOnce(
        messages([
          {
            uid: 22,
            envelope: {
              date: new Date("2026-08-22T17:31:00.000Z"),
              subject: "SINPEMOVIL - Notificación de transacción realizada",
            },
            source: Buffer.from(
              [
                "Transacción SINPE MÓVIL",
                "Número de referencia: 2026082115183010997449092",
                "Monto: 850.00",
                "Esta transacción fue realizada el 22/08/2026 a las 11:31 AM",
              ].join("\n"),
            ),
          },
        ]),
      );
    mocks.simpleParser.mockResolvedValueOnce({
      text: [
        "Transacción SINPE MÓVIL",
        "Número de referencia: 2026082115183010997449092",
        "Monto: 850.00",
        "Esta transacción fue realizada el 22/08/2026 a las 11:31 AM",
      ].join("\n"),
      html: "",
      from: { text: "BCR Mensajero <mensajero@bancobcr.com>" },
    });
    const { readBcrSinpeReport } = await import("@/services/sinpe-imap.server");

    const result = await readBcrSinpeReport({
      email: "cuenta@gmail.com",
      password: "secret",
      start: new Date("2026-08-22T13:01:00.000Z"),
      end: new Date("2026-08-22T21:00:00.000Z"),
    });

    expect(result).toMatchObject({
      processedEmails: 1,
      validTransactions: 1,
      total: 850,
      transactions: [
        expect.objectContaining({
          uid: 22,
          reference: "2026082115183010997449092",
          amount: 850,
        }),
      ],
    });
  });

  it("filtra por fecha de recepcion de Gmail y no por el header Date del correo", async () => {
    mocks.fetch.mockReset();
    mocks.fetch
      .mockReturnValueOnce(
        messages([
          {
            uid: 23,
            internalDate: new Date("2026-08-22T15:08:00.000Z"),
            envelope: {
              date: new Date("2026-08-21T23:08:00.000Z"),
              subject: "SINPEMOVIL - Notificación de transacción realizada",
            },
          },
        ]),
      )
      .mockReturnValueOnce(
        messages([
          {
            uid: 23,
            envelope: {
              date: new Date("2026-08-21T23:08:00.000Z"),
              subject: "SINPEMOVIL - Notificación de transacción realizada",
            },
            source: Buffer.from(
              [
                "Transacción SINPE MÓVIL",
                "Número de referencia: 2026082280383010609995425",
                "Monto: 2,625.00",
                "Esta transacción fue realizada el 22/08/2026 a las 9:08 AM",
              ].join("\n"),
            ),
          },
        ]),
      );
    mocks.simpleParser.mockResolvedValueOnce({
      text: [
        "Transacción SINPE MÓVIL",
        "Número de referencia: 2026082280383010609995425",
        "Monto: 2,625.00",
        "Esta transacción fue realizada el 22/08/2026 a las 9:08 AM",
      ].join("\n"),
      html: "",
      from: { text: "BCR Mensajero <mensajero@bancobcr.com>" },
    });
    const { readBcrSinpeReport } = await import("@/services/sinpe-imap.server");

    const result = await readBcrSinpeReport({
      email: "cuenta@gmail.com",
      password: "secret",
      start: new Date("2026-08-22T13:01:00.000Z"),
      end: new Date("2026-08-22T21:00:00.000Z"),
    });

    expect(result.validTransactions).toBe(1);
    expect(result.transactions[0]).toMatchObject({
      uid: 23,
      date: "2026-08-22T15:08:00.000Z",
      reference: "2026082280383010609995425",
      amount: 2625,
    });
  });

  it("usa UID en la busqueda y en ambas lecturas IMAP", async () => {
    mocks.search.mockReset();
    mocks.fetch.mockReset();
    mocks.search.mockImplementation(
      (_query: unknown, options?: { uid?: boolean }) =>
        Promise.resolve(options?.uid ? [9484] : [7]),
    );
    mocks.fetch.mockImplementation(
      (_range: unknown, query: { source?: unknown }, options?: { uid?: boolean }) => {
        if (!options?.uid) return messages([]);
        if (query.source) {
          return messages([
            {
              uid: 9484,
              envelope: {
                subject: "SINPEMOVIL - Notificacion de transaccion realizada",
              },
              source: Buffer.from("Monto: 2,625.00 Referencia: 2026082280383010609995425"),
            },
          ]);
        }
        return messages([
          {
            uid: 9484,
            internalDate: new Date("2026-08-22T15:08:31.000Z"),
            envelope: {
              subject: "SINPEMOVIL - Notificacion de transaccion realizada",
            },
          },
        ]);
      },
    );
    mocks.simpleParser.mockResolvedValueOnce({
      text: "Monto: 2,625.00 Referencia: 2026082280383010609995425",
      html: "",
      from: { text: "BCR Mensajero <mensajero@bancobcr.com>" },
    });
    const { readBcrSinpeReport } = await import("@/services/sinpe-imap.server");

    const result = await readBcrSinpeReport({
      email: "cuenta@gmail.com",
      password: "secret",
      start: new Date("2026-08-22T13:01:00.000Z"),
      end: new Date("2026-08-22T21:00:00.000Z"),
    });

    expect(result).toMatchObject({
      processedEmails: 1,
      validTransactions: 1,
      total: 2625,
    });
  });
});
