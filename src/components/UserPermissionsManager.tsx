'use client';

import React, { useState, useEffect } from 'react';
import { User, UserPermissions } from '../types/firestore';
import { UsersService } from '../services/users';
import { getDefaultPermissions, getAllPermissions, getNoPermissions } from '../utils/permissions';

interface UserPermissionsManagerProps {
  userId?: string;
  onClose?: () => void;
}

const PERMISSION_LABELS = {
  scanner: 'Escáner',
  calculator: 'Calculadora',
  converter: 'Conversor',
  cashcounter: 'Contador Efectivo',
  timingcontrol: 'Control Tiempos',
  controlhorario: 'Control Horario',
  supplierorders: 'Órdenes Proveedor',
  mantenimiento: 'Mantenimiento',
  scanhistory: 'Historial de Escaneos',
};

const PERMISSION_DESCRIPTIONS = {
  scanner: 'Escanear códigos de barras',
  calculator: 'Calcular precios con descuentos',
  converter: 'Convertir y transformar texto',
  cashcounter: 'Contar billetes y monedas',
  timingcontrol: 'Registro de venta de tiempos',
  controlhorario: 'Registro de horarios de trabajo',
  supplierorders: 'Gestión de órdenes de proveedores',
  mantenimiento: 'Acceso al panel de administración',
  scanhistory: 'Ver historial completo de escaneos realizados',
};

