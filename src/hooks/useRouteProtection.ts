// src/hooks/useRouteProtection.ts
'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from './useAuth';

interface RouteProtectionConfig {
  requiredRole?: 'user' | 'admin' | 'superadmin';
  redirectTo?: string;
  allowedRoles?: ('user' | 'admin' | 'superadmin')[];
  requireAuth?: boolean;
  onUnauthorized?: () => void;
  onAccessDenied?: () => void;
}

export function useRouteProtection(config: RouteProtectionConfig = {}) {
  const {
    requiredRole,
    redirectTo = '/',
    allowedRoles = [],
    requireAuth = true,
    onUnauthorized,
    onAccessDenied
  } = config;

  const { user, isAuthenticated, loading, isSuperAdmin, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);

  useEffect(() => {
    if (loading) return;

    // Verificar autenticación
    if (requireAuth && !isAuthenticated) {
      setAccessGranted(false);
      setAccessChecked(true);
      if (onUnauthorized) {
        onUnauthorized();
      } else {
        router.push(redirectTo);
      }
      return;
    }

    // Verificar rol específico requerido
    if (requiredRole) {
      let hasRequiredRole = false;

      switch (requiredRole) {
        case 'superadmin':
          hasRequiredRole = isSuperAdmin();
          break;
        case 'admin':
          hasRequiredRole = isAdmin();
          break;
        case 'user':
          hasRequiredRole = !!user;
          break;
      }

      if (!hasRequiredRole) {
        setAccessGranted(false);
        setAccessChecked(true);
        if (onAccessDenied) {
          onAccessDenied();
        } else {
          router.push(redirectTo);
        }
        return;
      }
    }

    // Verificar roles permitidos
    if (allowedRoles.length > 0) {
      const userRole = user?.role;
      if (!userRole || !allowedRoles.includes(userRole)) {
        setAccessGranted(false);
        setAccessChecked(true);
        if (onAccessDenied) {
          onAccessDenied();
        } else {
          router.push(redirectTo);
        }
        return;
      }
    }

    // Acceso concedido
    setAccessGranted(true);
    setAccessChecked(true);
  }, [
    loading,
    isAuthenticated,
    user,
    isSuperAdmin,
    isAdmin,
    requiredRole,
    allowedRoles,
    requireAuth,
    pathname,
    router,
    redirectTo,
    onUnauthorized,
    onAccessDenied
  ]);

  return {
    accessGranted,
    accessChecked,
    loading: loading || !accessChecked,
    user,
    isAuthenticated,
    userRole: user?.role
  };
}

// Hook específico para proteger rutas SuperAdmin
export function useSuperAdminRoute(config: Omit<RouteProtectionConfig, 'requiredRole'> = {}) {
  return useRouteProtection({
    ...config,
    requiredRole: 'superadmin'
  });
}

// Hook específico para proteger rutas Admin
export function useAdminRoute(config: Omit<RouteProtectionConfig, 'requiredRole'> = {}) {
  return useRouteProtection({
    ...config,
    allowedRoles: ['admin', 'superadmin']
  });
}

// Hook para rutas que requieren cualquier autenticación
export function useAuthRoute(config: Omit<RouteProtectionConfig, 'requireAuth'> = {}) {
  return useRouteProtection({
    ...config,
    requireAuth: true
  });
}
