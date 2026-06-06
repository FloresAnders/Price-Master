//----------------------------------------------------------------------------
// src/utils/cash-calculator.ts
// Módulo utilitario para toda la lógica financiera de la apertura de caja.
// Responsable de cálculos totales, formateo y creación de estados iniciales.
//----------------------------------------------------------------------------

/** Definición de denominaciones utilizadas en el sistema. */
export const CRC_DENOMINATIONS: readonly number[] = [
  20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25,
];

export const USD_DENOMINATIONS: readonly number[] = [100, 50, 20, 10, 5, 1];

/** Tipado para los conteos de billetes (ej. { 10000: "5", 100: "2", ... }) */
export type CountState = Record<number | string, string>;

/** Formatea números a la moneda local (CRC) o USD. Devuelve un objeto con los formateadores necesarios para el componente de UI. */
interface Formatters {
  crcFormatter: Intl.NumberFormat;
  usdFormatter: Intl.NumberFormat;
  openingDateFormatter: Intl.DateTimeFormat;
}

/** Crea una instancia de formato monetario y temporal basado en la localización del sistema (es-CR). */
export const getFormatters = (): Formatters => ({
    crcFormatter: new Intl.NumberFormat("es-CR", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    usdFormatter: new Intl.NumberFormat("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
    openingDateFormatter: new Intl.DateTimeFormat("es-CR", { dateStyle: "long", timeStyle: "short" }),
});

/** Estado inicial de conteos nulos para una lista dada de denominaciones. */
export const buildInitialCounts = (denominations: readonly number[]): CountState =>
  denominations.reduce((acc, denom) => {
    acc[denom] = "";
    return acc;
  }, {} as CountState);

/** Construye el estado de conteos inicial a partir de un resumen de datos pasados. */
export const buildCountsFromBreakdown = (
  denominations: readonly number[],
  breakdown: Record<number, number> | undefined | null,
): CountState => {
  const initial = buildInitialCounts(denominations);
  if (!breakdown) return initial;

  Object.entries(breakdown).forEach(([denomStr, count]) => {
    const d = Number(denomStr);
    // Verifica que el valor sea un número finito y esté en la lista de denominaciones válidas antes de actualizar
    if (Number.isFinite(d) && denominations.includes(d)) {
      initial[d] = String(count ?? 0) || "";
    }
  });

  return initial;
};

/** Estructura de datos completa para el formulario (Input/API). */
export type CashOpeningFormValues = {
  openingDate: string;
  manager: string;
  notes: string;
  totalCRC: number;
  totalUSD: number;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
};

/** Determina el estado inicial completo del formulario a partir de valores preexistentes. */
export const buildFormState = (initialValues: CashOpeningFormValues | undefined): Omit&<CashOpeningFormValues> => {
    const initialDate = initialValues?.openingDate || new Date().toISOString();
    return {
        openingDate: initialDate,
        manager: initialValues?.manager || "",
        notes: initialValues?.notes || "",
        totalCRC: 0, // Se calculará en el componente utilizando los conteos.
        totalUSD: 0,
        breakdownCRC: buildCountsFromBreakdown(CRC_DENOMINATIONS, initialValues?.breakdownCRC),
        breakdownUSD: buildCountsFromBreakdown(USD_DENOMINATIONS, initialValues?.breakdownUSD),
    };
};

/** --- Lógica de Cálculo y Diferencias --- */

export const normalizeCount = (raw: string): number => {
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

/** Calcula el total de dinero para una moneda dada y sus denominaciones. */
export const calculateTotalCashAmount = (
    denominations: readonly number[],
    counts: CountState,
): number => {
  return denominations.reduce(
    (sum, denom) => sum + (denom * normalizeCount(counts[denom] || "")),
    0
  );
};

/** Calcula la diferencia entre el total calculado y el saldo inicial de caja en efectivo. */
export const calculateDifference = (calculatedTotal: number, initialBalance: number): {
    diffValue: number;
    isPositive: boolean; // True si hay un sobrante (+)
} => ({
    diffValue: calculatedTotal - Math.trunc(initialBalance),
    // Se considera positivo si el total de conteo > saldo inicial (sobrante)
    isPositive: calculatedTotal >= initialBalance, 
});