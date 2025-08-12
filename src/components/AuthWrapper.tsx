'use client';

import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginModal from './LoginModal';
import type { User } from '@/types/firestore';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, isAuthenticated, loading, login } = useAuth();

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

  // Si no está autenticado, mostrar modal de login directamente
  if (!isAuthenticated || !user) {
    return (
      <>
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-zinc-900 dark:to-zinc-800">
          <div className="text-center">
            <div className="animate-pulse text-gray-600 dark:text-gray-300">
              Iniciando sesión...
            </div>
          </div>
        </div>

        <LoginModal
          isOpen={true}
          onClose={() => {}} // No permitir cerrar
          onLoginSuccess={(userData: User, keepActive?: boolean) => {
            login(userData, keepActive);
          }}
          title="Price Master"
          canClose={false} // No mostrar botón cancelar
        />
      </>
    );
  }

  // Usuario autenticado, mostrar la aplicación
  return <>{children}</>;
}
