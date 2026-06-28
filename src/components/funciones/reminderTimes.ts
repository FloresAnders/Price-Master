export function normalizeReminderTimesCr(raw: {
  reminderTimeCr?: unknown;
  reminderTimesCr?: unknown;
} | null | undefined): string[] {
  if (!raw) return [];

  const values = [
    ...(Array.isArray(raw.reminderTimesCr) ? raw.reminderTimesCr : []),
    raw.reminderTimeCr,
  ];

  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

export function validateReminderTimesCr(
  hasReminder: boolean,
  values: string[],
): { times: string[]; error?: string } {
  if (!hasReminder) return { times: [] };

  const times = normalizeReminderTimesCr({ reminderTimesCr: values });
  if (times.length === 0) {
    return { times: [], error: "Selecciona una hora para el recordatorio." };
  }

  if (times.some((time) => !/^\d{2}:\d{2}$/.test(time))) {
    return {
      times: [],
      error: "Hora de recordatorio inválida (usa HH:mm).",
    };
  }

  return { times };
}

export function validateBlockSeconds(
  blockOnReminder: boolean,
  rawSeconds: unknown,
): { blockOnReminder: boolean; blockSeconds?: number; error?: string } {
  if (!blockOnReminder) {
    return { blockOnReminder: false, blockSeconds: undefined };
  }

  const value = String(rawSeconds ?? "").trim();
  if (!/^\d+$/.test(value)) {
    return {
      blockOnReminder: true,
      error: "Segundos de bloqueo inválidos.",
    };
  }

  const seconds = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    return {
      blockOnReminder: true,
      error: "Segundos de bloqueo inválidos.",
    };
  }

  return { blockOnReminder: true, blockSeconds: seconds };
}
