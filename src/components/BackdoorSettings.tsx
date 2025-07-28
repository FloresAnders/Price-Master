'use client';

import React, { useState } from 'react';
import { Settings, Clock, RefreshCw, User, Shield, Eye, EyeOff, X } from 'lucide-react';
import { getSession, saveSession, createSession } from '@/utils/session';
import type { SessionData } from '@/utils/session';
import type { User as FirestoreUser } from '@/types/firestore';

interface BackdoorSettingsProps {
  currentUser: FirestoreUser | null;
  onSessionExtended?: () => void;
}

export default function BackdoorSettings({ currentUser, onSessionExtended }: BackdoorSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showSessionDetails, setShowSessionDetails] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleExtendSession = (hours: number) => {
    const session = getSession();
    if (!session) {
      showNotification('No se pudo encontrar la sesión actual', 'error');
      return;
    }

    // Extender la sesión agregando las horas especificadas
    const extendedSession: SessionData = {
      ...session,
      expiresAt: session.expiresAt + (hours * 60 * 60 * 1000)
    };

    saveSession(extendedSession);
    showNotification(`Sesión extendida por ${hours} hora${hours > 1 ? 's' : ''} más`, 'success');
    
    if (onSessionExtended) {
      onSessionExtended();
    }
  };

  const handleResetSession = () => {
    if (!currentUser) return;
    
    // Crear una nueva sesión de 5 horas
    const newSession = createSession(currentUser);
    saveSession(newSession);
    showNotification('Sesión reiniciada a 5 horas completas', 'success');
    
    if (onSessionExtended) {
      onSessionExtended();
    }
  };

  const getSessionInfo = () => {
    const session = getSession();
    if (!session) return null;

    const now = Date.now();
    const timeLeft = session.expiresAt - now;
    const loginTime = new Date(session.loginTimestamp);
    const expiryTime = new Date(session.expiresAt);

    return {
      loginTime: loginTime.toLocaleString(),
      expiryTime: expiryTime.toLocaleString(),
      timeLeftMs: timeLeft,
      totalDuration: session.expiresAt - session.loginTimestamp
    };
  };

  const sessionInfo = getSessionInfo();

  return (
    <>
      {/* Botón de configuración flotante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-40 w-12 h-12 bg-gray-700 hover:bg-gray-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
        title="Configuración de sesión"
      >
        <Settings className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* Modal de configuración */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-[var(--card-bg)] rounded-2xl shadow-2xl w-full max-w-md border border-[var(--border)] max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <div className="flex items-center gap-3">
                <Settings className="w-6 h-6 text-blue-600" />
                <h2 className="text-xl font-bold text-[var(--foreground)]">Configuración de Sesión</h2>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-[var(--input-bg)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-[var(--muted-foreground)]" />
              </button>
            </div>

            {/* Notificación */}
            {notification && (
              <div className={`mx-6 mt-4 p-3 rounded-lg border ${
                notification.type === 'success' ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200' :
                notification.type === 'error' ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200' :
                'bg-blue-50 border-blue-200 text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200'
              }`}>
                {notification.message}
              </div>
            )}

            {/* Contenido */}
            <div className="p-6 space-y-6">
              {/* Información del usuario */}
              <div className="bg-[var(--input-bg)] rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="font-semibold text-[var(--foreground)]">Información de Usuario</h3>
                </div>
                <div className="space-y-2 text-sm text-[var(--muted-foreground)]">
                  <div>👤 <span className="font-medium">Usuario:</span> {currentUser?.name}</div>
                  <div>🆔 <span className="font-medium">ID:</span> {currentUser?.id}</div>
                  <div>🛡️ <span className="font-medium">Estado:</span> {currentUser?.isActive ? 'Activo' : 'Inactivo'}</div>
                </div>
              </div>

              {/* Gestión de sesión */}
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-green-600" />
                  <h3 className="font-semibold text-[var(--foreground)]">Gestión de Sesión</h3>
                </div>

                {/* Botones de extensión rápida */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => handleExtendSession(1)}
                    className="p-3 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg transition-colors text-center"
                  >
                    <div className="text-blue-600 font-medium">+1 Hora</div>
                    <div className="text-xs text-blue-500">Extensión rápida</div>
                  </button>
                  
                  <button
                    onClick={() => handleExtendSession(2)}
                    className="p-3 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg transition-colors text-center"
                  >
                    <div className="text-green-600 font-medium">+2 Horas</div>
                    <div className="text-xs text-green-500">Extensión media</div>
                  </button>
                  
                  <button
                    onClick={() => handleExtendSession(5)}
                    className="p-3 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg transition-colors text-center"
                  >
                    <div className="text-orange-600 font-medium">+5 Horas</div>
                    <div className="text-xs text-orange-500">Extensión larga</div>
                  </button>
                  
                  <button
                    onClick={handleResetSession}
                    className="p-3 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors text-center"
                  >
                    <RefreshCw className="w-4 h-4 mx-auto mb-1 text-purple-600" />
                    <div className="text-xs text-purple-500">Reiniciar a 5h</div>
                  </button>
                </div>
              </div>

              {/* Detalles de sesión */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowSessionDetails(!showSessionDetails)}
                  className="flex items-center justify-between w-full p-3 bg-[var(--input-bg)] hover:bg-[var(--input-border)] rounded-lg transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-[var(--foreground)]">Detalles de Sesión</span>
                  </div>
                  {showSessionDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>

                {showSessionDetails && sessionInfo && (
                  <div className="bg-[var(--input-bg)] rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">🕐 Inicio de sesión:</span>
                      <span className="font-mono text-[var(--foreground)]">{sessionInfo.loginTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">⏰ Expira el:</span>
                      <span className="font-mono text-[var(--foreground)]">{sessionInfo.expiryTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">⏱️ Duración total:</span>
                      <span className="font-mono text-[var(--foreground)]">
                        {Math.round(sessionInfo.totalDuration / (1000 * 60 * 60 * 10)) / 10}h
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--muted-foreground)]">📊 Estado:</span>
                      <span className={`font-medium ${
                        sessionInfo.timeLeftMs > 30 * 60 * 1000 ? 'text-green-600' :
                        sessionInfo.timeLeftMs > 5 * 60 * 1000 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {sessionInfo.timeLeftMs > 30 * 60 * 1000 ? 'Normal' :
                         sessionInfo.timeLeftMs > 5 * 60 * 1000 ? 'Advertencia' : 'Crítico'}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Configuraciones adicionales */}
              <div className="space-y-3">
                <h3 className="font-semibold text-[var(--foreground)] flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Configuraciones
                </h3>
                
                <div className="bg-[var(--input-bg)] rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)]">Notificaciones de alerta</span>
                    <div className="w-11 h-6 bg-blue-600 rounded-full p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-white rounded-full shadow-md transform translate-x-5 transition-transform"></div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-[var(--muted-foreground)]">Contador flotante</span>
                    <div className="w-11 h-6 bg-blue-600 rounded-full p-1 cursor-pointer">
                      <div className="w-4 h-4 bg-white rounded-full shadow-md transform translate-x-5 transition-transform"></div>
                    </div>
                  </div>
                  
                  <div className="text-xs text-[var(--muted-foreground)] mt-2">
                    💡 Las configuraciones se guardan automáticamente
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[var(--border)] bg-[var(--input-bg)]">
              <div className="flex justify-between items-center">
                <div className="text-xs text-[var(--muted-foreground)]">
                  🔒 Configuración segura de backdoor
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
