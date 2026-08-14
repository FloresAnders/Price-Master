const PUBLIC_ROUTES = new Set([
  "/home",
  "/reset-password",
  "/pruebas",
  "/device-link",
  "/privacy/gente-crystal-extension",
]);

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.has(pathname);
}
