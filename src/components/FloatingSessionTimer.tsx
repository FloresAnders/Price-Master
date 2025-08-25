'use client';

import React, { useState, useEffect } from 'react';
import { Clock, X, EyeOff, Key, Timer } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { TokenService } from '../services/tokenService';

interface TokenInfo {
  isValid: boolean;
  timeLeft: number;
  sessionId?: string | null;
  expiresAt?: Date | string | number | null;
}

interface FloatingSessionTimerProps {
  visible: boolean;
  onToggleVisibility: () => void;
}

export default function FloatingSessionTimer({ visible, onToggleVisibility }: FloatingSessionTimerProps) {
  const { 
    user, 
    useTokenAuth, 
    getFormattedTimeLeft, 
    getSessionTimeLeft 
  } = useAuth();

  const [timeLeft, setTimeLeft] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [timeInMs, setTimeInMs] = useState(0);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);

  // Actualizar tiempo cada segundo
  useEffect(() => {
    if (!visible) return;

    const updateTimer = () => {
      const formattedTime = getFormattedTimeLeft();
      setTimeLeft(formattedTime);
      
      const sessionTime = getSessionTimeLeft();
      if (useTokenAuth) {
        const info = TokenService.getTokenInfo();
        setTokenInfo(info);
        setTimeInMs(info.timeLeft);
      } else {
        setTimeInMs(sessionTime * 60 * 60 * 1000); // Convertir horas a ms
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [visible, getFormattedTimeLeft, getSessionTimeLeft, useTokenAuth]);

  const getTimerColor = () => {
    const hours = timeInMs / (1000 * 60 * 60);
    
    if (hours < 0.5) return 'bg-red-600 border-red-500'; // Menos de 30 minutos
    if (hours < 2) return 'bg-yellow-600 border-yellow-500'; // Menos de 2 horas
    if (hours < 24) return 'bg-orange-600 border-orange-500'; // Menos de 1 día
    return 'bg-green-600 border-green-500'; // Más de 1 día
  };

  const getProgressPercentage = () => {
    if (!useTokenAuth) {
      // Para sesiones tradicionales, usar estimación basada en el rol
      const maxHours = user?.role === 'superadmin' ? 4 : user?.role === 'admin' ? 24 : 720;
      const currentHours = timeInMs / (1000 * 60 * 60);
      return Math.max(0, Math.min(100, (currentHours / maxHours) * 100));
    } else {
      // Para tokens, usar 7 días como máximo (duración estándar)
      const maxMs = 7 * 24 * 60 * 60 * 1000;
      return Math.max(0, Math.min(100, (timeInMs / maxMs) * 100));
    }
  };

  const formatDetailedTime = () => {
    const totalSeconds = Math.floor(timeInMs / 1000);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const days = Math.floor(totalHours / 24);
    
    const hours = totalHours % 24;
    const minutes = totalMinutes % 60;
    const seconds = totalSeconds % 60;

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  };

  if (!visible || !user) return null;

  return (
    <div className="fixed bottom-20 right-4 z-40">
      {/* Timer compacto */}
      {!isExpanded && (
        <div
          className={`${getTimerColor()} text-white p-3 rounded-lg shadow-lg border-2 cursor-pointer hover:scale-105 transition-transform`}
          onClick={() => setIsExpanded(true)}
        >
          <div className="flex items-center gap-2">
            {useTokenAuth ? <Key className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
            <span className="font-mono text-sm font-bold">{timeLeft}</span>
          </div>
        </div>
      )}

      {/* Timer expandido */}
      {isExpanded && (
        <div className={`${getTimerColor()} text-white rounded-lg shadow-lg border-2 p-4 min-w-72`}>
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {useTokenAuth ? <Key className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              <span className="font-semibold text-sm">
                {useTokenAuth ? 'Token' : 'Sesión'}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={onToggleVisibility}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Ocultar timer"
              >
                <EyeOff className="w-3 h-3" />
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Minimizar"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Usuario */}
          <div className="mb-3">
            <div className="text-xs opacity-80">Usuario:</div>
            <div className="font-semibold text-sm">{user.name}</div>
            <div className="text-xs opacity-80">
              {user.role?.toUpperCase()} - {user.location}
            </div>
          </div>

          {/* Tiempo restante */}
          <div className="mb-3">
            <div className="text-xs opacity-80">Tiempo restante:</div>
            <div className="font-mono text-lg font-bold">{formatDetailedTime()}</div>
          </div>

          {/* Barra de progreso */}
          <div className="mb-3">
            <div className="w-full bg-white bg-opacity-30 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-1000"
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>
            <div className="text-xs opacity-80 mt-1">
              {getProgressPercentage().toFixed(1)}% restante
            </div>
          </div>

          {/* Información adicional para tokens */}
          {useTokenAuth && tokenInfo && (
            <div className="border-t border-white border-opacity-30 pt-3">
              <div className="text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="opacity-80">Válido:</span>
                  <span className={tokenInfo.isValid ? 'text-green-200' : 'text-red-200'}>
                    {tokenInfo.isValid ? 'Sí' : 'No'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="opacity-80">Sesión ID:</span>
                  <span className="font-mono text-xs">
                    {tokenInfo.sessionId?.slice(-8) || 'N/A'}
                  </span>
                </div>
                {tokenInfo.expiresAt && (
                  <div className="flex justify-between">
                    <span className="opacity-80">Expira:</span>
                    <span className="text-xs">
                      {new Date(tokenInfo.expiresAt).toLocaleTimeString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Acciones rápidas */}
          <div className="border-t border-white border-opacity-30 pt-3 mt-3">
            <div className="flex gap-2">
              <button
                onClick={() => setIsExpanded(false)}
                className="w-full bg-white bg-opacity-20 hover:bg-opacity-30 text-white text-xs py-2 px-3 rounded transition-colors flex items-center justify-center gap-1"
                title="Minimizar"
              >
                <Timer className="w-3 h-3" />
                Minimizar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
