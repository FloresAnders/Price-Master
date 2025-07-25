'use client';

import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, User, LogIn, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { User as FirestoreUser } from '@/types/firestore';

// Componente que maneja toda la lógica del backdoor
function BackdoorContent() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<FirestoreUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState<string>('');

    // Verificar autenticación al cargar la página
    useEffect(() => {
        const storedUserData = localStorage.getItem('simple_login_user');
        if (!storedUserData) {
            // Si no está autenticado, redirigir al login
            router.push('/login');
            return;
        }

        try {
            const userData = JSON.parse(storedUserData);
            setCurrentUser(userData);
            setLoading(false);
        } catch (error) {
            // Si hay error al parsear, limpiar localStorage y redirigir
            localStorage.removeItem('simple_login_user');
            router.push('/login');
        }
    }, [router]);

    // Establecer la hora actual solo en el cliente
    useEffect(() => {
        setCurrentTime(new Date().toLocaleTimeString());
    }, []);

    // Función para cerrar sesión
    const handleLogout = () => {
        localStorage.removeItem('simple_login_user');
        setCurrentUser(null);
        console.log('🚪 LOGOUT:', {
            timestamp: new Date().toISOString(),
            action: 'SIMPLE_LOGOUT'
        });
        // Redirigir al login después del logout
        router.push('/login');
    };

    // Mostrar loading mientras verifica autenticación
    if (loading) {
        return (
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="flex items-center gap-3">
                        <svg className="animate-spin w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                            <path d="M12 2L12 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                        </svg>
                        <span className="text-lg text-[var(--muted-foreground)]">Verificando acceso...</span>
                    </div>
                </div>
            </main>
        );
    }

    // Si no hay usuario después de cargar, mostrar mensaje (no debería pasar)
    if (!currentUser) {
        return (
            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center justify-center min-h-[60vh]">
                    <div className="text-center">
                        <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-[var(--foreground)] mb-2">Acceso no autorizado</h2>
                        <p className="text-[var(--muted-foreground)]">Redirigiendo al login...</p>
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header de bienvenida */}
            <div className="mb-8 bg-gradient-to-r from-green-600 to-green-800 text-white p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <CheckCircle className="w-8 h-8" />
                        <div>
                            <h1 className="text-2xl font-bold">✅ Acceso Autorizado - Backdoor</h1>
                            <p className="text-green-100">Bienvenido, {currentUser?.name}</p>
                        </div>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center gap-2"
                    >
                        <LogIn className="w-4 h-4 rotate-180" />
                        Cerrar Sesión
                    </button>
                </div>
            </div>

            {/* Contenido del área protegida */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Información del usuario */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <User className="w-6 h-6 text-blue-600" />
                        <h2 className="text-xl font-semibold text-[var(--foreground)]">Información del Usuario</h2>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Usuario:</span>
                            <span className="font-semibold text-[var(--foreground)]">{currentUser?.name}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">ID:</span>
                            <span className="font-semibold text-[var(--foreground)] text-xs">{currentUser?.id?.slice(-8)}</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Rol:</span>
                            <span className={`font-semibold px-3 py-1 rounded-full text-sm ${currentUser?.role === 'superadmin'
                                ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                : currentUser?.role === 'admin'
                                    ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                                }`}>
                                {currentUser?.role === 'superadmin' ? '🔴 SuperAdmin' :
                                    currentUser?.role === 'admin' ? '🟠 Admin' : '🔵 User'}
                            </span>
                        </div>
                        {currentUser?.location && (
                            <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                                <span className="text-[var(--muted-foreground)]">Ubicación:</span>
                                <span className="font-semibold text-[var(--foreground)]">{currentUser.location}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Estado:</span>
                            <span className="font-semibold bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-3 py-1 rounded-full text-sm">
                                🟢 Conectado
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Acceso:</span>
                            <span className="font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 px-3 py-1 rounded-full text-sm">
                                🔵 Autorizado
                            </span>
                        </div>
                    </div>
                </div>

                {/* Estadísticas de sesión */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <Shield className="w-6 h-6 text-green-600" />
                        <h2 className="text-xl font-semibold text-[var(--foreground)]">Sesión Actual</h2>
                    </div>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Inicio:</span>
                            <span className="font-semibold text-[var(--foreground)]">
                                {currentTime || 'Cargando...'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Tipo:</span>
                            <span className="font-semibold text-[var(--foreground)]">Backdoor Access</span>
                        </div>
                        <div className="flex justify-between items-center p-3 bg-[var(--muted)] rounded-lg">
                            <span className="text-[var(--muted-foreground)]">Seguridad:</span>
                            <span className="font-semibold bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-3 py-1 rounded-full text-sm">
                                🟡 Estándar
                            </span>
                        </div>
                    </div>
                </div>

                {/* Información del sistema */}
                <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-6 shadow-lg">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-orange-600" />
                        <h2 className="text-xl font-semibold text-[var(--foreground)]">Información</h2>
                    </div>
                    <div className="space-y-3 text-sm text-[var(--muted-foreground)]">
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
                            <p className="text-blue-800 dark:text-blue-300">
                                <strong>Sistema Seguro:</strong> Acceso controlado mediante autenticación de credenciales.
                            </p>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                            <p className="text-yellow-800 dark:text-yellow-300">
                                <strong>Nota:</strong> Mantenga sus credenciales seguras y no las comparta con terceros.
                            </p>
                        </div>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg p-3">
                            <p className="text-red-800 dark:text-red-300">
                                <strong>Backdoor:</strong> Área de acceso especial para usuarios autorizados.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Área de contenido adicional */}
            <div className="mt-8 bg-[var(--card)] border border-[var(--border)] rounded-xl p-8 shadow-lg">
                <h2 className="text-2xl font-bold text-[var(--foreground)] mb-6 text-center">
                    🚪 ¡Backdoor Access Desbloqueado!
                </h2>

                <div className="text-center text-[var(--muted-foreground)] space-y-4">
                    <p className="text-lg">
                        Has accedido exitosamente al área backdoor del sistema.
                    </p>
                    <p>
                        Este contenido solo está disponible para usuarios autenticados
                        con credenciales válidas a través del sistema de login.
                    </p>
                    <div className="bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6 mt-6">
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">
                            🚀 Características del Sistema Backdoor
                        </h3>
                        <ul className="text-left text-[var(--muted-foreground)] space-y-2">
                            <li>• ✅ Autenticación segura basada en credenciales</li>
                            <li>• 🔒 Persistencia local de sesión</li>
                            <li>• 📱 Diseño responsivo</li>
                            <li>• 🌙 Soporte para modo oscuro</li>
                            <li>• 🔄 Gestión de estado en tiempo real</li>
                            <li>• 🚪 Acceso backdoor especializado</li>
                            <li>• 🔐 Protección contra acceso no autorizado</li>
                        </ul>
                    </div>
                </div>
            </div>
        </main>
    );
}

// Importar dinámicamente para evitar SSR y problemas de hidratación
const BackdoorPageDynamic = dynamic(() => Promise.resolve(BackdoorContent), {
    ssr: false,
    loading: () => (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex items-center gap-3">
                    <svg className="animate-spin w-8 h-8 text-blue-600" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.3" />
                        <path d="M12 2L12 6" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
                    </svg>
                    <span className="text-lg text-[var(--muted-foreground)]">Cargando...</span>
                </div>
            </div>
        </main>
    )
});

export default function BackdoorPage() {
    return <BackdoorPageDynamic />;
}
