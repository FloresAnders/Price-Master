// app/scanhistory/page.tsx
'use client';

import React from 'react';
import { History } from 'lucide-react';
import ScanHistoryTable from '@/components/ScanHistoryTable';

export default function ScanHistoryPage() {
  return (
    <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
      <ScanHistoryTable />
    </main>
  );
}
