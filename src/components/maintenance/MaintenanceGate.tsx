"use client";

import type { ReactNode } from "react";
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
}: {
  children: ReactNode;
  user: User | null;
  isAuthenticated: boolean;
  config: MaintenanceConfig;
  loading: boolean;
}) {
  if (!isAuthenticated || !user || user.role === "superadmin") {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-[#020713] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-2 border-slate-700 border-b-blue-500" />
          <p className="text-sm text-slate-400">Verificando disponibilidad…</p>
        </div>
      </main>
    );
  }

  const block = getMaintenanceBlock(config, user);
  return block ? <MaintenanceScreen block={block} /> : <>{children}</>;
}

export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { config, loading } = useMaintenance();

  return (
    <MaintenanceBoundary
      user={user}
      isAuthenticated={isAuthenticated}
      config={config}
      loading={loading}
    >
      {children}
    </MaintenanceBoundary>
  );
}
