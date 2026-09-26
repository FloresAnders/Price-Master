import { beforeEach, describe, expect, it } from "vitest";
import {
  requestSinpeNotificationPermission,
  showSinpeSystemNotification,
  type SinpeSystemNotificationApi,
  type SinpeSystemNotificationInstance,
} from "@/components/sinpe/sinpeBrowserNotifications";

class FakeNotification implements SinpeSystemNotificationInstance {
  static permission: NotificationPermission = "default";
  static requestedPermission: NotificationPermission = "granted";
  static instances: FakeNotification[] = [];

  onclick: (() => void) | null = null;
  closed = false;

  constructor(
    readonly title: string,
    readonly options?: NotificationOptions,
  ) {
    FakeNotification.instances.push(this);
  }

  static async requestPermission(): Promise<NotificationPermission> {
    FakeNotification.permission = FakeNotification.requestedPermission;
    return FakeNotification.requestedPermission;
  }

  close() {
    this.closed = true;
  }
}

const notificationApi = FakeNotification as unknown as SinpeSystemNotificationApi;

const event = {
  id: "event-123",
  empresaId: "DELIKOR PALMARES",
  empresaName: "DELIKOR PALMARES",
  reference: "2026092615284002232023603",
  amount: 35_000.5,
  customerName: "Cliente SINPE",
};

describe("showSinpeSystemNotification", () => {
  beforeEach(() => {
    FakeNotification.permission = "default";
    FakeNotification.requestedPermission = "granted";
    FakeNotification.instances = [];
  });

  it("muestra el SINPE como aviso del sistema cuando TimeMaster está oculto", () => {
    FakeNotification.permission = "granted";

    const shown = showSinpeSystemNotification({
      event,
      isDocumentHidden: true,
      notificationApi,
      focusWindow: () => undefined,
    });

    expect(shown).toBe(true);
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0]).toMatchObject({
      title: "Nuevo SINPE · DELIKOR PALMARES",
      options: {
        body: "₡35 000,50 · Cliente SINPE",
        icon: "/android-chrome-192x192.png",
        tag: "sinpe:DELIKOR PALMARES:event-123",
      },
    });
  });

  it("no muestra un aviso del sistema si TimeMaster está visible o el permiso falta", () => {
    FakeNotification.permission = "granted";
    expect(
      showSinpeSystemNotification({
        event,
        isDocumentHidden: false,
        notificationApi,
        focusWindow: () => undefined,
      }),
    ).toBe(false);

    FakeNotification.permission = "default";
    expect(
      showSinpeSystemNotification({
        event,
        isDocumentHidden: true,
        notificationApi,
        focusWindow: () => undefined,
      }),
    ).toBe(false);
    expect(FakeNotification.instances).toHaveLength(0);
  });

  it("mantiene operativo TimeMaster si el navegador rechaza crear el aviso", () => {
    class ThrowingNotification {
      static permission: NotificationPermission = "granted";
      static requestPermission = async () => "granted" as const;

      constructor() {
        throw new TypeError("Notifications require a service worker");
      }
    }

    expect(
      showSinpeSystemNotification({
        event,
        isDocumentHidden: true,
        notificationApi:
          ThrowingNotification as unknown as SinpeSystemNotificationApi,
        focusWindow: () => undefined,
      }),
    ).toBe(false);
  });

  it("enfoca TimeMaster y cierra el aviso cuando el usuario lo pulsa", () => {
    FakeNotification.permission = "granted";
    let focusCount = 0;

    showSinpeSystemNotification({
      event,
      isDocumentHidden: true,
      notificationApi,
      focusWindow: () => {
        focusCount += 1;
      },
    });
    FakeNotification.instances[0].onclick?.();

    expect(focusCount).toBe(1);
    expect(FakeNotification.instances[0].closed).toBe(true);
  });
});

describe("requestSinpeNotificationPermission", () => {
  it("solicita el permiso del navegador desde la acción del usuario", async () => {
    await expect(
      requestSinpeNotificationPermission(notificationApi),
    ).resolves.toBe("granted");
    expect(FakeNotification.permission).toBe("granted");
  });

  it("informa que la función no está disponible en navegadores incompatibles", async () => {
    await expect(requestSinpeNotificationPermission(null)).resolves.toBe(
      "unsupported",
    );
  });
});
