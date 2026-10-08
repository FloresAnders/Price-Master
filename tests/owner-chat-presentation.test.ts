import { describe, expect, it } from "vitest";
import type { OwnerChatMessage } from "@/services/owner-chat";
import {
  formatOwnerChatDateLabel,
  getOwnerChatDateKey,
  shouldShowOwnerChatDateDivider,
} from "@/components/chat/ownerChatPresentation";

function message(id: string, isoDate: string | null): OwnerChatMessage {
  const date = isoDate ? new Date(isoDate) : null;
  return {
    id,
    ownerId: "owner-1",
    senderId: "admin-1",
    senderName: "Admin",
    senderRole: "admin",
    text: id,
    createdAt: date
      ? ({
          toDate: () => date,
          toMillis: () => date.getTime(),
        } as OwnerChatMessage["createdAt"])
      : null,
  };
}

describe("presentación de fechas del chat", () => {
  it("agrupa por el día de Costa Rica aunque UTC ya esté en el día siguiente", () => {
    expect(getOwnerChatDateKey(new Date("2026-10-07T05:30:00.000Z"))).toBe(
      "2026-10-06",
    );
    expect(getOwnerChatDateKey(new Date("2026-10-07T06:30:00.000Z"))).toBe(
      "2026-10-07",
    );
  });

  it("muestra Hoy, Ayer y una fecha completa según el calendario local", () => {
    const now = new Date("2026-10-07T18:00:00.000Z");

    expect(
      formatOwnerChatDateLabel(new Date("2026-10-07T12:00:00.000Z"), now),
    ).toBe("Hoy");
    expect(
      formatOwnerChatDateLabel(new Date("2026-10-06T12:00:00.000Z"), now),
    ).toBe("Ayer");
    expect(
      formatOwnerChatDateLabel(new Date("2026-10-05T12:00:00.000Z"), now),
    ).toBe("lunes, 5 de octubre de 2026");
  });

  it("crea un solo divisor por día e ignora timestamps pendientes", () => {
    const messages = [
      message("primero", "2026-10-06T13:00:00.000Z"),
      message("segundo", "2026-10-06T14:00:00.000Z"),
      message("pendiente", null),
      message("tercero", "2026-10-07T13:00:00.000Z"),
    ];

    expect(
      messages.map((_, index) =>
        shouldShowOwnerChatDateDivider(messages, index),
      ),
    ).toEqual([true, false, false, true]);
  });
});
