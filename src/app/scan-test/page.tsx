'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Smartphone, QrCode, Camera, Wifi, CheckCircle } from 'lucide-react';
import { BarcodeScanner } from '../../components/scanner';

export default function ScanTestPage() {
  const [detectedCodes, setDetectedCodes] = useState<string[]>([]);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleCodeDetect = (code: string) => {
    console.log('Código detectado:', code);
    setDetectedCodes(prev => [code, ...prev.slice(0, 9)]); // Keep last 10 codes
    setTestStatus('success');

    // Reset status after 2 seconds
    setTimeout(() => setTestStatus('idle'), 2000);
  };

  const clearHistory = () => {
    setDetectedCodes([]);
    setTestStatus('idle');
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] p-4">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-4">
            🔬 Prueba del Sistema de Escaneo Móvil
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-4">
            Prueba el escáner de códigos de barras con sincronización en tiempo real
          </p>

          {/* Status indicator */}
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className={`w-3 h-3 rounded-full ${testStatus === 'success' ? 'bg-green-500 animate-pulse' :
                testStatus === 'error' ? 'bg-red-500' :
                  'bg-gray-400'
              }`} />
            <span className="text-sm">
              {testStatus === 'success' && 'Código detectado correctamente'}
              {testStatus === 'error' && 'Error en la detección'}
              {testStatus === 'idle' && 'Esperando código...'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left Column - Scanner */}
          <div className="space-y-6">
            <div className="bg-[var(--card-bg)] rounded-lg p-6 border border-[var(--input-border)]">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Camera className="w-5 h-5" />
                Escáner Principal
              </h2>

              <BarcodeScanner onDetect={handleCodeDetect} />
            </div>
          </div>

          {/* Right Column - Info and History */}
          <div className="space-y-6">

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <Smartphone className="w-5 h-5" />
                Instrucciones de Prueba
              </h3>

              <div className="space-y-3 text-sm text-blue-800 dark:text-blue-200">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                  <p>Haz clic en <strong>&quot;Ver QR&quot;</strong> en el escáner principal</p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                  <p>Copia la URL móvil y ábrela en tu teléfono</p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                  <p>Escanea códigos desde el móvil</p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                  <p>Los códigos aparecerán automáticamente aquí</p>
                </div>
              </div>
            </div>

            {/* Features */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-900 dark:text-green-100">
                <CheckCircle className="w-5 h-5" />
                Características Implementadas
              </h3>

              <div className="space-y-2 text-sm text-green-800 dark:text-green-200">
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4" />
                  <span>Sincronización en tiempo real con Firebase</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4" />
                  <span>Interfaz móvil optimizada</span>
                </div>
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  <span>Escaneo por cámara y entrada manual</span>
                </div>
                <div className="flex items-center gap-2">
                  <QrCode className="w-4 h-4" />
                  <span>Código QR para acceso rápido</span>
                </div>
              </div>
            </div>

            {/* History */}
            <div className="bg-[var(--card-bg)] rounded-lg p-6 border border-[var(--input-border)]">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Historial de Códigos</h3>
                {detectedCodes.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="text-sm text-red-600 hover:text-red-800 dark:text-red-400"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              {detectedCodes.length === 0 ? (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <QrCode className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay códigos detectados aún</p>
                  <p className="text-sm">Escanea un código para verlo aquí</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {detectedCodes.map((code, index) => (
                    <motion.div
                      key={`${code}-${index}`}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                    >
                      <span className="font-mono text-sm">{code}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          #{index + 1}
                        </span>
                        {index === 0 && (
                          <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                            Nuevo
                          </span>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="mt-8 bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4">Detalles Técnicos</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Backend:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• Firebase Firestore para almacenamiento</li>
                <li>• Real-time listeners para sincronización</li>
                <li>• Colección &apos;scans&apos; para códigos</li>
                <li>• Manejo de sesiones por ID único</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Frontend:</h4>
              <ul className="space-y-1 text-gray-600 dark:text-gray-400">
                <li>• React hooks para estado en tiempo real</li>
                <li>• Componente móvil responsivo</li>
                <li>• Notificaciones visuales automáticas</li>
                <li>• Manejo de errores y estados offline</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
