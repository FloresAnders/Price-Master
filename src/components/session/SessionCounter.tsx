'use client';

import React, { useState, useEffect } from 'react';
import { Clock, X, Minimize2, Shield } from 'lucide-react';
import { formatSessionTimeLeft, isSessionValid } from '@/utils/session';
import { useAuth } from '../../hooks/useAuth';
import { TokenService } from '../../services/tokenService';

interface SessionCounterProps {
  onExpired?: () => void;
  onHide?: () => void;
}

export default function SessionCounter({ onExpired, onHide }: SessionCounterProps) {
  const { useTokenAuth, getFormattedTimeLeft, getSessionTimeLeft } = useAuth();
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: window?.innerWidth ? window.innerWidth - 240 : 20, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Cargar posición guardada
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedPosition = localStorage.getItem('session-counter-position');
      const savedMinimized = localStorage.getItem('session-counter-minimized');
      
      if (savedPosition) {
        try {
          const pos = JSON.parse(savedPosition);
          setPosition(pos);
        } catch {
          // Si hay error, usar posición por defecto
        }
      }
      
      if (savedMinimized === 'true') {
        setIsMinimized(true);
      }
    }
  }, []);

  // Guardar posición cuando cambie
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('session-counter-position', JSON.stringify(position));
    }
  }, [position]);

  // Guardar estado minimizado
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('session-counter-minimized', isMinimized.toString());
    }
  }, [isMinimized]);

  // Actualizar contador cada segundo
  useEffect(() => {
    const updateTimer = () => {
      let sessionValid = true;
      let formattedTime = '';

      if (useTokenAuth) {
        // Usar información del token
        const tokenInfo = TokenService.getTokenInfo();
        sessionValid = tokenInfo.isValid;
        formattedTime = getFormattedTimeLeft();
      } else {
        // Usar sesión tradicional
        sessionValid = isSessionValid();
        formattedTime = formatSessionTimeLeft();
      }

      if (!sessionValid) {
        setIsVisible(false);
        if (onExpired) {
          onExpired();
        }
        return;
      }

      setTimeLeft(formattedTime);
      setIsVisible(true);

      // Cambiar color cuando queda menos de 24 horas (para tokens) o 30 minutos (para sesiones tradicionales)
      const sessionTimeLeft = getSessionTimeLeft();
      const warningThreshold = useTokenAuth ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000; // 24 horas vs 30 minutos
      
      if (sessionTimeLeft <= warningThreshold && sessionTimeLeft > 0) {
        // Agregar clase de advertencia si queda poco tiempo
        const element = document.getElementById('session-counter');
        if (element) {
          element.classList.add('session-warning');
        }
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    
    return () => clearInterval(interval);
  }, [onExpired, useTokenAuth, getFormattedTimeLeft, getSessionTimeLeft]);

  // Manejo de arrastre
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMinimized) return;
    
    setIsDragging(true);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isVisible) return null;

  const sessionTimeLeft = getSessionTimeLeft();
  
  // Ajustar umbrales según el tipo de autenticación
  const warningThreshold = useTokenAuth ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000; // 24 horas vs 30 minutos
  const criticalThreshold = useTokenAuth ? 6 * 60 * 60 * 1000 : 5 * 60 * 1000; // 6 horas vs 5 minutos
  
  const isWarning = sessionTimeLeft <= warningThreshold && sessionTimeLeft > criticalThreshold;
  const isCritical = sessionTimeLeft <= criticalThreshold;

  return (
    <>
      {/* Estilos CSS */}
      <style jsx>{`
        .session-counter {
          position: fixed;
          z-index: 9999;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          user-select: none;
          cursor: ${isDragging ? 'grabbing' : isMinimized ? 'pointer' : 'grab'};
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          transform-origin: center;
        }
        
        .session-counter:hover {
          box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
          transform: translateY(-2px);
        }
        
        .session-counter.minimized {
          cursor: pointer;
          transform: scale(0.9);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
        }
        
        .session-counter.minimized:hover {
          transform: scale(1);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
        }
        
        .session-counter.warning {
          animation: pulse-warning 3s infinite ease-in-out;
        }
        
        .session-counter.critical {
          animation: pulse-critical 1.5s infinite ease-in-out;
        }
        
        @keyframes pulse-warning {
          0%, 100% { 
            transform: scale(1) translateY(0); 
            box-shadow: 0 8px 32px rgba(245, 158, 11, 0.2);
          }
          50% { 
            transform: scale(1.02) translateY(-1px); 
            box-shadow: 0 12px 40px rgba(245, 158, 11, 0.3);
          }
        }
        
        @keyframes pulse-critical {
          0%, 100% { 
            transform: scale(1) translateY(0); 
            box-shadow: 0 8px 32px rgba(239, 68, 68, 0.3);
          }
          50% { 
            transform: scale(1.05) translateY(-2px); 
            box-shadow: 0 16px 48px rgba(239, 68, 68, 0.4);
          }
        }
        
        .time-display {
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        
        .session-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          items-center: 
          justify-center;
          font-size: 10px;
          font-weight: bold;
          animation: badge-pulse 2s infinite;
        }
        
        @keyframes badge-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }
        
        .progress-ring {
          transition: stroke-dashoffset 0.35s;
          transform: rotate(-90deg);
          transform-origin: 50% 50%;
        }
      `}</style>

      <div
        id="session-counter"
        className={`session-counter ${isMinimized ? 'minimized' : ''} ${isWarning ? 'warning' : ''} ${isCritical ? 'critical' : ''}`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          background: isCritical 
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.95), rgba(220, 38, 38, 0.95))'
            : isWarning 
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.95), rgba(217, 119, 6, 0.95))'
              : 'linear-gradient(135deg, rgba(59, 130, 246, 0.95), rgba(37, 99, 235, 0.95))',
          borderRadius: isMinimized ? '50%' : '16px',
          padding: isMinimized ? '12px' : '16px 20px',
          color: 'white',
          fontSize: isMinimized ? '14px' : '15px',
          fontWeight: '600',
          minWidth: isMinimized ? 'auto' : '240px',
          border: `2px solid ${isCritical ? 'rgba(255, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)'}`,
          boxShadow: isCritical 
            ? '0 8px 32px rgba(239, 68, 68, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : isWarning
              ? '0 8px 32px rgba(245, 158, 11, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
              : '0 8px 32px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
        }}
        onMouseDown={handleMouseDown}
      >
        {/* Badge indicador de estado */}
        {!isMinimized && (
          <div 
            className="session-badge"
            style={{
              background: isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#10b981',
              color: 'white'
            }}
          >
            {isCritical ? '!' : isWarning ? '⚠' : '✓'}
          </div>
        )}

        {isMinimized ? (
          <div 
            className="flex items-center justify-center w-10 h-10"
            onClick={() => setIsMinimized(false)}
          >
            {useTokenAuth ? <Shield className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                {useTokenAuth ? (
                  <Shield className={`w-5 h-5 ${isCritical ? 'animate-bounce' : ''}`} />
                ) : (
                  <Clock className={`w-5 h-5 ${isCritical ? 'animate-bounce' : ''}`} />
                )}
              </div>
              <div>
                <div className="text-xs opacity-90 font-medium tracking-wide">
                  {useTokenAuth ? (
                    isCritical ? 'TOKEN CRÍTICO' : isWarning ? 'Token expirando' : 'Token activo'
                  ) : (
                    isCritical ? 'SESIÓN CRÍTICA' : isWarning ? 'Sesión terminando' : 'Sesión activa'
                  )}
                </div>
                <div className={`time-display text-lg leading-tight ${isCritical ? 'animate-pulse' : ''}`}>
                  {timeLeft}
                </div>
                {!isMinimized && (
                  <div className="text-xs opacity-75 mt-1">
                    {useTokenAuth ? (
                      isCritical ? 'Se renovará automáticamente' : isWarning ? 'Renovación próxima' : '7 días de duración'
                    ) : (
                      isCritical ? 'Guarda tu trabajo' : isWarning ? 'Considera renovar' : '5h máximo'
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex flex-col gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMinimized(true);
                }}
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors duration-200"
                title="Minimizar contador"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsVisible(false);
                  if (onHide) onHide();
                }}
                className="p-1.5 hover:bg-white/20 rounded-md transition-colors duration-200"
                title="Ocultar contador"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
