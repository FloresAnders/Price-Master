import { describe, expect, it } from "vitest";
import { canQueueEmail } from "@/lib/email/authorization";

describe("autorizacion de cola de correo", () => {
  it("permite roles administrativos y permisos operativos que generan avisos", () => {
    expect(canQueueEmail({ role: "admin" })).toBe(true);
    expect(canQueueEmail({ role: "superadmin" })).toBe(true);
    expect(canQueueEmail({ role: "user", permissions: { mantenimiento: true } })).toBe(true);
    expect(canQueueEmail({ role: "user", permissions: { fondogeneral: true } })).toBe(true);
  });

  it("rechaza usuario autenticado sin permiso de correo", () => {
    expect(canQueueEmail({ role: "user", permissions: {} })).toBe(false);
    expect(canQueueEmail({})).toBe(false);
  });
});
