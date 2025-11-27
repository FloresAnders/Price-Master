'use client';

import React, { useEffect, useState } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { Capacitor } from '@capacitor/core';

export function PermissionsManager({ children }: { children: React.ReactNode }) {
  const { permissions, requestCameraPermissions } = usePermissions();
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [hasRequestedPermissions, setHasRequestedPermissions] = useState(false);

  useEffect(() => {
    // Solo mostrar el diálogo en plataformas nativas
    if (Capacitor.isNativePlatform() && !permissions.isLoading && !hasRequestedPermissions) {
      if (permissions.camera === 'prompt' || permissions.camera === 'denied') {
        setShowPermissionDialog(true);
      }
    }
  }, [permissions, hasRequestedPermissions]);

  const handleRequestPermissions = async () => {
    setHasRequestedPermissions(true);
    const granted = await requestCameraPermissions();

    if (granted) {
      setShowPermissionDialog(false);
    } else {
      // Si los permisos fueron denegados, mostrar mensaje informativo
      alert('Los permisos de cámara son necesarios para escanear códigos de barras. Puedes activarlos desde la configuración de la aplicación.');
      setShowPermissionDialog(false);
    }
  };

  const handleSkip = () => {
    setHasRequestedPermissions(true);
    setShowPermissionDialog(false);
  };

  if (!showPermissionDialog) {
    return <>{children}</>;
  }

  return (
    <>
      {children}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
          <div className="text-center mb-6">
            <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Permisos necesarios
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Time Master necesita acceso a tu cámara para escanear códigos de barras y QR.
            </p>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex items-start space-x-3">
              <svg
                className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Cámara:</strong> Para escanear códigos de barras y códigos QR
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <svg
                className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                <strong className="text-gray-900 dark:text-white">Portapapeles:</strong> Para copiar y pegar información rápidamente
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleSkip}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Ahora no
            </button>
            <button
              onClick={handleRequestPermissions}
              className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Permitir acceso
            </button>
          </div>

          <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
            Puedes cambiar estos permisos en cualquier momento desde la configuración de tu dispositivo
          </p>
        </div>
      </div>
    </>
  );
}
