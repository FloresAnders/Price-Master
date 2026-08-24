"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Footer } from "../layout";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { isPublicRoute } from "./publicRoutes";
import LoginModal from "./LoginModal";

interface AuthWrapperProps {
  children: React.ReactNode;
}

function AuthGuard({ children }: AuthWrapperProps) {
  const { user, isAuthenticated, loading, login } = useAuth();
  const pathname = usePathname();
  const publicRoute = isPublicRoute(pathname);

  if (loading && !publicRoute) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020713] text-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-14 w-14 animate-spin rounded-full border-2 border-slate-700 border-b-blue-500" />
          <p className="text-sm text-slate-400">Verificando sesión…</p>
        </div>
      </div>
    );
  }

  if (publicRoute) return <>{children}</>;

  if (!isAuthenticated || !user) {
    return (
      <div className="flex min-h-screen flex-col bg-[#020713]">
        <div className="flex min-h-0 flex-1">
          <LoginModal
            isOpen
            onClose={() => undefined}
            onLoginSuccess={login}
            title="Time Master"
            canClose={false}
          />
        </div>
        <Footer />
      </div>
    );
  }

  return <>{children}</>;
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  return (
    <AuthProvider>
      <AuthGuard>{children}</AuthGuard>
    </AuthProvider>
  );
}
