export type SinpeSystemNotificationInstance = {
  onclick: (() => void) | null;
  close: () => void;
};

export type SinpeSystemNotificationApi = {
  readonly permission: NotificationPermission;
  requestPermission: () => Promise<NotificationPermission>;
  new (
    title: string,
    options?: NotificationOptions,
  ): SinpeSystemNotificationInstance;
};

type SinpeNotificationEvent = {
  id: string;
  empresaId: string;
  empresaName: string;
  amount: number;
  customerName: string;
};

const formatAmount = (amount: number) =>
  new Intl.NumberFormat("es-CR", {
    style: "currency",
    currency: "CRC",
    maximumFractionDigits: 2,
  }).format(amount);

export function showSinpeSystemNotification(options: {
  event: SinpeNotificationEvent;
  isDocumentHidden: boolean;
  notificationApi: SinpeSystemNotificationApi | null;
  focusWindow: () => void;
}): boolean {
  const { event, isDocumentHidden, notificationApi, focusWindow } = options;
  if (
    !isDocumentHidden ||
    !notificationApi ||
    notificationApi.permission !== "granted"
  ) {
    return false;
  }

  try {
    const notification = new notificationApi(
      `Nuevo SINPE · ${event.empresaName}`,
      {
        body: `${formatAmount(event.amount)} · ${event.customerName || "Cliente SINPE"}`,
        icon: "/android-chrome-192x192.png",
        badge: "/favicon-32x32.png",
        tag: `sinpe:${event.empresaId}:${event.id}`,
      },
    );
    notification.onclick = () => {
      focusWindow();
      notification.close();
    };
    return true;
  } catch {
    return false;
  }
}

export async function requestSinpeNotificationPermission(
  notificationApi: SinpeSystemNotificationApi | null,
): Promise<NotificationPermission | "unsupported"> {
  if (!notificationApi) return "unsupported";
  if (notificationApi.permission !== "default") {
    return notificationApi.permission;
  }
  return notificationApi.requestPermission();
}
