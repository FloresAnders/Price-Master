export const TIEMPOS_TUCAN_TAB_ID = "tiempostucan";

export type ReporteTiemposPermissions = {
  reportetiempos?: boolean;
};

export function canAccessTiemposTucan(
  permissions?: ReporteTiemposPermissions | null,
): boolean {
  return permissions?.reportetiempos === true;
}

export const FONDO_SECTION_HASHES = [
  "#fondogeneral",
  "#agregarproveedor",
  `#${TIEMPOS_TUCAN_TAB_ID}`,
  "#facturas",
  "#reportes",
  "#reportessinpe",
  "#deudasinternas",
] as const;

export const HOME_TAB_IDS = [
  "scanner",
  "calculator",
  "converter",
  "xml",
  "cashcounter",
  "recetas",
  "agregarproducto",
  "timingcontrol",
  "controlhorario",
  "empleados",
  "funciones",
  "calculohorasprecios",
  "supplierorders",
  "scanhistory",
  "edit",
  "solicitud",
  "registroTucan",
  "registroTiempos",
  "anotaciones",
  "fondogeneral",
  "agregarproveedor",
  TIEMPOS_TUCAN_TAB_ID,
  "facturas",
  "reportes",
  "reportessinpe",
  "deudasinternas",
] as const;

export function isFondoSectionHash(currentHash: string): boolean {
  return (FONDO_SECTION_HASHES as readonly string[]).includes(currentHash);
}

export function isHomeTabId(tabId: string, isSuperAdmin: boolean): boolean {
  if (tabId === "pruebas") return isSuperAdmin;
  return (HOME_TAB_IDS as readonly string[]).includes(tabId);
}
