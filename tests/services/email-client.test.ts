import { afterEach, describe, expect, it, vi } from "vitest";
import { queueEmailFromClient } from "@/services/email-client";

describe("queueEmailFromClient", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("envia por el API autenticado y no escribe Firestore desde cliente", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await queueEmailFromClient({
      to: "owner@example.com",
      subject: "Aviso",
      text: "Contenido",
      html: "<p>Contenido</p>",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/send-email",
      expect.objectContaining({
        method: "POST",
        credentials: "same-origin",
        body: JSON.stringify({
          to: "owner@example.com",
          subject: "Aviso",
          text: "Contenido",
          html: "<p>Contenido</p>",
        }),
      }),
    );
  });

  it("propaga rechazo del servidor", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "No autorizado." }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(
      queueEmailFromClient({
        to: "owner@example.com",
        subject: "Aviso",
        text: "Contenido",
      }),
    ).rejects.toThrow("No autorizado.");
  });
});
