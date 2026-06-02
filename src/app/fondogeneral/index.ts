export {
  FondoSection,
  ProviderSection,
  OtraSection,
  FondoIngresoSection,
  FondoEgresoSection,
  FondoGeneralSection,
} from "./components";

export {
  FONDO_INGRESO_TYPES,
  FONDO_GASTO_TYPES,
  FONDO_EGRESO_TYPES,
  FONDO_TYPE_OPTIONS,
} from "./constants";

export {
  isFondoMovementType,
  isIngresoType,
  isGastoType,
  isEgresoType,
  formatMovementType,
  sanitizeFondoEntries,
} from "./utils";

export type { FondoEntry, FondoMovementType } from "./types";
