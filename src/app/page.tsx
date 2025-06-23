// app/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
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
} from 'lucide-react'
import type { ScanHistoryEntry } from '@/types/barcode'
import TimingControl from '@/components/TimingControl'

// 1) Ampliamos ActiveTab para incluir "cashcounter", "controlhorario"
type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'history' | 'timingcontrol' | 'controlhorario'

export default function HomePage() {
  // 2) Estado para la pestaña activa
  const [activeTab, setActiveTab] = useState<ActiveTab>('cashcounter')
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([])
  const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);

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
  // Función para manejar códigos detectados por el escáner
  const handleCodeDetected = (code: string, productName?: string) => {
    setScanHistory(prev => {
      if (prev[0]?.code === code) return prev
      // Si ya existe, lo sube al tope pero mantiene el nombre existente o usa el nuevo
      const existing = prev.find(e => e.code === code)
      const newEntry: ScanHistoryEntry = existing
        ? { ...existing, code, name: productName || existing.name }
        : { code, name: productName }
      const filtered = prev.filter(e => e.code !== code)
      return [newEntry, ...filtered].slice(0, 20)
    })
  }

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
  }  // 3) Lista de pestañas
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

  ]  // 4) Al montar, leemos el hash de la URL y marcamos la pestaña correspondiente
  useEffect(() => {
    const checkAndSetTab = () => {
      if (typeof window !== 'undefined') {
        const hash = window.location.hash.replace('#', '') as ActiveTab
        // Si coincide con alguna pestaña válida, la activamos
        if (['scanner', 'calculator', 'converter', 'cashcounter', 'history', 'timingcontrol', 'controlhorario'].includes(hash)) {
          setActiveTab(hash)
        }
      }
    }

    // Ejecutar inmediatamente
    checkAndSetTab()

    // También ejecutar después de un pequeño delay para asegurar que se cargue
    const timeout = setTimeout(checkAndSetTab, 100)

    return () => clearTimeout(timeout)
  }, [])

  // 6) Escuchar cambios en el hash para actualizar la pestaña activa
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleHashChange = () => {
        const hash = window.location.hash.replace('#', '') as ActiveTab
        console.log('Hash changed to:', hash) // Debug
        if (['scanner', 'calculator', 'converter', 'cashcounter', 'history', 'timingcontrol', 'controlhorario'].includes(hash)) {
          setActiveTab(hash)
        }
      }

      // Agregar el listener
      window.addEventListener('hashchange', handleHashChange)

      // Limpiar el listener al desmontar
      return () => {
        window.removeEventListener('hashchange', handleHashChange)
      }
    }
  }, [])

  // 5) Cada vez que cambie activeTab, actualizamos el hash en la URL
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Por ejemplo: https://.../#cashcounter
      window.history.replaceState(null, '', `#${activeTab}`)
    }
  }, [activeTab])

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

        {/* Navegación por pestañas */}
        <div className="mb-8">
          <nav className="border-b border-[var(--input-border)]">
            <div className="-mb-px flex space-x-8">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group relative flex-1 py-4 px-1 text-center text-sm font-medium transition-colors
                    ${activeTab === tab.id
                      ? 'text-[var(--tab-text-active)] border-b-2 border-[var(--tab-border-active)]'
                      : 'text-[var(--tab-text)] border-b-2 border-[var(--tab-border)] hover:text-[var(--tab-hover-text)]'
                    }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <tab.icon className="w-5 h-5" />
                    <span className="hidden sm:inline">{tab.name}</span>

                  </div>
                </button>
              ))}
            </div>
          </nav>
        </div>

        {/* Descripción de la pestaña activa */}
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold mb-2">
            {tabs.find(t => t.id === activeTab)?.name}
          </h2>
          <p className="text-[var(--tab-text)]">
            {tabs.find(t => t.id === activeTab)?.description}
          </p>
        </div>

        {/* Contenido de las pestañas */}
        <div className="space-y-8">          {/* SCANNER */}
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
              <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">💡 Consejos para mejores resultados:</h3>
                <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                  <li>• Asegúrate de que el código de barras esté bien iluminado</li>
                  <li>• La imagen debe estar enfocada y sin borrosidad</li>
                  <li>• Puedes pegar imágenes directamente con Ctrl+V</li>
                  <li>• Soporta múltiples formatos: EAN-13, Code-128, QR, UPC-A</li>
                </ul>
              </div>
            </div>
          )}

          {/* CALCULATOR */}
          {activeTab === 'calculator' && (
            <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
              <PriceCalculator />
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-medium text-green-800 mb-2">🇨🇷 Para Costa Rica:</h3>
                  <p className="text-sm text-green-700">IVA configurado al 13% por defecto. Puedes cambiarlo según tus necesidades.</p>
                </div>
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="font-medium text-yellow-800 mb-2">💰 Cálculo inteligente:</h3>
                  <p className="text-sm text-yellow-700">El descuento se aplica primero y luego se calcula el impuesto sobre el precio con descuento.</p>
                </div>
              </div>
            </div>
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
          )}          {/* CONTROL HORARIO */}
          {activeTab === 'controlhorario' && (
            <ControlHorario />
          )}
        </div>
      </main>
    </>
  )
}
