// src/components/TokenInfo.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, RefreshCw, Eye, EyeOff, Clock, CheckCircle2, AlertTriangle, Plus, Calendar, Timer } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { TokenService } from '../../services/tokenService';
import type { User } from '../../types/firestore';

interface TokenInfoProps {
  isOpen: boolean;
  onClose: () => void;
  inline?: boolean;
}

interface TokenInfoData {
  isValid: boolean;
  timeLeft: number;
  user: User | null;
  sessionId: string | null;
  expiresAt: Date | null;
  type?: string;
}

export default function TokenInfo({ isOpen, onClose, inline = false }: TokenInfoProps) {
  const { user, useTokenAuth, getFormattedTimeLeft } = useAuth();
  const [showDetails, setShowDetails] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<TokenInfoData | null>(null);
  const [extending, setExtending] = useState(false);
  const [showExtensionControls, setShowExtensionControls] = useState(false);
  const [extensionAmount, setExtensionAmount] = useState(1);
  const [extensionUnit, setExtensionUnit] = useState<'hours' | 'days' | 'weeks'>('days');

  useEffect(() => {
    if (isOpen && useTokenAuth) {
      const info = TokenService.getTokenInfo();
      setTokenInfo(info);
    }
  }, [isOpen, useTokenAuth]);

  const handleExtendToken = async () => {
    setExtending(true);
    try {
      const success = TokenService.extendToken();
      if (success) {
        const info = TokenService.getTokenInfo();
        setTokenInfo(info);
      }
    } catch (error) {
      console.error('Error extending token:', error);
    } finally {
      setExtending(false);
    }
  };

  const handleCustomExtension = async () => {
    setExtending(true);
    try {
      // Convertir la extensión a milisegundos
      let extensionMs = 0;
      switch (extensionUnit) {
        case 'hours':
          extensionMs = extensionAmount * 60 * 60 * 1000;
          break;
        case 'days':
          extensionMs = extensionAmount * 24 * 60 * 60 * 1000;
          break;
        case 'weeks':
          extensionMs = extensionAmount * 7 * 24 * 60 * 60 * 1000;
          break;
      }

      // Aquí usamos la nueva función extendTokenCustom
      const success = TokenService.extendTokenCustom(extensionMs);

      if (success) {
        const info = TokenService.getTokenInfo();
        setTokenInfo(info);
        setShowExtensionControls(false);
      }
    } catch (error) {
      console.error('Error extending token:', error);
    } finally {
      setExtending(false);
    }
  };

  if (!isOpen || !useTokenAuth) return null;

  const timeLeft = tokenInfo?.timeLeft || 0;
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const daysLeft = Math.floor(hoursLeft / 24);

  const isWarning = timeLeft <= 24 * 60 * 60 * 1000;
  const isCritical = timeLeft <= 6 * 60 * 60 * 1000;

  const TokenContent = () => (
    <>
      <div className={`p-4 rounded-lg mb-4 ${isCritical
          ? 'bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800'
          : isWarning
            ? 'bg-yellow-50 border border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            : 'bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-800'
        }`}>
        <div className="flex items-center gap-3 mb-2">
          {isCritical ? (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          ) : isWarning ? (
            <Clock className="w-5 h-5 text-yellow-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          )}
          <span className={`font-medium ${isCritical ? 'text-red-800 dark:text-red-200' :
              isWarning ? 'text-yellow-800 dark:text-yellow-200' :
                'text-green-800 dark:text-green-200'
            }`}>
            {isCritical ? 'Token por expirar' : isWarning ? 'Token expirando pronto' : 'Token activo'}
          </span>
        </div>

        <div className="text-2xl font-mono font-bold mb-1">
          {getFormattedTimeLeft()}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {daysLeft > 0 ? `${daysLeft} dias restantes` : `${hoursLeft} horas restantes`}
        </div>
      </div>

      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
        <h3 className="font-medium text-gray-900 dark:text-white mb-3">Usuario Autenticado</h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Nombre:</span>
            <span className="font-medium text-gray-900 dark:text-white">{user?.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Rol:</span>
            <span className="font-medium text-gray-900 dark:text-white">{user?.role}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Empresa asignada:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {user?.ownercompanie || 'No especificada'}
            </span>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <button
          onClick={() => setShowDetails(!showDetails)}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors text-sm"
        >
          {showDetails ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {showDetails ? 'Ocultar' : 'Mostrar'} detalles tecnicos
        </button>

        {showDetails && tokenInfo && (
          <div className="mt-3 bg-gray-100 dark:bg-gray-800 rounded-lg p-3 text-xs font-mono">
            <div className="grid grid-cols-1 gap-2">
              <div>
                <span className="text-gray-600 dark:text-gray-400">ID de Sesion:</span>
                <div className="text-gray-900 dark:text-white break-all">{tokenInfo.sessionId}</div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Expira:</span>
                <div className="text-gray-900 dark:text-white">{tokenInfo.expiresAt?.toLocaleString() || 'N/A'}</div>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Tipo:</span>
                <div className="text-green-600 dark:text-green-400">{tokenInfo.type || 'Token'}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Custom Extension Controls */}
      <div className="mb-4">
        <button
          onClick={() => setShowExtensionControls(!showExtensionControls)}
          className="flex items-center gap-2 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          {showExtensionControls ? 'Ocultar' : 'Mostrar'} extensión personalizada
        </button>

        {showExtensionControls && (
          <div className="mt-3 bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
            <h4 className="text-sm font-medium text-green-800 dark:text-green-200 mb-3 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Extender Token - Duración Personalizada
            </h4>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs text-green-700 dark:text-green-300 mb-1">
                  Cantidad
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={extensionAmount}
                  onChange={(e) => setExtensionAmount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 text-sm border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                />
              </div>

              <div>
                <label className="block text-xs text-green-700 dark:text-green-300 mb-1">
                  Unidad
                </label>
                <select
                  value={extensionUnit}
                  onChange={(e) => setExtensionUnit(e.target.value as 'hours' | 'days' | 'weeks')}
                  className="w-full px-3 py-2 text-sm border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
                >
                  <option value="hours">Horas</option>
                  <option value="days">Días</option>
                  <option value="weeks">Semanas</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-green-700 dark:text-green-300 mb-3">
              <Timer className="w-3 h-3" />
              <span>
                Tiempo a agregar: {extensionAmount} {
                  extensionUnit === 'hours' ? 'hora(s)' :
                    extensionUnit === 'days' ? 'día(s)' : 'semana(s)'
                }
              </span>
            </div>

            <button
              onClick={handleCustomExtension}
              disabled={extending}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              <Plus className={`w-4 h-4 ${extending ? 'animate-spin' : ''}`} />
              {extending ? 'Extendiendo...' : `Extender ${extensionAmount} ${extensionUnit === 'hours' ? 'hora(s)' :
                  extensionUnit === 'days' ? 'día(s)' : 'semana(s)'
                }`}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleExtendToken}
          disabled={extending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${extending ? 'animate-spin' : ''}`} />
          {extending ? 'Renovando...' : 'Renovar Token (7 dias mas)'}
        </button>
        {!inline && (
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-400 dark:hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
          Ventajas de los Tokens
        </h4>
        <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <li>• Duracion de 7 dias automatica</li>
          <li>• Renovacion automatica al acercarse a la expiracion</li>
          <li>• Mayor seguridad con cifrado</li>
          <li>• No requiere actividad constante del usuario</li>
        </ul>
      </div>
    </>
  );

  if (inline) {
    return <TokenContent />;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Informacion del Token
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <TokenContent />
      </div>
    </div>
  );
}