'use client';

import React from 'react';
import { Banknote } from 'lucide-react';

export default function FondoGeneralPage() {
  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
        <div className="flex items-center mb-4">
          <Banknote className="w-8 h-8 mr-3 text-[var(--foreground)]" />
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Fondo General</h1>
        </div>

        <p className="text-[var(--muted-foreground)] mb-4">
          Aquí se mostrará la interfaz para administrar el Fondo General de la compañía.
          Puedes agregar acciones como ver saldo, registrar ingresos/egresos y reportes.
        </p>

        <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
          <p className="text-sm text-[var(--muted-foreground)]">Contenido inicial de la página de Fondo General.</p>
        </div>
      </div>
    </div>
  );
}
