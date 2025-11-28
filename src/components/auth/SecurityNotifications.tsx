// src/components/SecurityNotifications.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle, Bell, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface SecurityNotification {
  id: string;
  type: 'warning' | 'error' | 'success' | 'info';
  title: string;
  message: string;
  timestamp: string;
  actions?: {
    label: string;
    action: () => void;
    type: 'primary' | 'secondary' | 'danger';
  }[];
  persistent?: boolean;
  requiresSuperAdmin?: boolean;
}

export default function SecurityNotifications() {
  const { user, isSuperAdmin, logout } = useAuth();
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Generar notificaciones basadas en eventos de seguridad
  useEffect(() => {
    const checkSecurityEvents = () => {
      const newNotifications: SecurityNotification[] = [];

      // Verificar múltiples sesiones (simulado)
      if (isSuperAdmin()) {
        const sessionCount = Math.floor(Math.random() * 3) + 1;
        if (sessionCount > 1) {
          newNotifications.push({
            id: `multi_session_${Date.now()}`,
            type: 'warning',
            title: 'Múltiples Sesiones Detectadas',
            message: `Se detectaron ${sessionCount} sesiones activas para tu cuenta SuperAdmin. Si no reconoces esta actividad, cierra sesión inmediatamente.`,
            timestamp: new Date().toISOString(),
            actions: [
              {
                label: 'Cerrar Todas las Sesiones',
                action: () => logout('security_multiple_sessions'),
                type: 'danger'
              }
            ],
            persistent: true,
            requiresSuperAdmin: true
          });
        }

        // Verificar acceso desde nueva ubicación (simulado)
        const newLocation = Math.random() > 0.8;
        if (newLocation) {
          newNotifications.push({
            id: `new_location_${Date.now()}`,
            type: 'info',
            title: 'Acceso desde Nueva Ubicación',
            message: 'Se detectó un acceso desde una nueva ubicación geográfica. Si fuiste tú, puedes ignorar este mensaje.',
            timestamp: new Date().toISOString(),
            actions: [
              {
                label: 'No Fui Yo',
                action: () => logout('security_unknown_location'),
                type: 'danger'
              },
              {
                label: 'Confirmar',
                action: () => dismissNotification(`new_location_${Date.now()}`),
                type: 'primary'
              }
            ],
            requiresSuperAdmin: true
          });
        }

        // Verificar intentos de acceso fallidos
        const failedAttempts = Math.floor(Math.random() * 5);
        if (failedAttempts > 2) {
          newNotifications.push({
            id: `failed_attempts_${Date.now()}`,
            type: 'error',
            title: 'Intentos de Acceso Fallidos',
            message: `Se detectaron ${failedAttempts} intentos fallidos de acceso a tu cuenta en la última hora.`,
            timestamp: new Date().toISOString(),
            actions: [
              {
                label: 'Revisar Logs',
                action: () => {/* Abrir logs */ },
                type: 'secondary'
              },
              {
                label: 'Cambiar Contraseña',
                action: () => {/* Abrir cambio de contraseña */ },
                type: 'primary'
              }
            ],
            persistent: true,
            requiresSuperAdmin: true
          });
        }
      }

      // Notificación de sesión próxima a expirar para todos los usuarios
      const sessionWarning = Math.random() > 0.9;
      if (sessionWarning && user) {
        newNotifications.push({
          id: `session_expiry_${Date.now()}`,
          type: 'warning',
          title: 'Sesión Próxima a Expirar',
          message: 'Tu sesión expirará en 10 minutos. Guarda tu trabajo.',
          timestamp: new Date().toISOString(),
          actions: [
            {
              label: 'Extender Sesión',
              action: () => {/* Extender sesión */ },
              type: 'primary'
            }
          ]
        });
      }

      setNotifications(prev => [...prev, ...newNotifications]);
    };

    // Verificar eventos de seguridad cada 30 segundos para SuperAdmin
    if (isSuperAdmin()) {
      checkSecurityEvents();
      const interval = setInterval(checkSecurityEvents, 30000);
      return () => clearInterval(interval);
    }

    // Para usuarios normales, verificar cada 5 minutos
    if (user) {
      const interval = setInterval(checkSecurityEvents, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user, isSuperAdmin, logout]);

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const getIcon = (type: SecurityNotification['type']) => {
    switch (type) {
      case 'warning': return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'success': return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'info': return <Shield className="w-5 h-5 text-blue-600" />;
      default: return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getBackgroundColor = (type: SecurityNotification['type']) => {
    switch (type) {
      case 'warning': return 'bg-yellow-50 border-yellow-200';
      case 'error': return 'bg-red-50 border-red-200';
      case 'success': return 'bg-green-50 border-green-200';
      case 'info': return 'bg-blue-50 border-blue-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  // Filtrar notificaciones según el rol del usuario
  const visibleNotifications = notifications.filter(notification =>
    !notification.requiresSuperAdmin || isSuperAdmin()
  );

  const persistentNotifications = visibleNotifications.filter(n => n.persistent);
  const unreadCount = visibleNotifications.length;

  return (
    <>
      {/* Notificaciones persistentes */}
      {persistentNotifications.map((notification) => (
        <div
          key={notification.id}
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-md w-full mx-4 ${getBackgroundColor(notification.type)} border rounded-lg shadow-lg p-4 animate-slide-down`}
        >
          <div className="flex items-start gap-3">
            {getIcon(notification.type)}
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900 text-sm">{notification.title}</h4>
              <p className="text-gray-700 text-xs mt-1">{notification.message}</p>
              <div className="flex gap-2 mt-3">
                {notification.actions?.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.action}
                    className={`px-3 py-1 text-xs rounded font-medium transition-colors ${action.type === 'primary' ? 'bg-blue-600 text-white hover:bg-blue-700' :
                      action.type === 'danger' ? 'bg-red-600 text-white hover:bg-red-700' :
                        'bg-gray-200 text-gray-800 hover:bg-gray-300'
                      }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}

      {/* Indicador de notificaciones */}
      {unreadCount > 0 && (
        <button
          onClick={() => setShowNotifications(!showNotifications)}
          className="fixed top-4 right-4 z-40 bg-red-600 text-white p-3 rounded-full shadow-lg hover:bg-red-700 transition-colors"
        >
          <div className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-yellow-400 text-red-900 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
        </button>
      )}

      {/* Panel de notificaciones */}
      {showNotifications && (
        <div className="fixed top-16 right-4 z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl w-96 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Alertas de Seguridad
              </h3>
              <button
                onClick={() => setShowNotifications(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {visibleNotifications.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <Shield className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">No hay alertas de seguridad</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {visibleNotifications.map((notification) => (
                  <div key={notification.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <div className="flex items-start gap-3">
                      {getIcon(notification.type)}
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm">
                          {notification.title}
                        </h4>
                        <p className="text-gray-600 dark:text-gray-300 text-xs mt-1">
                          {notification.message}
                        </p>
                        <p className="text-gray-400 text-xs mt-2">
                          {new Date(notification.timestamp).toLocaleString('es-CR')}
                        </p>
                        {notification.actions && (
                          <div className="flex gap-2 mt-2">
                            {notification.actions.map((action, index) => (
                              <button
                                key={index}
                                onClick={action.action}
                                className={`px-2 py-1 text-xs rounded transition-colors ${action.type === 'primary' ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' :
                                  action.type === 'danger' ? 'bg-red-100 text-red-800 hover:bg-red-200' :
                                    'bg-gray-100 text-gray-800 hover:bg-gray-200'
                                  }`}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => dismissNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600 flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
