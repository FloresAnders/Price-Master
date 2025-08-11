// app/scanhistory/page.tsx
'use client';

import React, { useState } from 'react';
import { History } from 'lucide-react';
import ScanHistoryTable from '@/components/ScanHistoryTable';

export default function ScanHistoryPage() {
  const [notification, setNotification] = useState<{message: string, color?: string} | null>(null);

  // Función para mostrar notificaciones
  const showNotification = (message: string, color: string = 'green') => {
    setNotification({ message, color });
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in ${
          notification.color === 'green' ? 'bg-green-500' :
          notification.color === 'red' ? 'bg-red-500' : 
          notification.color === 'orange' ? 'bg-orange-500' :
          'bg-blue-500'
        } text-white`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6" />
          <div>
            <h1 className="text-xl font-bold">📋 Historial de Escaneos</h1>
            <p className="text-blue-100 text-sm">Registro completo de todos los escaneos realizados en el sistema</p>
          </div>
        </div>
      </div>

      {/* Componente del Historial de Escaneos */}
      <ScanHistoryTable notify={showNotification} />
    </main>
  );
}
