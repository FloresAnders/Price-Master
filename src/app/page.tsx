// app/page.tsx
'use client'

import React, { useState } from 'react'
import Header from '@/components/Header'
import BarcodeScanner from '@/components/BarcodeScanner'
import PriceCalculator from '@/components/PriceCalculator'
import TextConversion from '@/components/TextConversion'
import ScanHistory from '@/components/ScanHistory'

type ActiveTab = 'scanner' | 'calculator' | 'converter' | 'history'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('scanner')
  const [scanHistory, setScanHistory] = useState<string[]>([])

  // Función para manejar códigos detectados por el escáner
  const handleCodeDetected = (code: string) => {
    setScanHistory(prev => (
      prev[0] === code
        ? prev
        : [code, ...prev.slice(0, 19)]
    ))
  }

  // Configuración de las pestañas
  const tabs = [
    { id: 'scanner' as ActiveTab, name: 'Escáner', icon: '📷', description: 'Escanear códigos de barras' },
    { id: 'calculator' as ActiveTab, name: 'Calculadora', icon: '🧮', description: 'Calcular precios con descuentos' },
    { id: 'converter' as ActiveTab, name: 'Conversor', icon: '🔤', description: 'Convertir y transformar texto' },
    {
      id: 'history' as ActiveTab,
      name: 'Historial',
      icon: '📋',
      description: 'Ver códigos escaneados',
      badge: scanHistory.length > 0 ? scanHistory.length : undefined
    }
  ]

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
                    <span className="text-lg">{tab.icon}</span>
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
          <h2 className="text-2xl font-bold mb-2">{tabs.find(t => t.id === activeTab)?.name}</h2>
          <p className="text-[var(--tab-text)]">{tabs.find(t => t.id === activeTab)?.description}</p>
        </div>

        {/* Contenido de las pestañas */}
        <div className="space-y-8">
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
                  <p className="text-sm text-yellow-700">El descuento se aplica primero, luego se calcula el impuesto sobre el precio con descuento.</p>
                </div>
              </div>
            </div>
          )}

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
                  <div className="text-6xl mb-4">📱</div>
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

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2024 Price Master - Herramientas para el manejo de precios
            </div>
            <div className="flex space-x-4">
              <span>Next.js 15</span>
              <span>•</span>
              <span>React 19</span>
              <span>•</span>
              <span>Tailwind CSS</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}