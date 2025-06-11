'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { QrCode, Smartphone, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ScanningService } from '../../services/scanning';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import CameraScanner from '../../components/CameraScanner';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

function MobileScanContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [code, setCode] = useState('');
  const [lastScanned, setLastScanned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isClient, setIsClient] = useState(false);
  // Usar el hook de barcode scanner
  const {
    code: detectedCode,
    error: scannerError,
    cameraActive,
    liveStreamRef,
    toggleCamera,
    handleClear: clearScanner,
    handleCopyCode,
    detectionMethod,
  } = useBarcodeScanner((detectedCode) => {
    console.log('Código detectado:', detectedCode);
    submitCode(detectedCode);
  });// Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);
  // Check online status
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  // Submit scanned code
  const submitCode = useCallback(async (scannedCode: string) => {
    if (!scannedCode.trim()) {
      setError('Código vacío');
      return;
    }

    // Check if already scanned recently
    if (lastScanned.includes(scannedCode)) {
      setError('Este código ya fue escaneado recientemente');
      return;
    }

    if (!isOnline) {
      setError('Sin conexión a internet. Inténtalo más tarde.');
      return;
    }

    try {
      setError(null);
      
      // Enviar al servicio de scanning y también a localStorage para sincronización con PC
      await ScanningService.addScan({
        code: scannedCode,
        source: 'mobile',
        userName: 'Móvil',
        sessionId: sessionId || undefined,
        processed: false
      });

      // También guardar en localStorage para comunicación con PC
      if (sessionId) {
        const mobileScans = JSON.parse(localStorage.getItem('mobile-scans') || '[]');
        mobileScans.push({
          code: scannedCode,
          sessionId,
          timestamp: Date.now(),
          processed: false
        });
        localStorage.setItem('mobile-scans', JSON.stringify(mobileScans));
      }
      
      setSuccess(`Código ${scannedCode} enviado correctamente`);
      setLastScanned(prev => [...prev.slice(-4), scannedCode]); // Keep last 5
      setCode('');
      
      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(null), 2000);
      
    } catch (err) {
      console.error('Error submitting code:', err);
      setError('Error al enviar el código. Inténtalo de nuevo.');
    }
  }, [lastScanned, sessionId, isOnline]);

  // Handler para eliminar primer dígito
  const handleRemoveLeadingZero = useCallback(() => {
    if (detectedCode && detectedCode.length > 1 && detectedCode[0] === '0') {
      const newCode = detectedCode.slice(1);
      submitCode(newCode);
    }
  }, [detectedCode, submitCode]);
  // Handle manual code input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCode(code);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">Escáner Móvil</h1>
        </div>
        
        <div className="flex items-center gap-2">
          {isOnline ? (
            <Wifi className="w-5 h-5 text-green-400" />
          ) : (
            <WifiOff className="w-5 h-5 text-red-400" />
          )}
          <span className="text-sm">
            {isOnline ? 'Conectado' : 'Sin conexión'}
          </span>
        </div>
      </div>

      {/* Browser Compatibility Warning for Edge */}
      {isClient && (navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg/')) && (
        <div className="bg-orange-900/50 border border-orange-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0" />
          <div className="text-sm text-orange-200">
            <strong>Navegador Edge detectado:</strong> Para mejor compatibilidad con el escáner de cámara, 
            recomendamos usar <strong>Chrome</strong> o <strong>Firefox</strong> en tu dispositivo móvil.
          </div>
        </div>
      )}

      {/* Session Info */}
      {sessionId && (
        <div className="bg-blue-900/50 rounded-lg p-3 mb-4">
          <div className="text-sm text-blue-300">Sesión: {sessionId}</div>
        </div>
      )}      {/* Status Messages */}
      {(error || scannerError) && (
        <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-200">{error || scannerError}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-900/50 border border-green-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400" />
          <span className="text-green-200">{success}</span>
        </div>
      )}      {/* Camera Section */}
      <div className="mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Escanear con Cámara</h2>
          </div>
          
          {/* Usar CameraScanner component */}
          {isClient && (
            <CameraScanner
              code={detectedCode}
              error={scannerError}
              detectionMethod={detectionMethod}
              cameraActive={cameraActive}
              liveStreamRef={liveStreamRef}
              toggleCamera={toggleCamera}
              handleClear={clearScanner}
              handleCopyCode={handleCopyCode}
              onRemoveLeadingZero={handleRemoveLeadingZero}
            />
          )}
          
          {/* Show loading message on server-side */}
          {!isClient && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">Cargando...</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Input Section */}
      <div className="bg-gray-800 rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Introducir Código Manualmente</h2>
        
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ingresa el código de barras"
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          
          <button
            type="submit"
            disabled={!code.trim() || !isOnline}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Enviar Código
          </button>
        </form>
      </div>

      {/* Recently Scanned */}
      {lastScanned.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Códigos Enviados Recientemente</h2>
          <div className="space-y-2">
            {lastScanned.slice().reverse().map((scannedCode, index) => (
              <div key={index} className="bg-gray-700 rounded px-3 py-2 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-400" />
                <span className="font-mono">{scannedCode}</span>
              </div>
            ))}
          </div>
        </div>
      )}      {/* Instructions */}
      <div className="mt-6 text-center text-gray-400 text-sm">
        <p>Asegúrate de que tu PC esté conectado a la misma red</p>
        <p>Los códigos aparecerán automáticamente en tu computadora</p>
      </div>
    </div>
  );
}

export default function MobileScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p>Cargando escáner...</p>
        </div>
      </div>
    }>
      <MobileScanContent />
    </Suspense>
  );
}
