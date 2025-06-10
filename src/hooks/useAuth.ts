import { useState, useEffect } from 'react';
import type { User } from '../types/firestore';

interface SessionData {
  id?: string;
  name: string;
  location?: string;
  role?: 'admin' | 'user' | 'manager';
  loginTime: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = () => {
    try {
      const sessionData = localStorage.getItem('pricemaster_session');
      if (sessionData) {
        const session: SessionData = JSON.parse(sessionData);
        
        // Verificar si la sesión no ha expirado (opcional: 24 horas)
        const loginTime = new Date(session.loginTime);
        const now = new Date();
        const hoursElapsed = (now.getTime() - loginTime.getTime()) / (1000 * 60 * 60);
        
        if (hoursElapsed < 24) { // Sesión válida por 24 horas
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
  };

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

  const canChangeLocation = () => {
    return user?.role === 'admin';
  };

  return {
    user,
    isAuthenticated,
    loading,
    login,
    logout,
    isAdmin,
    canChangeLocation
  };
}
