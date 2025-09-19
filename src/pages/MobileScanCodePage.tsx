import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { decodeData } from '@/utils/shortEncoder';

export default function MobileScanCodePage() {
  const params = useParams();
  const navigate = useNavigate();
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

      // Extract params from decoded data
      const { session, requestProductName } = decoded;
      
      // Construct query string
      const queryParams = new URLSearchParams();
      queryParams.set('session', session);
      if (requestProductName) queryParams.set('requestProductName', 'true');
      
      // Redirect to main mobile scan page with decoded params
      navigate(`/mobile-scan?${queryParams.toString()}`, { replace: true });
      
    } catch (error) {
      console.error('Error decoding short URL:', error);
      setError('Error al decodificar el enlace corto');
      setIsDecoding(false);
    }
  }, [params.code, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-lg border border-red-200 dark:border-red-800">
            <div className="text-red-600 dark:text-red-400 text-6xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Error en el enlace
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6">
              {error}
            </p>
            <button
              onClick={() => navigate('/mobile-scan')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Ir al escáner móvil
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-800/20 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-zinc-800 rounded-lg p-8 shadow-lg">
          <div className="animate-spin text-blue-600 dark:text-blue-400 text-6xl mb-4">⚙️</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Decodificando enlace...
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Por favor espera mientras procesamos tu enlace corto.
          </p>
        </div>
      </div>
    </div>
  );
}