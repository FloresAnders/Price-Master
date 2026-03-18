'use client';

import Pruebas from '@/components/xpruebas/Pruebas';
import { useAuth } from '@/hooks/useAuth';

export default function PruebasPage() {
  const { loading, isSuperAdmin } = useAuth();

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6 text-[var(--foreground)]">
          Cargando…
        </div>
      </div>
    );
  }

  if (!isSuperAdmin()) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">Acceso restringido</h1>
        </div>
      </div>
    );
  }

  return <Pruebas />;
}
