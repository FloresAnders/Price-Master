'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginModal from './LoginModal';
import type { User } from '@/types/firestore';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, isAuthenticated, loading, login } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);

  // Mostrar loading mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar pantalla de login
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800">
        <div className="max-w-md w-full mx-4">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Price Master
              </h1>
              <p className="text-gray-600 dark:text-gray-300">
                Calcula, cuenta, escanea. Todo en uno.
              </p>
            </div>
            
            <button
              onClick={() => setShowLoginModal(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Iniciar Sesión
            </button>
            
            <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
              <p>Ingresa con tu cuenta para acceder a todas las funciones</p>
            </div>
          </div>
        </div>

        <LoginModal
          isOpen={showLoginModal}
          onClose={() => setShowLoginModal(false)}
          onLoginSuccess={(userData: User) => {
            login(userData);
            setShowLoginModal(false);
          }}
          title="Iniciar Sesión - Price Master"
        />
      </div>
    );
  }

  // Usuario autenticado, mostrar la aplicación
  return <>{children}</>;
}
