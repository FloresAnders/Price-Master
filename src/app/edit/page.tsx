// app/edit/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Lock, Eye, AlertTriangle, User, Clock } from 'lucide-react';
import DataEditor from '@/edit/DataEditor';
import LoginModal from '@/components/LoginModal';
import { useAuth } from '@/hooks/useAuth';
import type { User as FirestoreUser } from '@/types/firestore';

export default function EditPage() {
  const {
    user,
    isAuthenticated,
    isSuperAdmin,
    login,
    loading,
    sessionWarning,
    getSessionTimeLeft
  } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [sessionTime, setSessionTime] = useState(0);
  
  // Actualizar tiempo de sesión cada minuto
  useEffect(() => {
    if (isAuthenticated && isSuperAdmin()) {
      const updateTime = () => setSessionTime(getSessionTimeLeft());
      updateTime();
      const interval = setInterval(updateTime, 60000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, getSessionTimeLeft, isSuperAdmin]);
  
  // Log de acceso a la ruta protegida
  useEffect(() => {
    if (isAuthenticated && user) {
      // Crear log de acceso al editor
      const auditLog = {
        timestamp: new Date().toISOString(),
        userId: user?.id || 'unknown',
        userName: user?.name || 'Unknown',
        action: isSuperAdmin() ? 'EDITOR_ACCESS_GRANTED' : 'EDITOR_ACCESS_DENIED',
        details: `User attempted to access data editor with role: ${user?.role}`,
        sessionId: localStorage.getItem('pricemaster_session_id') || '',
        userAgent: navigator.userAgent
      };

      const existingLogs = JSON.parse(localStorage.getItem('pricemaster_audit_logs') || '[]');
      existingLogs.push(auditLog);

      if (existingLogs.length > 100) {
        existingLogs.shift();
      }

      localStorage.setItem('pricemaster_audit_logs', JSON.stringify(existingLogs));

      // Console log para SuperAdmin
      if (isSuperAdmin()) {
        console.log('🔐 SUPERADMIN EDITOR ACCESS:', auditLog);
      } else {
        console.warn('🚫 UNAUTHORIZED EDITOR ACCESS ATTEMPT:', auditLog);
      }    }
  }, [isAuthenticated, user, isSuperAdmin]);

  // Función para manejar login exitoso
  const handleLoginSuccess = (userData: FirestoreUser) => {
    login(userData);
    setShowLoginModal(false);
  };

  // Formatear tiempo restante
  const formatTimeLeft = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.floor(hours * 60);
      return `${minutes} minutos`;
    }
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours % 1) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  // Estado de carga
  if (loading) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <div className="relative flex items-center justify-center mb-4">
            <svg className="animate-spin w-12 h-12 text-blue-600" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="24" cy="24" r="22" stroke="currentColor" strokeWidth="4" opacity="0.2" />
              <line x1="24" y1="24" x2="24" y2="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              <line x1="24" y1="24" x2="36" y2="24" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <div className="text-lg flex items-center">
            Verificando permisos de acceso...
          </div>
        </div>
      </main>
    );
  }
  // Usuario no autenticado
  if (!isAuthenticated) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto bg-[var(--card)] border-2 border-red-200 dark:border-red-800 rounded-xl shadow-lg p-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Shield className="w-20 h-20 text-red-600" />
                <Lock className="w-8 h-8 text-red-800 absolute -bottom-1 -right-1 bg-[var(--background)] rounded-full p-1" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-red-900 dark:text-red-400 mb-4">
              🔒 Editor de Datos - Acceso Restringido
            </h1>

            <div className="bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="font-semibold text-yellow-800 dark:text-yellow-300">Zona de Alta Seguridad</span>
              </div>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                El Editor de Datos contiene información sensible y requiere autenticación SuperAdmin
              </p>
            </div>

            <p className="text-[var(--muted-foreground)] mb-8 leading-relaxed">
              Para acceder a esta funcionalidad necesitas:
            </p>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="flex items-center gap-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <User className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-red-900 dark:text-red-300">Rol SuperAdmin</div>
                    <div className="text-xs text-red-600 dark:text-red-400">Nivel de acceso máximo</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Eye className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                  <div>
                    <div className="font-semibold text-blue-900 dark:text-blue-300">Credenciales Válidas</div>
                    <div className="text-xs text-blue-600 dark:text-blue-400">Usuario y contraseña</div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-gradient-to-r from-red-600 to-red-700 text-white px-8 py-4 rounded-lg hover:from-red-700 hover:to-red-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold text-lg"
            >
              🔐 Iniciar Sesión SuperAdmin
            </button>

            <div className="mt-6 text-xs text-[var(--muted-foreground)]">
              <p>• Solo usuarios SuperAdmin pueden acceder al Editor de Datos</p>
              <p>• Todas las acciones son registradas por seguridad</p>
              <p>• Las sesiones tienen duración limitada por motivos de seguridad</p>
            </div>
          </div>
        </div>        <LoginModal
          isOpen={showLoginModal}
          onLoginSuccess={handleLoginSuccess}
          onClose={() => setShowLoginModal(false)}
          title="Editor de Datos - Acceso SuperAdmin"
        />
      </main>
    );
  }
  // Usuario autenticado pero sin permisos SuperAdmin
  if (isAuthenticated && !isSuperAdmin()) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-2xl mx-auto bg-[var(--card)] border-2 border-red-200 dark:border-red-800 rounded-xl shadow-lg p-8">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="relative">
                <Shield className="w-20 h-20 text-red-600 dark:text-red-400" />
                <AlertTriangle className="w-8 h-8 text-red-800 dark:text-red-400 absolute -bottom-1 -right-1 bg-[var(--background)] rounded-full p-1" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-red-900 dark:text-red-400 mb-4">
              🚫 Acceso Denegado
            </h1>

            <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                <span className="font-semibold text-red-800 dark:text-red-300">Permisos Insuficientes</span>
              </div>
              <p className="text-red-700 dark:text-red-300 text-sm">
                Tu rol actual no tiene autorización para acceder al Editor de Datos
              </p>
            </div>

            <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-6 mb-6">
              <h3 className="font-semibold text-[var(--foreground)] mb-4">Información de tu Cuenta:</h3>

              <div className="grid grid-cols-1 gap-3 text-left">
                <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                  <span className="text-[var(--muted-foreground)]">Usuario:</span>
                  <span className="font-semibold text-[var(--foreground)]">{user?.name}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                  <span className="text-[var(--muted-foreground)]">Rol Actual:</span>
                  <span className={`font-semibold px-3 py-1 rounded-full text-sm ${user?.role === 'admin'
                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                    }`}>
                    {user?.role === 'admin' ? '🟠 Admin' : '🔵 User'}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                  <span className="text-[var(--muted-foreground)]">Acceso Requerido:</span>
                  <span className="font-semibold bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 px-3 py-1 rounded-full text-sm">
                    🔴 SuperAdmin
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-6">
              <p className="text-blue-800 dark:text-blue-300 text-sm">
                <strong>¿Necesitas acceso SuperAdmin?</strong><br />
                Contacta al administrador del sistema para solicitar una elevación de permisos.
              </p>
            </div>

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => window.history.back()}
                className="bg-gray-600 dark:bg-gray-700 text-white px-6 py-3 rounded-lg hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
              >
                ← Volver
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-3 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                🏠 Ir al Inicio
              </button>
            </div>

            <div className="mt-6 text-xs text-[var(--muted-foreground)]">
              <p>• Este intento de acceso ha sido registrado por seguridad</p>
              <p>• ID de Sesión: {localStorage.getItem('pricemaster_session_id')?.slice(-8)}</p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Usuario SuperAdmin con acceso autorizado
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header de seguridad para SuperAdmin */}
      <div className="mb-6 bg-gradient-to-r from-green-600 to-green-800 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield className="w-6 h-6" />
            <div>
              <h1 className="text-xl font-bold">🔐 Editor de Datos - Modo SuperAdmin</h1>
              <p className="text-red-100 text-sm">Usuario autorizado: {user?.name}</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Advertencia de sesión */}
            {sessionWarning && (
              <div className="bg-yellow-500 text-yellow-900 px-3 py-1 rounded-full text-sm font-medium animate-pulse">
                ⚠️ Sesión por expirar
              </div>
            )}

            {/* Timer de sesión */}
            <div className="flex items-center gap-2 bg-red-700 px-3 py-1 rounded-full text-sm">
              <Clock className="w-4 h-4" />
              <span>Sesión: {formatTimeLeft(sessionTime)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Componente del Editor de Datos */}
      <DataEditor />
    </main>
  );
}
