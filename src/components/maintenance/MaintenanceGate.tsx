"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMaintenance } from "@/contexts/MaintenanceContext";
import {
  getMaintenanceBlock,
  type MaintenanceConfig,
} from "@/services/maintenance";
import type { User } from "@/types/firestore";
import MaintenanceScreen from "./MaintenanceScreen";

export function MaintenanceBoundary({
  children,
  user,
  isAuthenticated,
  config,
  loading,
  bypassStatus,
}: {
  children: ReactNode;
  user: User | null;
  isAuthenticated: boolean;
  config: MaintenanceConfig;
  loading: boolean;
  bypassStatus?: {
    checking: boolean;
    active: boolean;
    expiresAt?: number;
  };
}) {
  if (!isAuthenticated || !user || user.role !== "user") {
    return <>{children}</>;
  }

  const block = getMaintenanceBlock(config, user);

  if (loading || (block && bypassStatus?.checking)) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#020713] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-2 border-slate-700 border-b-blue-500" />
          <p className="text-sm text-slate-400">Verificando disponibilidad…</p>
        </div>
      </main>
    );
  }

  if (block && !bypassStatus?.active) {
    return <MaintenanceScreen block={block} />;
  }

  return (
    <>
      {children}
      {bypassStatus?.active && bypassStatus.expiresAt && (
        <div className="fixed bottom-3 left-1/2 z-[60] -translate-x-1/2 rounded-full border border-amber-300/20 bg-slate-950/90 px-3 py-1.5 text-xs text-amber-200 shadow-lg backdrop-blur">
          Pase de mantenimiento activo · expira a las{" "}
          {new Date(bypassStatus.expiresAt).toLocaleTimeString("es-CR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}
    </>
  );
}

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { config, loading } = useMaintenance();
  const [bypassStatus, setBypassStatus] = useState<{
    userId?: string;
    checking: boolean;
    active: boolean;
    expiresAt?: number;
  }>({ checking: true, active: false });

  useEffect(() => {
    if (!isAuthenticated || user?.role !== "user") {
      return;
    }

    const userId = user.id || "";
    let mounted = true;
    let expiryTimer: ReturnType<typeof setTimeout> | undefined;
    void fetch("/api/maintenance/bypass/status", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("bypass_status_failed");
        const data = (await response.json()) as {
          active?: boolean;
          expiresAt?: number;
        };
        if (!mounted) return;
        const active = data.active === true && Number(data.expiresAt) > Date.now();
        const expiresAt = active ? Number(data.expiresAt) : undefined;
        setBypassStatus({ userId, checking: false, active, expiresAt });
        if (active && expiresAt) {
          expiryTimer = setTimeout(() => {
            if (mounted) {
              setBypassStatus({ userId, checking: false, active: false });
            }
          }, Math.max(0, expiresAt - Date.now()));
        }
      })
      .catch(() => {
        if (mounted) {
          setBypassStatus({ userId, checking: false, active: false });
        }
      });

    return () => {
      mounted = false;
      if (expiryTimer) clearTimeout(expiryTimer);
    };
  }, [isAuthenticated, user?.id, user?.role]);

  const currentBypassStatus =
    isAuthenticated && user?.role === "user"
      ? bypassStatus.userId === (user.id || "")
        ? bypassStatus
        : { checking: true, active: false }
      : { checking: false, active: false };

  return (
    <MaintenanceBoundary
      user={user}
      isAuthenticated={isAuthenticated}
      config={config}
      loading={loading}
      bypassStatus={currentBypassStatus}
    >
      {children}
    </MaintenanceBoundary>
  );
}
