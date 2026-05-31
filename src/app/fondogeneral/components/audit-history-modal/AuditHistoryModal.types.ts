export type AuditHistoryModalData = { history?: AuditEntry[] } | null;

export interface AuditEntry {
  at?: string;
  before?: unknown;
  after?: unknown;
}

export interface Snapshot {
  [key: string]: unknown;
}

export interface FinResult {
  hl: string | null;
  il: string;
  el: string;
  bi: number;
  ai: number;
  be: number;
  ae: number;
  di: number;
  de: number;
}

export interface AuditHistoryModalProps {
  open: boolean;
  onClose: () => void;
  auditModalData: AuditHistoryModalData;
  dateTimeFormatter: Intl.DateTimeFormat;
  formatByCurrency: (currency: "CRC" | "USD", value: number) => string;
  providersMap: Map<string, string>;
}

export interface AuditHistoryItemProps {
  entry: AuditEntry;
  idx: number;
  total: number;
  isLast: boolean;
  dateTimeFormatter: Intl.DateTimeFormat;
  formatByCurrency: (currency: "CRC" | "USD", value: number) => string;
  providersMap: Map<string, string>;
}
