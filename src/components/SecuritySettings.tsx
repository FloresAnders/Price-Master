// src/components/SecuritySettings.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Settings, Clock, Users, Key, Eye, EyeOff, Save, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface SecurityConfig {
  sessionDuration: {
    superadmin: number;
    admin: number;
    user: number;
  };
  inactivityTimeout: {
    superadmin: number;
    admin: number;
    user: number;
  };
  passwordPolicy: {
    minLength: number;
    requireSpecialChars: boolean;
    requireNumbers: boolean;
    requireUppercase: boolean;
    maxAge: number; // días
  };
  auditSettings: {
    logRetentionDays: number;
    logCriticalActionsOnly: boolean;
    enableRealTimeAlerts: boolean;
  };
  loginAttempts: {
    maxFailedAttempts: number;
    lockoutDurationMinutes: number;
    enableTwoFactor: boolean;
  };
}

export default function SecuritySettings() {
  const { isSuperAdmin, user } = useAuth();
  const [config, setConfig] = useState<SecurityConfig>({
    sessionDuration: {
      superadmin: 4,
      admin: 24,
      user: 720
    },
    inactivityTimeout: {
      superadmin: 30,
      admin: 120,
      user: 480
    },
    passwordPolicy: {
      minLength: 8,
      requireSpecialChars: true,
      requireNumbers: true,
      requireUppercase: true,
      maxAge: 90
    },
    auditSettings: {
      logRetentionDays: 365,
      logCriticalActionsOnly: false,
      enableRealTimeAlerts: true
    },
    loginAttempts: {
      maxFailedAttempts: 3,
      lockoutDurationMinutes: 30,
      enableTwoFactor: true
    }
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Cargar configuración guardada
  useEffect(() => {
    const savedConfig = localStorage.getItem('pricemaster_security_config');
    if (savedConfig) {
      try {
        setConfig(JSON.parse(savedConfig));
      } catch (error) {
        console.error('Error loading security config:', error);
      }
    }
  }, []);

  // Solo SuperAdmin puede acceder
  if (!isSuperAdmin()) {
    return (
      <div className="max-w-4xl mx-auto bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <Shield className="w-12 h-12 mx-auto mb-4 text-red-600" />
        <h3 className="text-lg font-semibold text-red-900 mb-2">Acceso Restringido</h3>
        <p className="text-red-700">
          Solo los usuarios SuperAdmin pueden acceder a la configuración de seguridad.
        </p>
      </div>
    );
  }

  const updateConfig = (section: keyof SecurityConfig, key: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value
      }
    }));
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      // Guardar en localStorage (en producción, enviar al servidor)
      localStorage.setItem('pricemaster_security_config', JSON.stringify(config));
      
      // Log de auditoría
      const auditLog = {
        timestamp: new Date().toISOString(),
        userId: user?.id,
        userName: user?.name,
        action: 'SECURITY_CONFIG_UPDATED',
        details: 'SuperAdmin updated security configuration',
        sessionId: localStorage.getItem('pricemaster_session_id') || ''
      };

      const existingLogs = JSON.parse(localStorage.getItem('pricemaster_audit_logs') || '[]');
      existingLogs.push(auditLog);
      localStorage.setItem('pricemaster_audit_logs', JSON.stringify(existingLogs));

      setNotification({ message: 'Configuración de seguridad guardada exitosamente', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Error al guardar la configuración', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setNotification(null), 3000);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-800 text-white p-6 rounded-lg">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8" />
          <div>
            <h1 className="text-2xl font-bold">Configuración de Seguridad</h1>
            <p className="text-red-100">Panel exclusivo SuperAdmin - {user?.name}</p>
          </div>
        </div>
      </div>

      {/* Notification */}
      {notification && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          notification.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <Shield className="w-5 h-5" />
          ) : (
            <AlertTriangle className="w-5 h-5" />
          )}
          {notification.message}
        </div>
      )}

      {/* Duración de Sesiones */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-6 h-6 text-blue-600" />
          <h2 className="text-xl font-semibold">Duración de Sesiones</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">SuperAdmin (horas)</label>
            <input
              type="number"
              min="1"
              max="24"
              value={config.sessionDuration.superadmin}
              onChange={(e) => updateConfig('sessionDuration', 'superadmin', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recomendado: 2-8 horas</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Admin (horas)</label>
            <input
              type="number"
              min="1"
              max="72"
              value={config.sessionDuration.admin}
              onChange={(e) => updateConfig('sessionDuration', 'admin', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recomendado: 8-48 horas</p>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Usuario (horas)</label>
            <input
              type="number"
              min="24"
              max="8760"
              value={config.sessionDuration.user}
              onChange={(e) => updateConfig('sessionDuration', 'user', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">Recomendado: 168-720 horas</p>
          </div>
        </div>
      </div>

      {/* Timeout de Inactividad */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Users className="w-6 h-6 text-orange-600" />
          <h2 className="text-xl font-semibold">Timeout de Inactividad (minutos)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">SuperAdmin</label>
            <input
              type="number"
              min="5"
              max="120"
              value={config.inactivityTimeout.superadmin}
              onChange={(e) => updateConfig('inactivityTimeout', 'superadmin', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Admin</label>
            <input
              type="number"
              min="30"
              max="480"
              value={config.inactivityTimeout.admin}
              onChange={(e) => updateConfig('inactivityTimeout', 'admin', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Usuario</label>
            <input
              type="number"
              min="60"
              max="1440"
              value={config.inactivityTimeout.user}
              onChange={(e) => updateConfig('inactivityTimeout', 'user', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Política de Contraseñas */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Key className="w-6 h-6 text-green-600" />
          <h2 className="text-xl font-semibold">Política de Contraseñas</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Longitud mínima</label>
            <input
              type="number"
              min="6"
              max="32"
              value={config.passwordPolicy.minLength}
              onChange={(e) => updateConfig('passwordPolicy', 'minLength', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Caducidad (días)</label>
            <input
              type="number"
              min="30"
              max="365"
              value={config.passwordPolicy.maxAge}
              onChange={(e) => updateConfig('passwordPolicy', 'maxAge', Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={config.passwordPolicy.requireSpecialChars}
              onChange={(e) => updateConfig('passwordPolicy', 'requireSpecialChars', e.target.checked)}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm">Requiere caracteres especiales (!@#$%^&*)</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={config.passwordPolicy.requireNumbers}
              onChange={(e) => updateConfig('passwordPolicy', 'requireNumbers', e.target.checked)}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm">Requiere números</span>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={config.passwordPolicy.requireUppercase}
              onChange={(e) => updateConfig('passwordPolicy', 'requireUppercase', e.target.checked)}
              className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
            />
            <span className="text-sm">Requiere mayúsculas</span>
          </label>
        </div>
      </div>

      {/* Configuración Avanzada */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-3 mb-4 text-gray-700 hover:text-gray-900 transition-colors"
        >
          {showAdvanced ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          <h2 className="text-xl font-semibold">Configuración Avanzada</h2>
        </button>

        {showAdvanced && (
          <div className="space-y-6">
            {/* Auditoría */}
            <div>
              <h3 className="text-lg font-medium mb-3">Configuración de Auditoría</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Retención de logs (días)</label>
                  <input
                    type="number"
                    min="30"
                    max="2555"
                    value={config.auditSettings.logRetentionDays}
                    onChange={(e) => updateConfig('auditSettings', 'logRetentionDays', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="mt-4 space-y-3">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.auditSettings.logCriticalActionsOnly}
                    onChange={(e) => updateConfig('auditSettings', 'logCriticalActionsOnly', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm">Registrar solo acciones críticas</span>
                </label>
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.auditSettings.enableRealTimeAlerts}
                    onChange={(e) => updateConfig('auditSettings', 'enableRealTimeAlerts', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm">Habilitar alertas en tiempo real</span>
                </label>
              </div>
            </div>

            {/* Intentos de Login */}
            <div>
              <h3 className="text-lg font-medium mb-3">Control de Acceso</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Máx. intentos fallidos</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={config.loginAttempts.maxFailedAttempts}
                    onChange={(e) => updateConfig('loginAttempts', 'maxFailedAttempts', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Bloqueo (minutos)</label>
                  <input
                    type="number"
                    min="5"
                    max="1440"
                    value={config.loginAttempts.lockoutDurationMinutes}
                    onChange={(e) => updateConfig('loginAttempts', 'lockoutDurationMinutes', Number(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={config.loginAttempts.enableTwoFactor}
                    onChange={(e) => updateConfig('loginAttempts', 'enableTwoFactor', e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                  />
                  <span className="text-sm">Habilitar autenticación de dos factores para SuperAdmin</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Botón de Guardar */}
      <div className="flex justify-end">
        <button
          onClick={saveConfiguration}
          disabled={saving}
          className="flex items-center gap-2 bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
