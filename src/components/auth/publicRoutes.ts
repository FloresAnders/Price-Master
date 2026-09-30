const PUBLIC_ROUTES = new Set([
  "/home",
  "/reset-password",
  "/pruebas",
  "/device-link",
  "/about",
  "/privacy/gmail-sinpe",
  "/privacy/encabezado-impresion",
  "/privacy/gente-crystal-extension",
  "/terms",
]);

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}