export default function UserPermissionsManager({ userId, onClose }: UserPermissionsManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermissions>(getNoPermissions());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (userId && users.length > 0) {
      const user = users.find(u => u.id === userId);
      if (user) {
        setSelectedUser(user);
        setPermissions(user.permissions || getDefaultPermissions(user.role));
      }
    }
  }, [userId, users]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const allUsers = await UsersService.getAllUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error('Error loading users:', error);
      setMessage({ type: 'error', text: 'Error al cargar usuarios' });
    } finally {
      setLoading(false);
    }
  };

  const handleUserChange = (user: User) => {
    setSelectedUser(user);
    setPermissions(user.permissions || getDefaultPermissions(user.role));
  };

  const handlePermissionChange = (permission: keyof UserPermissions, value: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [permission]: value
    }));
  };

  const handleSave = async () => {
    if (!selectedUser?.id) return;

    setSaving(true);
    try {
      await UsersService.updateUserPermissions(selectedUser.id, permissions);
      setMessage({ type: 'success', text: 'Permisos actualizados correctamente' });
      
      // Update local state
      setUsers(prev => prev.map(u => 
        u.id === selectedUser.id 
          ? { ...u, permissions } 
          : u
      ));
    } catch (error) {
      console.error('Error updating permissions:', error);
      setMessage({ type: 'error', text: 'Error al actualizar permisos' });
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefault = () => {
    if (!selectedUser) return;
    const defaultPerms = getDefaultPermissions(selectedUser.role);
    setPermissions(defaultPerms);
  };

  const handleSelectAll = () => {
    setPermissions(getAllPermissions());
  };

  const handleSelectNone = () => {
    setPermissions(getNoPermissions());
  };

  const migrateAllUsers = async () => {
    setLoading(true);
    try {
      const result = await UsersService.migrateUsersPermissions();
      setMessage({ 
        type: 'success', 
        text: `Migración completada: ${result.updated} usuarios actualizados, ${result.skipped} omitidos` 
      });
      await loadUsers(); // Reload users to see changes
    } catch (error) {
      console.error('Error migrating users:', error);
      setMessage({ type: 'error', text: 'Error en la migración de usuarios' });
    } finally {
      setLoading(false);
    }
  };

  const ensureAllPermissions = async () => {
    setLoading(true);
    try {
      const result = await UsersService.ensureAllPermissions();
      setMessage({ 
        type: 'success', 
        text: `Permisos actualizados: ${result.updated} usuarios actualizados, ${result.skipped} ya estaban al día` 
      });
      await loadUsers(); // Reload users to see changes
    } catch (error) {
      console.error('Error ensuring all permissions:', error);
      setMessage({ type: 'error', text: 'Error al actualizar permisos de usuarios' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-5/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Administrar Permisos de Usuario</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            ✕
          </button>
        )}
      </div>

      {message && (
        <div className={`p-3 rounded mb-4 ${
          message.type === 'success' 
            ? 'bg-green-100 text-green-700 border border-green-300' 
            : 'bg-red-100 text-red-700 border border-red-300'
        }`}>
          {message.text}
        </div>
      )}

      {/* Migration Buttons */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold mb-2">Gestión de Permisos</h3>
        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Agrega permisos predeterminados a usuarios que no los tienen configurados.
            </p>
            <button
              onClick={migrateAllUsers}
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Migrar Usuarios Nuevos
            </button>
          </div>
          <div>
            <p className="text-sm text-gray-600 mb-2">
              Actualiza todos los usuarios para asegurar que tengan todos los permisos disponibles (útil cuando se agregan nuevos permisos).
            </p>
            <button
              onClick={ensureAllPermissions}
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              Actualizar Permisos Existentes
            </button>
          </div>
        </div>
      </div>

      {/* User Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Seleccionar Usuario:</label>
        <select
          value={selectedUser?.id || ''}
          onChange={(e) => {
            const user = users.find(u => u.id === e.target.value);
            if (user) handleUserChange(user);
          }}
          className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">-- Seleccionar Usuario --</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>
              {user.name} ({user.role}) - {user.location}
            </option>
          ))}
        </select>
      </div>

      {selectedUser && (
        <>
          {/* User Info */}
          <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
            <h3 className="font-semibold mb-2">Información del Usuario</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p><strong>Nombre:</strong> {selectedUser.name}</p>
                <p><strong>Rol:</strong> {selectedUser.role}</p>
                <p><strong>Ubicación:</strong> {selectedUser.location}</p>
                <p><strong>Estado:</strong> {selectedUser.isActive ? 'Activo' : 'Inactivo'}</p>
              </div>
              <div>
                <h4 className="font-medium mb-2">Permisos Actuales:</h4>
                <div className="flex flex-wrap gap-1">
                  {Object.entries(selectedUser.permissions || getDefaultPermissions(selectedUser.role))
                    .filter(([_, hasAccess]) => hasAccess)
                    .map(([permission]) => (
                      <span
                        key={permission}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded border border-blue-200"
                      >
                        {PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS]}
                      </span>
                    ))
                  }
                  {Object.values(selectedUser.permissions || getDefaultPermissions(selectedUser.role))
                    .filter(Boolean).length === 0 && (
                    <span className="text-xs text-gray-500 italic">Sin permisos activos</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Acciones Rápidas</h3>
              <div className="text-sm text-gray-600">
                Rol: <strong>{selectedUser.role}</strong> 
                <span className="ml-2 text-xs bg-gray-100 px-2 py-1 rounded">
                  {selectedUser.role === 'superadmin' ? 'Acceso total' : 
                   selectedUser.role === 'admin' ? 'Acceso amplio' : 'Acceso básico'}
                </span>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={handleSelectAll}
                className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Seleccionar Todo
              </button>
              <button
                onClick={handleSelectNone}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Deseleccionar Todo
              </button>
              <button
                onClick={handleResetToDefault}
                className="px-3 py-1 bg-gray-600 text-white rounded text-sm hover:bg-gray-700"
              >
                Permisos por Defecto
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-600">
              <strong>Permisos predeterminados para {selectedUser.role}:</strong>
              <div className="flex flex-wrap gap-1 mt-1">
                {Object.entries(getDefaultPermissions(selectedUser.role))
                  .filter(([_, hasAccess]) => hasAccess)
                  .map(([permission]) => (
                    <span
                      key={permission}
                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                    >
                      {PERMISSION_LABELS[permission as keyof typeof PERMISSION_LABELS]}
                    </span>
                  ))
                }
              </div>
            </div>
          </div>

          {/* Permissions Grid */}
          <div className="mb-6">
            <h3 className="font-semibold mb-4">Permisos de Secciones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-start p-3 border border-gray-200 rounded">
                  <input
                    type="checkbox"
                    id={key}
                    checked={permissions[key as keyof UserPermissions]}
                    onChange={(e) => handlePermissionChange(key as keyof UserPermissions, e.target.checked)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded mt-1"
                  />
                  <label htmlFor={key} className="flex-1 text-sm cursor-pointer">
                    <div className="font-medium">{label}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {PERMISSION_DESCRIPTIONS[key as keyof typeof PERMISSION_DESCRIPTIONS]}
                    </div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Guardando...' : 'Guardar Permisos'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
