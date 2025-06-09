import React, { useState, useEffect } from 'react';
import type { Location, Sorteo } from '../types/timing';

const INITIAL_ROWS = 4;

function getNowTime() {
    const now = new Date();
    return now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function TimingControl() {
    const [locations, setLocations] = useState<Location[]>([]);
    const [sorteos, setSorteos] = useState<Sorteo[]>([]);
    const [loading, setLoading] = useState(true);
    const [location, setLocation] = useState('');
    const [rows, setRows] = useState(() =>
        Array.from({ length: INITIAL_ROWS }, () => ({
            name: '',
            sorteo: '',
            amount: '',
            time: '',
            cliente: '',
        }))
    );
    const [showSummary, setShowSummary] = useState(false);

    // Cargar datos desde las APIs
    useEffect(() => {
        const loadData = async () => {
            try {
                const [locationsRes, sorteosRes] = await Promise.all([
                    fetch('/api/data/locations'),
                    fetch('/api/data/sorteos')
                ]);
                
                const locationsData = await locationsRes.json();
                const sorteosData = await sorteosRes.json();
                
                setLocations(locationsData);
                setSorteos(sorteosData);
            } catch (error) {
                console.error('Error loading data:', error);
            } finally {
                setLoading(false);
            }
        };
        
        loadData();
    }, []);

    const names = locations.find(l => l.value === location)?.names || [];

    const sorteosConMonto = rows.filter(r => r.sorteo && r.amount && !isNaN(Number(r.amount)) && Number(r.amount) > 0);
    const resumenSorteos = sorteosConMonto.reduce((acc, row) => {
        if (!acc[row.sorteo]) acc[row.sorteo] = 0;
        acc[row.sorteo] += Number(row.amount);
        return acc;
    }, {} as Record<string, number>);
    const totalGeneral = Object.values(resumenSorteos).reduce((a, b) => a + b, 0);

    const handleRowChange = (idx: number, field: string, value: string) => {
        setRows(prev => prev.map((row, i) => {
            if (i !== idx) return row;
            if (field === 'amount') {
                return { ...row, amount: value, time: value ? getNowTime() : '' };
            }
            return { ...row, [field]: value };
        }));
    };

    const addRow = () => {
        setRows(prev => ([...prev, { name: '', sorteo: '', amount: '', time: '', cliente: '' }]));
    }; React.useEffect(() => {
        if (!location) {
            setRows(Array.from({ length: INITIAL_ROWS }, () => ({ name: '', sorteo: '', amount: '', time: '', cliente: '' })));
            return;
        }

        const saved = localStorage.getItem('timingControlRows_' + location);
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setRows(parsed.map((row: any) => ({
                        name: row.name || '',
                        sorteo: row.sorteo || '',
                        amount: row.amount || '',
                        time: row.time || '',
                        cliente: row.cliente || '',
                    })));
                }
            } catch { }
        } else {
            setRows(Array.from({ length: INITIAL_ROWS }, () => ({ name: '', sorteo: '', amount: '', time: '', cliente: '' })));
        }
    }, [location]);    React.useEffect(() => {
        if (location) {
            localStorage.setItem('timingControlRows_' + location, JSON.stringify(rows));
        }
    }, [rows, location]);

    // Handle ESC key to close summary modal
    React.useEffect(() => {
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
                        <h2 className="text-lg font-bold mb-4 text-center" style={{ color: 'var(--foreground)' }}>Resumen de Ventas por Sorteo</h2>                        {Object.keys(resumenSorteos).length === 0 ? (
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
            )}            <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center justify-between">
                <div className="flex items-center gap-2">
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--foreground)' }}>Ubicación:</label>
                    <select
                        className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--input-border)',
                            color: 'var(--foreground)',
                        }} value={location}
                        onChange={e => setLocation(e.target.value)}
                    >
                        <option value="">Seleccionar ubicación</option>                            {locations.map((loc: Location) => (
                            <option key={loc.value} value={loc.value}>{loc.label}</option>
                        ))}
                    </select>
                </div>
                {location && (
                    <div className="flex items-center gap-2 ml-auto">
                        <span className="font-semibold" style={{ color: 'var(--foreground)' }}>Total:</span>
                        <span className="font-mono text-green-700 text-lg">₡ {totalGeneral.toLocaleString('es-CR')}</span>
                        <button
                            className="ml-2 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            style={{
                                background: 'var(--button-bg)',
                                color: 'var(--button-text)',
                            }}
                            onClick={() => setShowSummary(true)}
                        >
                            Ver resumen
                        </button>
                        <button
                            className="ml-2 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => {
                                if (window.confirm('¿Seguro que deseas limpiar todas las filas?')) {
                                    setRows(Array.from({ length: INITIAL_ROWS }, () => ({ name: '', sorteo: '', amount: '', time: '', cliente: '' })))
                                }
                            }}
                        >
                            Limpiar todo                    </button>
                    </div>
                )}
            </div>
            {location ? (
                <div className="overflow-x-auto">
                    <div className="grid grid-cols-5 gap-2 font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                        <div>Nombre</div>
                        <div>Sorteo</div>
                        <div>Monto (₡)</div>
                        <div>Hora</div>
                        <div>Cliente (opcional)</div>
                    </div>
                    {rows.map((row, idx) => (
                        <div className="grid grid-cols-5 gap-2 mb-2" key={idx}>
                            <select
                                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={{
                                    background: 'var(--input-bg)',
                                    border: '1px solid var(--input-border)',
                                    color: 'var(--foreground)',
                                }}
                                value={row.name}
                                onChange={e => handleRowChange(idx, 'name', e.target.value)}
                            >
                                <option value="">Seleccionar</option>
                                {names.map(n => (
                                    <option key={n} value={n}>{n}</option>
                                ))}
                            </select>
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
                                {sorteos.map((s: string) => (
                                    <option key={s} value={s}>{s}</option>
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
                            {row.cliente ? (
                                <span className="text-blue-700 font-semibold truncate px-2 flex items-center min-h-[40px]">{row.cliente}</span>
                            ) : (
                                <button
                                    className="flex items-center justify-center w-full h-full rounded min-h-[40px] transition-colors"
                                    style={{
                                        background: 'var(--input-bg)',
                                        border: '1px solid var(--input-border)',
                                    }}
                                    title="Agregar cliente"
                                    onClick={() => {
                                        const cliente = prompt('Nombre del cliente (opcional):', row.cliente || '');
                                        handleRowChange(idx, 'cliente', cliente || '');
                                    }}
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-blue-600">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 20.25v-1.5A2.25 2.25 0 016.75 16.5h10.5a2.25 2.25 0 012.25 2.25v1.5" />
                                    </svg>
                                </button>
                            )}
                        </div>
                    ))}                <button
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
