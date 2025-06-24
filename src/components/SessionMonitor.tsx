// src/components/SessionMonitor.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Clock, AlertTriangle, Eye, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface AuditLog {
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId: string;
}

interface SessionMonitorProps {
  showAuditLogs?: boolean;
}

export default function SessionMonitor({ showAuditLogs = false }: SessionMonitorProps) {
  const { 
    user, 
    sessionWarning, 
    extendSession, 
    getSessionTimeLeft, 
    getAuditLogs, 
    isSuperAdmin 
  } = useAuth();
  
  const [timeLeft, setTimeLeft] = useState(0);
  const [showLogs, setShowLogs] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Actualizar tiempo restante cada minuto
  useEffect(() => {
    const updateTimer = () => {
      setTimeLeft(getSessionTimeLeft());
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Cada minuto

    return () => clearInterval(interval);
  }, [getSessionTimeLeft]);

  // Cargar logs de auditoría para SuperAdmin
  useEffect(() => {
    if (isSuperAdmin() && showAuditLogs) {
      setAuditLogs(getAuditLogs());
    }
  }, [isSuperAdmin, showAuditLogs, getAuditLogs]);

  const formatTimeLeft = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes}m`;
    }
    if (hours < 24) {
      return `${Math.floor(hours)}h ${Math.floor((hours % 1) * 60)}m`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = Math.floor(hours % 24);
    return `${days}d ${remainingHours}h`;
  };

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'superadmin': return 'text-red-600 bg-red-100';
      case 'admin': return 'text-orange-600 bg-orange-100';
      case 'user': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Advertencia de sesión */}
      {sessionWarning && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-pulse">
          <AlertTriangle className="w-5 h-5" />
          <span className="font-medium">
            Su sesión expirará pronto. ¿Desea extenderla?
          </span>
          <button
            onClick={extendSession}
            className="bg-white text-yellow-500 px-3 py-1 rounded text-sm font-medium hover:bg-gray-100 transition-colors"
          >
            Extender
          </button>
        </div>
      )}

      {/* Monitor de sesión para SuperAdmin */}
      {isSuperAdmin() && (
        <div className="fixed bottom-4 right-4 z-40 bg-red-900 text-white p-3 rounded-lg shadow-lg border-2 border-red-600">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold">SUPERADMIN MONITOR</span>
          </div>
          <div className="text-xs space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>Sesión: {formatTimeLeft(timeLeft)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleColor(user.role)}`}>
                {user.role?.toUpperCase()}
              </span>
            </div>
            {showAuditLogs && (
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center gap-1 text-xs bg-red-700 hover:bg-red-600 px-2 py-1 rounded transition-colors w-full justify-center"
              >
                <Eye className="w-3 h-3" />
                {showLogs ? 'Ocultar' : 'Ver'} Logs
              </button>
            )}
          </div>
        </div>
      )}

      {/* Panel de logs de auditoría */}
      {showLogs && isSuperAdmin() && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-red-600" />
                <h3 className="text-lg font-semibold">Logs de Auditoría</h3>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-xs font-medium">
                  CONFIDENCIAL
                </span>
              </div>
              <button
                onClick={() => setShowLogs(false)}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-4 max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {auditLogs.slice(-50).reverse().map((log, index) => (
                  <div key={index} className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-blue-600 dark:text-blue-400">
                        {log.action}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(log.timestamp).toLocaleString('es-CR')}
                      </span>
                    </div>
                    <div className="text-gray-700 dark:text-gray-300 mb-1">
                      <strong>Usuario:</strong> {log.userName} ({log.userId})
                    </div>
                    <div className="text-gray-600 dark:text-gray-400 text-xs">
                      {log.details}
                    </div>
                    {log.sessionId && (
                      <div className="text-gray-500 text-xs mt-1">
                        <strong>Sesión:</strong> {log.sessionId.slice(-8)}
                      </div>
                    )}
                  </div>
                ))}
                
                {auditLogs.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay logs de auditoría disponibles
                  </div>
                )}
              </div>
            </div>
            
            <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
              <div className="flex justify-between items-center text-xs text-gray-600 dark:text-gray-400">
                <span>Mostrando los últimos 50 eventos</span>
                <span>Total de logs: {auditLogs.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Indicador de estado de sesión para todos los usuarios */}
      {user && user.role !== 'superadmin' && (
        <div className="fixed bottom-4 right-4 z-40 bg-gray-800 text-white p-2 rounded-lg shadow-lg text-xs">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${timeLeft > 1 ? 'bg-green-400' : 'bg-yellow-400'}`}></div>
            <span>{formatTimeLeft(timeLeft)}</span>
          </div>
        </div>
      )}
    </>
  );
}
