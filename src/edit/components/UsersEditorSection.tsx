'use client';

import React from 'react';
import { Save, Eye, EyeOff, Settings, Edit, UserPlus } from 'lucide-react';

import type { User } from '../../types/firestore';

type Props = {
  usersData: User[];
  empresasData: any[];
  currentUser: User | null;

  addUser: () => void;
  updateUser: (index: number, field: keyof User, value: unknown) => void;
  removeUser: (index: number) => void | Promise<void>;
  saveIndividualUser: (index: number) => void | Promise<void>;

  hasUserChanged: (index: number) => boolean;
  getUserKey: (user: User, index: number) => string;

  savingUserKey: string | null;

  changePasswordMode: Record<string, boolean>;
  passwordVisibility: Record<string, boolean>;
  togglePasswordVisibility: (user: User, index: number) => void;

  setChangePasswordMode: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setUsersData: React.Dispatch<React.SetStateAction<User[]>>;
  setPasswordStore: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  passwordBaseline: Record<string, string>;

  renderUserPermissions: (user: User, index: number) => React.ReactNode;
};

export default function UsersEditorSection({
  usersData,
  empresasData,
  currentUser,
  addUser,
  updateUser,
  removeUser,
  saveIndividualUser,
  hasUserChanged,
  getUserKey,
  savingUserKey,
  changePasswordMode,
  passwordVisibility,
  togglePasswordVisibility,
  setChangePasswordMode,
  setUsersData,
  setPasswordStore,
  passwordBaseline,
  renderUserPermissions,
}: Props) {
  return (
    <div className="space-y-3 sm:space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <h4 className="text-base sm:text-lg lg:text-xl font-semibold">Configuración de Usuarios</h4>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
            Gestiona usuarios, roles y permisos del sistema
          </p>
        </div>
        <button
          onClick={addUser}
          className="px-3 py-1.5 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs sm:text-sm w-full sm:w-auto flex items-center justify-center gap-1.5 sm:gap-2 whitespace-nowrap"
        >
          <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>Agregar Usuario</span>
        </button>
      </div>

      {usersData.map((user, index) => (
        <div key={user.id || index} className="border border-[var(--input-border)] rounded-lg p-2.5 sm:p-4 lg:p-5 relative">
          {hasUserChanged(index) && (
            <div className="absolute top-2 right-2 sm:top-3 sm:right-3 flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-yellow-100 text-yellow-800 rounded-full text-[10px] sm:text-xs font-medium">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span>Pendiente</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Usuario:</label>
              <input
                type="text"
                value={user.name}
                onChange={(e) => updateUser(index, 'name', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                placeholder="Nombre de usuario"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Nombre Completo:</label>
              <input
                type="text"
                value={user.fullName || ''}
                onChange={(e) => updateUser(index, 'fullName', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                placeholder="Nombre completo"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Correo:</label>
              <input
                type="email"
                value={user.email || ''}
                onChange={(e) => updateUser(index, 'email', e.target.value)}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Empresa Dueña:</label>
              {(() => {
                const resolvedOwnerId =
                  user.ownerId || (currentUser?.ownerId ?? (currentUser && currentUser.eliminate === false ? currentUser.id : '')) || '';
                const allowedEmpresas = empresasData.filter((e) => (e?.ownerId || '') === resolvedOwnerId);
                return (
                  <>
                    <select
                      value={user.ownercompanie || ''}
                      onChange={(e) => updateUser(index, 'ownercompanie', e.target.value)}
                      className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                      style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                    >
                      <option value="">Seleccionar empresa</option>
                      {allowedEmpresas.map((empresa) => (
                        <option key={empresa.id || empresa.name} value={empresa.name}>
                          {empresa.name}
                        </option>
                      ))}
                    </select>
                    {allowedEmpresas.length === 0 && (
                      <p className="text-[10px] sm:text-xs mt-1 text-yellow-600">No hay empresas disponibles.</p>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Contraseña:</label>
              {!user.id ? (
                <input
                  type="text"
                  value={user.password || ''}
                  onChange={(e) => updateUser(index, 'password', e.target.value)}
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                  placeholder="Contraseña"
                />
              ) : changePasswordMode[getUserKey(user, index)] ? (
                <div className="space-y-1.5 sm:space-y-2">
                  <div className="relative">
                    <input
                      type={passwordVisibility[getUserKey(user, index)] ? 'text' : 'password'}
                      value={user.password || ''}
                      onChange={(e) => updateUser(index, 'password', e.target.value)}
                      className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 pr-10 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                      style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                      placeholder="Nueva contraseña"
                    />
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(user, index)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                      title={passwordVisibility[getUserKey(user, index)] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {passwordVisibility[getUserKey(user, index)] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const key = getUserKey(user, index);
                      setChangePasswordMode((prev) => ({ ...prev, [key]: false }));
                      const updated = [...usersData];
                      updated[index] = { ...updated[index], password: '' };
                      setUsersData(updated);
                      setPasswordStore((prev) => ({ ...prev, [key]: passwordBaseline[key] ?? '' }));
                    }}
                    className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <div
                  className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1.5 sm:gap-0 px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md"
                  style={{ background: 'var(--muted)', color: 'var(--foreground)' }}
                >
                  <span className="text-xs sm:text-sm">Contraseña configurada</span>
                  <button
                    type="button"
                    onClick={() => {
                      const key = getUserKey(user, index);
                      setChangePasswordMode((prev) => ({ ...prev, [key]: true }));
                    }}
                    className="text-[10px] sm:text-xs px-2 py-1 bg-[var(--primary)] text-white rounded hover:bg-[var(--button-hover)] transition-colors whitespace-nowrap flex items-center justify-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    Cambiar
                  </button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Rol:</label>
              <select
                value={user.role || 'user'}
                onChange={(e) => updateUser(index, 'role', e.target.value as any)}
                className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
              >
                {!(currentUser?.role === 'superadmin' && !user.id) && <option value="user">Usuario</option>}
                <option value="admin">Administrador</option>
                {currentUser?.role === 'superadmin' && <option value="superadmin">Super Administrador</option>}
              </select>
            </div>

            {user.role === 'admin' && user.eliminate === false && currentUser?.role === 'superadmin' && (
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1">Máx. Empresas:</label>
                <input
                  type="number"
                  min={0}
                  value={(user as any).maxCompanies ?? ''}
                  onChange={(e) => updateUser(index, 'maxCompanies' as any, e.target.value === '' ? undefined : Number(e.target.value))}
                  className="w-full px-2.5 sm:px-3 py-1.5 sm:py-2 border border-[var(--input-border)] rounded-md text-xs sm:text-sm"
                  style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                  placeholder="Máx. empresas"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">Estado:</label>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <input
                  type="checkbox"
                  checked={user.isActive ?? true}
                  onChange={(e) => updateUser(index, 'isActive', e.target.checked)}
                  className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 bg-[var(--background)] border-[var(--border)] rounded focus:ring-blue-500"
                />
                <span className="text-xs sm:text-sm">Usuario activo</span>
              </div>
            </div>
          </div>

          <div className="mb-3 sm:mb-4 p-2 sm:p-3 lg:p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-2 sm:mb-3">
              <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 dark:text-gray-400" />
              <h5 className="text-xs sm:text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                Permisos del Usuario
              </h5>
              <span className="text-[10px] sm:text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                {user.role || 'user'}
              </span>
            </div>
            {renderUserPermissions(user, index)}
            <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-[10px] sm:text-xs" style={{ color: 'var(--muted-foreground)' }}>
                <strong>Nota:</strong> Edita los permisos y presiona &quot;Guardar&quot; para aplicar cambios.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-2 mt-2">
            <button
              onClick={() => saveIndividualUser(index)}
              className="px-3 py-1.5 sm:px-4 sm:py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm"
              disabled={savingUserKey === getUserKey(user, index)}
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {savingUserKey === getUserKey(user, index) ? 'Guardando...' : 'Guardar'}
            </button>
            <button
              onClick={() => removeUser(index)}
              className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base"
              disabled={
                savingUserKey === getUserKey(user, index) ||
                (currentUser?.role === 'admin' && (user.eliminate === false || user.eliminate === undefined))
              }
              title={
                currentUser?.role === 'admin' && (user.eliminate === false || user.eliminate === undefined)
                  ? 'No puedes eliminar este usuario: marcado como protegido'
                  : 'Eliminar Usuario'
              }
            >
              Eliminar Usuario
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
