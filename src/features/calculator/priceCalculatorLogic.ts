export const ROUNDING_MODES = {
  NEAREST: "nearest",
  DOWN: "down",
  UP: "up",
} as const;

export type RoundingMode =
  (typeof ROUNDING_MODES)[keyof typeof ROUNDING_MODES];

export function redondearPrecioFinal(valor: number): number {
  const ultimosDosDigitos = Math.floor(valor) % 100;
  const baseRedondeo = Math.floor(valor / 100) * 100;

  if (ultimosDosDigitos <= 12) return baseRedondeo;
  if (ultimosDosDigitos <= 37) return baseRedondeo + 25;
  if (ultimosDosDigitos <= 62) return baseRedondeo + 50;
  if (ultimosDosDigitos <= 87) return baseRedondeo + 75;
  return baseRedondeo + 100;
}

export function redondearAlMultiplo25(
  valor: number,
  modo: RoundingMode,
): number {
  if (modo === ROUNDING_MODES.DOWN) return Math.floor(valor / 25) * 25;
  if (modo === ROUNDING_MODES.UP) return Math.ceil(valor / 25) * 25;
  return redondearPrecioFinal(valor);
}

export function dividirPrecioFinal(
  precioFinal: number,
  cantidad: number,
  modo: RoundingMode,
): number | null {
  if (!Number.isFinite(precioFinal) || !Number.isFinite(cantidad)) return null;
  if (cantidad <= 0) return null;

  return redondearAlMultiplo25(precioFinal / cantidad, modo);
}
