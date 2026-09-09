"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  createDefaultMaintenanceConfig,
  subscribeToMaintenance,
  type MaintenanceConfig,
} from "@/services/maintenance";

interface MaintenanceContextValue {
  config: MaintenanceConfig;
  loading: boolean;
  error: string | null;
}

const MaintenanceContext = createContext<MaintenanceContextValue | null>(null);

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [config, setConfig] = useState<MaintenanceConfig>(
    createDefaultMaintenanceConfig,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    return subscribeToMaintenance(
      (nextConfig) => {
        setConfig(nextConfig);
        setLoading(false);
        setError(null);
      },
      (subscriptionError) => {
        console.warn(
          "No se pudo cargar la configuración de mantenimiento",
          subscriptionError,
        );
        setLoading(false);
        setError("No se pudo verificar el estado de mantenimiento.");
      },
    );
  }, [isAuthenticated, user]);

  const value = useMemo(
    () => ({ config, loading, error }),
    [config, error, loading],
  );

  return (
    <MaintenanceContext.Provider value={value}>
      {children}
    </MaintenanceContext.Provider>
  );
}

export function useMaintenance(): MaintenanceContextValue {
  const context = useContext(MaintenanceContext);
  if (!context) {
    throw new Error(
      "useMaintenance debe utilizarse dentro de MaintenanceProvider.",
    );
  }
  return context;
}
