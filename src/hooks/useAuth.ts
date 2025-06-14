import { useState, useEffect, useCallback } from 'react';
import type { User } from '../types/firestore';

interface SessionData {
  id?: string;
  name: string;
  location?: string;
  role?: 'admin' | 'user' | 'superadmin';
  loginTime: string;
}

// Duración de la sesión en horas
// Opciones disponibles:
// - 24 horas = 24
// - 7 días = 168
// - 30 días = 720
// - 90 días = 2160
// - 1 año = 8760
const SESSION_DURATION_HOURS = 720; // 30 días

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const checkExistingSession = useCallback(() => {
    try {
      const sessionData = localStorage.getItem('pricemaster_session');
      if (sessionData) {
        const session: SessionData = JSON.parse(sessionData);        // Verificar si la sesión no ha expirado (30 días)
        const loginTime = new Date(session.loginTime);
        const now = new Date();
        const hoursElapsed = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);

        if (hoursElapsed < SESSION_DURATION_HOURS) { // Sesión válida por 30 días
          setUser({
            id: session.id,
            name: session.name,
            location: session.location,
            role: session.role
          });
          setIsAuthenticated(true);
        } else {
          // Sesión expirada
          logout();
        }
      }
    } catch (error) {
      console.error('Error checking session:', error);
      logout();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkExistingSession();
  }, [checkExistingSession]);

  const login = (userData: User) => {
    setUser(userData);
    setIsAuthenticated(true);
  };

  const logout = () => {
    localStorage.removeItem('pricemaster_session');
    setUser(null);
    setIsAuthenticated(false);
  };
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  const isSuperAdmin = () => {
    return user?.role === 'superadmin';
  };
  const canChangeLocation = () => {
    return user?.role === 'admin' || user?.role === 'superadmin';
  };

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    isAdmin,
    isSuperAdmin,
    canChangeLocation
  };
}
