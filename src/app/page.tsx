// app/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import BarcodeScanner from '@/components/BarcodeScanner'
import PriceCalculator from '@/components/PriceCalculator'
import TextConversion from '@/components/TextConversion'
import ScanHistory from '@/components/ScanHistory'
import CashCounterTabs from '@/components/CashCounterTabs'
import {
  Calculator,
  Smartphone,
  Type,
  ClipboardList,
  Banknote,
  Scan,
} from 'lucide-react'
import type { ScanHistoryEntry } from '@/types/barcode'
import TimingControl from '@/components/TimingControl'

// 1) Ampliamos ActiveTab para incluir "cashcounter"
type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'history' | 'timingcontrol'

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
      } catch {}
    }
  }, [])
  // LocalStorage: save on change
  useEffect(() => {
    localStorage.setItem('scanHistory', JSON.stringify(scanHistory))
  }, [scanHistory])

  // Función para manejar códigos detectados por el escáner
  const handleCodeDetected = (code: string) => {
    setScanHistory(prev => {
      if (prev[0]?.code === code) return prev
      // Si ya existe, lo sube al tope pero mantiene el nombre
      const existing = prev.find(e => e.code === code)
      const newEntry: ScanHistoryEntry = existing ? { ...existing, code } : { code }
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
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    showNotification('¡Código copiado!', 'green');
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

  // 3) Lista de pestañas
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
    { 
      id: 'history' as ActiveTab, 
      name: 'Historial', 
      icon: ClipboardList, 
      description: 'Ver códigos escaneados', 
      badge: scanHistory.length > 0 ? scanHistory.length : undefined 
    },
    { id: 'timingcontrol' as ActiveTab, name: 'Control Tiempos', icon: Smartphone, description: 'Registro de venta de tiempos' },
  ]

  // 4) Al montar, leemos el hash de la URL y marcamos la pestaña correspondiente
  useEffect(() => {
    // Solo en cliente (window existe)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as ActiveTab
      // Si coincide con alguna pestaña válida, la activamos
      if (['scanner','calculator','converter','cashcounter','history','timingcontrol'].includes(hash)) {
        setActiveTab(hash)
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
                    {tab.badge && (
                      <span
                        className="ml-1 py-0.5 px-2 rounded-full text-xs"
                        style={{ backgroundColor: 'var(--badge-bg)', color: 'var(--badge-text)' }}
                      >
                        {tab.badge}
                      </span>
                    )}
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
        <div className="space-y-8">
          {/* SCANNER */}
          {activeTab === 'scanner' && (
            <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
              <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1">
                  <BarcodeScanner onDetect={handleCodeDetected} />
                </div>
                <div className="w-full lg:w-80">
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
              <div className="mt-6 bg-blue-50 rounded-lg p-4">
                <h3 className="font-medium text-blue-800 mb-2">💡 Consejos para mejores resultados:</h3>
                <ul className="text-sm text-blue-700 space-y-1">
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

          {/* HISTORY */}
          {activeTab === 'history' && (
            <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4">
              <ScanHistory
                history={scanHistory}
                onCopy={handleCopy}
                onDelete={handleDelete}
                onRemoveLeadingZero={handleRemoveLeadingZero}
                onRename={handleRename}
                notify={showNotification}
              />
              {scanHistory.length > 0 ? (
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setScanHistory([])}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:ring-2 focus:ring-red-500 transition-colors"
                  >
                    Limpiar Historial
                  </button>
                </div>
              ) : (
                <div className="mt-6 text-center">
                  <div className="mb-4 flex justify-center">
                    <Smartphone className="w-16 h-16 text-gray-500 dark:text-gray-300" />
                  </div>
                  <p className="text-gray-500 mb-4">Aún no has escaneado ningún código de barras</p>
                  <button
                    onClick={() => setActiveTab('scanner')}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 transition-colors"
                  >
                    Ir al Escáner
                  </button>
                </div>
              )}
            </div>
          )}

          {/* CONTROL TIEMPOS */}
          {activeTab === 'timingcontrol' && (
            <div className="max-w-4xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-4 min-h-[300px] flex flex-col items-center justify-center">
              <TimingControl />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
