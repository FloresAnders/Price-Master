import React, { useState, useEffect } from 'react';
import { LocationsService } from '../services/locations';
import { SorteosService } from '../services/sorteos';
import { useAuth } from '../hooks/useAuth';
import LoginModal from './LoginModal';
import { Timer } from 'lucide-react';
import type { Location, Sorteo, User } from '../types/firestore';

const INITIAL_ROWS = 4;

function getNowTime() {
    const now = new Date();
    return now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TimingControl() {
    const { user, isAuthenticated, login } = useAuth();
    const [showLoginModal, setShowLoginModal] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [sorteos, setSorteos] = useState<Sorteo[]>([]);
    const [location, setLocation] = useState('');    const [rows, setRows] = useState(() =>
        Array.from({ length: INITIAL_ROWS }, () => ({
            ticketNumber: '',
            sorteo: '',
            amount: '',
            time: '',
        }))
    );
    const [showSummary, setShowSummary] = useState(false);

    // Cargar datos desde Firebase
    useEffect(() => {
        const loadData = async () => {
            try {
                const [locationsData, sorteosData] = await Promise.all([
                    LocationsService.getAllLocations(),
                    SorteosService.getAllSorteos()
                ]);
                
                setLocations(locationsData);
                setSorteos(sorteosData);
            } catch (error) {
                console.error('Error loading data from Firebase:', error);
            }
        };
        
        loadData();
    }, []);

    // Efecto para manejar la ubicación del usuario autenticado
    useEffect(() => {
        if (isAuthenticated && user?.location && !location) {
            setLocation(user.location);
        }
    }, [isAuthenticated, user, location]);    // Efecto para cargar/guardar filas desde/hacia localStorage
    useEffect(() => {
        if (!location) {
            setRows(Array.from({ length: INITIAL_ROWS }, () => ({ ticketNumber: '', sorteo: '', amount: '', time: '' })));
            return;
        }

        const saved = localStorage.getItem('timingControlRows_' + location);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setRows(parsed.map((row: { ticketNumber?: string; sorteo?: string; amount?: string; time?: string }) => ({
                        ticketNumber: row.ticketNumber || '',
                        sorteo: row.sorteo || '',
                        amount: row.amount || '',
                        time: row.time || '',
                    })));
                }
            } catch { }
        } else {
            setRows(Array.from({ length: INITIAL_ROWS }, () => ({ ticketNumber: '', sorteo: '', amount: '', time: '' })));
        }
    }, [location]);

    // Efecto para guardar filas en localStorage
    useEffect(() => {
        if (location) {
            localStorage.setItem('timingControlRows_' + location, JSON.stringify(rows));
        }
    }, [rows, location]);

    // Handle ESC key to close summary modal
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && showSummary) {
                setShowSummary(false);
            }
        };

        if (showSummary) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showSummary]);

    // Manejar login exitoso
    const handleLoginSuccess = (userData: User) => {
        login(userData);
        setShowLoginModal(false);
        if (userData.location) {
            setLocation(userData.location);
        }
    };

    // Verificar si necesita autenticación
    if (!isAuthenticated) {
        return (
            <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">                <div className="text-center py-8">
                    <Timer className="w-16 h-16 mx-auto mb-4 text-blue-600" />
                    <h3 className="text-2xl font-semibold mb-4">Control de tiempos</h3>
                    <p className="text-[var(--tab-text)] mb-6">
                        Necesitas iniciar sesión para acceder a esta funcionalidad
                    </p>
                    <button
                        onClick={() => setShowLoginModal(true)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Iniciar Sesión
                    </button>
                </div>
                
                <LoginModal
                    isOpen={showLoginModal}
                    onLoginSuccess={handleLoginSuccess}
                    onClose={() => setShowLoginModal(false)}
                    title="Control de tiempos"
                />
            </div>
        );
    }

    const sorteosConMonto = rows.filter(r => r.amount && !isNaN(Number(r.amount)) && Number(r.amount) > 0);
    const resumenSorteos = sorteosConMonto.reduce((acc, row) => {
        const sorteoName = row.sorteo || 'Sin sorteo';
        if (!acc[sorteoName]) acc[sorteoName] = 0;
        acc[sorteoName] += Number(row.amount);
        return acc;
    }, {} as Record<string, number>);
    const totalGeneral = Object.values(resumenSorteos).reduce((a, b) => a + b, 0);    const handleRowChange = (idx: number, field: string, value: string) => {
        setRows(prev => prev.map((row, i) => {
            if (i !== idx) return row;
            if (field === 'amount') {
                return { ...row, amount: value, time: value ? getNowTime() : '' };
            } else if (field === 'ticketNumber') {
                // Solo permitir números y máximo 4 dígitos
                const numericValue = value.replace(/\D/g, '').slice(0, 4);
                return { ...row, ticketNumber: numericValue };
            }
            return { ...row, [field]: value };
        }));
    };    const addRow = () => {
        setRows(prev => ([...prev, { ticketNumber: '', sorteo: '', amount: '', time: '' }]));
    };

    return (
        <div className="rounded-lg shadow-md p-6" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
            {showSummary && location && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="rounded-2xl shadow-xl p-6 min-w-[320px] max-w-[90vw] relative" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
                        <button
                            className="absolute top-2 right-2 hover:text-gray-500"
                            style={{ color: 'var(--foreground)' }}
                            onClick={() => setShowSummary(false)}
                            aria-label="Cerrar resumen"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-lg font-bold mb-4 text-center" style={{ color: 'var(--foreground)' }}>Resumen de Ventas por Sorteo</h2>
                        {Object.keys(resumenSorteos).length === 0 ? (
                            <div className="text-center" style={{ color: 'var(--foreground)' }}>No hay sorteos con monto asignado.</div>
                        ) : (
                            <div className="space-y-2 mb-4">
                                {Object.entries(resumenSorteos).map(([sorteo, total]) => (
                                    <div key={sorteo} className="flex justify-between pb-1" style={{ borderBottom: '1px solid var(--input-border)' }}>
                                        <span className="font-medium" style={{ color: 'var(--foreground)' }}>{sorteo}</span>
                                        <span className="font-mono" style={{ color: 'var(--foreground)' }}>₡ {total.toLocaleString('es-CR')}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="mt-4 text-right font-bold text-lg" style={{ color: 'var(--foreground)' }}>
                            Total: <span className="font-mono text-green-700">₡ {totalGeneral.toLocaleString('es-CR')}</span>
                        </div>
                    </div>
                </div>
            )}            {/* Header simplificado */}
            <div className="mb-6 flex items-center gap-4">
                <Timer className="w-6 h-6 text-blue-600" />
                <h3 className="text-lg font-semibold">Control de tiempos</h3>
            </div>
            
            {/* Controles de total y resumen - solo cuando hay ubicación */}
            {location && (
                <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Total:</span>
                        <span className="font-mono text-green-700 text-lg">₡ {totalGeneral.toLocaleString('es-CR')}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            style={{
                                background: 'var(--button-bg)',
                                color: 'var(--button-text)',
                            }}
                            onClick={() => setShowSummary(true)}
                        >
                            Ver resumen
                        </button>
                        <button
                            className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-red-500 hover:bg-red-600 text-white"                            onClick={() => {
                                if (window.confirm('¿Seguro que deseas limpiar todas las filas?')) {
                                    setRows(Array.from({ length: INITIAL_ROWS }, () => ({ ticketNumber: '', sorteo: '', amount: '', time: '' })))
                                }
                            }}
                        >
                            Limpiar todo
                        </button>
                    </div>
                </div>
            )}

            {location ? (
                <div className="overflow-x-auto">                    <div className="grid grid-cols-4 gap-2 font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                        <div>Número de Tiquete</div>
                        <div>Sorteo</div>
                        <div>Monto (₡)</div>
                        <div>Hora</div>
                    </div>                    {rows.map((row, idx) => (
                        <div className="grid grid-cols-4 gap-2 mb-2" key={idx}>
                            <input
                                type="text"
                                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--foreground)',
                                }}
                                value={row.ticketNumber}
                                onChange={e => handleRowChange(idx, 'ticketNumber', e.target.value)}
                                placeholder="0000"
                                maxLength={4}
                            />
                            <select
                                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--foreground)',
                                }}
                                value={row.sorteo}
                                onChange={e => handleRowChange(idx, 'sorteo', e.target.value)}
                            >
                                <option value="">Seleccionar</option>
                                {sorteos.map((sorteo) => (
                                    <option key={sorteo.id || sorteo.name} value={sorteo.name}>{sorteo.name}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                min="0"
                                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--foreground)',
                                }}
                                value={row.amount}
                                onChange={e => handleRowChange(idx, 'amount', e.target.value)}
                                placeholder="₡"
                            />
                            <input
                                type="text"
                                className="px-3 py-2 rounded-md"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--foreground)',
                                }}
                                value={row.time}
                                readOnly
                                placeholder="--:--:--"
                            />
                        </div>
                    ))}
                    <button
                        className="mt-2 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-600 hover:bg-green-700 text-white font-semibold"
                        onClick={addRow}
                    >
                        + Agregar fila
                    </button>
                </div>
            ) : (
                <div className="text-center py-8" style={{ color: 'var(--foreground)' }}>
                    <p className="text-lg">Selecciona una ubicación para comenzar</p>
                </div>
            )}
        </div>
    );
}
