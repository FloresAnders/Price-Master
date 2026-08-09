export type RegistroTiemposTotalInput = {
  saldoPaginaTiempos: number;
  saldoFondoTiempos: number;
  pagosHoy?: number;
  saldoSinpesRecibidos?: number;
};

export function roundRegistroTiemposAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function parseRegistroTiemposAmount(value: string): number {
  const raw = String(value || "").trim();
  if (!raw) return 0;

  const cleaned = raw.replace(/[^\d,.-]/g, "");
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");
  const decimalSeparator =
    lastComma > -1 && lastDot > -1
      ? lastComma > lastDot
        ? ","
        : "."
      : lastComma > -1
        ? ","
        : ".";

  const normalized =
    decimalSeparator === ","
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");

  const parsed = Number(normalized);
  return roundRegistroTiemposAmount(parsed);
}

export function calculateRegistroTiemposTotal(
  input: RegistroTiemposTotalInput,
): number {
  return roundRegistroTiemposAmount(
    Number(input.saldoPaginaTiempos || 0) +
      Number(input.saldoFondoTiempos || 0) +
      Number(input.pagosHoy ?? input.saldoSinpesRecibidos ?? 0),
  );
}

export function formatRegistroTiemposDateInput(date: Date): string {
  if (!date || typeof date.getTime !== "function" || Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatRegistroTiemposTimeInput(date: Date): string {
  if (!date || typeof date.getTime !== "function" || Number.isNaN(date.getTime())) {
    return "";
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function buildRegistroTiemposEmpresaDocId(empresa: string): string {
  const normalized = String(empresa || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return normalized || "SIN_EMPRESA";
}
