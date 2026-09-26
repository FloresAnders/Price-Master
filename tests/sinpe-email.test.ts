import { describe, expect, it } from "vitest";
import {
  BCR_SINPE_SUBJECT,
  isBcrSinpeMessage,
  parseSinpeEmail,
} from "@/services/sinpe-email.server";

const buildMessage = (body: string, contentType = "text/plain; charset=utf-8") =>
  [
    "From: Banco de Costa Rica <mensajero@bancobcr.com>",
    `Subject: ${BCR_SINPE_SUBJECT}`,
    "Date: Sat, 26 Sep 2026 16:43:00 +0000",
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
  ].join("\r\n");

describe("isBcrSinpeMessage", () => {
  it("acepta únicamente la dirección BCR esperada y el asunto exacto", () => {
    expect(
      isBcrSinpeMessage(
        "Banco de Costa Rica <mensajero@bancobcr.com>",
        BCR_SINPE_SUBJECT,
      ),
    ).toBe(true);
    expect(
      isBcrSinpeMessage(
        '"mensajero@bancobcr.com" <atacante@example.com>',
        BCR_SINPE_SUBJECT,
      ),
    ).toBe(false);
    expect(
      isBcrSinpeMessage(
        "Banco de Costa Rica <mensajero@bancobcr.com>",
        "Otra notificación",
      ),
    ).toBe(false);
  });
});

describe("parseSinpeEmail", () => {
  it("extrae los campos requeridos desde el HTML de la notificación", async () => {
    const raw = buildMessage(
      [
        "<table>",
        "<tr><td>Monto:</td><td>₡35.000,50</td></tr>",
        "<tr><td>Referencia:</td><td>458921037</td></tr>",
        "<tr><td>Nombre del cliente:</td><td>Juan Pérez Rodríguez</td></tr>",
        "<tr><td>Número de teléfono:</td><td>8888-8888</td></tr>",
        "<tr><td>Entidad de origen:</td><td>Banco Nacional</td></tr>",
        "<tr><td>Motivo:</td><td>Factura 184</td></tr>",
        "<tr><td>Fecha:</td><td>26/09/2026</td></tr>",
        "<tr><td>Hora:</td><td>10:43 p. m.</td></tr>",
        "</table>",
      ].join(""),
      "text/html; charset=utf-8",
    );

    const parsed = await parseSinpeEmail({
      raw,
      rawMessageId: "gmail-message-1",
    });

    expect(parsed).toMatchObject({
      reference: "458921037",
      amount: 35_000.5,
      customerName: "Juan Pérez Rodríguez",
      phone: "8888-8888",
      bank: "Banco Nacional",
      reason: "Factura 184",
      date: "26/09/2026",
      time: "10:43 p. m.",
      rawMessageId: "gmail-message-1",
    });
  });

  it("normaliza un monto CRC decimal y usa la fecha recibida como respaldo", async () => {
    const receivedAt = new Date("2026-09-27T05:15:00.000Z");
    const parsed = await parseSinpeEmail({
      raw: buildMessage("Monto: CRC 35000.50\nReferencia: 123456").replace(
        "Date: Sat, 26 Sep 2026 16:43:00 +0000\r\n",
        "",
      ),
      rawMessageId: "gmail-message-2",
      fallbackDate: receivedAt,
    });

    expect(parsed?.amount).toBe(35_000.5);
    expect(parsed?.reference).toBe("123456");
    expect(parsed?.date).toBe("2026-09-26");
    expect(parsed?.time).toBe("23:15");
  });

  it("rechaza mensajes que no contienen un monto SINPE válido", async () => {
    const parsed = await parseSinpeEmail({
      raw: buildMessage("Referencia: 123456\nMonto: 0"),
      rawMessageId: "gmail-message-3",
    });

    expect(parsed).toBeNull();
  });
});
