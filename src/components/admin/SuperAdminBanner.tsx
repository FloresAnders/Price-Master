// src/components/SuperAdminBanner.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Eye, Clock, AlertTriangle, X, Lock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function SuperAdminBanner() {
  const { isSuperAdmin, user, sessionWarning, getSessionTimeLeft } = useAuth();
  const [isVisible, setIsVisible] = useState(true);
  const [sessionTime, setSessionTime] = useState(0);

  // Actualizar tiempo de sesión cada 30 segundos
  useEffect(() => {
    if (isSuperAdmin()) {
      const updateTime = () => setSessionTime(getSessionTimeLeft());
      updateTime();
      const interval = setInterval(updateTime, 30000);
      return () => clearInterval(interval);
    }
  }, [isSuperAdmin, getSessionTimeLeft]);

  // Solo mostrar para SuperAdmin
  if (!isSuperAdmin() || !isVisible) return null;

  const formatTimeLeft = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes}m`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours % 1) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const getTimeColor = (hours: number) => {
    if (hours < 0.5) return 'text-red-400'; // Menos de 30 minutos
    if (hours < 1) return 'text-yellow-400'; // Menos de 1 hora
    return 'text-green-400'; // Más de 1 hora
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-red-800 to-red-900 text-white shadow-lg border-b-2 border-red-600">
      <div className="max-w-full mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          {/* Información principal */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-red-300" />
              <span className="font-bold text-sm">MODO SUPERADMIN ACTIVO</span>
            </div>
            
            <div className="hidden sm:flex items-center gap-1 text-xs">
              <Eye className="w-4 h-4 text-red-300" />
              <span>Sesión monitoreada</span>
            </div>
            
            <div className="flex items-center gap-1 text-xs">
              <span className="text-red-300">Usuario:</span>
              <span className="font-medium">{user?.name}</span>
            </div>
          </div>

          {/* Información de tiempo y controles */}
          <div className="flex items-center gap-4">
            {/* Advertencia de sesión */}
            {sessionWarning && (
              <div className="flex items-center gap-1 bg-yellow-600 px-2 py-1 rounded text-xs font-medium animate-pulse">
                <AlertTriangle className="w-3 h-3" />
                <span>¡Sesión por expirar!</span>
              </div>
            )}
            
            {/* Timer de sesión */}
            <div className="flex items-center gap-1 text-xs">
              <Clock className="w-4 h-4 text-red-300" />
              <span className="text-red-300">Tiempo:</span>
              <span className={`font-mono font-bold ${getTimeColor(sessionTime)}`}>
                {formatTimeLeft(sessionTime)}
              </span>
            </div>

            {/* Nivel de seguridad */}
            <div className="hidden md:flex items-center gap-1 bg-red-700 px-2 py-1 rounded text-xs font-bold">
              <Lock className="w-3 h-3" />
              <span>ALTA SEGURIDAD</span>
            </div>

            {/* Botón cerrar */}
            <button
              onClick={() => setIsVisible(false)}
              className="text-red-300 hover:text-white transition-colors p-1"
              title="Ocultar banner (permanece activo)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra de progreso de tiempo */}
        <div className="mt-1 h-1 bg-red-700 rounded-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-1000 ${
              sessionTime < 0.5 ? 'bg-red-400' : 
              sessionTime < 1 ? 'bg-yellow-400' : 
              'bg-green-400'
            }`}
            style={{ 
              width: `${Math.max(0, Math.min(100, (sessionTime / 4) * 100))}%` 
            }}
          />
        </div>

        {/* Información adicional (solo visible en pantallas grandes) */}
        <div className="hidden lg:block mt-1 text-xs text-red-200">
          <div className="flex items-center justify-between">
            <span>
              🔒 Todas las acciones son registradas • 
              📊 Logs de auditoría activos • 
              ⏰ Logout automático por inactividad (30 min)
            </span>
            <span className="font-mono">
              ID: {localStorage.getItem('pricemaster_session_id')?.slice(-8)}
            </span>
          </div>
        </div>
      </div>

      {/* Indicador visual de parpadeo para alertas críticas */}
      {sessionTime < 0.5 && (
        <div className="absolute inset-0 bg-red-500 opacity-20 animate-pulse pointer-events-none" />
      )}
    </div>
  );
}
