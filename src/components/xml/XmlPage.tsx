'use client';

import React from 'react';
import { FileCode, Info } from 'lucide-react';

export default function XmlPage() {
  return (
    <div className="max-w-4xl mx-auto bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg shadow p-6">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-full bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <FileCode className="w-6 h-6 text-blue-600" />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-[var(--foreground)]">XML</h2>
          <div className="mt-4 p-4 rounded border border-[var(--border)] bg-[var(--muted)] flex gap-3">
            <Info className="w-5 h-5 text-[var(--muted-foreground)] mt-0.5" />
            <div className="text-sm text-[var(--muted-foreground)]">
              Si todavía no está implementado el flujo, esta pantalla sirve como placeholder para que la tarjeta y el header ya funcionen.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
