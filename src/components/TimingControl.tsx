import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SorteosService } from '../services/sorteos';
import { Timer, Download } from 'lucide-react';
import type { Sorteo } from '../types/firestore';
import TicketCarousel from './TicketCarousel';
import HelpTooltip from './HelpTooltip';
import ConfirmModal from './ConfirmModal';
import { ToastProvider, useToast } from './ToastContext';

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

// Códigos válidos según la imagen
const VALID_CODES = {
    'T11': 'TIEMPOS (COMODIN)',
    'T10': 'TIEMPOS (ANGUILA)',
    'NNN': 'TIEMPOS (NICA)',
    'TTT': 'TIEMPOS (TICA)'
};

interface TicketEntry {
    id: string;
    code: string;
    sorteo: string;
    amount: number;
    time: string;
}

export default function TimingControl() {
    const [sorteos, setSorteos] = useState<Sorteo[]>([]);
    const [personName, setPersonName] = useState('');
    const [isExporting, setIsExporting] = useState(false);    const [showSummary, setShowSummary] = useState(false);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [currentCode, setCurrentCode] = useState('');    const [selectedSorteo, setSelectedSorteo] = useState('');
    const [modalAmount, setModalAmount] = useState('');
    const [keyBuffer, setKeyBuffer] = useState('');    const [tickets, setTickets] = useState<TicketEntry[]>([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [ticketToDelete, setTicketToDelete] = useState<TicketEntry | null>(null);
    const [showExportConfirm, setShowExportConfirm] = useState(false);
    const exportRef = useRef<HTMLDivElement>(null);
    const amountInputRef = useRef<HTMLInputElement>(null);// Cargar datos desde Firebase
    useEffect(() => {
        const loadData = async () => {
            try {
                const sorteosData = await SorteosService.getAllSorteos();
                setSorteos(sorteosData);
            } catch (error) {
                console.error('Error loading data from Firebase:', error);
            }
        };

        loadData();    }, []);      // Efecto para cargar/guardar todos los datos desde/hacia localStorage
    useEffect(() => {
        // Try to load complete state first
        const completeStateLoaded = loadCompleteState();
        
        if (!completeStateLoaded) {
            // Fallback to individual item loading
            const savedTickets = localStorage.getItem('timingControlTickets');
            if (savedTickets) {
                try {
                    const parsed = JSON.parse(savedTickets);
                    if (Array.isArray(parsed)) {
                        setTickets(parsed);
                    }
                } catch { 
                    console.warn('Error parsing saved tickets from localStorage');
                }
            }

            const savedName = localStorage.getItem('timingControlPersonName');
            if (savedName) {
                setPersonName(savedName);
            }

            const savedBuffer = localStorage.getItem('timingControlKeyBuffer');
            if (savedBuffer) {
                setKeyBuffer(savedBuffer);
            }
        }

        // Reset modal states on load
        resetModalStates();
    }, []);
    
    // Efecto para guardar tickets en localStorage
    useEffect(() => {
        localStorage.setItem('timingControlTickets', JSON.stringify(tickets));
    }, [tickets]);

    // Efecto para guardar nombre de persona en localStorage
    useEffect(() => {
        localStorage.setItem('timingControlPersonName', personName);
    }, [personName]);    // Efecto para guardar buffer de teclas en localStorage
    useEffect(() => {
        localStorage.setItem('timingControlKeyBuffer', keyBuffer);
    }, [keyBuffer]);

    // Función para guardar estado completo en localStorage
    const saveCompleteState = useCallback(() => {
        const state = {
            tickets,
            personName,
            keyBuffer,
            timestamp: Date.now()
        };
        localStorage.setItem('timingControlCompleteState', JSON.stringify(state));
    }, [tickets, personName, keyBuffer]);

    // Efecto para guardar estado completo periódicamente
    useEffect(() => {
        const interval = setInterval(() => {
            saveCompleteState();
        }, 30000); // Guardar cada 30 segundos

        return () => clearInterval(interval);
    }, [saveCompleteState]);

    // Efecto para guardar estado antes de cerrar la página
    useEffect(() => {
        const handleBeforeUnload = () => {
            saveCompleteState();
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [saveCompleteState]);// Función para limpiar todo el localStorage del componente
    const clearAllLocalStorage = () => {
        localStorage.removeItem('timingControlTickets');
        localStorage.removeItem('timingControlPersonName');
        localStorage.removeItem('timingControlKeyBuffer');
        localStorage.removeItem('timingControlCompleteState');
        setTickets([]);
        setPersonName('');
        setKeyBuffer('');
        resetModalStates();
    };

    // Función para resetear estados de modales y formularios
    const resetModalStates = () => {
        setShowSummary(false);
        setShowCodeModal(false);        setShowDeleteModal(false);
        setCurrentCode('');
        setSelectedSorteo('');
        setModalAmount('');
        setTicketToDelete(null);
    };

    // Función para cargar estado completo desde localStorage
    const loadCompleteState = () => {
        const savedState = localStorage.getItem('timingControlCompleteState');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed.tickets) setTickets(parsed.tickets);
                if (parsed.personName) setPersonName(parsed.personName);
                if (parsed.keyBuffer) setKeyBuffer(parsed.keyBuffer);
                return true;
            } catch {
                console.warn('Error parsing complete state from localStorage');
                return false;
            }
        }
        return false;
    };// Handle ESC key to close modals
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                if (showSummary) {
                    setShowSummary(false);
                }
                if (showCodeModal) {
                    setShowCodeModal(false);
                    setCurrentCode('');
                    setSelectedSorteo('');
                    setModalAmount('');
                }
                if (showDeleteModal) {
                    cancelDeleteTicket();
                }
            }
        };

        if (showSummary || showCodeModal || showDeleteModal) {
            document.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [showSummary, showCodeModal, showDeleteModal]);// Calculate totals from tickets
    const resumenSorteos = tickets.reduce((acc, ticket) => {
        const sorteoName = ticket.sorteo || 'Sin sorteo';
        if (!acc[sorteoName]) acc[sorteoName] = 0;
        acc[sorteoName] += ticket.amount;
        return acc;
    }, {} as Record<string, number>);
    
    const totalGeneral = Object.values(resumenSorteos).reduce((a: number, b: number) => a + b, 0);    // Handle keyboard input for code detection
    useEffect(() => {
        let bufferTimeout: NodeJS.Timeout;        const handleKeyPress = (event: KeyboardEvent) => {
            // Only process if no modal is open and not in an input field
            if (showCodeModal || showSummary || showDeleteModal) return;
            
            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                return;
            }

            const key = event.key.toUpperCase();
            
            if (key.length === 1 && /[A-Z0-9]/.test(key)) {
                setKeyBuffer(prev => {
                    const newBuffer = (prev + key).slice(-3); // Keep only last 3 characters
                    
                    // Clear any existing timeout
                    if (bufferTimeout) clearTimeout(bufferTimeout);
                    
                    // Set timeout to clear buffer after 2 seconds of inactivity
                    bufferTimeout = setTimeout(() => {
                        setKeyBuffer('');
                    }, 2000);
                    
                    // Check for valid codes
                    if (newBuffer === 'T11' || newBuffer === 'T10' || newBuffer === 'NNN' || newBuffer === 'TTT') {
                        setCurrentCode(newBuffer);
                        setShowCodeModal(true);
                        clearTimeout(bufferTimeout);
                        return ''; // Clear buffer after detection
                    }
                    
                    return newBuffer;
                });
            } else if (event.key === 'Escape') {
                setKeyBuffer('');
                if (bufferTimeout) clearTimeout(bufferTimeout);
            }
        };

        document.addEventListener('keydown', handleKeyPress);
          return () => {
            document.removeEventListener('keydown', handleKeyPress);
            if (bufferTimeout) clearTimeout(bufferTimeout);
        };
    }, [showCodeModal, showSummary, showDeleteModal]);

    // Filter sorteos based on current code
    const getFilteredSorteos = () => {
        const allSorteos = sorteos.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();
            
            const aIsPriority = aName.includes('nica') || aName.includes('tica');
            const bIsPriority = bName.includes('nica') || bName.includes('tica');
            
            const aIsDominicana = aName.includes('dominicana');
            const bIsDominicana = bName.includes('dominicana');
            
            if (aIsPriority && !bIsPriority) return -1;
            if (!aIsPriority && bIsPriority) return 1;
            
            if (!aIsPriority && !bIsPriority) {
                if (aIsDominicana && !bIsDominicana) return 1;
                if (!aIsDominicana && bIsDominicana) return -1;
            }
            
            return aName.localeCompare(bName);
        });        switch (currentCode) {
            case 'TTT':
                return allSorteos.filter(sorteo => 
                    sorteo.name.toLowerCase().includes('tica')
                );
            case 'NNN':
                return allSorteos.filter(sorteo => {
                    const name = sorteo.name.toLowerCase();
                    return name.includes('nica') && !name.includes('dominicana');
                });
            case 'T10':
                return allSorteos.filter(sorteo => 
                    sorteo.name.toLowerCase().includes('anguila')
                );
            case 'T11':
                return allSorteos.filter(sorteo => {
                    const name = sorteo.name.toLowerCase();
                    return !name.includes('tica') && !name.includes('nica') && !name.includes('anguila');
                });
            default:
                return allSorteos;
        }
    };

    // Handle modal form submission
    const handleAddTicket = () => {
        if (!selectedSorteo || !modalAmount || isNaN(Number(modalAmount)) || Number(modalAmount) <= 0) {
            alert('Por favor selecciona un sorteo y ingresa un monto válido');
            return;
        }

        const newTicket: TicketEntry = {
            id: Date.now().toString(),
            code: currentCode,
            sorteo: selectedSorteo,
            amount: Number(modalAmount),
            time: getNowTime()
        };

        setTickets(prev => [...prev, newTicket]);
        
        // Reset modal
        setShowCodeModal(false);
        setCurrentCode('');
        setSelectedSorteo('');        setModalAmount('');
    };

    // Handle ticket deletion
    const handleDeleteTicket = (ticket: TicketEntry) => {
        setTicketToDelete(ticket);
        setShowDeleteModal(true);
    };

    const confirmDeleteTicket = () => {
        if (ticketToDelete) {
            setTickets(prev => prev.filter(t => t.id !== ticketToDelete.id));
            setShowDeleteModal(false);
            setTicketToDelete(null);
        }
    };

    const cancelDeleteTicket = () => {
        setShowDeleteModal(false);
        setTicketToDelete(null);
    };
    useEffect(() => {
        if (showCodeModal && selectedSorteo && amountInputRef.current) {
            setTimeout(() => {
                amountInputRef.current?.focus();
            }, 100);
        }
    }, [showCodeModal, selectedSorteo]);const toast = useToast();
    const exportToPNG = async () => {
        if (!personName.trim()) {
            toast.showToast('Por favor ingresa el nombre de la persona antes de exportar', 'warning');
            return;
        }
        setShowExportConfirm(true);
    };
    const handleConfirmExport = async () => {
        setShowExportConfirm(false);
        setIsExporting(true);
        try {
            const html2canvas = (await import('html2canvas')).default;
            // Crear un contenedor temporal solo para el resumen
            const resumenDiv = document.createElement('div');
            resumenDiv.style.position = 'absolute';
            resumenDiv.style.left = '-9999px';
            resumenDiv.style.top = '0';
            resumenDiv.style.zIndex = '-1000';
            resumenDiv.style.pointerEvents = 'none';
            resumenDiv.style.background = getCurrentThemeColors().cardBg;
            resumenDiv.style.color = getCurrentThemeColors().foreground;
            resumenDiv.style.padding = '32px';
            resumenDiv.style.borderRadius = '18px';
            resumenDiv.style.fontFamily = 'var(--font-base), Arial, sans-serif';
            resumenDiv.style.minWidth = '340px';
            resumenDiv.innerHTML = `
              <div style="font-size:1.1rem;font-weight:600;margin-bottom:0.7rem;text-align:left;">Nombre: <span style='font-weight:700;'>${personName}</span></div>
              <h2 style="font-size:1.3rem;font-weight:bold;margin-bottom:1.2rem;text-align:center;">Resumen de Ventas por Tiquete</h2>
              <table style="width:100%;border-collapse:collapse;font-size:1.1rem;">
                <thead><tr><th style="text-align:left;padding-bottom:8px;">Sorteo</th><th style="text-align:right;padding-bottom:8px;">Monto</th><th style="text-align:right;padding-bottom:8px;padding-left:18px;min-width:110px;">Hora</th></tr></thead>
                <tbody>
                  ${tickets.map(ticket =>
                    `<tr style='border-bottom:1px solid #d1d5db;'><td style='padding:4px 18px 10px 0;'>${ticket.sorteo}</td><td style='text-align:right;padding:4px 0 10px 0;'>₡ ${ticket.amount.toLocaleString('es-CR')}</td><td style='text-align:right;padding:4px 0 10px 18px;min-width:110px;'>${ticket.time}</td></tr>`
                  ).join('')}
                </tbody>
              </table>
              <div style="margin-top:2.2rem;margin-bottom:0.5rem;font-weight:bold;font-size:1.1rem;">Totales por sorteo:</div>
              <table style="width:100%;border-collapse:collapse;font-size:1.05rem;">
                <thead><tr><th style="text-align:left;padding-bottom:6px;">Sorteo</th><th style="text-align:right;padding-bottom:6px;">Total</th></tr></thead>
                <tbody>
                  ${Object.entries(resumenSorteos).map(([sorteo, total]) =>
                    `<tr style='border-bottom:1px solid #d1d5db;'><td style='padding:3px 18px 10px 0;'>${sorteo}</td><td style='text-align:right;padding:3px 0 10px 0;'>₡ ${total.toLocaleString('es-CR')}</td></tr>`
                  ).join('')}
                </tbody>
              </table>
              <div style="margin-top:1.2rem;text-align:right;font-weight:bold;font-size:1.15rem;">Total General: <span style='color:#16a34a;'>₡ ${totalGeneral.toLocaleString('es-CR')}</span></div>
              <div style="margin-top:1.2rem;text-align:right;font-size:0.95rem;opacity:0.7;">Exportado: ${new Date().toLocaleString('es-CR')}</div>
            `;
            document.body.appendChild(resumenDiv);
            await new Promise(resolve => setTimeout(resolve, 100));
            const canvas = await html2canvas(resumenDiv, {
                useCORS: true,
                allowTaint: true,
                width: resumenDiv.scrollWidth,
                height: resumenDiv.scrollHeight,
                logging: false
            });
            document.body.removeChild(resumenDiv);
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            const now = new Date();
            const day = now.getDate().toString().padStart(2, '0');
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            const cleanName = personName.trim().replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
            const fileName = `${day}-${month}_${cleanName}_resumen.png`;
            link.download = fileName;
            link.href = imgData;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.showToast(`Resumen exportado exitosamente como: ${fileName}`, 'success');
        } catch (error) {
            console.error('Error al exportar:', error);
            toast.showToast('Error al exportar la imagen. Por favor intenta de nuevo.', 'error');
        } finally {
            setIsExporting(false);
        }
    };    const handleEditTicket = (editedTicket: TicketEntry) => {
        setTickets(prev => prev.map(t => t.id === editedTicket.id ? { ...t, ...editedTicket } : t));
    };
    // Adaptar TicketEntry a Ticket para TicketCarousel
    const ticketsForCarousel = tickets.map(t => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { code, ...rest } = t;
      return rest;
    });
    return (
        <ToastProvider>
          <React.Fragment>
            {/* Modal de resumen */}
            {showSummary && (
                <div className="fixed inset-0 bg-black bg-opacity-60 z-[9999] flex items-center justify-center p-4">
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
            )}            {/* Modal de código de barras */}
            {showCodeModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="rounded-2xl shadow-xl p-6 w-[90vw] max-w-[800px] max-h-[90vh] overflow-hidden relative" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
                        <button
                            className="absolute top-2 right-2 hover:text-gray-500"
                            style={{ color: 'var(--foreground)' }}
                            onClick={() => {
                                setShowCodeModal(false);
                                setCurrentCode('');
                                setSelectedSorteo('');
                                setModalAmount('');
                            }}
                            aria-label="Cerrar modal"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                        <h2 className="text-lg font-bold mb-4 text-center" style={{ color: 'var(--foreground)' }}>
                            Código: {currentCode}
                        </h2>
                        <p className="text-sm mb-4 text-center" style={{ color: 'var(--foreground)' }}>
                            {VALID_CODES[currentCode as keyof typeof VALID_CODES]}
                        </p>                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-3" style={{ color: 'var(--foreground)' }}>
                                    Seleccionar sorteo:
                                </label>
                                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
                                    {getFilteredSorteos().map((sorteo) => (
                                        <button
                                            key={sorteo.id || sorteo.name}
                                            className={`px-3 py-3 rounded-md text-left focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors text-sm ${
                                                selectedSorteo === sorteo.name 
                                                ? 'ring-2 ring-blue-500' 
                                                : 'hover:opacity-80'
                                            }`}
                                            style={{
                                                background: selectedSorteo === sorteo.name 
                                                    ? '#3b82f6' 
                                                    : 'var(--input-bg)',
                                                border: '1px solid var(--input-border)',
                                                color: selectedSorteo === sorteo.name 
                                                    ? '#ffffff' 
                                                    : 'var(--foreground)',
                                            }}
                                            onClick={() => {
                                                setSelectedSorteo(sorteo.name);
                                                // Focus amount input after selection
                                                setTimeout(() => {
                                                    amountInputRef.current?.focus();
                                                }, 100);
                                            }}
                                        >
                                            {sorteo.name}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {selectedSorteo && (
                                <div>
                                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--foreground)' }}>
                                        Monto (₡):
                                    </label>
                                    <input
                                        ref={amountInputRef}
                                        type="number"
                                        min="0"
                                        className="w-full px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                        style={{
                                            background: 'var(--input-bg)',
                                            border: '1px solid var(--input-border)',
                                            color: 'var(--foreground)',
                                        }}
                                        value={modalAmount}
                                        onChange={(e) => setModalAmount(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                handleAddTicket();
                                            }
                                        }}
                                        placeholder="Ingresa el monto"
                                    />
                                </div>
                            )}

                            {selectedSorteo && (
                                <button
                                    className="w-full px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 bg-green-600 hover:bg-green-700 text-white font-semibold disabled:opacity-50"
                                    onClick={handleAddTicket}
                                    disabled={!modalAmount || isNaN(Number(modalAmount)) || Number(modalAmount) <= 0}
                                >
                                    Agregar
                                </button>
                            )}                        </div>
                    </div>
                </div>
            )}

            {/* Modal de confirmación de eliminación */}
            {showDeleteModal && ticketToDelete && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
                    <div className="rounded-2xl shadow-xl p-6 min-w-[400px] max-w-[90vw] relative" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
                        <h2 className="text-lg font-bold mb-4 text-center" style={{ color: 'var(--foreground)' }}>
                            ¿Estás seguro de que deseas eliminar este ticket?
                        </h2>
                        
                        <div className="space-y-3 mb-6 p-4 rounded-lg" style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}>
                            <div className="flex justify-between">
                                <span className="font-medium">Sorteo:</span>
                                <span>{ticketToDelete.sorteo}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Monto:</span>
                                <span className="font-mono font-bold text-green-700">₡{ticketToDelete.amount.toLocaleString('es-CR')}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="font-medium">Hora:</span>
                                <span className="font-mono">{ticketToDelete.time}</span>
                            </div>
                        </div>

                        <div className="flex gap-3 justify-end">
                            <button
                                className="px-6 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 hover:opacity-80 transition-opacity"
                                style={{
                                    background: 'var(--button-bg)',
                                    color: 'var(--button-text)',
                                    border: '1px solid var(--input-border)'
                                }}
                                onClick={cancelDeleteTicket}
                            >
                                Cancelar
                            </button>
                            <button
                                className="px-6 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                                onClick={confirmDeleteTicket}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showExportConfirm && (
                <ConfirmModal
                    open={showExportConfirm}
                    title="Confirmar exportación"
                    message="¿Deseas exportar el resumen como imagen PNG?"
                    confirmText="Exportar PNG"
                    cancelText="Cancelar"
                    loading={isExporting}
                    onConfirm={handleConfirmExport}
                    onCancel={() => setShowExportConfirm(false)}
                    actionType="assign"
                />
            )}

            <div ref={exportRef}
                className="p-6 rounded-lg"
                style={{
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    minHeight: '400px',
                    border: '1px solid var(--input-border)'
                }}>
                <div className="flex flex-col lg:flex-row gap-8 w-full">
                  {/* Panel principal: controles y tickets */}
                  <div className="flex-1 min-w-[320px] max-w-[600px] flex flex-col">
                    <div className="mb-6 flex items-center gap-4">
                      <Timer className="w-6 h-6 text-blue-600" />
                      <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Control de tiempos</h3>
                      <HelpTooltip />
                    </div>
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
                    {keyBuffer && (
                      <div className="mb-4 export-hide">
                        <div className="inline-flex items-center px-3 py-1 rounded-full text-sm font-mono"
                          style={{
                            background: 'var(--input-bg)',
                            border: '1px solid var(--input-border)',
                            color: 'var(--foreground)'
                          }}>
                          Escribiendo: <span className="ml-2 font-bold">{keyBuffer}</span>
                        </div>
                      </div>
                    )}
                    <div className="mb-4 flex flex-col sm:flex-row gap-2 items-center justify-between">
                      <div className="flex flex-col items-start"></div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          style={{ background: 'var(--button-bg)', color: 'var(--button-text)' }}
                          onClick={() => setShowSummary(true)}
                        >
                          Ver resumen
                        </button>
                        <button
                          className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50"
                          onClick={exportToPNG}
                          disabled={!personName.trim() || isExporting}
                        >
                          <Download className="w-4 h-4" />
                          {isExporting ? 'Exportando...' : 'Exportar PNG'}
                        </button>
                        <button
                          className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-500 bg-red-500 hover:bg-red-600 text-white"
                          onClick={() => {
                            if (window.confirm('¿Seguro que deseas limpiar todos los tickets y datos guardados?')) {
                              clearAllLocalStorage();
                            }
                          }}
                        >
                          Limpiar todo
                        </button>
                      </div>
                    </div>
                    {/* Lista de tickets y carrusel */}
                    {tickets.length > 0 && !showCodeModal && !showDeleteModal && (
                      <div className="mb-6">
                        <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                          Tickets registrados:
                        </h4>
                        <TicketCarousel tickets={ticketsForCarousel} onDelete={ticket => handleDeleteTicket({ ...ticket, code: '' })} onEdit={edited => handleEditTicket({ ...edited, code: tickets.find(t => t.id === edited.id)?.code || '' })} />
                      </div>
                    )}
                  </div>
                  {/* Panel de resumen a la derecha */}
                  <div className="flex flex-col min-w-[260px] max-w-xs border-l border-[var(--input-border)] pl-4">
                    <h4 className="text-lg font-semibold mb-2" style={{ color: 'var(--foreground)' }}>
                      Resumen de Ventas por Sorteo
                    </h4>
                    <div className="space-y-2 mb-2">
                      {Object.entries(resumenSorteos).map(([sorteo, total]) => (
                        <div key={sorteo} className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--input-border)' }}>
                          <span className="font-medium" style={{ color: 'var(--foreground)' }}>{sorteo}</span>
                          <span className="font-mono font-semibold" style={{ color: 'var(--foreground)' }}>₡ {total.toLocaleString('es-CR')}</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-right font-bold text-xl pt-2" style={{ color: 'var(--foreground)', borderTop: '2px solid var(--input-border)' }}>
                      Total General: <span className="font-mono text-green-700">₡ {totalGeneral.toLocaleString('es-CR')}</span>
                    </div>
                  </div>
                </div>
            </div>
          </React.Fragment>
        </ToastProvider>
    );
}
