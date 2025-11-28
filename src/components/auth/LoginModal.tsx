'use client';

import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { UsersService } from '@/services/users';
import type { User as UserType } from '@/types/firestore';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { PasswordRecoveryModal } from './PasswordRecoveryModal';


interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserType, keepActive?: boolean, useTokens?: boolean) => void; // Agregar parámetro para tokens
  onClose: () => void;
  title: string;
  canClose?: boolean; // Nueva prop para controlar si se puede cerrar
}

export default function LoginModal({ isOpen, onLoginSuccess, onClose, title, canClose = true }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSessionActive, setKeepSessionActive] = useState(false);
  const [useTokenAuth, setUseTokenAuth] = useState(false); // Nueva opción para tokens
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Use server-side login endpoint that validates credentials and returns user
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const respJson = await response.json();
      const isSuperAdmin = respJson.isSuperAdmin; // Extraer la bandera
      console.log('¿Es superadmin?:', isSuperAdmin);
      if (!response.ok || !respJson.ok) {
        setError(respJson?.error || 'Credenciales incorrectas');
        setLoading(false);
        return;
      }

      const safeUser = respJson.user;
      if (safeUser) {
        onLoginSuccess(safeUser as UserType, keepSessionActive, useTokenAuth);
        // Limpiar formulario
        setUsername('');
        setPassword('');
        setKeepSessionActive(false);
        setUseTokenAuth(false);
      } else {
        setError('Credenciales invalidas');
      }
    } catch (error) {
      console.error('Error during login:', error);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="w-full flex flex-col items-center justify-center min-h-screen"
    >

      {/* Login modal siempre por encima, z-20 */}
      <div className="w-full flex flex-col items-center justify-center pt-4 z-20 relative">
        <div className="bg-[var(--card-bg)] rounded-lg shadow-xl p-4 sm:p-6 w-full max-w-xs sm:max-w-md mx-2 sm:mx-4">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 mx-auto mb-4 text-blue-600" />
            <h2 className="text-2xl font-semibold mb-2">Iniciar Sesión</h2>
            <p className="text-[var(--tab-text)]">
              Acceso requerido para {title}
            </p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">
                Nombre de Usuario
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--input-bg)] text-[var(--foreground)]"
                  placeholder="Ingresa tu nombre de usuario"
                  required
                  disabled={loading}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--input-bg)] text-[var(--foreground)]"
                  placeholder="Ingresa tu contraseña"
                  required
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  disabled={loading}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>


            {/* Toggle para autenticación con tokens */}
            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={useTokenAuth}
                    onChange={(e) => {
                      setUseTokenAuth(e.target.checked);
                      if (e.target.checked) {
                        setKeepSessionActive(false); // Desactivar keepSessionActive si se activa tokens
                      }
                    }}
                    className="sr-only"
                    disabled={loading}
                  />
                  <div className={`block w-11 h-6 rounded-full transition-colors duration-200 ease-in-out ${useTokenAuth
                    ? 'bg-green-600 shadow-lg'
                    : 'bg-gray-300 dark:bg-gray-600'
                    } ${loading ? 'opacity-50' : 'group-hover:shadow-md'}`}>
                  </div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform duration-200 ease-in-out shadow-sm ${useTokenAuth ? 'translate-x-5' : 'translate-x-0'
                    }`}>
                  </div>
                </div>
                <div className="ml-3">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    🔐 Mantener sesión activa
                  </span>
                  <div className="text-xs text-[var(--muted-foreground)] mt-1">
                    Autenticación más segura con renovación automática
                  </div>
                </div>
              </label>
            </div>
            {error && (
              <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
                {error}
              </div>
            )}

            {/* Enlace de recuperación de contraseña */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => setShowRecoveryModal(true)}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
                disabled={loading}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>

            <div className={`flex gap-3 ${canClose ? '' : 'justify-center'}`}>
              {canClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  disabled={loading}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                className={`py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 ${canClose ? 'flex-1' : 'w-full'}`}
                disabled={loading}
              >
                {loading ? 'Verificando...' : 'Iniciar Sesión'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal de recuperación de contraseña */}
      <PasswordRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
      />
    </div>
  );
}
