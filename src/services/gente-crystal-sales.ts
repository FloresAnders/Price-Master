export type GenteCrystalDailySale = {
  ticketId: string;
  sorteo: string;
  monto: number;
  saleAt: string;
  captureOrigin: "local_button" | "indirect";
};

export type GenteCrystalDailySalesResponse = {
  ok: true;
  companyId: string;
  date: string;
  timezone: "America/Costa_Rica";
  summary: {
    count: number;
    total: number;
    indirectCount: number;
    indirectTotal: number;
  };
  sales: GenteCrystalDailySale[];
};

export class GenteCrystalSalesClientError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = "GenteCrystalSalesClientError";
    this.status = status;
    this.code = code;
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDailySale(value: unknown): value is GenteCrystalDailySale {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.ticketId === "string" &&
    typeof value.sorteo === "string" &&
    typeof value.monto === "number" &&
    Number.isFinite(value.monto) &&
    value.monto > 0 &&
    typeof value.saleAt === "string" &&
    Number.isFinite(new Date(value.saleAt).getTime()) &&
    (value.captureOrigin === "local_button" ||
      value.captureOrigin === "indirect")
  );
}

function isDailyResponse(
  value: unknown,
): value is GenteCrystalDailySalesResponse {
  if (!isPlainObject(value) || !isPlainObject(value.summary)) return false;
  if (!Array.isArray(value.sales) || !value.sales.every(isDailySale)) {
    return false;
  }
  const sales = value.sales as GenteCrystalDailySale[];
  const indirectSales = sales.filter(
    (sale) => sale.captureOrigin === "indirect",
  );
  const expectedTotal = sales.reduce((total, sale) => total + sale.monto, 0);
  const expectedIndirectTotal = indirectSales.reduce(
    (total, sale) => total + sale.monto,
    0,
  );
  return (
    value.ok === true &&
    typeof value.companyId === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(value.date || "")) &&
    value.timezone === "America/Costa_Rica" &&
    Number.isInteger(value.summary.count) &&
    (value.summary.count as number) >= 0 &&
    typeof value.summary.total === "number" &&
    Number.isFinite(value.summary.total) &&
    Number.isInteger(value.summary.indirectCount) &&
    (value.summary.indirectCount as number) >= 0 &&
    typeof value.summary.indirectTotal === "number" &&
    Number.isFinite(value.summary.indirectTotal) &&
    value.summary.count === sales.length &&
    value.summary.total === expectedTotal &&
    value.summary.indirectCount === indirectSales.length &&
    value.summary.indirectTotal === expectedIndirectTotal
  );
}

function readErrorCode(body: unknown): string {
  return isPlainObject(body) && typeof body.error === "string"
    ? body.error
    : "request_failed";
}

export class GenteCrystalSalesClient {
  static async getDaily(
    companyId: string,
    date: string,
    signal?: AbortSignal,
  ): Promise<GenteCrystalDailySalesResponse> {
    const params = new URLSearchParams({ companyId, date });
    const response = await fetch(
      `/api/integrations/gente-crystal/sales?${params}`,
      {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        signal,
      },
    );
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      throw new GenteCrystalSalesClientError(
        response.status,
        readErrorCode(body),
      );
    }
    if (!isDailyResponse(body)) {
      throw new GenteCrystalSalesClientError(502, "invalid_response");
    }
    return body;
  }
}

export function messageForGenteCrystalSalesError(error: unknown): string {
  if (error instanceof GenteCrystalSalesClientError) {
    if (error.status === 401) {
      return "Tu sesión expiró. Inicia sesión nuevamente.";
    }
    if (error.code === "update_window_closed") {
      return "Solo puedes actualizar Tiempos/Tucan durante la ventana de cierre del turno D o N.";
    }
    if (error.status === 403) {
      return "No tienes acceso a esta empresa.";
    }
  }
  return "No se pudieron cargar los movimientos.";
}
