import React, { useState, useEffect, useRef } from 'react';
import { SorteosService } from '../services/sorteos';
import { Timer, Download } from 'lucide-react';
import type { Sorteo } from '../types/firestore';

const INITIAL_ROWS = 1;

function getNowTime() {
    const now = new Date();
    return now.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Función para obtener los colores del tema actual
function getCurrentThemeColors() {
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    if (isDarkMode) {
        return {
            background: '#1f2937',
            foreground: '#ffffff',
            cardBg: '#1f2937',
            inputBg: '#374151',
            inputBorder: '#4b5563',
            buttonBg: '#374151',
            buttonText: '#e5e7eb'
        };
    } else {
        return {
            background: '#ffffff',
            foreground: '#171717',
            cardBg: '#f9f9f9',
            inputBg: '#f3f4f6',
            inputBorder: '#d1d5db',
            buttonBg: '#f3f4f6',
            buttonText: '#1f2937'
        };
    }
}

export default function TimingControl() {
    const [sorteos, setSorteos] = useState<Sorteo[]>([]);
    const [personName, setPersonName] = useState('');
    const [isExporting, setIsExporting] = useState(false);
    const [rows, setRows] = useState(() =>
        Array.from({ length: INITIAL_ROWS }, () => ({
            ticketNumber: '',
            sorteo: '',
            amount: '',
            time: '',
        }))
    );
    const [showSummary, setShowSummary] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);// Cargar datos desde Firebase
    useEffect(() => {
        const loadData = async () => {
            try {
                const sorteosData = await SorteosService.getAllSorteos();
                setSorteos(sorteosData);
            } catch (error) {
                console.error('Error loading data from Firebase:', error);
            }
        };
        
        loadData();
    }, []);    // Efecto para cargar/guardar filas desde/hacia localStorage
    useEffect(() => {
        const saved = localStorage.getItem('timingControlRows');
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
        }

        // Load person name from localStorage
        const savedName = localStorage.getItem('timingControlPersonName');
        if (savedName) {
            setPersonName(savedName);
        }
    }, []);    // Efecto para guardar filas en localStorage
    useEffect(() => {
        localStorage.setItem('timingControlRows', JSON.stringify(rows));
    }, [rows]);

    // Efecto para guardar nombre de persona en localStorage
    useEffect(() => {
        if (personName.trim()) {
            localStorage.setItem('timingControlPersonName', personName);
        }
    }, [personName]);

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
        };    }, [showSummary]);

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
            
            let updatedRow;
            if (field === 'amount') {
                updatedRow = { ...row, amount: value, time: value ? getNowTime() : '' };
            } else if (field === 'ticketNumber') {
                // Solo permitir números y máximo 4 dígitos
                const numericValue = value.replace(/\D/g, '').slice(0, 4);
                updatedRow = { ...row, ticketNumber: numericValue };
            } else {
                updatedRow = { ...row, [field]: value };
            }
            
            // Verificar si la fila está completa después de esta actualización y establecer hora automáticamente
            if (updatedRow.ticketNumber.trim() !== '' && 
                updatedRow.sorteo.trim() !== '' && 
                updatedRow.amount.trim() !== '' && 
                updatedRow.time.trim() === '') {
                updatedRow.time = getNowTime();
            }
            
            return updatedRow;
        }));
    };    const addRow = () => {
        setRows(prev => ([...prev, { ticketNumber: '', sorteo: '', amount: '', time: '' }]));
    };

    // Función para verificar si una fila tiene los campos mínimos para avanzar
    const hasMinimumFields = (row: typeof rows[0]) => {
        return row.ticketNumber.trim() !== '' && 
               row.amount.trim() !== '';
    };

    // Función para verificar si una fila debe estar habilitada
    const isRowEnabled = (currentIndex: number) => {
        // La primera fila siempre está habilitada
        if (currentIndex === 0) return true;
        
        // Para las demás filas, verificar que la anterior tenga los campos mínimos
        const previousRow = rows[currentIndex - 1];
        return hasMinimumFields(previousRow);
    };const exportToJPG = async () => {
        if (!personName.trim()) {
            alert('Por favor ingresa el nombre de la persona antes de exportar');
            return;
        }

        setIsExporting(true);
        
        try {
            // Dynamically import html2canvas
            const html2canvas = (await import('html2canvas')).default;

            if (exportRef.current) {
                // Obtener colores del tema actual
                const themeColors = getCurrentThemeColors();
                
                // Crear un clon profundo del elemento
                const clonedElement = exportRef.current.cloneNode(true) as HTMLElement;
                
                // Configurar el clon para que sea invisible y esté fuera de la vista
                clonedElement.style.position = 'absolute';
                clonedElement.style.left = '-9999px';
                clonedElement.style.top = '0';
                clonedElement.style.zIndex = '-1000';
                clonedElement.style.pointerEvents = 'none';
                
                // Agregar el clon al DOM temporalmente
                document.body.appendChild(clonedElement);
                
                // Esperar un momento para que el DOM se actualice
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Aplicar estilos explícitos solo al clon
                const elementsToStyle = clonedElement.querySelectorAll('*');
                
                elementsToStyle.forEach((element: Element) => {
                    const htmlElement = element as HTMLElement;
                    const computedStyle = window.getComputedStyle(htmlElement);
                    
                    // Convertir variables CSS a valores reales
                    if (computedStyle.color && (
                        computedStyle.color.includes('var(--foreground)') ||
                        htmlElement.getAttribute('style')?.includes('var(--foreground)')
                    )) {
                        htmlElement.style.setProperty('color', themeColors.foreground, 'important');
                    }
                    
                    if (computedStyle.backgroundColor && (
                        computedStyle.backgroundColor.includes('var(--input-bg)') ||
                        htmlElement.getAttribute('style')?.includes('var(--input-bg)')
                    )) {
                        htmlElement.style.setProperty('background-color', themeColors.inputBg, 'important');
                    }
                    
                    if (computedStyle.backgroundColor && (
                        computedStyle.backgroundColor.includes('var(--card-bg)') ||
                        htmlElement.getAttribute('style')?.includes('var(--card-bg)')
                    )) {
                        htmlElement.style.setProperty('background-color', themeColors.cardBg, 'important');
                    }
                    
                    if (computedStyle.backgroundColor && (
                        computedStyle.backgroundColor.includes('var(--button-bg)') ||
                        htmlElement.getAttribute('style')?.includes('var(--button-bg)')
                    )) {
                        htmlElement.style.setProperty('background-color', themeColors.buttonBg, 'important');
                    }
                    
                    if (computedStyle.borderColor && (
                        computedStyle.borderColor.includes('var(--input-border)') ||
                        htmlElement.getAttribute('style')?.includes('var(--input-border)')
                    )) {
                        htmlElement.style.setProperty('border-color', themeColors.inputBorder, 'important');
                    }
                });
                
                // Capturar la imagen del clon
                const canvas = await html2canvas(clonedElement, {
                    useCORS: true,
                    allowTaint: true,
                    width: clonedElement.scrollWidth,
                    height: clonedElement.scrollHeight,
                    logging: false
                });
                
                // Remover el clon del DOM inmediatamente
                document.body.removeChild(clonedElement);
                
                // Convert canvas to JPG with high quality
                const imgData = canvas.toDataURL('image/jpeg', 0.95);
                
                // Create download link
                const link = document.createElement('a');
                const now = new Date();
                const day = now.getDate().toString().padStart(2, '0');
                const month = (now.getMonth() + 1).toString().padStart(2, '0');
                
                // Clean the person name for filename (remove special characters and slashes)
                const cleanName = personName.trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
                const fileName = `${day}-${month}_${cleanName}.jpg`;
                
                link.download = fileName;
                link.href = imgData;
                
                // Trigger download
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                alert(`Imagen exportada exitosamente como: ${fileName}`);
            }
        } catch (error) {
            console.error('Error al exportar:', error);
            alert('Error al exportar la imagen. Por favor intenta de nuevo.');
        } finally {
            setIsExporting(false);
        }
    };return (
        <div className="rounded-lg shadow-md p-6" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
            {showSummary && (
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
                </div>            )}            <div ref={exportRef} 
                 className="p-6 rounded-lg" 
                 style={{ 
                     background: 'var(--card-bg)', 
                     color: 'var(--foreground)',
                     minHeight: '400px',
                     border: '1px solid var(--input-border)'
                 }}>                {/* Header con título y nota informativa */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Timer className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Control de tiempos</h3>
                        </div>                        {/* Nota para pantallas medianas y grandes */}
                        <div className="hidden md:block p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs max-w-xs">
                            <p><strong>Nota:</strong> Complete el número de tiquete y monto de la fila anterior para habilitar la siguiente.</p>
                        </div>
                    </div>
                    {/* Nota para pantallas pequeñas */}
                    <div className="md:hidden mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs">
                        <p><strong>Nota:</strong> Complete el número de tiquete y monto de la fila anterior para habilitar la siguiente.</p>
                    </div>
                </div>

                {/* Campo para nombre de persona */}
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                        Nombre de la persona:
                    </label>
                    <input
                        type="text"
                        className="w-full max-w-md px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--input-border)',
                            color: 'var(--foreground)',
                        }}
                        value={personName}
                        onChange={(e) => setPersonName(e.target.value)}
                        placeholder="Ingresa tu nombre"
                    />
                </div>
            
                {/* Controles de total y resumen */}
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
                        </button>                        <button
                            className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50"
                            onClick={exportToJPG}
                            disabled={!personName.trim() || isExporting}
                        >
                            <Download className="w-4 h-4" />
                            {isExporting ? 'Exportando...' : 'Exportar JPG'}
                        </button>
                        <button
                            className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-red-500 hover:bg-red-600 text-white"
                            onClick={() => {
                                if (window.confirm('¿Seguro que deseas limpiar todas las filas?')) {
                                    setRows(Array.from({ length: INITIAL_ROWS }, () => ({ ticketNumber: '', sorteo: '', amount: '', time: '' })))
                                }
                            }}
                        >
                            Limpiar todo
                        </button>
                    </div>
                </div>                <div className="overflow-x-auto">                    <div className="grid grid-cols-4 gap-2 font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                        <div>Número de Tiquete</div>
                        <div>Sorteo</div>
                        <div>Monto (₡)</div>
                        <div>Hora</div>
                    </div>{rows.map((row, idx) => {
                        const rowEnabled = isRowEnabled(idx);
                        const rowStyle = {
                            background: rowEnabled ? 'var(--input-bg)' : '#f5f5f5',
                            border: '1px solid var(--input-border)',
                            color: rowEnabled ? 'var(--foreground)' : '#999',
                            opacity: rowEnabled ? 1 : 0.6,
                        };
                        
                        return (
                        <div className="grid grid-cols-4 gap-2 mb-2" key={idx}>
                            <input
                                type="text"
                                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={rowStyle}
                                value={row.ticketNumber}
                                onChange={e => handleRowChange(idx, 'ticketNumber', e.target.value)}
                                placeholder="0000"
                                maxLength={4}
                                disabled={!rowEnabled}
                            />
                            <select
                                className="px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                style={rowStyle}
                                value={row.sorteo}
                                onChange={e => handleRowChange(idx, 'sorteo', e.target.value)}
                                disabled={!rowEnabled}
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
                                style={rowStyle}
                                value={row.amount}
                                onChange={e => handleRowChange(idx, 'amount', e.target.value)}
                                placeholder="₡"
                                disabled={!rowEnabled}
                            />
                            <input
                                type="text"
                                className="px-3 py-2 rounded-md"
                                style={rowStyle}
                                value={row.time}
                                readOnly
                                placeholder="--:--:--"
                            />
                        </div>
                        );
                    })}                    <button
                        className="mt-2 px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={addRow}
                        disabled={rows.length > 0 && !hasMinimumFields(rows[rows.length - 1])}
                        title={rows.length > 0 && !hasMinimumFields(rows[rows.length - 1]) ? "Complete el número de tiquete y monto de la fila anterior antes de agregar una nueva" : "Agregar nueva fila"}
                    >
                        + Agregar fila
                    </button>
                </div>
            </div>
        </div>
    );
}
