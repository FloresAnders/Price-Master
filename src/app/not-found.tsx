'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { decodeData } from '../utils/shortEncoder';

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // Manejar URLs de mobile-scan con códigos
    if (pathname && pathname.startsWith('/mobile-scan/')) {
      const code = pathname.split('/mobile-scan/')[1]?.replace(/\/$/, '');
      if (code) {
        try {
          // Intentar decodificar el código corto
          const decoded = decodeData(code);
          if (decoded && decoded.session) {
            // Es un código corto válido, construir la URL con los parámetros decodificados
            const params = new URLSearchParams();
            params.set('session', decoded.session);
            if (decoded.requestProductName) {
              params.set('rpn', 't');
            }
            router.replace(`/mobile-scan?${params.toString()}`);
            return;
          }
        } catch (error) {
          console.error('Error decoding short URL:', error);
        }

        // Si la decodificación falla, usar el código como parámetro directo
        router.replace(`/mobile-scan?code=${encodeURIComponent(code)}`);
        return;
      }
    }
  }, [pathname, router]);

  // Si es una URL de mobile-scan, mostrar loading mientras redirecciona
  if (pathname && pathname.startsWith('/mobile-scan/')) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Redireccionando...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Por favor espera
          </p>
        </div>
      </div>
    );
  }

  // Página 404 normal para otras rutas
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center max-w-md">
        <div className="text-8xl font-bold text-blue-600 mb-4">404</div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Página no encontrada
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          Lo sentimos, la página que buscas no existe.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            Ir al inicio
          </Link>
          <Link
            href="/mobile-scan"
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg transition-colors font-medium"
          >
            Escáner móvil
          </Link>
        </div>
      </div>
    </div>
  );
}
