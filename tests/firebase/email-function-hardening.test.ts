import { describe, expect, it } from "vitest";
import { normalizeEmailJob } from "../../functions/modules/email.js";

describe("normalizacion de trabajos de correo", () => {
  it("acepta un trabajo acotado y conserva solo campos permitidos", () => {
    const normalized = normalizeEmailJob({
      to: " usuario@example.com ",
      subject: " Aviso ",
      text: "Contenido",
      html: "<p>Contenido</p>",
      status: "pending",
      createdAt: { seconds: 1 },
    });

    expect(normalized).toEqual({
      to: "usuario@example.com",
      subject: "Aviso",
      text: "Contenido",
      html: "<p>Contenido</p>",
    });
  });

  it("rechaza adjuntos y destinatarios inyectados", () => {
    expect(() =>
      normalizeEmailJob({
        to: "victim@example.com",
        subject: "Aviso",
        text: "Contenido",
        attachments: [{ path: "file:///etc/passwd" }],
      }),
    ).toThrow(/attachments/i);

    expect(() =>
      normalizeEmailJob({
        to: "victim@example.com, attacker@example.com",
        subject: "Aviso",
        text: "Contenido",
      }),
    ).toThrow(/recipient/i);
  });

  it("rechaza asunto o cuerpos que exceden limites", () => {
    expect(() =>
      normalizeEmailJob({
        to: "victim@example.com",
        subject: "x".repeat(201),
        text: "Contenido",
      }),
    ).toThrow(/subject/i);

    expect(() =>
      normalizeEmailJob({
        to: "victim@example.com",
        subject: "Aviso",
        text: "x".repeat(20_001),
      }),
    ).toThrow(/body/i);
  });
});
