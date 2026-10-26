export interface ClientEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function queueEmailFromClient(
  payload: ClientEmailPayload,
): Promise<void> {
  const response = await fetch("/api/send-email", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  if (response.ok) return;

  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  throw new Error(body?.error || `Email request failed (${response.status})`);
}
