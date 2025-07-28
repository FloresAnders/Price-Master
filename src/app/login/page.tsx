'use client';

import React, { useState, useEffect } from 'react';
import { Lock, Eye, AlertTriangle, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { UsersService } from '@/services/users';
import { createSession, saveSession, isSessionValid, clearSession } from '@/utils/session';

export default function LoginPage() {
    const router = useRouter();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isClient, setIsClient] = useState(false);

    // Ensure component is mounted on client
    useEffect(() => {
        setIsClient(true);
        
        // Verificar si llegó aquí por sesión expirada
        if (typeof window !== 'undefined') {
            const urlParams = new URLSearchParams(window.location.search);
            if (urlParams.get('expired') === 'true') {
                setLoginError('Su sesión ha expirado después de 5 horas. Por favor, inicie sesión nuevamente.');
            }
        }
    }, []);

    // Verificar si ya está autenticado al cargar la página
    useEffect(() => {
        if (!isClient) return;
        
        if (isSessionValid()) {
            // Si la sesión es válida, redirigir directamente a backdoor
            router.push('/backdoor');
        } else {
            // Si hay una sesión expirada, limpiarla y mostrar mensaje
            const storedUserData = localStorage.getItem('simple_login_user');
            if (storedUserData) {
                clearSession();
                setLoginError('Su sesión ha expirado después de 5 horas. Por favor, inicie sesión nuevamente.');
            }
        }
    }, [router, isClient]);

    // Función para manejar el login
    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setLoginError('');

        try {
            // Buscar el usuario en la base de datos
            const users = await UsersService.getAllUsers();
            const foundUser = users.find(user =>
                user.name.toLowerCase() === username.trim().toLowerCase()
            );

            if (!foundUser) {
                setLoginError('Usuario no encontrado.');
                setLoading(false);
                return;
            }

            if (!foundUser.isActive) {
                setLoginError('Usuario desactivado.');
                setLoading(false);
                return;
            }

            // Verificar que la contraseña almacenada en BD sea igual al nombre de usuario
            // Y que la contraseña ingresada coincida con la contraseña de BD
            if (foundUser.password === foundUser.name && foundUser.password === password.trim()) {
                // Login exitoso: usuario existe, está activo, y cumple la regla de acceso
                if (isClient) {
                    // Crear y guardar sesión con expiración de 5 horas
                    const sessionData = createSession(foundUser);
                    saveSession(sessionData);
                }

                // Log de acceso exitoso
                console.log('✅ LOGIN EXITOSO:', {
                    username: foundUser.name,
                    userId: foundUser.id,
                    timestamp: new Date().toISOString(),
                    action: 'SIMPLE_LOGIN_SUCCESS'
                });

                // Redirigir inmediatamente a backdoor después del login exitoso
                router.push('/backdoor');
                return;
            } else {
                // Login fallido: aunque el usuario existe y la contraseña sea correcta según BD,
                // no cumple con la regla de que usuario = contraseña en BD
                setLoginError('Credenciales incorrectas. Verifique usuario y contraseña.');
                console.warn('❌ LOGIN FALLIDO:', {
                    username: username.trim(),
                    timestamp: new Date().toISOString(),
                    action: 'SIMPLE_LOGIN_FAILED',
                    reason: 'User exists but does not meet access rule (username != password in DB) or password mismatch'
                });
            }
        } catch (_error) {
            console.error('Error during login:', _error);
            setLoginError('Error al conectar con la base de datos. Intente nuevamente.');
        }

        setLoading(false);
    };

    // Mostrar formulario de login
    return (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="max-w-md mx-auto bg-[var(--card)] border-2 border-blue-200 dark:border-blue-800 rounded-xl shadow-lg p-8">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full">
                            <Lock className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-[var(--foreground)] mb-2">Iniciar Sesión</h1>
                    <p className="text-[var(--muted-foreground)]">Accede al sistema con tus credenciales</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label htmlFor="username" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Nombre de Usuario
                        </label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                            <input
                                id="username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-10 pr-4 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-[var(--background)] text-[var(--foreground)]"
                                placeholder="Ingresa tu usuario"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-[var(--foreground)] mb-2">
                            Contraseña
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                            <input
                                id="password"
                                type={showPassword ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-10 pr-12 py-3 border border-[var(--border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-[var(--background)] text-[var(--foreground)]"
                                placeholder="Ingresa tu contraseña"
                                required
                                disabled={loading}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                disabled={loading}
                            >
                                <Eye className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {loginError && (
                        <div className="bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg p-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                                <span className="text-red-800 dark:text-red-300 text-sm font-medium">{loginError}</span>
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !username.trim() || !password.trim()}
                        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        {loading ? (
                            <div className="flex items-center justify-center gap-2">
                                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                                    <path d="M12 2L12 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                                </svg>
                                Verificando...
                            </div>
                        ) : (
                            '🔐 Iniciar Sesión'
                        )}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-[var(--muted-foreground)]">
                        ¿Problemas para acceder? Contacta al administrador del sistema.
                    </p>
                </div>
            </div>
        </main>
    );
}
