'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, QrCode, Smartphone, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ScanningService } from '../../services/scanning';
import { scanImageData } from '@undecaf/zbar-wasm';

export default function MobileScanPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  
  const [code, setCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);  const [isOnline, setIsOnline] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isCameraSupported, setIsCameraSupported] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);  const videoRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zbarIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const quaggaRef = useRef<any>(null);// Check if we're on the client side and camera is supported
  useEffect(() => {
    setIsClient(true);
    const addDebug = (msg: string) => {
      console.log(msg);
      setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
    };
      // Check camera support with better detection
    const checkCameraSupport = async () => {
      addDebug('Starting camera support check...');
      
      if (typeof window === 'undefined') {
        addDebug('Not in browser environment');
        setIsCameraSupported(false);
        return;
      }

      addDebug(`Protocol: ${location.protocol}, Host: ${location.hostname}`);
      addDebug(`User Agent: ${navigator.userAgent}`);

      // Check for basic MediaDevices API support
      if (!navigator?.mediaDevices?.getUserMedia) {
        addDebug('MediaDevices API not supported');
        
        // Detect browser type for specific error messaging
        const isEdge = navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg/');
        const isIE = navigator.userAgent.includes('MSIE') || navigator.userAgent.includes('Trident');
        
        if (isEdge) {
          addDebug('Edge browser detected - MediaDevices may not be available');
          setError('Microsoft Edge móvil tiene compatibilidad limitada con cámaras. Prueba con Chrome o Firefox.');
        } else if (isIE) {
          addDebug('Internet Explorer detected - not supported');
          setError('Internet Explorer no es compatible. Usa Chrome, Firefox o Safari.');
        } else {
          addDebug('Unknown browser with no MediaDevices support');
          setError('Tu navegador no soporta acceso a la cámara. Prueba con Chrome o Firefox.');
        }
        
        setIsCameraSupported(false);
        return;
      }

      addDebug('MediaDevices API available');

      try {
        // Try to enumerate devices to check for cameras
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cameras = devices.filter(device => device.kind === 'videoinput');
        addDebug(`Found ${cameras.length} camera devices`);
        
        if (cameras.length === 0) {
          addDebug('No camera devices found');
          setIsCameraSupported(false);
          return;
        }

        // Check if we can actually access camera (without starting it)
        const constraints = {
          video: {
            facingMode: 'environment',
            width: { ideal: 640 },
            height: { ideal: 480 }
          }
        };

        addDebug('Testing camera access...');
        // Test camera access permission
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          // Immediately stop the test stream
          stream.getTracks().forEach(track => track.stop());
          addDebug('Camera access successful - setting supported to true');
          setIsCameraSupported(true);
        } catch (permissionError: any) {
          addDebug(`Camera permission test failed: ${permissionError.name} - ${permissionError.message}`);
          // Still set as supported - user might grant permission later
          setIsCameraSupported(true);
        }
      } catch (error: any) {
        addDebug(`Camera support check failed: ${error.name} - ${error.message}`);
        setIsCameraSupported(false);
      }
    };
    
    checkCameraSupport();
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
      
      await ScanningService.addScan({
        code: scannedCode,
        source: 'mobile',
        userName: 'Móvil',
        sessionId: sessionId || undefined,
        processed: false
      });
      
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

  // Handle detected barcode
  const handleBarcodeDetected = useCallback(async (detectedCode: string, method: string) => {
    console.log(`Barcode detected with ${method}:`, detectedCode);
    
    // Stop detection first
    setIsScanning(false);
    
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Stop ZBar interval
    if (zbarIntervalRef.current) {
      clearInterval(zbarIntervalRef.current);
      zbarIntervalRef.current = null;
    }
      // Stop Quagga2
    if (quaggaRef.current) {
      try {
        quaggaRef.current.stop();
        quaggaRef.current = null;
      } catch (err) {
        console.error('Error stopping Quagga:', err);
      }
    }
    
    // Clear video container (videoRef is a div, not a video element)
    if (videoRef.current) {
      // Clear any child video elements created by Quagga2
      while (videoRef.current.firstChild) {
        videoRef.current.removeChild(videoRef.current.firstChild);
      }
    }
    
    // Submit the detected code
    submitCode(detectedCode);
    
    setSuccess(`Código ${detectedCode} detectado automáticamente (${method})`);
  }, [submitCode]);  // Advanced barcode detection using ZBar-WASM and Quagga2 (SAME AS BarcodeScanner.tsx)
  const startAdvancedDetection = useCallback(async () => {
    if (!videoRef.current || !isScanning) return;

    let zbarInterval: number | null = null;
    let lastZbarCode = '';
    let lastQuaggaCode = '';

    try {
      // Initialize Quagga2 with LiveStream (EXACT same method as BarcodeScanner.tsx)
      const Quagga = (await import('@ericblade/quagga2')).default;
      
      if (!videoRef.current) {
        setError('No se encontró el contenedor de video para la cámara.');
        setIsScanning(false);
        return;
      }

      console.log('Initializing Quagga2 with target:', videoRef.current);

      // Use Quagga2's LiveStream directly (same as BarcodeScanner.tsx)
      Quagga.init(
        {
          inputStream: {
            type: 'LiveStream',
            constraints: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            target: videoRef.current, // Direct reference to the div container
          },
          decoder: {
            readers: [
              'code_128_reader',
              'ean_reader',
              'ean_8_reader',
              'code_39_reader',
              'codabar_reader',
              'upc_reader',
              'i2of5_reader',
              'code_93_reader',
            ],
            debug: {
              drawBoundingBox: true,
              showFrequency: true,
              drawScanline: true,
              showPattern: true,
            },
            multiple: false,
          },
          locate: true,
          numOfWorkers: 2,
          frequency: 10,
        },        (err: unknown) => {
          if (err) {
            console.error('Quagga init error:', err);
            
            // Provide specific error messages for different browsers
            const isEdge = navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg/');
            let errorMessage = 'Error de cámara: ';
            
            if (isEdge) {
              errorMessage = 'Microsoft Edge móvil no es compatible con el escáner de cámara. Usa Chrome o Firefox para mejor experiencia.';
            } else if (err instanceof Error) {
              if (err.message.includes('NotAllowedError')) {
                errorMessage += 'Permisos de cámara denegados. Permite el acceso en la configuración.';
              } else if (err.message.includes('NotFoundError')) {
                errorMessage += 'No se encontró cámara en el dispositivo.';
              } else {
                errorMessage += err.message;
              }
            } else {
              errorMessage += 'Error desconocido';
            }
            
            setError(errorMessage);
            setIsScanning(false);
            return;
          }
          console.log('Quagga initialized successfully, starting...');
          Quagga.start();
        }
      );

      quaggaRef.current = Quagga;

      // ZBar-WASM detection with higher priority (EXACT same as BarcodeScanner.tsx)
      zbarInterval = window.setInterval(async () => {
        if (!videoRef.current) return;
        const videoElem = videoRef.current.querySelector('video') as HTMLVideoElement | null;
        if (videoElem && videoElem.readyState === 4) {
          const vWidth = videoElem.videoWidth;
          const vHeight = videoElem.videoHeight;
          if (vWidth > 0 && vHeight > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = vWidth;
            canvas.height = vHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(videoElem, 0, 0, vWidth, vHeight);
            const frameData = ctx.getImageData(0, 0, vWidth, vHeight);
            
            try {
              // ZBar-WASM detection (priority)
              const symbols = await scanImageData(frameData);
              if (symbols && symbols.length > 0) {
                const zbarCode = symbols[0].decode();
                if (zbarCode && zbarCode !== lastZbarCode) {
                  lastZbarCode = zbarCode;
                  handleBarcodeDetected(zbarCode, 'ZBar-WASM');
                  Quagga.stop();
                  setIsScanning(false);
                  if (zbarInterval) window.clearInterval(zbarInterval);
                  return;
                }
              }
            } catch (zbarError) {
              console.debug('ZBar detection failed:', zbarError);
            }
          }
        }
      }, 500);

      zbarIntervalRef.current = zbarInterval as any;

      // Quagga2 detection as fallback (EXACT same as BarcodeScanner.tsx)
      Quagga.offDetected();
      Quagga.onDetected((data: { codeResult?: { code: string | null } }) => {
        if (lastZbarCode) return; // If ZBar already detected, ignore Quagga
        
        const code = data.codeResult?.code;
        const valid = typeof code === 'string' && 
                     /^[0-9A-Za-z\-\+\.\$\/\%]+$/.test(code) && 
                     code.length >= 8 && 
                     code.length <= 20;
        
        if (valid && code !== lastQuaggaCode) {
          lastQuaggaCode = code;
          handleBarcodeDetected(code, 'Quagga2');
          Quagga.stop();
          setIsScanning(false);
          if (zbarInterval) window.clearInterval(zbarInterval);
        }
      });

    } catch (err) {
      console.error('Error starting advanced detection:', err);
      setError(`Error al inicializar la detección: ${err instanceof Error ? err.message : 'Error desconocido'}`);
      setIsScanning(false);
    }
  }, [isScanning, handleBarcodeDetected]);// Initialize camera with EXACT same method as BarcodeScanner.tsx
  const startCamera = useCallback(async () => {
    try {
      setError(null);
      setIsScanning(true);
      console.log('Starting camera with BarcodeScanner method...');
      
      // Use the same approach as BarcodeScanner.tsx - let Quagga2 handle everything
      const addDebug = (msg: string) => {
        console.log(msg);
        setDebugInfo(prev => [...prev.slice(-4), `${new Date().toLocaleTimeString()}: ${msg}`]);
      };

      addDebug('Initializing Quagga2 LiveStream...');
      await startAdvancedDetection();
      
    } catch (err) {
      console.error('Error starting camera:', err);
      let errorMessage = 'No se pudo acceder a la cámara.';
      
      if (err instanceof Error) {
        if (err.message.includes('Camera API not supported')) {
          errorMessage = 'Tu navegador no soporta el acceso a la cámara.';
        } else if (err.message.includes('HTTPS connection')) {
          errorMessage = 'Se requiere conexión HTTPS o red local para acceder a la cámara.';
        } else if (err.name === 'NotAllowedError') {
          errorMessage = 'Permisos de cámara denegados. Por favor, permite el acceso y recarga la página.';
        } else if (err.name === 'NotFoundError') {
          errorMessage = 'No se encontró ninguna cámara en el dispositivo.';
        } else if (err.name === 'NotReadableError') {
          errorMessage = 'La cámara está siendo usada por otra aplicación.';
        } else if (err.name === 'OverconstrainedError') {
          errorMessage = 'La cámara no soporta la configuración requerida.';
        } else {
          errorMessage = `Error de cámara: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      setIsScanning(false);
    }
  }, [startAdvancedDetection]);
  // Stop camera and cleanup detection (SAME as BarcodeScanner.tsx)
  const stopCamera = useCallback(async () => {
    try {
      // Stop Quagga2
      if (quaggaRef.current) {
        const Quagga = (await import('@ericblade/quagga2')).default;
        Quagga.stop();
        quaggaRef.current = null;
      }
    } catch (err) {
      console.error('Error stopping Quagga:', err);
    }
    
    // Stop ZBar interval
    if (zbarIntervalRef.current) {
      clearInterval(zbarIntervalRef.current);
      zbarIntervalRef.current = null;
    }
    
    // Clear video container
    if (videoRef.current) {
      while (videoRef.current.firstChild) {
        videoRef.current.removeChild(videoRef.current.firstChild);
      }
    }
    
    setIsScanning(false);
  }, []);

  // Handle manual code input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCode(code);  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

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
      {error && (
        <div className="bg-red-900/50 border border-red-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-200">{error}</span>
        </div>
      )}
      
      {success && (
        <div className="bg-green-900/50 border border-green-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-400" />
          <span className="text-green-200">{success}</span>
        </div>
      )}

      {/* Debug Info */}
      {debugInfo.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-600 rounded-lg p-3 mb-4">
          <h3 className="text-sm font-medium text-gray-300 mb-2">Debug Info:</h3>
          <div className="space-y-1">
            {debugInfo.map((info, index) => (
              <div key={index} className="text-xs text-gray-400 font-mono">
                {info}
              </div>
            ))}
          </div>
        </div>
      )}{/* Camera Section */}
      <div className="mb-6">
        <div className="bg-gray-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Escanear con Cámara</h2>
            {isClient && isCameraSupported && (
              <button
                onClick={isScanning ? stopCamera : startCamera}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  isScanning 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Camera className="w-4 h-4" />
                {isScanning ? 'Detener' : 'Iniciar'}
              </button>
            )}
          </div>
          
          {/* Show loading message on server-side or while checking compatibility */}
          {!isClient && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">Cargando...</p>
                </div>
              </div>
            </div>
          )}          {/* Show camera not supported message */}
          {isClient && !isCameraSupported && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center px-4">
                  <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
                  <p className="text-yellow-400 mb-2">Cámara no disponible</p>
                  <p className="text-gray-400 text-sm mb-4">
                    {navigator.userAgent.includes('Edge') || navigator.userAgent.includes('Edg/') ? (
                      <>
                        Microsoft Edge móvil tiene problemas con el acceso a cámaras.<br />
                        <strong>Recomendamos usar Chrome o Firefox</strong> para mejor compatibilidad.<br />
                        También puedes usar la entrada manual abajo.
                      </>
                    ) : (
                      <>
                        Si la cámara está disponible, aparecerá el botón "Iniciar".<br />
                        También puedes usar la entrada manual abajo.
                      </>
                    )}
                  </p><button
                    onClick={async () => {
                      try {
                        setError(null);
                        
                        // Check if MediaDevices API is available
                        if (!navigator?.mediaDevices?.getUserMedia) {
                          setError('Tu navegador no soporta acceso a la cámara. Prueba con Chrome o Firefox.');
                          return;
                        }
                        
                        const stream = await navigator.mediaDevices.getUserMedia({
                          video: { facingMode: 'environment' }
                        });
                        stream.getTracks().forEach(track => track.stop());
                        setIsCameraSupported(true);
                        setSuccess('¡Cámara detectada! Ya puedes usar el escáner.');
                      } catch (err) {
                        console.error('Camera test failed:', err);
                        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
                        
                        if (errorMessage.includes('NotAllowedError') || errorMessage.includes('Permission denied')) {
                          setError('Permisos de cámara denegados. Permite el acceso en la configuración del navegador.');
                        } else if (errorMessage.includes('NotFoundError')) {
                          setError('No se encontró ninguna cámara en el dispositivo.');
                        } else if (errorMessage.includes('NotSupportedError')) {
                          setError('Tu navegador no soporta acceso a la cámara.');
                        } else {
                          setError(`Error de cámara: ${errorMessage}`);
                        }
                      }
                    }}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white text-sm"
                  >
                    Probar Cámara
                  </button>
                </div>
              </div>
            </div>
          )}
            {/* Camera View - only show if camera is supported */}
          {isClient && isCameraSupported && (
            <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              {/* Container for Quagga2 camera - same as BarcodeScanner.tsx */}
              <div
                ref={videoRef}
                className="w-full h-full"
                style={{ display: isScanning ? 'block' : 'none' }}
              />
              
              {!isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <QrCode className="w-16 h-16 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">Presiona "Iniciar" para comenzar</p>
                  </div>
                </div>
              )}
              
              {/* Scanning overlay */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-blue-400 rounded-lg">
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-2 border-l-2 border-blue-400"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-2 border-r-2 border-blue-400"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-2 border-l-2 border-blue-400"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-2 border-r-2 border-blue-400"></div>
                  </div>
                  
                  {/* Real-time scanning status */}
                  <div className="absolute bottom-4 left-0 right-0 text-center">
                    <div className="bg-black/50 backdrop-blur-sm px-4 py-2 rounded-full text-white text-sm mx-auto w-fit">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        Escaneando automáticamente...
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          <canvas ref={canvasRef} style={{ display: 'none' }} />
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
      )}

      {/* Instructions */}
      <div className="mt-6 text-center text-gray-400 text-sm">
        <p>Asegúrate de que tu PC esté conectado a la misma red</p>
        <p>Los códigos aparecerán automáticamente en tu computadora</p>
      </div>
    </div>
  );
}
