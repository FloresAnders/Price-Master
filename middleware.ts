// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Solo aplicar middleware a la ruta /edit y sus sub-rutas
  if (request.nextUrl.pathname.startsWith('/edit')) {
    // En el cliente, la verificación de autenticación se hará en el componente
    // Aquí podemos agregar headers de seguridad adicionales
    const response = NextResponse.next();
    
    // Headers de seguridad para rutas sensibles
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    
    // Cache control para evitar cacheo de páginas sensibles
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/edit/:path*']
};
