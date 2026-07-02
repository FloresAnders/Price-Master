export type ReminderFunction = {
  funcionId: string;
  funcionNombre: string;
  funcionDescripcion?: string;
};

export type ReminderSourceItem = ReminderFunction & {
  empresaId: string;
  empresaName: string;
  reminderTimeCr: string;
  blockOnReminder?: boolean;
  blockSeconds?: number;
};

export type QueuedReminderItem = {
  key: string;
  keys: string[];
  empresaId: string;
  empresaName: string;
  funciones: ReminderFunction[];
  reminderTimeCr: string;
  blockOnReminder?: boolean;
  blockSeconds?: number;
};

export function getReminderBlockSeconds(
  item: Pick<ReminderSourceItem, "blockOnReminder" | "blockSeconds">,
): number {
  if (
    item.blockOnReminder === true &&
    Number.isSafeInteger(item.blockSeconds) &&
    Number(item.blockSeconds) > 0
  ) {
    return Number(item.blockSeconds);
  }

  return 0;
}

export function groupReminderSources(params: {
  dateKey: string;
  items: ReminderSourceItem[];
  firedKeys: ReadonlySet<string>;
  pendingKeys: ReadonlySet<string>;
}): { queued: QueuedReminderItem[]; pendingKeys: string[] } {
  const dateKey = String(params.dateKey || "").trim();
  const grouped = new Map<string, QueuedReminderItem>();
  const pendingKeys: string[] = [];

  for (const item of params.items || []) {
    const key = `${dateKey}|${item.empresaId}|${item.funcionId}|${item.reminderTimeCr}`;
    if (params.firedKeys.has(key)) continue;
    if (params.pendingKeys.has(key)) continue;

    pendingKeys.push(key);

    const groupKey = `${dateKey}|${item.empresaId}|${item.reminderTimeCr}`;
    const seconds = getReminderBlockSeconds(item);
    const existing = grouped.get(groupKey);
    const funcion: ReminderFunction = {
      funcionId: item.funcionId,
      funcionNombre: item.funcionNombre,
      funcionDescripcion: item.funcionDescripcion,
    };

    if (existing) {
      existing.keys.push(key);
      existing.funciones.push(funcion);
      if (seconds > Number(existing.blockSeconds || 0)) {
        existing.blockOnReminder = seconds > 0;
        existing.blockSeconds = seconds || undefined;
      }
      continue;
    }

    grouped.set(groupKey, {
      key: groupKey,
      keys: [key],
      empresaId: item.empresaId,
      empresaName: item.empresaName,
      funciones: [funcion],
      reminderTimeCr: item.reminderTimeCr,
      blockOnReminder: seconds > 0,
      blockSeconds: seconds || undefined,
    });
  }

  return {
    queued: Array.from(grouped.values()),
    pendingKeys,
  };
}
