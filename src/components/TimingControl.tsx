import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SorteosService } from '../services/sorteos';
import { Timer, Download } from 'lucide-react';
import type { Sorteo } from '../types/firestore';

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
    const [autoSaving, setAutoSaving] = useState(false);
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
        setAutoSaving(true);
        const state = {
            tickets,
            personName,
            keyBuffer,
            timestamp: Date.now()
        };
        localStorage.setItem('timingControlCompleteState', JSON.stringify(state));
        setTimeout(() => setAutoSaving(false), 1000);
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
    }, [showCodeModal, selectedSorteo]);const exportToJPG = async () => {
        if (!personName.trim()) {
            alert('Por favor ingresa el nombre de la persona antes de exportar');
            return;
        }

        setIsExporting(true);

        try {
            // Dynamically import html2canvas
            const html2canvas = (await import('html2canvas')).default; if (exportRef.current) {
                // Obtener colores del tema actual
                const themeColors = getCurrentThemeColors();

                // Primero, obtener todos los valores de los selects del elemento original
                const originalSelects = exportRef.current.querySelectorAll('select');
                const selectValues: { value: string; text: string }[] = [];
                originalSelects.forEach((select) => {
                    const htmlSelect = select as HTMLSelectElement;
                    const selectedOption = htmlSelect.options[htmlSelect.selectedIndex]; const valueData = {
                        value: htmlSelect.value,
                        text: selectedOption && htmlSelect.value ? selectedOption.text : ''
                    }; selectValues.push(valueData);
                });

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
                await new Promise(resolve => setTimeout(resolve, 100));                // Ocultar elementos que no deben aparecer en la exportación
                const elementsToHide = clonedElement.querySelectorAll('.export-hide');
                elementsToHide.forEach((element) => {
                    (element as HTMLElement).style.setProperty('display', 'none', 'important');
                });

                // Mostrar y configurar el timestamp de exportación
                const timestampElement = clonedElement.querySelector('.export-timestamp');
                if (timestampElement) {
                    (timestampElement as HTMLElement).style.setProperty('display', 'block', 'important');
                    const dateTimeElement = timestampElement.querySelector('#export-date-time');
                    if (dateTimeElement) {
                        const now = new Date();
                        const dateStr = now.toLocaleDateString('es-CR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        });
                        const timeStr = now.toLocaleTimeString('es-CR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });
                        dateTimeElement.textContent = `${dateStr} ${timeStr}`;
                    }
                }

                // Reemplazar todos los selects con divs que muestren el texto seleccionado
                const selects = clonedElement.querySelectorAll('select'); selects.forEach((select, index) => {                    // Usar los valores que obtuvimos del elemento original
                    const selectedText = selectValues[index] ? selectValues[index].text : '';

                    // Crear un div que reemplace el select
                    const div = document.createElement('div');
                    div.className = select.className;

                    // Copiar todos los estilos del select original
                    const computedStyle = window.getComputedStyle(select);
                    div.style.cssText = select.style.cssText;

                    // Aplicar estilos específicos para que se vea como el select original
                    div.style.setProperty('display', 'flex', 'important');
                    div.style.setProperty('align-items', 'center', 'important');
                    div.style.setProperty('justify-content', 'flex-start', 'important');
                    div.style.setProperty('padding', computedStyle.padding || '8px 12px', 'important');
                    div.style.setProperty('border', computedStyle.border, 'important');
                    div.style.setProperty('border-radius', computedStyle.borderRadius, 'important');
                    div.style.setProperty('background-color', computedStyle.backgroundColor, 'important');
                    div.style.setProperty('color', computedStyle.color, 'important');
                    div.style.setProperty('font-family', computedStyle.fontFamily, 'important');
                    div.style.setProperty('font-size', computedStyle.fontSize, 'important');
                    div.style.setProperty('width', computedStyle.width, 'important');
                    div.style.setProperty('height', computedStyle.height, 'important');
                    div.style.setProperty('box-sizing', 'border-box', 'important');

                    div.textContent = selectedText;

                    // Reemplazar el select con el div
                    select.parentNode?.replaceChild(div, select);
                });

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
    };    return (
        <div className="rounded-lg shadow-md p-6" style={{ background: 'var(--card-bg)', color: 'var(--foreground)' }}>
            {/* Modal de resumen */}
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

            <div ref={exportRef}
                className="p-6 rounded-lg"
                style={{
                    background: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    minHeight: '400px',
                    border: '1px solid var(--input-border)'
                }}>

                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Timer className="w-6 h-6 text-blue-600" />
                            <h3 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Control de tiempos</h3>
                        </div>

                        {/* Fecha y hora de exportación - solo visible en imagen exportada */}
                        <div className="export-timestamp hidden text-sm border border-gray-300 rounded-lg p-2 bg-gray-50"
                            style={{ color: 'var(--foreground)', backgroundColor: 'rgba(249, 250, 251, 0.9)' }}>
                            <div className="text-right">
                                <div className="font-semibold text-gray-600">Exportado:</div>
                                <div id="export-date-time" className="font-mono text-xs text-gray-700"></div>
                            </div>
                        </div>                        {/* Nota para pantallas medianas y grandes */}
                        <div className="hidden md:block p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs max-w-xs export-hide">
                            <p><strong>Nota:</strong> Escriba T11, T10, NNN o TTT en cualquier momento para abrir el modal de entrada.</p>
                            {autoSaving && <p className="mt-1 text-green-600"><strong>Guardando...</strong></p>}
                        </div>
                    </div>
                    {/* Nota para pantallas pequeñas */}
                    <div className="md:hidden mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-xs export-hide">
                        <p><strong>Nota:</strong> Escriba T11, T10, NNN o TTT para abrir el modal de entrada.</p>
                        {autoSaving && <p className="mt-1 text-green-600"><strong>Guardando...</strong></p>}
                    </div>
                </div>                {/* Campo para nombre de persona */}
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

                {/* Indicador de buffer de teclas */}
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
                        </button>
                        <button
                            className="px-4 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 disabled:opacity-50"
                            onClick={exportToJPG}
                            disabled={!personName.trim() || isExporting}
                        >
                            <Download className="w-4 h-4" />
                            {isExporting ? 'Exportando...' : 'Exportar JPG'}
                        </button>                        <button
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

                {/* Lista de tickets como pequeños tickets */}
                {tickets.length > 0 && (
                    <div className="mb-6">
                        <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                            Tickets registrados:
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {tickets.map((ticket) => (                                <div
                                    key={ticket.id}
                                    className="border border-gray-300 rounded-lg p-3 text-sm"
                                    style={{
                                        background: 'var(--input-bg)',
                                        borderColor: 'var(--input-border)',
                                        color: 'var(--foreground)'
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="font-medium text-sm" style={{ color: 'var(--foreground)' }}>
                                            {ticket.sorteo}
                                        </div>                                        <button
                                            className="text-red-500 hover:text-red-700 export-hide"
                                            onClick={() => handleDeleteTicket(ticket)}
                                            title="Eliminar ticket"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                            </svg>
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="font-mono font-bold text-green-700">
                                            ₡ {ticket.amount.toLocaleString('es-CR')}
                                        </span>
                                        <span className="text-xs" style={{ color: 'var(--foreground)', opacity: 0.7 }}>
                                            {ticket.time}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Resumen de sorteos para exportación */}
                {Object.keys(resumenSorteos).length > 0 && (
                    <div className="mt-6 pt-4" style={{ borderTop: '2px solid var(--input-border)' }}>
                        <h4 className="text-lg font-semibold mb-4" style={{ color: 'var(--foreground)' }}>
                            Resumen de Ventas por Sorteo
                        </h4>
                        <div className="space-y-2 mb-4">
                            {Object.entries(resumenSorteos).map(([sorteo, total]) => (
                                <div key={sorteo} className="flex justify-between pb-2" style={{ borderBottom: '1px solid var(--input-border)' }}>
                                    <span className="font-medium" style={{ color: 'var(--foreground)' }}>{sorteo}</span>
                                    <span className="font-mono font-semibold" style={{ color: 'var(--foreground)' }}>₡ {total.toLocaleString('es-CR')}</span>
                                </div>
                            ))}
                        </div>
                        <div className="text-right font-bold text-xl pt-2" style={{
                            color: 'var(--foreground)',
                            borderTop: '2px solid var(--input-border)'
                        }}>
                            Total General: <span className="font-mono text-green-700">₡ {totalGeneral.toLocaleString('es-CR')}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
