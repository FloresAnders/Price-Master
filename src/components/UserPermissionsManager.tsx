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

      {/* Migration Button */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold mb-2">Migración de Usuarios</h3>
        <p className="text-sm text-gray-600 mb-3">
          Agrega permisos predeterminados a usuarios que no los tienen configurados.
        </p>
        <button
          onClick={migrateAllUsers}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          Migrar Usuarios
        </button>
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
            <p><strong>Nombre:</strong> {selectedUser.name}</p>
            <p><strong>Rol:</strong> {selectedUser.role}</p>
            <p><strong>Ubicación:</strong> {selectedUser.location}</p>
            <p><strong>Estado:</strong> {selectedUser.isActive ? 'Activo' : 'Inactivo'}</p>
          </div>

          {/* Quick Actions */}
          <div className="mb-6 flex gap-2 flex-wrap">
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

          {/* Permissions Grid */}
          <div className="mb-6">
            <h3 className="font-semibold mb-4">Permisos de Secciones</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center p-3 border border-gray-200 rounded">
                  <input
                    type="checkbox"
                    id={key}
                    checked={permissions[key as keyof UserPermissions]}
                    onChange={(e) => handlePermissionChange(key as keyof UserPermissions, e.target.checked)}
                    className="mr-3 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor={key} className="flex-1 text-sm font-medium cursor-pointer">
                    {label}
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
