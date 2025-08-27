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

    // Log del intento de acceso
    const logAccess = (granted: boolean, reason: string) => {
      const auditLog = {
        timestamp: new Date().toISOString(),
        userId: user?.id || 'anonymous',
        userName: user?.name || 'Unknown',
        action: granted ? 'ROUTE_ACCESS_GRANTED' : 'ROUTE_ACCESS_DENIED',
        details: `Access to ${pathname} - ${reason}`,
        sessionId: localStorage.getItem('pricemaster_session_id') || '',
        userAgent: navigator.userAgent
      };

      try {
        const existingLogs = JSON.parse(localStorage.getItem('pricemaster_audit_logs') || '[]');
        existingLogs.push(auditLog);

        if (existingLogs.length > 100) {
          existingLogs.shift();
        }

        localStorage.setItem('pricemaster_audit_logs', JSON.stringify(existingLogs));

        if (!granted) {
          console.warn('🚫 ROUTE ACCESS DENIED:', auditLog);
        }
      } catch (error) {
        console.error('Error logging route access:', error);
      }
    };

    // Verificar autenticación
    if (requireAuth && !isAuthenticated) {
      logAccess(false, 'User not authenticated');
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
        logAccess(false, `User role ${user?.role} insufficient, required: ${requiredRole}`);
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
        logAccess(false, `User role ${userRole} not in allowed roles: ${allowedRoles.join(', ')}`);
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
    logAccess(true, `Access granted for role: ${user?.role}`);
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
