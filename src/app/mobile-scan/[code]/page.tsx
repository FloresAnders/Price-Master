'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { decodeData } from '../../../utils/shortEncoder';

export default function ShortMobileScanPage() {
  const params = useParams();
  const router = useRouter();
  const [isDecoding, setIsDecoding] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = params.code as string;
    
    if (!code) {
      setError('Código no encontrado en la URL');
      setIsDecoding(false);
      return;
    }

    try {
      // Decode the short URL
      const decoded = decodeData(code);
      
      if (!decoded || !decoded.session) {
        setError('Código inválido o corrupto');
        setIsDecoding(false);
        return;
      }

      // Build the original URL with decoded parameters
      const searchParams = new URLSearchParams();
      searchParams.set('session', decoded.session);
      
      if (decoded.requestProductName) {
        searchParams.set('rpn', 't');
      }

      // Redirect to the original mobile-scan page with full parameters
      const redirectUrl = `/mobile-scan?${searchParams.toString()}`;
      router.replace(redirectUrl);
      
    } catch (err) {
      console.error('Error decoding short URL:', err);
      setError('Error al decodificar la URL. Puede estar corrupta o ser inválida.');
      setIsDecoding(false);
    }
  }, [params.code, router]);

  if (isDecoding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Decodificando URL...
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Redirigiendo al escáner móvil
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Error en la URL
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error}
          </p>
          <button
            onClick={() => router.push('/mobile-scan')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Ir al escáner móvil
          </button>
        </div>
      </div>
    );
  }

  return null;
}
