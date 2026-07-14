export type RegistroTucanTotalInput = {
  saldoPaginaTucan: number;
  saldoFondoTucan: number;
  pagosHoy?: number;
  saldoSinpesRecibidos?: number;
};

export function roundRegistroTucanAmount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function parseRegistroTucanAmount(value: string): number {
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
  return roundRegistroTucanAmount(parsed);
}

export function calculateRegistroTucanTotal(
  input: RegistroTucanTotalInput,
): number {
  return roundRegistroTucanAmount(
    Number(input.saldoPaginaTucan || 0) +
      Number(input.saldoFondoTucan || 0) +
      Number(input.pagosHoy ?? input.saldoSinpesRecibidos ?? 0),
  );
}

export function formatRegistroTucanDateInput(date: Date): string {
  if (!date || typeof date.getTime !== "function" || Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatRegistroTucanTimeInput(date: Date): string {
  if (!date || typeof date.getTime !== "function" || Number.isNaN(date.getTime())) {
    return "";
  }
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

export function buildRegistroTucanEmpresaDocId(empresa: string): string {
  const normalized = String(empresa || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toUpperCase();
  return normalized || "SIN_EMPRESA";
}
