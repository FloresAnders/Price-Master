import { describe, expect, it } from "vitest";
import {
  canConfigureSinpeNotifications,
  canReceiveSinpeNotifications,
} from "@/components/sinpe/sinpeNotificationPreference";

describe("canConfigureSinpeNotifications", () => {
  it.each(["admin", "superadmin"] as const)(
    "habilita la configuracion para %s",
    (role) => {
      expect(canConfigureSinpeNotifications(role)).toBe(true);
    },
  );

  it("mantiene el listener apagado mientras carga la preferencia del admin", () => {
    expect(
      canReceiveSinpeNotifications({
        role: "admin",
        hasSinpePermission: true,
        preference: undefined,
        preferenceLoaded: false,
      }),
    ).toBe(false);
  });

  it("oculta la configuracion a usuarios regulares", () => {
    expect(canConfigureSinpeNotifications("user")).toBe(false);
  });
});

describe("canReceiveSinpeNotifications", () => {
  it.each(["admin", "superadmin"] as const)(
    "mantiene activadas por defecto las notificaciones para %s existentes",
    (role) => {
      expect(
        canReceiveSinpeNotifications({
          role,
          hasSinpePermission: true,
          preference: undefined,
        }),
      ).toBe(true);
    },
  );

  it.each(["admin", "superadmin"] as const)(
    "respeta la desactivacion del usuario %s",
    (role) => {
      expect(
        canReceiveSinpeNotifications({
          role,
          hasSinpePermission: true,
          preference: false,
        }),
      ).toBe(false);
    },
  );

  it("no permite recibir SINPE sin el permiso reportessinpe", () => {
    expect(
      canReceiveSinpeNotifications({
        role: "admin",
        hasSinpePermission: false,
        preference: true,
      }),
    ).toBe(false);
  });

  it("conserva el comportamiento previo para usuarios regulares", () => {
    expect(
      canReceiveSinpeNotifications({
        role: "user",
        hasSinpePermission: true,
        preference: false,
      }),
    ).toBe(true);
  });
});
