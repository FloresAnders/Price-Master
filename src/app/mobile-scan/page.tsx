'use client';

import React, { useState, useEffect, useCallback, Suspense, useRef } from 'react';
import { QrCode, Smartphone, Check, AlertCircle, Wifi, WifiOff } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { ScanningService } from '../../services/scanning';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import CameraScanner from '../../components/CameraScanner';
import ImageDropArea from '../../components/ImageDropArea';
import { ThemeToggle } from '../../components/ThemeToggle';
import { SessionSyncService, type SessionStatus } from '../../services/session-sync';

// Force dynamic rendering for this page
export const dynamic = 'force-dynamic';

function MobileScanContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session');
  const requestProductNameParam = searchParams.get('requestProductName');
  const locationsParam = searchParams.get('locations');

  const [code, setCode] = useState('');
  const [lastScanned, setLastScanned] = useState<{code: string, productName?: string, location?: string}[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [requestProductName, setRequestProductName] = useState(false);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingCode, setPendingCode] = useState<string>(''); const [productName, setProductName] = useState('');
  
  // Estado para ubicaciones
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [showLocationModal, setShowLocationModal] = useState(false);  // Estados para sincronización real
  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [connectedDeviceType, setConnectedDeviceType] = useState<'pc' | 'laptop' | 'desktop' | null>(null);
  const sessionHeartbeatRef = useRef<{ start: () => Promise<void>; stop: () => void; sessionDocId: string | null } | null>(null);
  const sessionSyncUnsubscribeRef = useRef<(() => void) | null>(null);// Usar el hook de barcode scanner
  const {
    code: detectedCode,
    error: scannerError,
    cameraActive,
    liveStreamRef,
    toggleCamera, handleClear: clearScanner,
    handleCopyCode,
    detectionMethod,
    fileInputRef,
    handleFileUpload,
    handleDrop,
    handleDropAreaClick,
  } = useBarcodeScanner((detectedCode) => {
    submitCode(detectedCode);
  });// Check if we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Set requestProductName from URL parameter
  useEffect(() => {
    if (requestProductNameParam === 'true') {
      setRequestProductName(true);
    }
  }, [requestProductNameParam]);

  // Process locations from URL parameter
  useEffect(() => {
    if (locationsParam) {
      try {
        const locations = decodeURIComponent(locationsParam).split(',').filter(loc => loc.trim());
        setAvailableLocations(locations);
        // Auto-select the first location if only one is provided
        if (locations.length === 1) {
          setSelectedLocation(locations[0]);
        }
        console.log('📍 Ubicaciones disponibles desde URL:', locations);
      } catch (error) {
        console.error('Error parsing locations from URL:', error);
        setAvailableLocations([]);
      }
    }
  }, [locationsParam]);

  // Check online status
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline); return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Efecto para inicializar y mantener la sincronización de sesión
  useEffect(() => {
    if (!sessionId || !isClient) return;

    let isMounted = true;
    const initializeSession = async () => {
      try {
        setConnectionStatus('checking');

        // Crear heartbeat manager para mantener sesión móvil activa
        const heartbeatManager = SessionSyncService.createHeartbeatManager(sessionId, 'mobile');
        sessionHeartbeatRef.current = heartbeatManager;

        // Iniciar sesión y heartbeat
        await heartbeatManager.start();        // Escuchar cambios en tiempo real para detectar conexión PC
        const unsubscribe = SessionSyncService.subscribeToSessionStatus(
          sessionId,
          (sessions: SessionStatus[]) => {
            if (!isMounted) return;

            const pcConnected = sessions.some(session =>
              session.source === 'pc' &&
              session.status === 'active'
            );
            // Determinar qué tipo de dispositivo se conectó basándose en User Agent
            if (pcConnected) {
              const connectedDevice = sessions.find(session =>
                session.source === 'pc' &&
                session.status === 'active'
              );

              // Detectar tipo de PC basándose en el User Agent
              const userAgent = connectedDevice?.userAgent || '';
              const isWindows = /Windows/i.test(userAgent);
              const isMac = /Macintosh|Mac OS/i.test(userAgent);
              const isLinux = /Linux/i.test(userAgent);

              if (isWindows) {
                setConnectedDeviceType('desktop');
              } else if (isMac) {
                setConnectedDeviceType('laptop');
              } else if (isLinux) {
                setConnectedDeviceType('pc');
              } else {
                setConnectedDeviceType('pc'); // Fallback
              }
            } else {
              setConnectedDeviceType(null);
            }

            setConnectionStatus(pcConnected ? 'connected' : 'disconnected');
          },
          (error) => {
            console.error('Error in session status subscription:', error);
            if (isMounted) {
              setConnectionStatus('disconnected');
            }
          }
        );
        sessionSyncUnsubscribeRef.current = unsubscribe;

      } catch (error) {
        console.error('Error initializing session sync:', error);
        if (isMounted) {
          setConnectionStatus('disconnected');
        }
      }
    };

    initializeSession();

    return () => {
      isMounted = false;
      // Limpiar sesión
      if (sessionSyncUnsubscribeRef.current) {
        sessionSyncUnsubscribeRef.current();
        sessionSyncUnsubscribeRef.current = null;
      }
      if (sessionHeartbeatRef.current) {
        sessionHeartbeatRef.current.stop();
        sessionHeartbeatRef.current = null;
      }
    };
  }, [sessionId, isClient]);// Submit scanned code
  const submitCode = useCallback(async (scannedCode: string, nameForProduct?: string) => {
    if (!scannedCode.trim()) {
      setError('Código vacío');
      return;
    }

    // Check if already scanned recently
    if (lastScanned.some(scan => scan.code === scannedCode)) {
      setError('Este código ya fue escaneado recientemente');
      return;
    }

    if (!isOnline) {
      setError('Sin conexión a internet. Inténtalo más tarde.');
      return;
    }

    // If there are multiple locations and none is selected, show location modal
    if (availableLocations.length > 1 && !selectedLocation) {
      setPendingCode(scannedCode);
      if (nameForProduct) {
        setProductName(nameForProduct);
      }
      setShowLocationModal(true);
      return;
    }

    // If requestProductName is enabled and no name provided, show modal
    if (requestProductName && !nameForProduct?.trim()) {
      setPendingCode(scannedCode);
      setShowNameModal(true);
      return;
    } try {
      setError(null);      // Create scan object without undefined values
      const scanData = {
        code: scannedCode,
        source: 'mobile' as const,
        userName: 'Móvil',
        processed: false,
        ...(sessionId && { sessionId }),
        ...(nameForProduct?.trim() && { productName: nameForProduct.trim() }),
        ...(selectedLocation && { location: selectedLocation })
      };

      // Enviar al servicio de scanning y también a localStorage para sincronización con PC
      await ScanningService.addScan(scanData);

      // También guardar en localStorage para comunicación con PC
      if (sessionId) {
        const mobileScans = JSON.parse(localStorage.getItem('mobile-scans') || '[]'); mobileScans.push({
          code: scannedCode,
          sessionId,
          timestamp: Date.now(),
          processed: false,
          ...(nameForProduct?.trim() && { productName: nameForProduct.trim() }),
          ...(selectedLocation && { location: selectedLocation })
        });
        localStorage.setItem('mobile-scans', JSON.stringify(mobileScans));
      }
      
      // Create success message including location if present
      let message = `Código ${scannedCode}`;
      if (nameForProduct?.trim()) {
        message += ` (${nameForProduct.trim()})`;
      }
      if (selectedLocation) {
        message += ` [${selectedLocation}]`;
      }
      message += ' enviado correctamente';
      
      setSuccess(message);
      setLastScanned(prev => [...prev.slice(-4), {
        code: scannedCode,
        ...(nameForProduct?.trim() && { productName: nameForProduct.trim() }),
        ...(selectedLocation && { location: selectedLocation })
      }]); // Keep last 5
      setCode('');
      // Clear success message after 2 seconds
      setTimeout(() => setSuccess(null), 2000);
    } catch (error) {
      console.error('Error submitting code:', error);
      setError('Error al enviar el código. Inténtalo de nuevo.');
    }
  }, [lastScanned, sessionId, isOnline, requestProductName, availableLocations, selectedLocation]);
  // Handler para eliminar primer dígito
  const handleRemoveLeadingZero = useCallback(() => {
    if (detectedCode && detectedCode.length > 1 && detectedCode[0] === '0') {
      const newCode = detectedCode.slice(1);
      submitCode(newCode);
    }
  }, [detectedCode, submitCode]);  // Handle name modal submission
  const handleNameSubmit = useCallback(() => {
    if (pendingCode) {
      const trimmedName = productName.trim();
      submitCode(pendingCode, trimmedName || '');
      setShowNameModal(false);
      setPendingCode('');
      setProductName('');
    }
  }, [pendingCode, productName, submitCode]);

  // Handle name modal cancel
  const handleNameCancel = useCallback(() => {
    setShowNameModal(false);
    setPendingCode('');
    setProductName('');
  }, []);

  // Handle location modal submission
  const handleLocationSubmit = useCallback(() => {
    if (pendingCode && selectedLocation) {
      const nameForProduct = productName.trim() || '';
      submitCode(pendingCode, nameForProduct);
      setShowLocationModal(false);
      setPendingCode('');
      setProductName('');
    }
  }, [pendingCode, selectedLocation, productName, submitCode]);

  // Handle location modal cancel
  const handleLocationCancel = useCallback(() => {
    setShowLocationModal(false);
    setPendingCode('');
    setProductName('');
  }, []);
  // Handle manual code input
  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitCode(code);
  };
  return (
    <div className="min-h-screen bg-background text-foreground p-4">      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Smartphone className="w-6 h-6 text-blue-400" />
          <h1 className="text-xl font-bold">Escáner Móvil</h1>
        </div>

        <div className="flex items-center gap-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Estado de Internet */}
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-5 h-5 text-green-400" />
            ) : (
              <WifiOff className="w-5 h-5 text-red-400" />
            )}
            <span className="text-sm">
              {isOnline ? 'Online' : 'Sin conexión'}
            </span>
          </div>          {/* Estado de conexión PC */}
          {sessionId && (
            <div className="flex items-center gap-2">
              {connectionStatus === 'connected' ? (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-green-400">
                    {connectedDeviceType === 'desktop' && '🖥️ ESCRITORIO'}
                    {connectedDeviceType === 'laptop' && '💻 LAPTOP'}
                    {connectedDeviceType === 'pc' && '🖥️ PC'}
                    {!connectedDeviceType && '🖥️ DISPOSITIVO'} Conectado
                  </span>
                </>
              ) : connectionStatus === 'disconnected' ? (
                <>
                  <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                  <span className="text-sm text-red-400">
                    {connectedDeviceType === 'desktop' && '🖥️ ESCRITORIO'}
                    {connectedDeviceType === 'laptop' && '💻 LAPTOP'}
                    {connectedDeviceType === 'pc' && '🖥️ PC'}
                    {!connectedDeviceType && '🖥️ DISPOSITIVO'} Desconectado
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
                  <span className="text-sm text-yellow-400">Verificando...</span>
                </>
              )}
            </div>
          )}
        </div></div>      {/* Session Info */}
      {sessionId && (
        <div className="bg-blue-100 dark:bg-blue-900/50 rounded-lg p-3 mb-4">
          <div className="text-sm text-blue-800 dark:text-blue-300">Sesión: {sessionId}</div>
        </div>
      )}      {/* Alerta de conexión PC */}
      {sessionId && connectionStatus === 'disconnected' && (
        <div className="bg-orange-100 dark:bg-orange-900/50 border border-orange-300 dark:border-orange-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
          <div className="text-orange-800 dark:text-orange-200">
            <div className="font-medium">
              {connectedDeviceType === 'desktop' && '🖥️ Escritorio'}
              {connectedDeviceType === 'laptop' && '💻 Laptop'}
              {connectedDeviceType === 'pc' && '🖥️ PC'}
              {!connectedDeviceType && '🖥️ Dispositivo'} no está conectado
            </div>
            <div className="text-sm text-orange-700 dark:text-orange-300">
              Asegúrate de que la página del {
                connectedDeviceType === 'desktop' ? 'escritorio' :
                  connectedDeviceType === 'laptop' ? 'laptop' :
                    connectedDeviceType === 'pc' ? 'PC' : 'dispositivo'
              } esté abierta con esta sesión activa
            </div>
          </div>
        </div>
      )}{/* Status Messages */}
      {(error || scannerError) && (
        <div className="bg-red-100 dark:bg-red-900/50 border border-red-300 dark:border-red-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
          <span className="text-red-800 dark:text-red-200">{error || scannerError}</span>
        </div>
      )}

      {success && (
        <div className="bg-green-100 dark:bg-green-900/50 border border-green-300 dark:border-green-600 rounded-lg p-3 mb-4 flex items-center gap-2">
          <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
          <span className="text-green-800 dark:text-green-200">{success}</span>
        </div>
      )}      {/* Product Name Configuration Status - Set by PC */}
      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-4 h-4 rounded-full ${requestProductName ? 'bg-blue-500' : 'bg-gray-400'}`}></div>
          <h4 className="font-medium text-blue-800 dark:text-blue-200">
            {requestProductName ? '📝 Solicitar nombres de productos' : '📄 Solo códigos de barras'}
          </h4>
        </div>        <p className="text-sm text-blue-600 dark:text-blue-400 ml-7">
          Esta configuración fue establecida desde la PC donde se generó el QR.
          {requestProductName
            ? " Se te pedirá ingresar un nombre REQUERIDO para cada código escaneado."
            : " Solo se enviarán los códigos de barras sin solicitar nombres."
          }
        </p>
      </div>

      {/* Location Configuration Status - Set by PC */}
      {availableLocations.length > 0 && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 mb-4 border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-4 h-4 rounded-full ${selectedLocation ? 'bg-purple-500' : 'bg-gray-400'}`}></div>
            <h4 className="font-medium text-purple-800 dark:text-purple-200">
              📍 Ubicaciones Configuradas
            </h4>
          </div>

          <div className="ml-7 space-y-2">
            <p className="text-sm text-purple-600 dark:text-purple-400">
              Se configuraron {availableLocations.length} ubicación(es) desde la PC.
            </p>
            
            {availableLocations.length === 1 ? (
              <p className="text-sm text-purple-600 dark:text-purple-400">
                <strong>Ubicación seleccionada automáticamente:</strong> {selectedLocation}
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-purple-600 dark:text-purple-400">
                  <strong>Ubicaciones disponibles:</strong> {availableLocations.join(', ')}
                </p>
                {selectedLocation ? (
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    <strong>Ubicación actual:</strong> {selectedLocation}
                  </p>
                ) : (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-purple-700 dark:text-purple-300 mb-1">
                      Selecciona una ubicación:
                    </label>
                    <select
                      value={selectedLocation}
                      onChange={(e) => setSelectedLocation(e.target.value)}
                      className="w-full bg-input-bg border border-input-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:border-purple-500 text-sm"
                    >
                      <option value="">-- Seleccionar ubicación --</option>
                      {availableLocations.map((location) => (
                        <option key={location} value={location}>
                          {location}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Camera Section */}
      <div className="mb-6">
        <div className="bg-card-bg rounded-lg p-4">
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
            <div className="relative bg-gray-900 dark:bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-500 dark:text-gray-400">Cargando...</p>
                </div>
              </div>
            </div>
          )}        </div>
      </div>

      {/* Image Upload Section */}
      <div className="mb-6">
        <div className="bg-card-bg rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Subir Imagen de Código</h2>
          </div>

          {/* Usar ImageDropArea component */}
          {isClient && (
            <ImageDropArea
              onDrop={handleDrop}
              onFileSelect={handleDropAreaClick}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
            />
          )}

          {/* Show loading message on server-side */}
          {!isClient && (
            <div className="relative bg-input-bg rounded-lg p-8">
              <div className="text-center">
                <div className="w-16 h-16 bg-input-bg rounded-lg mx-auto mb-2 flex items-center justify-center">
                  <QrCode className="w-8 h-8 text-gray-500 dark:text-gray-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-400">Cargando área de carga...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Manual Input Section */}
      <div className="bg-card-bg rounded-lg p-4 mb-6">
        <h2 className="text-lg font-semibold mb-4">Introducir Código Manualmente</h2>

        <form onSubmit={handleManualSubmit} className="space-y-4">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Ingresa el código de barras"
            className="w-full bg-input-bg border border-input-border rounded-lg px-4 py-3 text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />

          <button
            type="submit"
            disabled={!code.trim() || !isOnline}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-3 rounded-lg text-white font-semibold flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Enviar Código
          </button>
        </form>
      </div>      {/* Recently Scanned */}
      {lastScanned.length > 0 && (
        <div className="bg-card-bg rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-3">Códigos Enviados Recientemente</h2>
          <div className="space-y-2">
            {lastScanned.slice().reverse().map((scan, index) => (
              <div key={index} className="bg-input-bg rounded px-3 py-2 flex items-center gap-2">
                <Check className="w-4 h-4 text-green-500 dark:text-green-400" />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="font-mono text-sm">{scan.code}</span>
                  {scan.productName && (
                    <span className="text-xs text-blue-600 dark:text-blue-400 truncate">
                      📝 {scan.productName}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>        </div>
      )}

      {/* Location Selection Modal */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card-bg rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              📍 Seleccionar Ubicación
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Código: <span className="font-mono bg-input-bg px-2 py-1 rounded">{pendingCode}</span>
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-foreground mb-2">
                Selecciona la ubicación para este escaneo:
              </label>
              <select
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-input-bg border border-input-border rounded-lg px-4 py-3 text-foreground focus:outline-none focus:border-purple-500"
                autoFocus
              >
                <option value="">-- Seleccionar ubicación --</option>
                {availableLocations.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleLocationCancel}
                className="flex-1 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleLocationSubmit}
                disabled={!selectedLocation}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white font-medium"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-card-bg rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4 text-foreground">
              {requestProductName ? 'Nombre del Producto (Requerido)' : 'Nombre del Producto (Opcional)'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
              Código: <span className="font-mono bg-input-bg px-2 py-1 rounded">{pendingCode}</span>
            </p>

            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder={requestProductName ? "Ingresa el nombre del producto (requerido)" : "Ingresa el nombre del producto (opcional)"}
              className="w-full bg-input-bg border border-input-border rounded-lg px-4 py-3 text-foreground placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 mb-4"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (!requestProductName || productName.trim())) {
                  handleNameSubmit();
                } else if (e.key === 'Escape') {
                  handleNameCancel();
                }
              }}
            />

            <div className="flex gap-3">
              <button
                onClick={handleNameCancel}
                className="flex-1 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 px-4 py-2 rounded-lg text-white font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={handleNameSubmit}
                disabled={requestProductName && !productName.trim()}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed px-4 py-2 rounded-lg text-white font-medium"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>Asegúrate de que tu PC esté conectado a la misma red</p>
        <p>Los códigos aparecerán automáticamente en tu computadora</p>
      </div>
    </div>
  );
}

export default function MobileScanPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p>Cargando escáner...</p>
        </div>
      </div>
    }>
      <MobileScanContent />
    </Suspense>
  );
}
