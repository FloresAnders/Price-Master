// app/page.tsx
'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { BarcodeScanner } from '@/components/scanner'
import { PriceCalculator, TextConversion } from '@/components/calculator'
import { ScanHistory } from '@/components/scanner'
import { CashCounterTabs, ControlHorario, TimingControl, SupplierOrders } from '@/components/business'
import { useAuth } from '@/hooks/useAuth'
import useToast from '@/hooks/useToast';
/*import { Calculator, Smartphone, Type, Banknote, Scan, Clock, Truck, Settings, History, } from lucide-react'*/
import type { ScanHistoryEntry } from '@/types/barcode'
import { ClientOnlyHomeMenu } from '@/components/layout'
import { Mantenimiento } from '@/components/admin'
import { ScanHistoryTable } from '@/components/scanner'
import { storage } from '@/config/firebase'
import { ref, listAll } from 'firebase/storage'
import Pruebas from '@/components/xpruebas/Pruebas'

// 1) Ampliamos ActiveTab para incluir "cashcounter", "controlhorario", "supplierorders", "edit", "scanhistory", "solicitud"
type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'timingcontrol' | 'controlhorario' | 'supplierorders' | 'scanhistory' | 'edit' | 'solicitud' | 'fondogeneral' | 'pruebas'
import FondoGeneralPage from '@/app/fondogeneral/page';
import SolicitudForm from '@/components/solicitud/SolicitudForm'

export default function HomePage() {
  // Hook para obtener el usuario autenticado
  const { user } = useAuth();

  // 2) Estado para la pestaña activa - now managed by URL hash only
  const [activeTab, setActiveTab] = useState<ActiveTab | null>(null);
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])
  const { showToast } = useToast();

  // Memoize notify so callbacks can depend on a stable reference
  const notify = useCallback((message: string, color: string = 'green') => {
    const type = color === 'green' ? 'success' : color === 'red' ? 'error' : 'info';
    showToast(message, type);
  }, [showToast]);
  // Helper function to get tab info
  {/*TODO: DESCOMENTAR LO SIGUIENTE SI SE QUIERE LAS DESCRIPCIONES EN LAS PESTAÑAS */ }
  /*
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
  */
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

  // Use global toast
  
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
  notify('¡Código copiado!', 'green');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
  notify('Error al copiar código', 'red');
    }
  }
  // Handler: eliminar
  const handleDelete = (code: string) => {
    setScanHistory(prev => prev.filter(e => e.code !== code));
  notify('Código eliminado', 'red');
  }
  // Handler: eliminar primer dígito
  const handleRemoveLeadingZero = (code: string) => {
    setScanHistory(prev => prev.map(e =>
      e.code === code && code.length > 1 && code[0] === '0'
        ? { ...e, code: code.slice(1) }
        : e
    ));
  notify('Primer dígito eliminado', 'blue');
  }
  // Handler: renombrar
  const handleRename = (code: string, name: string) => {
    setScanHistory(prev => prev.map(e =>
      e.code === code ? { ...e, name } : e
    ));
  notify('Nombre actualizado', 'indigo');
  }

  // Handler: mostrar imágenes
  const handleShowImages = useCallback((code: string) => {
    notify(`Mostrando imágenes de: ${code}`, 'purple');
  }, [notify]);

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

  const isSuperAdmin = user?.role === 'superadmin';

  useEffect(() => {
    if (!isSuperAdmin && activeTab === 'pruebas') {
      setActiveTab(null);
      if (typeof window !== 'undefined' && window.location.hash === '#pruebas') {
        window.location.hash = '';
      }
    }
  }, [isSuperAdmin, activeTab]);

  // 4) Al montar, leemos el hash de la URL y marcamos la pestaña correspondiente
  useEffect(() => {
    const checkAndSetTab = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace('#', '') as ActiveTab;
        const validTabs = [
          'scanner', 'calculator', 'converter', 'cashcounter', 'timingcontrol', 'controlhorario', 'supplierorders', 'scanhistory', 'solicitud', 'fondogeneral',
          ...(isSuperAdmin ? ['pruebas'] : [])
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
  }, [isSuperAdmin])

  // 6) Escuchar cambios en el hash para actualizar la pestaña activa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleHashChange = () => {
        const hash = window.location.hash.replace('#', '') as ActiveTab;
        const validTabs = [
          'scanner', 'calculator', 'converter', 'cashcounter', 'timingcontrol', 'controlhorario', 'supplierorders', 'scanhistory', 'edit', 'solicitud', 'fondogeneral',
          ...(isSuperAdmin ? ['pruebas'] : [])
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
  }, [isSuperAdmin])
  return (
    <>
      <main className="flex-1 max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* notifications are rendered globally by ToastProvider */}
        {activeTab === null ? (
          <ClientOnlyHomeMenu />
        ) : (
          <>
            {/*TODO: DESCOMENTAR LO SIGUIENTE SI SE QUIERE LAS DESCRIPCIONES EN LAS PESTAÑAS */}
            {/* Page title for active tab 
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold mb-2">
                {getTabInfo(activeTab)?.name}
              </h2>
              <p className="text-[var(--tab-text)]">
                {getTabInfo(activeTab)?.description}
              </p>
            </div>*/}

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
                          notify={notify}
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
                <TextConversion />
              )}

              {/* CASHCOUNTER (Contador Efectivo) */}
              {activeTab === 'cashcounter' && (
                <CashCounterTabs />
              )}

              {/* CONTROL TIEMPOS */}
              {activeTab === 'timingcontrol' && (
                <div className="max-w-7xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
                  <TimingControl />
                </div>
              )}

              {/* CONTROL HORARIO */}
              {activeTab === 'controlhorario' && (
                <ControlHorario currentUser={user} />
              )}

              {/* SUPPLIER ORDERS */}
              {activeTab === 'supplierorders' && (
                <SupplierOrders />
              )}

              {/* HISTORIAL DE ESCANEOS */}
              {activeTab === 'scanhistory' && (
                <ScanHistoryTable />
              )}

              {/* FONDO GENERAL */}
              {activeTab === 'fondogeneral' && (
                <FondoGeneralPage />
              )}

              {/* SOLICITUD */}
              {activeTab === 'solicitud' && (
                <SolicitudForm />
              )}

              {/* EDIT / MANTENIMIENTO */}
              {activeTab === 'edit' && (
                <Mantenimiento />
              )}

              {/* ÁREA DE PRUEBAS */}
              {activeTab === 'pruebas' && isSuperAdmin && (
                <Pruebas />
              )}
            </div>
          </>
        )}
      </main>
    </>
  )
}