export type TimingMode = "mixto" | "individual";

export interface TicketEntry {
  id: string;
  code: string;
  sorteo: string;
  amount: number;
  time: string;
  comment?: string;
}

interface CreateTimingTicketInput extends TicketEntry {
  timingMode: TimingMode;
}

const normalizeOptionalComment = (comment?: string): string | undefined => {
  const normalized = comment?.trim();
  return normalized || undefined;
};

export function createTimingTicket({
  timingMode,
  comment,
  ...ticket
}: CreateTimingTicketInput): TicketEntry {
  if (timingMode !== "mixto" || ticket.code !== "T11") return ticket;

  const normalizedComment = normalizeOptionalComment(comment);
  return normalizedComment ? { ...ticket, comment: normalizedComment } : ticket;
}

export function getVisibleTicketComment(comment?: string): string | null {
  return normalizeOptionalComment(comment) ?? null;
}
