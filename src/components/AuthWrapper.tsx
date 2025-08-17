
'use client';
import Footer from './Footer';

import React, { useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import LoginModal from './LoginModal';
import type { User } from '@/types/firestore';

interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, isAuthenticated, loading, login } = useAuth();
  const wasAuthenticatedRef = useRef(false);

  // Detectar logout y notificar al chat
  useEffect(() => {
    // Si estaba autenticado y ahora no lo está, es un logout
    if (wasAuthenticatedRef.current && !isAuthenticated && !loading) {
      console.log('🔍 Logout detectado, notificando al chat...');
      
      // Notificar al sistema de chat sobre el logout
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('chat_userId_')) {
          const chatUserId = localStorage.getItem(key);
          if (chatUserId) {
            try {
              fetch('/api/chat-polling', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  action: 'logout',
                  data: { userId: chatUserId }
                })
              }).catch(error => {
                console.error('Error notificando logout al chat:', error);
              });
            } catch (error) {
              console.error('Error en cleanup de logout:', error);
            }
          }
          // Limpiar datos del chat del localStorage
          localStorage.removeItem(key);
        }
      });
    }
    
    // Actualizar el estado de referencia
    wasAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated, loading]);

  // Detectar cuando el usuario cierra la ventana/pestaña estando autenticado
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleBeforeUnload = () => {
      // Enviar leave al chat si está autenticado
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('chat_userId_')) {
          const chatUserId = localStorage.getItem(key);
          if (chatUserId) {
            const data = JSON.stringify({
              action: 'leave',
              data: { userId: chatUserId }
            });
            navigator.sendBeacon('/api/chat-polling', data);
          }
        }
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isAuthenticated]);

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
        <div className="flex items-center justify-start">
        </div>

        <div className="mb-32 sm:mb-48">
          <LoginModal
            isOpen={true}
            onClose={() => {}} // No permitir cerrar
            onLoginSuccess={(userData: User, keepActive?: boolean) => {
              login(userData, keepActive);
            }}
            title="Price Master"
            canClose={false} // No mostrar botón cancelar
          />
        </div>
        <Footer />
      </>
    );
  }

  // Usuario autenticado, mostrar la aplicación
  return <>{children}</>;
}
