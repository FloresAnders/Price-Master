"use client";
import { Footer } from "../layout";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import LoginModal from "./LoginModal";
import type { User } from "@/types/firestore";
import { safeLocalStorage } from "@/utils/client";
//delete this line if not needed
import { usePathname } from "next/navigation";
//---------------------------------------------
interface AuthWrapperProps {
  children: React.ReactNode;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { user, isAuthenticated, loading, login } = useAuth();
  //delete this line if not needed
  const pathname = usePathname();
  const [hasStoredSession, setHasStoredSession] = useState<boolean>(() => {
    try {
      const hasTraditional = Boolean(
        safeLocalStorage.getItem("pricemaster_session"),
      );
      const hasToken = Boolean(
        safeLocalStorage.getItem("pricemaster_token_session"),
      );
      return hasTraditional || hasToken;
    } catch {
      return false;
    }
  });

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/home", "/reset-password", "/pruebas"];
  const isPublicRoute = publicRoutes.includes(pathname);

  useEffect(() => {
    const onStorage = () => {
      try {
        const hasTraditional = Boolean(
          safeLocalStorage.getItem("pricemaster_session"),
        );
        const hasToken = Boolean(
          safeLocalStorage.getItem("pricemaster_token_session"),
        );
        setHasStoredSession(hasTraditional || hasToken);
      } catch {
        setHasStoredSession(false);
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Si es ruta pública, renderizar sin autenticación
  if (isPublicRoute) {
    return <>{children}</>;
  }
  //---------------------------------------------
  // Failsafe: si no hay nada guardado para verificar, no mostrar spinner infinito.
  if (loading && hasStoredSession === false) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[4px]" />

        <div className="relative z-10 min-h-screen flex flex-col">
          <div className="flex-1 min-h-0 flex">
            <LoginModal
              isOpen={true}
              onClose={() => {}}
              onLoginSuccess={(
                userData: User,
                keepActive?: boolean,
                useTokens?: boolean,
              ) => {
                login(userData, keepActive, useTokens);
              }}
              title="Time Master"
              canClose={false}
            />
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // Mostrar loading mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--background)] dark:bg-zinc-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-[var(--primary)] mx-auto mb-4"></div>
          <p className="text-[var(--muted-foreground)]">
            Verificando sesión...
          </p>
        </div>
      </div>
    );
  }

  // Si no está autenticado, mostrar modal de login directamente
  if (!isAuthenticated || !user) {
    return (
      <div className="relative min-h-screen">
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[4px]" />

        <div className="relative z-10 min-h-screen flex flex-col">
          <div className="flex-1 min-h-0 flex">
            <LoginModal
              isOpen={true}
              onClose={() => {}} // No permitir cerrar
              onLoginSuccess={(
                userData: User,
                keepActive?: boolean,
                useTokens?: boolean,
              ) => {
                login(userData, keepActive, useTokens);
              }}
              title="Time Master"
              canClose={false} // No mostrar botón cancelar
            />
          </div>
          <Footer />
        </div>
      </div>
    );
  }

  // Usuario autenticado, mostrar la aplicación
  return <>{children}</>;
}
