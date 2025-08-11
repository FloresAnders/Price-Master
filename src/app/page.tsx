// app/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'
import PriceCalculator from '@/components/PriceCalculator'
import TextConversion from '@/components/TextConversion'
import ScanHistory from '@/components/ScanHistory'
import CashCounterTabs from '@/components/CashCounterTabs'
import ControlHorario from '@/components/ControlHorario'
import {
  Calculator,
  Smartphone,
  Type, Banknote,
  Scan,
  Clock,
  Truck,
  Settings,
  History,
} from 'lucide-react'
import type { ScanHistoryEntry } from '@/types/barcode'
import TimingControl from '@/components/TimingControl'
import ClientOnlyHomeMenu from '@/components/ClientOnlyHomeMenu'
import SupplierOrders from '@/components/SupplierOrders'
import Mantenimiento from '@/components/Mantenimiento'
import ScanHistoryTable from '@/components/ScanHistoryTable'
import { storage } from '@/config/firebase'
import { ref, listAll } from 'firebase/storage'

// 1) Ampliamos ActiveTab para incluir "cashcounter", "controlhorario", "supplierorders", "edit", "scanhistory"
type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'timingcontrol' | 'controlhorario' | 'supplierorders' | 'scanhistory' | 'edit'

export default function HomePage() {
  // 2) Estado para la pestaña activa - now managed by URL hash only
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])
  const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);

  // Helper function to get tab info
  const getTabInfo = (tabId: ActiveTab | null) => {
    const tabs = [
      { id: 'scanner' as ActiveTab, name: 'Escáner', icon: Scan, description: 'Escanear códigos de barras' },
      { id: 'calculator' as ActiveTab, name: 'Calculadora', icon: Calculator, description: 'Calcular precios con descuentos' },
      { id: 'converter' as ActiveTab, name: 'Conversor', icon: Type, description: 'Convertir y transformar texto' },
      {
        id: 'cashcounter' as ActiveTab,
        name: 'Contador Efectivo',
        icon: Banknote,
        description: 'Contar billetes y monedas (CRC/USD)'
      },
      { id: 'timingcontrol' as ActiveTab, name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos' },
      { id: 'controlhorario' as ActiveTab, name: 'Control Horario', icon: Clock, description: 'Registro de horarios de trabajo' },
      { id: 'supplierorders' as ActiveTab, name: 'Órdenes Proveedor', icon: Truck, description: 'Gestión de órdenes de proveedores' },
      { id: 'scanhistory' as ActiveTab, name: 'Historial de Escaneos', icon: History, description: 'Ver historial completo de escaneos' },
      { id: 'edit' as ActiveTab, name: 'Mantenimiento', icon: Settings, description: 'Gestión y mantenimiento del sistema' },
    ];
    return tabs.find(t => t.id === tabId);
  };

  // LocalStorage: load on mount
  useEffect(() => {
    const stored = localStorage.getItem('scanHistory')
    if (stored) {
      try {
        setScanHistory(JSON.parse(stored))
      } catch { }
    }
  }, [])
  // LocalStorage: save on change
  useEffect(() => {
    localStorage.setItem('scanHistory', JSON.stringify(scanHistory))
  }, [scanHistory])

  // Function to check if a code has images in Firebase Storage
  const checkCodeHasImages = useCallback(async (barcodeCode: string): Promise<boolean> => {
    try {
      const storageRef = ref(storage, 'barcode-images/');
      const result = await listAll(storageRef);

      const hasImages = result.items.some(item => {
        const fileName = item.name;
        return fileName === `${barcodeCode}.jpg` ||
          fileName.match(new RegExp(`^${barcodeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)\\.jpg$`));
      });

      return hasImages;
    } catch (error) {
      console.error('Error checking if code has images:', error);
      return false;
    }
  }, []);

  // Función para manejar códigos detectados por el escáner
  const handleCodeDetected = useCallback(async (code: string, productName?: string) => {
    // Check if code has images
    const hasImages = await checkCodeHasImages(code);

    setScanHistory(prev => {
      if (prev[0]?.code === code) return prev
      // Si ya existe, lo sube al tope pero mantiene el nombre existente o usa el nuevo
      const existing = prev.find(e => e.code === code)
      const newEntry: ScanHistoryEntry = existing
        ? { ...existing, code, name: productName || existing.name, hasImages }
        : { code, name: productName, hasImages }
      const filtered = prev.filter(e => e.code !== code)
      return [newEntry, ...filtered].slice(0, 20)
    })
  }, [checkCodeHasImages])

  // Helper to show notification
  const showNotification = (message: string, color: string = 'green') => {
    setNotification({ message, color });
    setTimeout(() => setNotification(null), 2000);
  }
  // Handler: copiar
  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers or insecure contexts
        const textArea = document.createElement('textarea');
        textArea.value = code;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }
      showNotification('¡Código copiado!', 'green');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      showNotification('Error al copiar código', 'red');
    }
  }
  // Handler: eliminar
  const handleDelete = (code: string) => {
    setScanHistory(prev => prev.filter(e => e.code !== code));
    showNotification('Código eliminado', 'red');
  }
  // Handler: eliminar primer dígito
  const handleRemoveLeadingZero = (code: string) => {
    setScanHistory(prev => prev.map(e =>
      e.code === code && code.length > 1 && code[0] === '0'
        ? { ...e, code: code.slice(1) }
        : e
    ));
    showNotification('Primer dígito eliminado', 'blue');
  }
  // Handler: renombrar
  const handleRename = (code: string, name: string) => {
    setScanHistory(prev => prev.map(e =>
      e.code === code ? { ...e, name } : e
    ));
    showNotification('Nombre actualizado', 'indigo');
  }

  // Handler: mostrar imágenes
  const handleShowImages = useCallback((code: string) => {
    showNotification(`Mostrando imágenes de: ${code}`, 'purple');
  }, []);

  // Effect to check if existing codes in history have images
  useEffect(() => {
    if (scanHistory.length === 0) return;

    const updateHistoryWithImages = async () => {
      const updatedHistory = await Promise.all(
        scanHistory.map(async (entry) => {
          if (entry.hasImages === undefined) {
            const hasImages = await checkCodeHasImages(entry.code);
            return { ...entry, hasImages };
          }
          return entry;
        })
      );

      // Only update if there are changes
      const hasChanges = updatedHistory.some((entry, index) =>
        entry.hasImages !== scanHistory[index]?.hasImages
      );

      if (hasChanges) {
        setScanHistory(updatedHistory);
      }
    };

    updateHistoryWithImages();
  }, [checkCodeHasImages, scanHistory]); // Added scanHistory back as dependency

  // 4) Al montar, leemos el hash de la URL y marcamos la pestaña correspondiente
  useEffect(() => {
    const checkAndSetTab = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace('#', '') as ActiveTab;
        const validTabs = [
          'scanner', 'calculator', 'converter', 'cashcounter', 'timingcontrol', 'controlhorario', 'supplierorders', 'scanhistory'
        ];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else if (hash === 'edit') {
          // Special handling for edit tab
          setActiveTab('edit');
        } else {
          setActiveTab(null); // Si no hay hash válido, mostrar HomeMenu
        }
      }
    };
    checkAndSetTab();
    const timeout = setTimeout(checkAndSetTab, 100);
    return () => clearTimeout(timeout);
  }, [])

  // 6) Escuchar cambios en el hash para actualizar la pestaña activa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleHashChange = () => {
        const hash = window.location.hash.replace('#', '') as ActiveTab;
        const validTabs = [
          'scanner', 'calculator', 'converter', 'cashcounter', 'timingcontrol', 'controlhorario', 'supplierorders', 'scanhistory', 'edit'
        ];
        if (validTabs.includes(hash)) {
          setActiveTab(hash);
        } else {
          setActiveTab(null);
        }
      };
      window.addEventListener('hashchange', handleHashChange);
      return () => {
        window.removeEventListener('hashchange', handleHashChange);
      };
    }
  }, [])
  return (
    <>
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {notification && (
          <div
            className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down bg-${notification.color}-500 text-white`}
            style={{ minWidth: 180, textAlign: 'center' }}
          >
            {notification.message}
          </div>
        )}
        {activeTab === null ? (
          <ClientOnlyHomeMenu />
        ) : (
          <>
            {/* Page title for active tab */}
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold mb-2">
                {getTabInfo(activeTab)?.name}
              </h2>
              <p className="text-[var(--tab-text)]">
                {getTabInfo(activeTab)?.description}
              </p>
            </div>

            {/* Contenido de las pestañas */}
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
                          onShowImages={handleShowImages}
                          notify={showNotification}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* CALCULATOR */}
              {activeTab === 'calculator' && (
                <PriceCalculator />
              )}

              {/* CONVERTER */}
              {activeTab === 'converter' && (
                <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
                  <TextConversion />
                </div>
              )}

              {/* CASHCOUNTER (Contador Efectivo) */}
              {activeTab === 'cashcounter' && (
                <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
                  <CashCounterTabs />
                </div>
              )}

              {/* CONTROL TIEMPOS */}
              {activeTab === 'timingcontrol' && (
                <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 min-h-[300px] flex flex-col items-center justify-center">
                  <TimingControl />
                </div>
              )}

              {/* CONTROL HORARIO */}
              {activeTab === 'controlhorario' && (
                <ControlHorario />
              )}

              {/* SUPPLIER ORDERS */}
              {activeTab === 'supplierorders' && (
                <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
                  <SupplierOrders />
                </div>
              )}

              {/* HISTORIAL DE ESCANEOS */}
              {activeTab === 'scanhistory' && (
                <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
                  <ScanHistoryTable notify={showNotification} />
                </div>
              )}

              {/* EDIT / MANTENIMIENTO */}
              {activeTab === 'edit' && (
                <Mantenimiento />
              )}
            </div>
          </>
        )}
      </main>
    </>
  )
}