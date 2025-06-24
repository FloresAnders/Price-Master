// src/app/edit/page-with-hook.tsx (ejemplo alternativo)
'use client';

import React from 'react';
import { Shield, AlertTriangle, Clock } from 'lucide-react';
import DataEditor from '@/edit/DataEditor';
import { useSuperAdminRoute } from '@/hooks/useRouteProtection';

export default function EditPageWithHook() {
  const { accessGranted, loading, user } = useSuperAdminRoute({
    redirectTo: '/',
    onAccessDenied: () => {
      // Lógica personalizada cuando se deniega el acceso
      console.warn('Access denied to SuperAdmin route');
    }
  });

  // Estado de carga
  if (loading) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-12">
          <Shield className="w-12 h-12 text-blue-600 animate-pulse mb-4" />
          <div className="text-lg">Verificando permisos de acceso...</div>
        </div>
      </main>
    );
  }

  // Si no tiene acceso, el hook ya manejó la redirección
  if (!accessGranted) {
    return (
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 text-red-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-red-900 mb-2">Acceso Denegado</h1>
          <p className="text-gray-600">Redirigiendo...</p>
        </div>
      </main>
    );
  }

  // Usuario SuperAdmin con acceso autorizado
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header de seguridad compacto */}
      <div className="mb-6 bg-red-600 text-white p-3 rounded-lg flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          <span className="font-semibold">Editor de Datos - SuperAdmin: {user?.name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4" />
          <span>Sesión Activa</span>
        </div>
      </div>

      {/* Componente del Editor de Datos */}
      <DataEditor />
    </main>
  );
}
