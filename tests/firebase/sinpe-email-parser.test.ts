import { describe, expect, it } from "vitest";

import { parseSinpeEmail } from "@/services/sinpe-email.server";

describe("parseSinpeEmail", () => {
  it("interpreta un monto decimal sin cero inicial", async () => {
    const raw = [
      "From: mensajero@bancobcr.com",
      "Subject: SINPEMOVIL - Notificacion de transaccion realizada",
      "Date: Sun, 18 Oct 2026 10:18:54 -0600",
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "",
      "Monto: .29",
      "Referencia: 123456789",
      "Nombre del cliente: Cliente de prueba",
    ].join("\r\n");

    const parsed = await parseSinpeEmail({
      raw,
      rawMessageId: "decimal-without-leading-zero",
    });

    expect(parsed?.amount).toBe(0.29);
  });
});
