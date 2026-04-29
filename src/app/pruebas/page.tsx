"use client";

import ConfirmModal from "@/components/ui/ConfirmModal";
import Pruebas from "@/components/xpruebas/Pruebas";
import { useAuth } from "@/hooks/useAuth";
import { usePruebasUnlock } from "@/hooks/usePruebasUnlock";
import { useRouter } from "next/navigation";

export default function PruebasPage() {
  const { loading, isSuperAdmin, isAuthenticated } = useAuth();
  const router = useRouter();

  const { unlocked, password, setPassword, submitting, error, unlock } =
    usePruebasUnlock({
      ttlMs: 5 * 60 * 1000,
    });

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6 text-[var(--foreground)]">
          Cargando…
        </div>
      </div>
    );
  }

  // Not authenticated: require password unlock.
  if (!isAuthenticated) {
    if (!unlocked) {
      return (
        <div className="max-w-3xl mx-auto p-6">
          <ConfirmModal
            open={true}
            title="Acceso a Pruebas"
            message={
              <div className="w-full">
                <div className="text-sm text-[var(--muted-foreground)] mb-3">
                  Ingresa la contraseña para acceder al área de pruebas.
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void unlock();
                    }
                  }}
                  className="w-full px-3 py-2 rounded border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground)]"
                  placeholder="Contraseña"
                  autoFocus
                  disabled={submitting}
                />
                {error ? (
                  <div className="mt-2 text-sm text-red-500">{error}</div>
                ) : null}
              </div>
            }
            confirmText={submitting ? "Validando…" : "Entrar"}
            cancelText="Volver"
            confirmDisabled={submitting || password.trim().length === 0}
            loading={submitting}
            onConfirm={() => {
              void unlock();
            }}
            onCancel={() => {
              router.push("/home");
            }}
            actionType="change"
          />
        </div>
      );
    }

    return <Pruebas />;
  }

  // Authenticated: keep superadmin restriction.
  if (!isSuperAdmin()) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <div className="bg-[var(--card-bg)] border border-[var(--border)] rounded-lg p-6">
          <h1 className="text-xl font-semibold text-[var(--foreground)]">
            Acceso restringido
          </h1>
        </div>
      </div>
    );
  }

  return <Pruebas />;
}
