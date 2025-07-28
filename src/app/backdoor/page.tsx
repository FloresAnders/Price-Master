'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, LogIn, CheckCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import type { User as FirestoreUser } from '@/types/firestore';
import { isSessionValid, getSession, clearSession } from '@/utils/session';
import BackdoorScanHistory from './BackdoorScanHistory';
import Pruebas from './Pruebas';
import BarcodeScanner from '@/components/BarcodeScanner';
import ControlHorario from '@/components/ControlHorario';
import ScanHistory from '@/components/ScanHistory';
import SessionCounter from '@/components/SessionCounter';
import BackdoorSettings from '@/components/BackdoorSettings';
import type { ScanHistoryEntry } from '@/types/barcode';

type BackdoorTab = 'scanner' | 'controlhorario' | 'histoscans' | 'pruebas';

// Componente que maneja toda la lógica del backdoor
function BackdoorContent() {
    const router = useRouter();
    const [currentUser, setCurrentUser] = useState<FirestoreUser | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<BackdoorTab | null>(null);
    const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
    const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);
    const [showWelcomeBanner, setShowWelcomeBanner] = useState(true);
    const [isClient, setIsClient] = useState(false);
    const [showSessionCounter, setShowSessionCounter] = useState(true);

    // Ensure component is mounted on client
    useEffect(() => {
        setIsClient(true);
    }, []);

    // Verificar autenticación al cargar la página
    useEffect(() => {
        if (!isClient) return;
        
        if (!isSessionValid()) {
            // Sesión no válida o expirada, limpiar y redirigir
            clearSession();
            router.push('/login?expired=true');
            return;
        }
        
        // Obtener datos de sesión válida
        const sessionData = getSession();
        if (sessionData) {
            setCurrentUser(sessionData);
        }
        setLoading(false);
    }, [router, isClient]);

    // Verificar periódicamente si la sesión ha expirado (cada minuto)
    useEffect(() => {
        if (!isClient || !currentUser) return;

        const checkSessionExpiration = () => {
            if (!isSessionValid()) {
                clearSession();
                router.push('/login?expired=true');
                return;
            }
        };

        // Verificar cada minuto
        const interval = setInterval(checkSessionExpiration, 60000);
        
        return () => clearInterval(interval);
    }, [router, isClient, currentUser]);

    // Hide welcome banner after 5 seconds
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowWelcomeBanner(false);
        }, 5000);

        return () => clearTimeout(timer);
    }, []);

    // Load scan history from localStorage
    useEffect(() => {
        if (!isClient) return;
        
        const stored = localStorage.getItem('scanHistory');
        if (stored) {
            try {
                setScanHistory(JSON.parse(stored));
            } catch (error) {
                console.error('Error loading scan history:', error);
            }
        }
    }, [isClient]);

    // Save scan history to localStorage
    useEffect(() => {
        if (!isClient) return;
        
        if (scanHistory.length > 0) {
            localStorage.setItem('scanHistory', JSON.stringify(scanHistory));
        }
    }, [scanHistory, isClient]);

    // Handle hash changes for tabs
    useEffect(() => {
        if (!isClient) return;
        
        const checkAndSetTab = () => {
            const hash = window.location.hash.replace('#', '');
            // Map backdoor specific hash to standard tab names
            let mappedTab: BackdoorTab | null = null;
            if (hash === 'historial') {
                mappedTab = 'histoscans';
            } else if (hash === 'scanner') {
                mappedTab = 'scanner';
            } else if (hash === 'controlhorario') {
                mappedTab = 'controlhorario';
            } else if (hash === 'pruebas') {
                mappedTab = 'pruebas';
            }

            setActiveTab(mappedTab);
        };
        
        checkAndSetTab();

        const handleHashChange = () => {
            const hash = window.location.hash.replace('#', '');
            // Map backdoor specific hash to standard tab names
            let mappedTab: BackdoorTab | null = null;
            if (hash === 'historial') {
                mappedTab = 'histoscans';
            } else if (hash === 'scanner') {
                mappedTab = 'scanner';
            } else if (hash === 'controlhorario') {
                mappedTab = 'controlhorario';
            } else if (hash === 'pruebas') {
                mappedTab = 'pruebas';
            }

            setActiveTab(mappedTab);
        };

        window.addEventListener('hashchange', handleHashChange);
        return () => {
            window.removeEventListener('hashchange', handleHashChange);
        };
    }, [isClient]);

    // Handle code detection from scanner
    const handleCodeDetected = (code: string, productName?: string) => {
        setScanHistory(prev => {
            if (prev[0]?.code === code) return prev;
            const existing = prev.find(e => e.code === code);
            const newEntry: ScanHistoryEntry = existing
                ? { ...existing, code, name: productName || existing.name }
                : { code, name: productName };
            const filtered = prev.filter(e => e.code !== code);
            return [newEntry, ...filtered].slice(0, 20);
        });
    };

    // Handle copy code
    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code);
    };

    // Handle delete code from history
    const handleDelete = (code: string) => {
        setScanHistory(prev => prev.filter(entry => entry.code !== code));
    };

    // Handle remove leading zero from code
    const handleRemoveLeadingZero = (code: string) => {
        if (code.startsWith('0')) {
            const newCode = code.substring(1);
            setScanHistory(prev => prev.map(entry => 
                entry.code === code ? { ...entry, code: newCode } : entry
            ));
        }
    };

    // Handle rename product
    const handleRename = (code: string, name: string) => {
        setScanHistory(prev => prev.map(entry => 
            entry.code === code ? { ...entry, name } : entry
        ));
    };

    // Show notification
    const showNotification = (message: string, color: string = 'green') => {
        setNotification({ message, color });
        setTimeout(() => setNotification(null), 2000);
    };

    // Función para cerrar sesión
    const handleLogout = () => {
        clearSession();
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
        <>
            {/* Contador flotante de sesión */}
            {showSessionCounter && (
                <SessionCounter 
                    onExpired={() => {
                        clearSession();
                        router.push('/login?expired=true');
                    }}
                    onHide={() => setShowSessionCounter(false)}
                />
            )}

            {/* Configuración de Backdoor */}
            <BackdoorSettings 
                currentUser={currentUser}
                onSessionExtended={() => {
                    // Forzar actualización del SessionCounter
                    setShowSessionCounter(false);
                    setTimeout(() => setShowSessionCounter(true), 100);
                }}
            />

            {/* Botón para mostrar contador cuando está oculto */}
            {!showSessionCounter && (
                <button
                    onClick={() => setShowSessionCounter(true)}
                    className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group"
                    title="Mostrar contador de sesión"
                >
                    <Clock className="w-6 h-6 group-hover:scale-110 transition-transform" />
                </button>
            )}

            <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Notification */}
                {notification && (
                    <div
                        className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down bg-${notification.color}-500 text-white`}
                        style={{ minWidth: 180, textAlign: 'center' }}
                    >
                        {notification.message}
                    </div>
                )}

                {activeTab === null ? (
                    <>
                        {showWelcomeBanner && (
                            <div className="mb-8 bg-gradient-to-r from-green-600 to-green-800 text-white p-6 rounded-xl shadow-lg transition-opacity duration-500">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <CheckCircle className="w-8 h-8" />
                                        <div>
                                            <h1 className="text-2xl font-bold">✅ Acceso Autorizado - Backdoor</h1>
                                            <p className="text-green-100">Bienvenido, {currentUser?.name}</p>
                                            <p className="text-green-200 text-sm mt-1">
                                                💡 Usa el contador flotante para ver el tiempo de sesión restante
                                            </p>
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
                        )}

                        {/* Menu de opciones disponibles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                            {/* Scanner */}
                            <div
                                onClick={() => isClient && (window.location.hash = 'scanner')}
                                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-blue-400 group"
                            >
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 rounded-xl group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                                        <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Escáner</h3>
                                    <p className="text-[var(--muted-foreground)]">Escanear códigos de barras</p>
                                </div>
                            </div>

                            {/* Control Horario */}
                            <div
                                onClick={() => isClient && (window.location.hash = 'controlhorario')}
                                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-green-400 group"
                            >
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-green-100 dark:bg-green-900/30 rounded-xl group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                                        <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <circle cx="12" cy="12" r="10" />
                                            <polyline points="12,6 12,12 16,14" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Control Horario</h3>
                                    <p className="text-[var(--muted-foreground)]">Registro de horarios de trabajo</p>
                                </div>
                            </div>

                            {/* Historial de Escaneos */}
                            <div
                                onClick={() => isClient && (window.location.hash = 'historial')}
                                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-purple-400 group"
                            >
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-purple-100 dark:bg-purple-900/30 rounded-xl group-hover:bg-purple-200 dark:group-hover:bg-purple-900/50 transition-colors">
                                        <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Historial de Escaneos</h3>
                                    <p className="text-[var(--muted-foreground)]">Ver historial de escaneos realizados</p>
                                </div>
                            </div>

                            {/* Pruebas */}
                            <div
                                onClick={() => isClient && (window.location.hash = 'pruebas')}
                                className="bg-[var(--card-bg)] border border-[var(--border)] rounded-xl p-6 cursor-pointer hover:shadow-lg transition-all duration-200 hover:border-orange-400 group"
                            >
                                <div className="text-center">
                                    <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-orange-100 dark:bg-orange-900/30 rounded-xl group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50 transition-colors">
                                        <svg className="w-8 h-8 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-xl font-bold text-[var(--foreground)] mb-2">Pruebas</h3>
                                    <p className="text-[var(--muted-foreground)]">Área de pruebas y testing</p>
                                </div>
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        {/* Page title for active tab */}
                        <div className="mb-6 text-center">
                            <h2 className="text-2xl font-bold mb-2">
                                {activeTab === 'scanner' && 'Escáner'}
                                {activeTab === 'controlhorario' && 'Control Horario'}
                                {activeTab === 'histoscans' && 'Historial de Escaneos'}
                                {activeTab === 'pruebas' && 'Pruebas'}
                            </h2>
                            <p className="text-[var(--tab-text)]">
                                {activeTab === 'scanner' && 'Escanear códigos de barras'}
                                {activeTab === 'controlhorario' && 'Registro de horarios de trabajo'}
                                {activeTab === 'histoscans' && 'Ver historial de escaneos realizados'}
                                {activeTab === 'pruebas' && 'Área de pruebas y testing'}
                            </p>
                        </div>

                        {/* Tab content */}
                        <div className="space-y-8">
                            {/* SCANNER */}
                            {activeTab === 'scanner' && (
                                <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
                                    <div className="flex flex-col xl:flex-row gap-8">
                                        {/* Área de escáner - lado izquierdo */}
                                        <div className="flex-1 xl:max-w-3xl">
                                            <BarcodeScanner onDetect={handleCodeDetected} />
                                        </div>

                                        {/* Historial - lado derecho */}
                                        <div className="xl:w-96 xl:flex-shrink-0">
                                            <div className="sticky top-6">
                                                <ScanHistory
                                                    history={scanHistory}
                                                    onCopy={handleCopy}
                                                    onDelete={handleDelete}
                                                    onRemoveLeadingZero={handleRemoveLeadingZero}
                                                    onRename={handleRename}
                                                    notify={showNotification}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'controlhorario' && (
                                <ControlHorario />
                            )}

                            {activeTab === 'histoscans' && (
                                <BackdoorScanHistory />
                            )}

                            {activeTab === 'pruebas' && (
                                <Pruebas />
                            )}
                        </div>
                    </>
                )}
            </main>
        </>
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
