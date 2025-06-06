// app/page.tsx
'use client'

import React, { useState, useEffect } from 'react'
import Header from '@/components/Header'
import BarcodeScanner from '@/components/BarcodeScanner'
import PriceCalculator from '@/components/PriceCalculator'
import TextConversion from '@/components/TextConversion'
import ScanHistory from '@/components/ScanHistory'
import Footer from '@/components/Footer'
import CashCounterTabs from '@/components/CashCounterTabs'
import {
  Calculator,
  Smartphone,
  Type,
  ClipboardList,
  Banknote,
  Scan,
} from 'lucide-react'

// 1) Ampliamos ActiveTab para incluir "cashcounter"
type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'cashcounter' | 'history'

export default function HomePage() {
  // 2) Estado para la pestaña activa
  const [activeTab, setActiveTab] = useState<ActiveTab>('cashcounter')
  const [scanHistory, setScanHistory] = useState<string[]>([])

  // Función para manejar códigos detectados por el escáner
  const handleCodeDetected = (code: string) => {
    setScanHistory(prev => (
      prev[0] === code
        ? prev
        : [code, ...prev.slice(0, 19)]
    ))
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
    }
  ]

  // 4) Al montar, leemos el hash de la URL y marcamos la pestaña correspondiente
  useEffect(() => {
    // Solo en cliente (window existe)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as ActiveTab
      // Si coincide con alguna pestaña válida, la activamos
      if (['scanner','calculator','converter','cashcounter','history'].includes(hash)) {
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
      <Header />

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              <BarcodeScanner onDetect={handleCodeDetected} />
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
              <div className="mt-6 bg-purple-50 rounded-lg p-4">
                <h3 className="font-medium text-purple-800 mb-2">🔧 Casos de uso comunes:</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-purple-700">
                  <div>
                    <p><strong>Para programadores:</strong></p>
                    <ul className="ml-4 space-y-1">
                      <li>• camelCase para variables</li>
                      <li>• snake_case para Python</li>
                      <li>• kebab-case para CSS</li>
                    </ul>
                  </div>
                  <div>
                    <p><strong>Para documentos:</strong></p>
                    <ul className="ml-4 space-y-1">
                      <li>• Títulos profesionales</li>
                      <li>• Conversión de mayúsculas/minúsculas</li>
                      <li>• Análisis de texto con estadísticas</li>
                    </ul>
                  </div>
                </div>
              </div>
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
              <ScanHistory history={scanHistory} />
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
        </div>
      </main>

      <Footer />
    </>
  )
}
