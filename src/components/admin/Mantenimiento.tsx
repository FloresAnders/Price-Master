'use client';

import React from 'react';
import { Lock as LockIcon } from 'lucide-react';
import DataEditor from '@/edit/DataEditor';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

export default function Mantenimiento() {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  // Verificar si el usuario tiene permiso para usar el mantenimiento
  if (!hasPermission(user?.permissions, 'mantenimiento')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Panel de Mantenimiento.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <DataEditor />
    </div>
  );
}
