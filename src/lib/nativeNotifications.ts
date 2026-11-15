import { Capacitor } from "@capacitor/core";
import {
  LocalNotifications,
  type PermissionStatus,
} from "@capacitor/local-notifications";

export const SINPE_NOTIFICATION_CHANNEL_ID = "sinpe-alerts";

export type NativeNotificationPermission =
  | PermissionStatus["display"]
  | "unsupported";

function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

export async function initializeNativeNotifications(): Promise<NativeNotificationPermission> {
  if (!isNativeAndroid()) return "unsupported";

  const current = await LocalNotifications.checkPermissions();
  const permission =
    current.display === "prompt"
      ? await LocalNotifications.requestPermissions()
      : current;

  if (permission.display === "granted") {
    await LocalNotifications.createChannel({
      id: SINPE_NOTIFICATION_CHANNEL_ID,
      name: "Alertas SINPE",
      description: "Notificaciones de pagos SINPE recibidos",
      importance: 5,
      visibility: 1,
      sound: "default",
      lights: true,
      lightColor: "#22d3ee",
      vibration: true,
    });
  }

  return permission.display;
}

export async function showNativeSinpeNotification(event: {
  id: string;
  empresaId: string;
  empresaName: string;
  amount: number;
  customerName: string;
}): Promise<boolean> {
  if (!isNativeAndroid()) return false;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return false;

  const numericId = Math.abs(
    Array.from(`${event.empresaId}:${event.id}`).reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
      0,
    ),
  );

  await LocalNotifications.schedule({
    notifications: [
      {
        id: numericId || 1,
        title: `Nuevo SINPE · ${event.empresaName}`,
        body: `${new Intl.NumberFormat("es-CR", {
          style: "currency",
          currency: "CRC",
          maximumFractionDigits: 2,
        }).format(event.amount)} · ${event.customerName || "Cliente SINPE"}`,
        channelId: SINPE_NOTIFICATION_CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 100) },
        extra: { type: "sinpe", eventId: event.id },
      },
    ],
  });

  return true;
}

export async function showNativeCompanyRequestNotification(event: {
  id: string;
  companyName: string;
  requesterName?: string;
}): Promise<boolean> {
  if (!isNativeAndroid()) return false;

  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return false;

  const numericId = Math.abs(
    Array.from(`company-request:${event.id}`).reduce(
      (hash, character) => (hash * 31 + character.charCodeAt(0)) | 0,
      0,
    ),
  );

  await LocalNotifications.schedule({
    notifications: [
      {
        id: numericId || 1,
        title: "Nueva solicitud de empresa",
        body: `${event.companyName}${event.requesterName ? ` · ${event.requesterName}` : ""}`,
        channelId: SINPE_NOTIFICATION_CHANNEL_ID,
        schedule: { at: new Date(Date.now() + 100) },
        extra: { type: "company-request", requestId: event.id },
      },
    ],
  });

  return true;
}
