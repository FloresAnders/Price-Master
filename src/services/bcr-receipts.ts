export type BcrDailyReceipt = {
  monto: number;
  paidAt: string;
};

export type BcrDailyReceiptsResponse = {
  ok: true;
  companyId: string;
  date: string;
  timezone: "America/Costa_Rica";
  summary: { count: number; total: number };
  receipts: BcrDailyReceipt[];
};

export class BcrReceiptsClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "BcrReceiptsClientError";
    this.status = status;
    this.code = code;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDailyReceipt(value: unknown): value is BcrDailyReceipt {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.monto === "number" &&
    Number.isFinite(value.monto) &&
    value.monto > 0 &&
    typeof value.paidAt === "string" &&
    Number.isFinite(new Date(value.paidAt).getTime())
  );
}

function isDailyResponse(value: unknown): value is BcrDailyReceiptsResponse {
  if (!isPlainObject(value) || !isPlainObject(value.summary)) return false;
  if (!Array.isArray(value.receipts) || !value.receipts.every(isDailyReceipt)) {
    return false;
  }
  const receipts = value.receipts as BcrDailyReceipt[];
  const expectedTotal = receipts.reduce((total, receipt) => total + receipt.monto, 0);
  return (
    value.ok === true &&
    typeof value.companyId === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.date || "")) &&
    value.timezone === "America/Costa_Rica" &&
    Number.isInteger(value.summary.count) &&
    (value.summary.count as number) >= 0 &&
    typeof value.summary.total === "number" &&
    Number.isFinite(value.summary.total) &&
    value.summary.count === receipts.length &&
    value.summary.total === expectedTotal
  );
}

function readErrorCode(body: unknown): string {
  return isPlainObject(body) && typeof body.error === "string"
    ? body.error
    : "request_failed";
}

export class BcrReceiptsClient {
  static async getDaily(
    companyId: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<BcrDailyReceiptsResponse> {
    const params = new URLSearchParams({ companyId, date });
    const response = await fetch(`/api/integrations/bcr/receipts?${params}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new BcrReceiptsClientError(response.status, readErrorCode(body));
    }
    if (!isDailyResponse(body)) {
      throw new BcrReceiptsClientError(502, "invalid_response");
    }
    return body;
  }
}

export function messageForBcrReceiptsError(error: unknown): string {
  if (error instanceof BcrReceiptsClientError) {
    if (error.status === 401) return "Tu sesión expiró. Inicia sesión nuevamente.";
    if (error.code === "update_window_closed") {
      return "Solo puedes actualizar Tiempos/Tucan durante la ventana de cierre del turno D o N.";
    }
    if (error.status === 403) return "No tienes acceso a esta empresa.";
  }
  return "No se pudieron cargar los comprobantes de Tucán.";
}
