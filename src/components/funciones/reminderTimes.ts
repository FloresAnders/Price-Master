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
