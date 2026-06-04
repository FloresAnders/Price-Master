import type { MovementAccountKey } from "@/services/movimientos-fondos";
import type { UserPermissions } from "@/types/firestore";

export let FONDO_INGRESO_TYPES: readonly string[] = [];
export let FONDO_GASTO_TYPES: readonly string[] = [];
export let FONDO_EGRESO_TYPES: readonly string[] = [];
export let FONDO_TYPE_OPTIONS: readonly string[] = [];

export function setFondoMovementTypes(types: {
  INGRESO: readonly string[];
  GASTO: readonly string[];
  EGRESO: readonly string[];
}) {
  FONDO_INGRESO_TYPES = types.INGRESO;
  FONDO_GASTO_TYPES = types.GASTO;
  FONDO_EGRESO_TYPES = types.EGRESO;
  FONDO_TYPE_OPTIONS = [
    ...types.INGRESO,
    ...types.GASTO,
    ...types.EGRESO,
  ];
}

export const MAX_AUDIT_EDITS = 5;

export const AUTO_ADJUSTMENT_PROVIDER_CODE = "CIERRE DE FONDO GENERAL";
export const AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY = "AJUSTE FONDO GENERAL";
export const AUTO_ADJUSTMENT_MANAGER = "SISTEMA";
export const AUTO_ADJUSTMENT_CLOSING_TYPE = "AJUSTE CIERRE";

export const CIERRE_FONDO_VENTAS_PROVIDER_NAME = "CIERRE FONDO VENTAS";
export const CIERRE_FONDO_VENTAS_MINUTES_BEFORE_END = 15;
export const CIERRE_FONDO_VENTAS_MINUTES_AFTER_END = 90;
export const INGRESO_DESDE_FONDO_VENTAS_NAME = "INGRESO DESDE FONDO VENTAS";

export const FONDO_KEY_SUFFIX = "_fondos_v1";
export const DAILY_CLOSINGS_STORAGE_PREFIX = "fg_daily_closings";
export const SHARED_COMPANY_STORAGE_KEY = "fg_selected_company_shared";

export const NAMESPACE_PERMISSIONS: Record<string, keyof UserPermissions> = {
  fg: "fondogeneral",
  bcr: "fondogeneralBCR",
  bn: "fondogeneralBN",
  bac: "fondogeneralBAC",
  cn: "cajaNegra",
};

export const NAMESPACE_DESCRIPTIONS: Record<string, string> = {
  fg: "el Fondo General",
  bcr: "la cuenta BCR",
  bn: "la cuenta BN",
  bac: "la cuenta BAC",
  cn: "la Caja Negra",
};

export const ACCOUNT_KEY_BY_NAMESPACE: Record<string, MovementAccountKey> = {
  fg: "FondoGeneral",
  bcr: "BCR",
  bn: "BN",
  bac: "BAC",
  cn: "CajaNegra",
};

export const MOVEMENT_ACCOUNT_KEYS: MovementAccountKey[] = [
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
  "CajaNegra",
];

export const SAVE_COOLDOWN_MS = 60_000;
export const CACHE_TTL_MS = 60_000;
export const MOVEMENT_COOLDOWN_MS = 60_000;
export const CLOSING_GUARD_LOCK_DURATION_MS = 1_800_000;
