import { useState, useEffect, useCallback } from 'react';
import type { User, UserPermissions } from '../types/firestore';

interface SessionData {
  id?: string;
  name: string;
  location?: string;
  role?: 'admin' | 'user' | 'superadmin';
  permissions?: UserPermissions;
  loginTime: string;
  lastActivity?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface AuditLog {
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId: string;
}

// Duración de la sesión en horas por tipo de usuario
const SESSION_DURATION_HOURS = {
  superadmin: 4,    // SuperAdmin: 4 horas por seguridad
  admin: 24,        // Admin: 24 horas
  user: 720         // User: 30 días
};

// Tiempo de inactividad máximo antes de logout automático (en minutos)
const MAX_INACTIVITY_MINUTES = {
  superadmin: 30,   // SuperAdmin: 30 minutos
  admin: 120,       // Admin: 2 horas
  user: 480         // User: 8 horas
};

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sessionWarning, setSessionWarning] = useState(false);

  // Función para generar ID de sesión único
  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Función para obtener información del navegador
  const getBrowserInfo = () => {
    return {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled
    };
  };  // Función para registrar logs de auditoría
  const logAuditEvent = useCallback((action: string, details: string, userId?: string) => {
    try {
      const currentUser = user;
      const auditLog: AuditLog = {
        timestamp: new Date().toISOString(),
        userId: userId || currentUser?.id || 'anonymous',
        userName: currentUser?.name || 'Unknown',
        action,
        details,
        sessionId: currentUser ? localStorage.getItem('pricemaster_session_id') || '' : '',
        userAgent: navigator.userAgent
      };

      // Guardar en localStorage (en producción, enviar al servidor)
      const existingLogs = JSON.parse(localStorage.getItem('pricemaster_audit_logs') || '[]');
      existingLogs.push(auditLog);
      
      // Mantener solo los últimos 100 logs
      if (existingLogs.length > 100) {
        existingLogs.shift();
      }
      
      localStorage.setItem('pricemaster_audit_logs', JSON.stringify(existingLogs));
    } catch (error) {
      console.error('Error logging audit event:', error);
    }
  }, [user]);

  // Función para verificar tiempo de inactividad
  const checkInactivity = useCallback((session: SessionData) => {
    if (!session.lastActivity || !session.role) return false;

    const lastActivity = new Date(session.lastActivity);
    const now = new Date();
    const minutesInactive = (now.getTime() - lastActivity.getTime()) / (1000 * 60);
    const maxInactivity = MAX_INACTIVITY_MINUTES[session.role] || MAX_INACTIVITY_MINUTES.user;

    return minutesInactive > maxInactivity;
  }, []);
  // Función para actualizar actividad del usuario
  const updateActivity = useCallback(() => {
    if (isAuthenticated && user) {
      const sessionData = localStorage.getItem('pricemaster_session');
      if (sessionData) {
        try {
          const session: SessionData = JSON.parse(sessionData);
          session.lastActivity = new Date().toISOString();
          localStorage.setItem('pricemaster_session', JSON.stringify(session));
        } catch (error) {
          console.error('Error updating activity:', error);
        }
      }
    }  }, [isAuthenticated, user]);

  const logout = useCallback((reason?: string) => {
    const currentUser = user;

    // Log de auditoría antes del logout
    if (currentUser) {
      logAuditEvent('LOGOUT', reason || 'Manual logout', currentUser.id);
    }

    // Limpiar datos de sesión
    localStorage.removeItem('pricemaster_session');
    localStorage.removeItem('pricemaster_session_id');
    
    setUser(null);
    setIsAuthenticated(false);
    setSessionWarning(false);
  }, [user, logAuditEvent]);const checkExistingSession = useCallback(() => {
    try {
      const sessionData = localStorage.getItem('pricemaster_session');
      if (sessionData) {        const session: SessionData = JSON.parse(sessionData);

        // Verificar si la sesión no ha expirado según el rol
        const loginTime = new Date(session.loginTime);
        const now = new Date();
        const hoursElapsed = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
        const maxHours = SESSION_DURATION_HOURS[session.role || 'user'] || SESSION_DURATION_HOURS.user;

        // Verificar inactividad
        const isInactive = checkInactivity(session);        if (hoursElapsed < maxHours && !isInactive) {
          // Only update user if the data has actually changed
          const newUserData = {
            id: session.id,
            name: session.name,
            location: session.location,
            role: session.role,
            permissions: session.permissions // ¡Importante! Incluir los permisos desde la sesión
          };

          // Check if user data has changed to prevent unnecessary re-renders
          const hasUserChanged = !user || 
            user.id !== newUserData.id ||
            user.name !== newUserData.name ||
            user.location !== newUserData.location ||
            user.role !== newUserData.role ||
            JSON.stringify(user.permissions) !== JSON.stringify(newUserData.permissions);

          if (hasUserChanged) {
            setUser(newUserData);
          }

          if (!isAuthenticated) {
            setIsAuthenticated(true);
          }

          // Advertencia de sesión para SuperAdmin (30 minutos antes de expirar)
          if (session.role === 'superadmin') {
            const minutesLeft = (maxHours * 60) - (hoursElapsed * 60);
            const shouldShowWarning = minutesLeft <= 30 && minutesLeft > 0;
            if (shouldShowWarning !== sessionWarning) {
              setSessionWarning(shouldShowWarning);
            }
          }

          logAuditEvent('SESSION_RESUMED', `User ${session.name} resumed session`, session.id);
        } else {
          // Sesión expirada o inactiva
          const reason = isInactive ? 'inactivity' : 'time_expiration';
          logAuditEvent('SESSION_EXPIRED', `Session expired due to ${reason}`, session.id);
          logout();
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      logAuditEvent('SESSION_ERROR', `Error checking session: ${error}`);
      logout();
    } finally {
      setLoading(false);
    }
  }, [checkInactivity, logout, user, isAuthenticated, sessionWarning, logAuditEvent]);
  useEffect(() => {
    checkExistingSession();

    // Configurar listener para actividad del usuario
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    
    const handleActivity = () => {
      updateActivity();
    };

    // Agregar listeners
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Verificar sesión cada 5 minutos
    const sessionInterval = setInterval(() => {
      checkExistingSession();
    }, 5 * 60 * 1000);

    // Cleanup
    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(sessionInterval);
    };
  }, [checkExistingSession, updateActivity]);
  const login = (userData: User) => {
    const sessionId = generateSessionId();
    const browserInfo = getBrowserInfo();
    
    // Crear datos de sesión completos
    const sessionData: SessionData = {
      id: userData.id,
      name: userData.name,
      location: userData.location,
      role: userData.role,
      permissions: userData.permissions, // ¡Importante! Incluir los permisos
      loginTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      sessionId,
      userAgent: browserInfo.userAgent
    };

    // Guardar sesión
    localStorage.setItem('pricemaster_session', JSON.stringify(sessionData));
    localStorage.setItem('pricemaster_session_id', sessionId);

    setUser(userData);
    setIsAuthenticated(true);
    setSessionWarning(false);    // Log de auditoría
    logAuditEvent('LOGIN_SUCCESS', `User ${userData.name} logged in with role ${userData.role}`, userData.id);
  };

  // Función para extender sesión
  const extendSession = () => {
    if (user && isAuthenticated) {
      const sessionData = localStorage.getItem('pricemaster_session');
      if (sessionData) {
        try {
          const session: SessionData = JSON.parse(sessionData);
          session.loginTime = new Date().toISOString();
          session.lastActivity = new Date().toISOString();
          localStorage.setItem('pricemaster_session', JSON.stringify(session));
          
          setSessionWarning(false);
          logAuditEvent('SESSION_EXTENDED', 'User extended session', user.id);
        } catch (error) {
          console.error('Error extending session:', error);
        }
      }
    }
  };
  // Función para obtener tiempo restante de sesión
  const getSessionTimeLeft = useCallback(() => {
    if (!user || !isAuthenticated) return 0;

    const sessionData = localStorage.getItem('pricemaster_session');
    if (!sessionData) return 0;

    try {
      const session: SessionData = JSON.parse(sessionData);
      const loginTime = new Date(session.loginTime);
      const now = new Date();
      const hoursElapsed = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
      const maxHours = SESSION_DURATION_HOURS[session.role || 'user'] || SESSION_DURATION_HOURS.user;
        return Math.max(0, maxHours - hoursElapsed);
    } catch {
      return 0;
    }
  }, [user, isAuthenticated]);

  // Función para obtener logs de auditoría (solo SuperAdmin)
  const getAuditLogs = () => {
    if (user?.role !== 'superadmin') {
      logAuditEvent('UNAUTHORIZED_ACCESS', 'Attempted to access audit logs without SuperAdmin role');
      return [];
    }

    try {
      const logs = JSON.parse(localStorage.getItem('pricemaster_audit_logs') || '[]');
      logAuditEvent('AUDIT_LOGS_ACCESSED', 'SuperAdmin accessed audit logs');
      return logs;
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return [];
    }
  };  const isAdmin = useCallback(() => {
    return user?.role === 'admin' || user?.role === 'superadmin';
  }, [user?.role]);

  const isSuperAdmin = useCallback(() => {
    return user?.role === 'superadmin';
  }, [user?.role]);

  const canChangeLocation = useCallback(() => {
    return user?.role === 'admin' || user?.role === 'superadmin';
  }, [user?.role]);
  // Función para verificar si el usuario necesita autenticación de dos factores
  const requiresTwoFactor = useCallback(() => {
    return user?.role === 'superadmin';
  }, [user?.role]);

  return {
    user,
    isAuthenticated,
    loading,
    sessionWarning,
    login,
    logout,
    extendSession,
    isAdmin,
    isSuperAdmin,
    canChangeLocation,
    requiresTwoFactor,
    getSessionTimeLeft,
    getAuditLogs,
    updateActivity
  };
}
