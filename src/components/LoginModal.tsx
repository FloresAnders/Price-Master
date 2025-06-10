'use client';

import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff } from 'lucide-react';
import { UsersService } from '../services/users';
import type { User as UserType } from '../types/firestore';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (user: UserType) => void;
  onClose: () => void;
  title: string;
}

export default function LoginModal({ isOpen, onLoginSuccess, onClose, title }: LoginModalProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Obtener todos los usuarios activos
      const users = await UsersService.getActiveUsers();
      
      // Buscar usuario por nombre y contraseña
      const user = users.find(u => 
        u.name.toLowerCase() === username.toLowerCase() && 
        u.password === password
      );

      if (user) {
        // Guardar sesión en localStorage
        const sessionData = {
          id: user.id,
          name: user.name,
          location: user.location,
          role: user.role,
          loginTime: new Date().toISOString()
        };
        localStorage.setItem('pricemaster_session', JSON.stringify(sessionData));
        
        onLoginSuccess(user);
        
        // Limpiar formulario
        setUsername('');
        setPassword('');
      } else {
        setError('Credenciales incorrectas');
      }
    } catch (error) {
      console.error('Error during login:', error);
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--card-bg)] rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
        <div className="text-center mb-6">
          <Lock className="w-12 h-12 mx-auto mb-4 text-blue-600" />
          <h2 className="text-2xl font-semibold mb-2">Iniciar Sesión</h2>
          <p className="text-[var(--tab-text)]">
            Acceso requerido para {title}
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre de Usuario
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--input-bg)] text-[var(--foreground)]"
                placeholder="Ingresa tu nombre de usuario"
                required
                disabled={loading}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-[var(--input-bg)] text-[var(--foreground)]"
                placeholder="Ingresa tu contraseña"
                required
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                disabled={loading}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-4 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Verificando...' : 'Iniciar Sesión'}
            </button>
          </div>        </form>
      </div>
    </div>
  );
}
