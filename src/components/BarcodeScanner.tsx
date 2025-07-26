'use client';
import React, { useCallback, useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check as CheckIcon,
  Copy as CopyIcon,
  Trash as TrashIcon,
  AlertCircle as AlertIcon, ScanBarcode,
  Loader2 as LoaderIcon,
  Smartphone as SmartphoneIcon,
  QrCode as QrCodeIcon,
  Wifi as WifiIcon,
  WifiOff as WifiOffIcon,
} from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { BarcodeScannerProps } from '../types/barcode';
import CameraScanner from './CameraScanner';
import ImageDropArea from './ImageDropArea';
import QRCode from 'qrcode';
import { SessionSyncService, type SessionStatus } from '../services/session-sync';
import { LocationsService } from '../services/locations';
import { ScanningService } from '../services/scanning-optimized';
import type { Location } from '../types/firestore';

export default function BarcodeScanner({ onDetect, onRemoveLeadingZero, children }: BarcodeScannerProps & { onRemoveLeadingZero?: (code: string) => void; children?: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'image' | 'camera' | 'mobile'>('image');
  const [mobileSessionId, setMobileSessionId] = useState<string | null>(null);
  const [showMobileQR, setShowMobileQR] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [lastScanCheck, setLastScanCheck] = useState<Date>(new Date());
  const [nextPollIn, setNextPollIn] = useState<number>(10);
  const [sessionExpiry, setSessionExpiry] = useState<Date | null>(null);

  // Estado para configuración de productos desde PC
  const [requestProductName, setRequestProductName] = useState(false);
  
  // Estado para locations seleccionadas
  const [availableLocations, setAvailableLocations] = useState<Location[]>([]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Estados para sincronización real
  const [hasMobileConnection, setHasMobileConnection] = useState(false); 
  const [connectedDeviceType, setConnectedDeviceType] = useState<'mobile' | 'tablet' | 'pc' | null>(null);
  const sessionHeartbeatRef = useRef<{ start: () => Promise<void>; stop: () => void; sessionDocId: string | null } | null>(null);
  const sessionSyncUnsubscribeRef = useRef<(() => void) | null>(null);
  const listenersActiveRef = useRef<boolean>(false);

  // Funciones para manejo de sesión persistente en localStorage
  const saveSessionToStorage = useCallback((sessionId: string, expiryDate: Date) => {
    if (typeof window !== 'undefined') {
      const sessionData = {
        sessionId,
        expiry: expiryDate.getTime(),
        requestProductName,
        selectedLocations
      };
      localStorage.setItem('barcodeScanner_session', JSON.stringify(sessionData));
    }
  }, [requestProductName, selectedLocations]);

  const loadSessionFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      try {
        const storedData = localStorage.getItem('barcodeScanner_session');
        if (storedData) {
          const sessionData = JSON.parse(storedData);
          const expiryDate = new Date(sessionData.expiry);
          
          // Verificar si la sesión no ha expirado
          if (expiryDate > new Date()) {
            return {
              sessionId: sessionData.sessionId,
              expiry: expiryDate,
              requestProductName: sessionData.requestProductName,
              selectedLocations: sessionData.selectedLocations || []
            };
          } else {
            // Limpiar sesión expirada
            localStorage.removeItem('barcodeScanner_session');
          }
        }
      } catch (error) {
        console.error('Error loading session from storage:', error);
        localStorage.removeItem('barcodeScanner_session');
      }
    }
    return null;
  }, []);

  const clearSessionFromStorage = useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('barcodeScanner_session');
    }
  }, []);

  // Función para formatear tiempo restante de la sesión
  const getSessionTimeRemaining = useCallback(() => {
    if (!sessionExpiry) return null;
    
    const now = new Date();
    const diff = sessionExpiry.getTime() - now.getTime();
    
    if (diff <= 0) return null;
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }, [sessionExpiry]);

  // Cargar sesión existente al montar el componente y activarla automáticamente
  useEffect(() => {
    const storedSession = loadSessionFromStorage();
    if (storedSession) {
      setMobileSessionId(storedSession.sessionId);
      setSessionExpiry(storedSession.expiry);
      setRequestProductName(storedSession.requestProductName);
      setSelectedLocations(storedSession.selectedLocations || []);
      
      // Activar automáticamente el QR si hay una sesión válida
      setShowMobileQR(true);
      console.log('📱 Sesión restaurada automáticamente:', storedSession.sessionId);
    }
  }, [loadSessionFromStorage]);

  // Cargar locations disponibles desde Firebase
  useEffect(() => {
    const loadAvailableLocations = async () => {
      setLoadingLocations(true);
      try {
        const locations = await LocationsService.getLocationsOrderedByLabel();
        setAvailableLocations(locations);
        console.log('📍 Locations cargadas:', locations.length);
      } catch (error) {
        console.error('Error loading locations:', error);
        // Fallback a locations estáticas si Firebase falla
        setAvailableLocations([]);
      } finally {
        setLoadingLocations(false);
      }
    };

    loadAvailableLocations();
  }, []);

  // Generar QR automáticamente cuando hay una sesión válida cargada
  useEffect(() => {
    const generateQRForExistingSession = async () => {
      if (mobileSessionId && sessionExpiry && sessionExpiry > new Date() && !qrCodeUrl) {
        try {
          const locationsParam = selectedLocations.length > 0 ? `&locations=${encodeURIComponent(selectedLocations.join(','))}` : '';
          const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/mobile-scan?session=${mobileSessionId}${requestProductName ? '&requestProductName=true' : ''}${locationsParam}`;
          const qrDataUrl = await QRCode.toDataURL(url, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeUrl(qrDataUrl);
          console.log(`📱 QR regenerado para sesión existente - Válida hasta: ${sessionExpiry.toLocaleString()}`);
        } catch (error) {
          console.error('Error generando QR para sesión existente:', error);
        }
      }
    };

    generateQRForExistingSession();
  }, [mobileSessionId, sessionExpiry, requestProductName, selectedLocations, qrCodeUrl]);

  // Regenerar QR cuando cambian las configuraciones mientras está visible
  useEffect(() => {
    const regenerateQRForChanges = async () => {
      if (mobileSessionId && sessionExpiry && sessionExpiry > new Date() && showMobileQR) {
        try {
          const locationsParam = selectedLocations.length > 0 ? `&locations=${encodeURIComponent(selectedLocations.join(','))}` : '';
          const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/mobile-scan?session=${mobileSessionId}${requestProductName ? '&requestProductName=true' : ''}${locationsParam}`;
          const qrDataUrl = await QRCode.toDataURL(url, {
            width: 256,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeUrl(qrDataUrl);
          console.log('📱 QR regenerado por cambio de configuración');
        } catch (error) {
          console.error('Error regenerando QR por cambio de configuración:', error);
        }
      }
    };

    regenerateQRForChanges();
  }, [requestProductName, selectedLocations, mobileSessionId, sessionExpiry, showMobileQR]);

  // Verificar periódicamente si la sesión ha expirado
  useEffect(() => {
    const checkSessionExpiry = () => {
      if (sessionExpiry && sessionExpiry <= new Date()) {
        console.log('📱 Sesión expirada, limpiando...');
        setMobileSessionId(null);
        setSessionExpiry(null);
        setShowMobileQR(false);
        setQrCodeUrl('');
        clearSessionFromStorage();
      }
    };

    // Verificar cada minuto
    const expiryCheckInterval = setInterval(checkSessionExpiry, 60000);

    // Verificar inmediatamente
    checkSessionExpiry();

    return () => clearInterval(expiryCheckInterval);
  }, [sessionExpiry, clearSessionFromStorage]);

  const unsubscribeRef = useRef<(() => void) | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null); const {
    code,
    isLoading,
    error,
    imagePreview,
    copySuccess,
    detectionMethod,
    cameraActive,
    fileInputRef,
    liveStreamRef,
    handleFileUpload,
    handleDrop,
    handleDropAreaClick,
    handleClear,
    handleCopyCode,
    toggleCamera,
    processImage,
    setCode, } = useBarcodeScanner(onDetect);
  const containerRef = useRef<HTMLDivElement>(null);

  // Focus automático al montar para que onPaste funcione siempre
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  // Handler global para pegar imagen desde portapapeles
  useEffect(() => {
    const handleGlobalPaste = (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.items) {
        for (let i = 0; i < event.clipboardData.items.length; i++) {
          const item = event.clipboardData.items[i];
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile();
            if (file) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const imageSrc = (e.target as FileReader)?.result as string;
                processImage(imageSrc);
              };
              reader.readAsDataURL(file);
              event.preventDefault();
              break;
            }
          }
        }
      }
    };
    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [processImage]);  // Handler para eliminar primer dígito del código escaneado principal
  const handleRemoveLeadingZeroMain = useCallback(() => {
    if (code && code.length > 1 && code[0] === '0') {
      setCode(code.slice(1)); // update overlay code immediately
      onRemoveLeadingZero?.(code);
    }
  }, [code, setCode, onRemoveLeadingZero]);  // Limpiar listener de Firebase al desmontar el componente
  useEffect(() => {
    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, []);

  // Función para iniciar el contador regresivo
  const startCountdown = useCallback(() => {
    setNextPollIn(10);

    if (countdownRef.current) {
      clearInterval(countdownRef.current);
    }

    countdownRef.current = setInterval(() => {
      setNextPollIn((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          return 10; // Reset para el próximo ciclo
        }
        return prev - 1;
      });
    }, 1000);
  }, []);  // Función para verificar manualmente nuevos escaneos desde Firebase
  const checkForNewScans = useCallback(async (sessionId: string) => {
    if (typeof window === 'undefined') return;

    try {
      console.log('🔄 Verificando nuevos escaneos...');

      // Usar método simple sin índices complejos
      const sessionScans = await ScanningService.getScansBySession(sessionId);

      // Buscar nuevos códigos no procesados para esta sesión
      const newScan = sessionScans.find(scan =>
        !scan.processed &&
        scan.source === 'mobile' &&
        scan.timestamp > lastScanCheck
      ); if (newScan && newScan.id) {
        console.log('🔄 Nuevo escaneo detectado via polling:', newScan.code);
        setCode(newScan.code);
        onDetect?.(newScan.code, newScan.productName);

        // Marcar como procesado en Firebase
        await ScanningService.markAsProcessed(newScan.id);

        // Actualizar timestamp del último chequeo
        setLastScanCheck(new Date());

        // Cerrar QR modal
        setShowMobileQR(false);

        // Limpiar el polling ya que encontramos un resultado
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      } else {
        console.log('🔄 No hay nuevos escaneos, continuando...');
        // Reiniciar contador para el próximo chequeo
        startCountdown();
      }

      // Actualizar timestamp del último chequeo
      setLastScanCheck(new Date());
    } catch (error) {
      console.error('Error checking for new scans:', error);
      startCountdown(); // Reiniciar contador incluso si hay error
    }
  }, [onDetect, setCode, lastScanCheck, startCountdown]);// Generar sesión para escáner móvil con detección real de conexión y persistencia de 24h
  const generateMobileSession = useCallback(async () => {
    // Limpiar listeners existentes antes de crear nuevos
    if (unsubscribeRef.current && typeof unsubscribeRef.current === 'function') {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    
    // Reset flag de listeners
    listenersActiveRef.current = false;

    // Verificar si ya hay una sesión válida en localStorage
    let sessionId: string;
    let expiryDate: Date;
    
    const storedSession = loadSessionFromStorage();
    if (storedSession && storedSession.sessionId) {
      // Usar sesión existente válida
      sessionId = storedSession.sessionId;
      expiryDate = storedSession.expiry;
      console.log('📱 Reutilizando sesión existente:', sessionId);
    } else {
      // Crear nueva sesión válida por 24 horas
      sessionId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      expiryDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas
      console.log('📱 Creando nueva sesión válida por 24h:', sessionId);
      
      // Guardar en localStorage
      saveSessionToStorage(sessionId, expiryDate);
    }
    
    setMobileSessionId(sessionId);
    setSessionExpiry(expiryDate);
    setShowMobileQR(true);
    setLastScanCheck(new Date()); // Reset del timestamp

    try {
      // Crear heartbeat manager para mantener sesión PC activa
      const heartbeatManager = SessionSyncService.createHeartbeatManager(sessionId, 'pc');
      sessionHeartbeatRef.current = heartbeatManager;

      // Iniciar sesión y heartbeat
      await heartbeatManager.start();      // Escuchar cambios en tiempo real para detectar conexiones
      const sessionUnsubscribe = SessionSyncService.subscribeToSessionStatus(
        sessionId,
        (sessions: SessionStatus[]) => {
          const mobileConnected = sessions.some(session =>
            session.source === 'mobile' &&
            session.status === 'active'
          );

          // Determinar qué tipo de dispositivo se conectó basándose en User Agent
          if (mobileConnected) {
            const connectedDevice = sessions.find(session =>
              session.source === 'mobile' &&
              session.status === 'active'
            );

            // Detectar si es móvil o tablet basándose en el User Agent
            const userAgent = connectedDevice?.userAgent || '';
            const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(userAgent);
            const isTablet = /iPad|Tablet/i.test(userAgent);

            if (isTablet) {
              setConnectedDeviceType('tablet' as 'mobile' | 'tablet' | 'pc');
            } else if (isMobile) {
              setConnectedDeviceType('mobile');
            } else {
              setConnectedDeviceType('mobile'); // Fallback para mobile
            }
          } else {
            setConnectedDeviceType(null);
          }

          setHasMobileConnection(mobileConnected);
        },
        (error) => {
          console.error('Error in session status subscription:', error);
        }
      );
      sessionSyncUnsubscribeRef.current = sessionUnsubscribe;      // Generar QR code con sesión válida
      const locationsParam = selectedLocations.length > 0 ? `&locations=${encodeURIComponent(selectedLocations.join(','))}` : '';
      const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/mobile-scan?session=${sessionId}${requestProductName ? '&requestProductName=true' : ''}${locationsParam}`;
      const qrDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);
      
      console.log(`📱 QR generado - Sesión válida hasta: ${expiryDate.toLocaleString()}`);
    } catch (err) {
      console.error('Error generating session with real connection detection:', err);
    }

    // Escuchar códigos de la sesión móvil usando Firebase
    if (typeof window !== 'undefined') {
      // 1. Configurar listener en tiempo real (método principal)
      try {
        const unsubscribe = ScanningService.subscribeToScans(
          (scans) => {
            // Buscar nuevos códigos no procesados para esta sesión
            const newScan = scans.find(scan =>
              scan.sessionId === sessionId &&
              !scan.processed &&
              scan.source === 'mobile'
            );            if (newScan && newScan.id) {
              console.log('🔥 Nuevo escaneo detectado:', newScan.code);
              setCode(newScan.code);
              onDetect?.(newScan.code, newScan.productName);

              // Marcar como procesado en Firebase
              ScanningService.markAsProcessed(newScan.id).catch(console.error);

              // Cerrar QR modal
              setShowMobileQR(false);

              // Limpiar el polling ya que el listener funcionó
              if (pollIntervalRef.current) {
                clearInterval(pollIntervalRef.current);
                pollIntervalRef.current = null;
              }
              if (countdownRef.current) {
                clearInterval(countdownRef.current);
                countdownRef.current = null;
              }
            }
          },
          sessionId, // Filtrar por sessionId
          (error) => {
            console.error('Error in Firebase scan subscription:', error);
            // Si es un error de índice, depender solo del polling
            if (error.message?.includes('index') || error.message?.includes('Index')) {
              console.log('🔥➡️🔄 Firebase listener falló por índice, usando solo polling...');
            }
          }
        );

        // Guardar el unsubscribe para poder limpiarlo después
        unsubscribeRef.current = unsubscribe;
        
        // Marcar listeners como activos
        listenersActiveRef.current = true;
      } catch (error) {
        console.error('Error setting up Firebase listener:', error);
        console.log('🔥➡️🔄 Firebase listener no disponible, usando solo polling...');
      }      // 2. Configurar polling cada 10 segundos como fallback
      console.log('🔄 Iniciando polling cada 10 segundos como fallback...');
      pollIntervalRef.current = setInterval(() => {
        checkForNewScans(sessionId);
      }, 10000); // 10 segundos

      // Iniciar contador regresivo
      startCountdown();

      // Retornar función de cleanup que incluye tanto listener como polling
      return () => {
        if (unsubscribeRef.current) {
          unsubscribeRef.current();
        }
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
        }
      };
    }
  }, [onDetect, setCode, checkForNewScans, startCountdown, requestProductName, selectedLocations, loadSessionFromStorage, saveSessionToStorage]);

  // Reactivar listeners de Firebase cuando se restaura una sesión al recargar la página
  useEffect(() => {
    const reactivateSessionListeners = async () => {
      // Solo ejecutar si hay sesión válida, QR visible y no hay listeners activos
      if (mobileSessionId && sessionExpiry && sessionExpiry > new Date() && showMobileQR && !listenersActiveRef.current) {
        try {
          console.log('🔄 Reactivando listeners para sesión restaurada:', mobileSessionId);
          
          // Marcar listeners como activos
          listenersActiveRef.current = true;
          
          // Limpiar listeners existentes antes de crear nuevos
          if (unsubscribeRef.current) {
            unsubscribeRef.current();
            unsubscribeRef.current = null;
          }
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          if (countdownRef.current) {
            clearInterval(countdownRef.current);
            countdownRef.current = null;
          }
          
          // Crear heartbeat manager para mantener sesión PC activa
          const heartbeatManager = SessionSyncService.createHeartbeatManager(mobileSessionId, 'pc');
          sessionHeartbeatRef.current = heartbeatManager;

          // Iniciar sesión y heartbeat
          await heartbeatManager.start();

          // Escuchar cambios en tiempo real para detectar conexiones
          const sessionUnsubscribe = SessionSyncService.subscribeToSessionStatus(
            mobileSessionId,
            (sessions: SessionStatus[]) => {
              const mobileConnected = sessions.some(session =>
                session.source === 'mobile' &&
                session.status === 'active'
              );

              // Determinar qué tipo de dispositivo se conectó basándose en User Agent
              if (mobileConnected) {
                const connectedDevice = sessions.find(session =>
                  session.source === 'mobile' &&
                  session.status === 'active'
                );

                // Detectar si es móvil o tablet basándose en el User Agent
                const userAgent = connectedDevice?.userAgent || '';
                const isMobile = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|Windows Phone/i.test(userAgent);
                const isTablet = /iPad|Tablet/i.test(userAgent);

                if (isTablet) {
                  setConnectedDeviceType('tablet' as 'mobile' | 'tablet' | 'pc');
                } else if (isMobile) {
                  setConnectedDeviceType('mobile');
                } else {
                  setConnectedDeviceType('mobile'); // Fallback para mobile
                }
              } else {
                setConnectedDeviceType(null);
              }

              setHasMobileConnection(mobileConnected);
            },
            (error) => {
              console.error('Error in session status subscription:', error);
            }
          );
          sessionSyncUnsubscribeRef.current = sessionUnsubscribe;

          // Configurar listener en tiempo real de Firebase
          if (typeof window !== 'undefined') {
            try {
              const unsubscribe = ScanningService.subscribeToScans(
                (scans) => {
                  // Buscar nuevos códigos no procesados para esta sesión
                  const newScan = scans.find(scan =>
                    scan.sessionId === mobileSessionId &&
                    !scan.processed &&
                    scan.source === 'mobile'
                  );

                  if (newScan && newScan.id) {
                    console.log('🔥 Nuevo escaneo detectado:', newScan.code);
                    setCode(newScan.code);
                    onDetect?.(newScan.code, newScan.productName);

                    // Marcar como procesado en Firebase
                    ScanningService.markAsProcessed(newScan.id).catch(console.error);

                    // Cerrar QR modal
                    setShowMobileQR(false);

                    // Limpiar el polling ya que el listener funcionó
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current);
                      pollIntervalRef.current = null;
                    }
                    if (countdownRef.current) {
                      clearInterval(countdownRef.current);
                      countdownRef.current = null;
                    }
                  }
                },
                mobileSessionId, // Filtrar por sessionId
                (error) => {
                  console.error('Error in Firebase scan subscription:', error);
                  if (error.message?.includes('index') || error.message?.includes('Index')) {
                    console.log('🔥➡️🔄 Firebase listener falló por índice, usando solo polling...');
                  }
                }
              );

              // Guardar el unsubscribe para poder limpiarlo después
              unsubscribeRef.current = unsubscribe;
              
              // Marcar listeners como activos (redundante pero por seguridad)
              listenersActiveRef.current = true;
            } catch (error) {
              console.error('Error setting up Firebase listener:', error);
              console.log('🔥➡️🔄 Firebase listener no disponible, usando solo polling...');
            }

            // Configurar polling cada 10 segundos como fallback
            console.log('🔄 Iniciando polling cada 10 segundos como fallback...');
            pollIntervalRef.current = setInterval(() => {
              checkForNewScans(mobileSessionId);
            }, 10000); // 10 segundos

            // Iniciar contador regresivo
            startCountdown();
          }
        } catch (error) {
          console.error('Error reactivando listeners para sesión restaurada:', error);
        }
      }
    };

    reactivateSessionListeners();
  }, [mobileSessionId, sessionExpiry, showMobileQR, onDetect, setCode, checkForNewScans, startCountdown]);

  // Función para solo ocultar el QR manteniendo la sesión activa
  const hideMobileQR = useCallback(() => {
    setShowMobileQR(false);
    console.log('📱 QR ocultado, sesión mantiene activa en localStorage');
  }, []);

  const closeMobileSession = useCallback(() => {
    setShowMobileQR(false);
    setMobileSessionId(null);
    setQrCodeUrl('');
    setHasMobileConnection(false);
    setConnectedDeviceType(null);
    setSessionExpiry(null);
    setSelectedLocations([]); // Clear selected locations

    // Limpiar sesión del localStorage solo cuando se cierra manualmente
    clearSessionFromStorage();

    // Limpiar la sincronización de sesión
    if (sessionSyncUnsubscribeRef.current) {
      sessionSyncUnsubscribeRef.current();
      sessionSyncUnsubscribeRef.current = null;
    }

    // Detener heartbeat de la sesión
    if (sessionHeartbeatRef.current) {
      sessionHeartbeatRef.current.stop();
      sessionHeartbeatRef.current = null;
    }

    // Limpiar el listener de Firebase si existe
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
      unsubscribeRef.current = null;
    }

    // Limpiar el polling si existe
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
      console.log('🔄 Polling detenido');
    }

    // Limpiar el contador regresivo si existe
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Reset del contador
    setNextPollIn(10);
    
    // Reset flag de listeners
    listenersActiveRef.current = false;
  }, [clearSessionFromStorage]);

  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } };
  const slideUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl mx-auto flex flex-col gap-10 p-8 md:p-12 rounded-3xl shadow-2xl transition-colors duration-500 bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] barcode-mobile backdrop-blur-xl"
      tabIndex={0}
    >
      {/* Tabs */}
      <div className="flex justify-center mb-6">
        <button
          className={`px-6 py-2 rounded-l-xl font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-900 ${activeTab === 'image' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/80 dark:bg-zinc-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'}`}
          onClick={() => setActiveTab('image')}
        >
          Imagen / Pegar
        </button>
        <button
          className={`px-6 py-2 font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-900 ${activeTab === 'camera' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/80 dark:bg-zinc-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'}`}
          onClick={() => setActiveTab('camera')}
        >
          Cámara
        </button>
        <button
          className={`px-6 py-2 rounded-r-xl font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-900 ${activeTab === 'mobile' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/80 dark:bg-zinc-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'}`}
          onClick={() => setActiveTab('mobile')}
        >
          <SmartphoneIcon className="w-4 h-4 inline-block mr-2" />
          Escáner Móvil
        </button>
      </div>
      {/* Contenido de cada tab */}
      {activeTab === 'image' && (
        <div>
          {/* Icono ScanBarcode destacado */}
          <div className="flex flex-col items-center gap-4 mb-2">
            <div className="p-6 rounded-full bg-gradient-to-tr from-indigo-500 via-blue-400 to-cyan-300 dark:from-indigo-700 dark:via-indigo-900 dark:to-blue-900 text-white shadow-2xl border-4 border-white/80 dark:border-indigo-900 animate-pulse-slow">
              <ScanBarcode className="w-16 h-16 drop-shadow-lg" />
            </div>
            <h2 className="text-2xl font-extrabold text-zinc-800 dark:text-indigo-300 tracking-tight mb-1">Escáner de Códigos de Barras</h2>
          </div>

          {/* Mensaje de "Código copiado" */}
          <AnimatePresence>
            {copySuccess && (
              <motion.div
                {...fadeIn}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="fixed top-8 right-8 z-50 px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-3 bg-gradient-to-r from-green-400 to-green-600 text-white font-bold text-lg animate-bounce backdrop-blur-xl border-2 border-green-200 dark:border-green-800"
              >
                <CheckIcon className="w-6 h-6" />
                ¡Código copiado!
              </motion.div>
            )}
          </AnimatePresence>

          {/* Card de código detectado con preview de imagen de fondo mejorada y mensaje de éxito unificado */}
          {imagePreview && (
            <motion.div {...slideUp} transition={{ duration: 0.5 }} className="mb-2 flex justify-center w-full items-center">
              <div className="w-full max-w-md relative rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-200 dark:border-indigo-700 bg-white dark:bg-transparent min-h-[220px] flex items-center justify-center">
                {/* Imagen de fondo SIEMPRE visible si hay imagePreview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="absolute inset-0 w-full h-full object-contain z-0"
                  style={{ filter: 'brightness(0.92)' }}
                />
                {/* Overlay sutil para contraste */}
                <div className="absolute inset-0 bg-white/60 dark:bg-black/50 z-10" />
                {/* Código de barras y acciones, overlay centrado */}
                {code && (
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
                    {/* Mensaje de éxito y código detectado juntos */}
                    <div className="flex flex-col items-center w-full gap-2">
                      <div className="flex items-center justify-center gap-3 mb-2">
                        <CheckIcon className="w-7 h-7 text-green-300 drop-shadow" />
                        <span className="text-lg font-bold text-white drop-shadow">¡Código detectado y copiado!</span>
                      </div>
                      <div
                        className="w-full text-center font-mono text-3xl md:text-4xl tracking-widest text-white select-all px-2 bg-transparent whitespace-nowrap overflow-x-auto"
                        style={{ letterSpacing: '0.12em', maxWidth: '100%', userSelect: 'all', WebkitUserSelect: 'all', overflowY: 'hidden', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}
                        tabIndex={0}
                        title={code}
                      >
                        {code}
                      </div>
                      <div className="flex gap-6 mt-2 justify-center">
                        <button
                          onClick={handleRemoveLeadingZeroMain}
                          className="group p-3 rounded-full bg-white/20 hover:bg-white/30 text-white shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-700"
                          title="Eliminar primer dígito"
                          aria-label="Eliminar primer dígito"
                        >
                          <svg className="w-7 h-7 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <button
                          onClick={handleCopyCode}
                          className="group p-3 rounded-full bg-white/20 hover:bg-white/30 text-white shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-700"
                          title="Copiar código"
                          aria-label="Copiar código"
                        >
                          <CopyIcon className="w-7 h-7 group-hover:scale-110 transition-transform duration-200" color="white" />
                        </button>
                      </div>
                      {detectionMethod && (
                        <span className="mt-2 inline-block text-xs font-semibold text-indigo-700 dark:text-indigo-200 bg-indigo-100/80 dark:bg-indigo-900/60 px-3 py-1 rounded-full shadow">
                          Método: {detectionMethod}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
          {/* Botón "Limpiar Todo" debajo del preview */}
          <AnimatePresence>
            {(code || error || imagePreview) && (
              <motion.div key="clear" {...slideUp} transition={{ duration: 0.5 }} className="flex justify-center mb-6">
                <button
                  onClick={handleClear}
                  className="px-7 py-3 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-300 bg-gradient-to-r from-zinc-200 to-red-200 dark:from-zinc-800 dark:to-red-900 text-zinc-800 dark:text-zinc-100 hover:bg-red-500 hover:text-white font-bold shadow-lg"
                >
                  <TrashIcon className="w-5 h-5 inline-block mr-2" />
                  Limpiar Todo
                </button>
              </motion.div>
            )}
          </AnimatePresence>          {/* Área de carga de imagen */}
          <motion.div {...slideUp} transition={{ duration: 0.5 }}>
            <ImageDropArea
              onDrop={handleDrop}
              onFileSelect={handleDropAreaClick}
              fileInputRef={fileInputRef}
              onFileUpload={handleFileUpload}
            />
          </motion.div>
          {/* Spinner mientras procesa imagen */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                key="spinner"
                {...fadeIn}
                transition={{ duration: 0.3 }}
                className="text-center p-6 rounded-2xl flex items-center justify-center gap-4 bg-gradient-to-r from-indigo-100 to-blue-100 dark:from-indigo-900 dark:to-blue-950 text-indigo-700 dark:text-indigo-200 shadow-xl border-2 border-indigo-200 dark:border-indigo-800"
              >
                <LoaderIcon className="w-10 h-10 animate-spin" />
                <p className="font-bold text-lg">Procesando imagen...</p>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Mensaje de error */}
          <AnimatePresence>
            {error && (
              <motion.div
                key="error"
                {...fadeIn}
                transition={{ duration: 0.3 }}
                className="text-center text-red-700 dark:text-red-300 bg-gradient-to-r from-red-100 to-red-200 dark:from-red-900 dark:to-red-950 p-6 rounded-2xl flex flex-col items-center gap-3 border-2 border-red-200 dark:border-red-800 shadow-xl"
              >
                <AlertIcon className="w-7 h-7" />
                <p className="text-base font-bold">{error}</p>
                <button
                  onClick={handleClear}
                  className="mt-2 text-sm bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700 px-4 py-2 rounded-xl transition-colors duration-300 font-bold shadow"
                >
                  Intentar de nuevo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}      {activeTab === 'camera' && (
        <CameraScanner
          code={code}
          error={error}
          detectionMethod={detectionMethod}
          cameraActive={cameraActive}
          liveStreamRef={liveStreamRef}
          toggleCamera={toggleCamera}
          handleClear={handleClear}
          handleCopyCode={handleCopyCode}
          onRemoveLeadingZero={handleRemoveLeadingZeroMain}
        />
      )}

      {activeTab === 'mobile' && (
        <div>
          {/* Icono de móvil destacado */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <div className="p-6 rounded-full bg-gradient-to-tr from-green-500 via-emerald-400 to-teal-300 dark:from-green-700 dark:via-green-900 dark:to-emerald-900 text-white shadow-2xl border-4 border-white/80 dark:border-green-900 animate-pulse-slow">
              <SmartphoneIcon className="w-16 h-16 drop-shadow-lg" />
            </div>
            <h2 className="text-2xl font-extrabold text-zinc-800 dark:text-green-300 tracking-tight mb-1">Escáner Móvil</h2>
            <p className="text-center text-gray-600 dark:text-gray-400 max-w-md">
              Escanea códigos de barras usando tu teléfono móvil. Los códigos aparecerán automáticamente aquí.
            </p>
          </div>          {!showMobileQR ? (
            <div className="text-center space-y-4">
              {/* Mostrar sesión existente si la hay */}
              {mobileSessionId && sessionExpiry && sessionExpiry > new Date() && (
                <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800 max-w-md mx-auto mb-4">
                  <h4 className="text-base font-semibold text-green-800 dark:text-green-200 mb-2">
                    🟢 Sesión Activa Encontrada
                  </h4>
                  <div className="text-sm text-green-700 dark:text-green-300 space-y-1">
                    <p><strong>ID:</strong> <span className="font-mono text-xs">{mobileSessionId}</span></p>
                    <p><strong>Válida por:</strong> {getSessionTimeRemaining()}</p>
                    <p><strong>Configuración:</strong> {requestProductName ? 'Con nombres de productos' : 'Solo códigos'}</p>
                    {selectedLocations.length > 0 && (
                      <p><strong>Ubicaciones:</strong> {selectedLocations.join(', ')}</p>
                    )}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => setShowMobileQR(true)}
                      className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      📱 Usar Sesión Existente
                    </button>
                    <button
                      onClick={closeMobileSession}
                      className="flex-1 px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm font-medium"
                    >
                      🗑️ Crear Nueva
                    </button>
                  </div>
                </div>
              )}

              {/* Configuración desde PC para móvil */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800 max-w-md mx-auto space-y-4">
                <h4 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-3">
                  Configuración para Móvil
                </h4>

                {/* Checkbox para nombres de productos */}
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requestProductName}
                    onChange={(e) => {
                      setRequestProductName(e.target.checked);
                      // Si hay sesión existente, actualizar configuración en localStorage
                      if (mobileSessionId && sessionExpiry) {
                        saveSessionToStorage(mobileSessionId, sessionExpiry);
                      }
                    }}
                    className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mt-0.5"
                  />
                  <div className="text-left">
                    <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Solicitar nombres de productos en móvil
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                      {requestProductName
                        ? "El móvil pedirá ingresar nombres opcionales para cada código escaneado"
                        : "El móvil solo enviará códigos de barras sin solicitar nombres"
                      }
                    </p>
                  </div>
                </label>

                {/* Sección de selección de ubicaciones */}
                <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                  <h5 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    📍 Ubicaciones Activas
                  </h5>
                  
                  {loadingLocations ? (
                    <div className="flex items-center justify-center py-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-500 border-t-transparent"></div>
                      <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">Cargando ubicaciones...</span>
                    </div>
                  ) : availableLocations.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {availableLocations.map((location) => (
                        <label key={location.id} className="flex items-center gap-2 cursor-pointer text-xs">
                          <input
                            type="checkbox"
                            checked={selectedLocations.includes(location.value)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedLocations(prev => [...prev, location.value]);
                              } else {
                                setSelectedLocations(prev => prev.filter(loc => loc !== location.value));
                              }
                              // Si hay sesión existente, actualizar configuración en localStorage
                              if (mobileSessionId && sessionExpiry) {
                                saveSessionToStorage(mobileSessionId, sessionExpiry);
                              }
                            }}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-1 dark:bg-gray-700 dark:border-gray-600"
                          />
                          <span className="text-blue-800 dark:text-blue-200 font-medium">
                            {location.label}
                          </span>
                          <span className="text-blue-600 dark:text-blue-400">
                            ({location.names?.length || 0} empleados)
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-blue-600 dark:text-blue-400 py-2">
                      No hay ubicaciones disponibles en la base de datos
                    </p>
                  )}
                  
                  {selectedLocations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                      <p className="text-xs text-blue-700 dark:text-blue-300">
                        <strong>Seleccionadas:</strong> {selectedLocations.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <button
                onClick={generateMobileSession}
                className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold text-lg rounded-2xl shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-green-300 dark:focus:ring-green-900"
              >
                <QrCodeIcon className="w-6 h-6 inline-block mr-3" />
                {mobileSessionId && sessionExpiry && sessionExpiry > new Date() 
                  ? 'Mostrar QR de Sesión Existente' 
                  : 'Generar Código QR para Móvil (24h)'}
              </button>
            </div>
          ) : (
            <div className="text-center">
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-xl border-2 border-green-200 dark:border-green-800 max-w-sm mx-auto">
                {/* Indicador de sesión restaurada */}
                <div className="mb-4 px-3 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
                  <div className="flex items-center justify-center gap-2 text-green-800 dark:text-green-200">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">✅ Sesión Restaurada Automáticamente</span>
                  </div>
                </div>
                
                <h3 className="text-xl font-bold text-gray-800 dark:text-green-300 mb-4">EscaneA este QR con tu móvil</h3>

                {/* QR Code - ahora real */}                <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4 mb-4 flex items-center justify-center">
                  {qrCodeUrl ? (
                    <Image
                      src={qrCodeUrl}
                      alt="QR Code para acceder al escáner móvil"
                      width={192}
                      height={192}
                      className="rounded-lg"
                    />
                  ) : (
                    <div className="w-48 h-48 bg-white dark:bg-gray-900 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
                      <LoaderIcon className="w-12 h-12 text-gray-400 animate-spin" />
                    </div>
                  )}
                </div>                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Sesión: <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">{mobileSessionId}</span>
                  </p>

                  {/* Indicador de tiempo restante */}
                  {sessionExpiry && (
                    <div className="text-xs px-3 py-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                      <span className="flex items-center gap-1">
                        ⏰ <strong>Válida por:</strong> {getSessionTimeRemaining()}
                      </span>
                    </div>
                  )}

                  {/* Indicador de configuración de nombres de productos */}
                  <div className={`text-xs px-3 py-2 rounded-lg ${requestProductName
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    }`}>
                    {requestProductName ? (
                      <span className="flex items-center gap-1">
                        📝 <strong>Solicitar nombres:</strong> El móvil pedirá el nombre del producto
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        📄 <strong>Solo códigos:</strong> El móvil enviará únicamente el código de barras
                      </span>
                    )}
                  </div>

                  {/* Indicador de ubicaciones seleccionadas */}
                  {selectedLocations.length > 0 && (
                    <div className="text-xs px-3 py-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-700">
                      <span className="flex items-center gap-1">
                        📍 <strong>Ubicaciones:</strong> {selectedLocations.join(', ')}
                      </span>
                    </div>
                  )}

                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    O ingresa manualmente esta URL en tu móvil:
                  </p>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                    <code className="text-xs text-gray-700 dark:text-gray-300 break-all">
                    {typeof window !== 'undefined' && `${window.location.origin}/mobile-scan?session=${mobileSessionId}${requestProductName ? '&requestProductName=true' : ''}${selectedLocations.length > 0 ? `&locations=${encodeURIComponent(selectedLocations.join(','))}` : ''}`}
                  </code>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={hideMobileQR}
                    className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors font-medium"
                  >
                    Cerrar
                  </button>
                  
                  {/* Botón para descargar imagen QR */}
                  <button 
                    onClick={async () => {
                      if (qrCodeUrl) {
                        try {
                          // Crear un enlace temporal para descargar la imagen
                          const response = await fetch(qrCodeUrl);
                          const blob = await response.blob();
                          const url = URL.createObjectURL(blob);
                          
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `scanner-qr-${mobileSessionId}.png`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          URL.revokeObjectURL(url);
                        } catch (error) {
                          console.error('Error downloading QR image:', error);
                          alert('Error al descargar la imagen QR');
                        }
                      }
                    }}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
                    title="Descargar imagen QR"
                  >
                    📥 Descargar QR
                  </button>

                  <button onClick={async () => {
                    if (typeof window !== 'undefined' && mobileSessionId) {
                      const locationsParam = selectedLocations.length > 0 ? `&locations=${encodeURIComponent(selectedLocations.join(','))}` : '';
                      const url = `${window.location.origin}/mobile-scan?session=${mobileSessionId}${requestProductName ? '&requestProductName=true' : ''}${locationsParam}`;
                      try {
                        // Try modern clipboard API first
                        if (navigator.clipboard && navigator.clipboard.writeText) {
                          await navigator.clipboard.writeText(url);
                        } else {
                          // Fallback for older browsers or insecure contexts
                          const textArea = document.createElement('textarea');
                          textArea.value = url;
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
                      } catch (error) {
                        console.error('Error copying to clipboard:', error);
                        // Show the URL to user if clipboard fails
                        alert(`URL copiada manualmente: ${url}`);
                      }
                    }
                  }}
                    className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium"
                  >
                    Copiar URL
                  </button>
                </div>
              </div>              <div className="mt-6 text-center">                {/* Estado de conexión real */}
                {hasMobileConnection ? (
                  <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                    <WifiIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">
                      {connectedDeviceType === 'mobile' && '📱 MÓVIL'}
                      {connectedDeviceType === 'tablet' && '📱 TABLET'}
                      {!connectedDeviceType && '📱 DISPOSITIVO'} CONECTADO - Listo para escanear
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-orange-600 dark:text-orange-400">
                    <WifiOffIcon className="w-4 h-4" />
                    <span className="text-sm font-medium">⏳ ESPERANDO CONEXIÓN &ldquo;MÓVIL&rdquo;</span>
                  </div>
                )}
                <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  🔥 Sincronización en tiempo real activa
                </div>
                <div className="mt-1 text-xs text-blue-500 dark:text-blue-400">
                  🔄 Próxima verificación en {nextPollIn}s
                </div>
              </div>
            </div>
          )}          {/* Código detectado desde móvil */}
          <AnimatePresence>
            {code && activeTab === 'mobile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="mt-4 flex justify-center w-full"
              >
                <div className="w-full max-w-sm relative rounded-xl shadow-lg overflow-hidden border border-green-400 dark:border-green-700 bg-white/95 dark:bg-gray-800/95 min-h-[80px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 z-10" />
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-3">
                    <div className="flex flex-col items-center w-full gap-1">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <CheckIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-sm font-semibold text-green-800 dark:text-green-200">¡Código recibido desde móvil!</span>
                      </div>
                      <div
                        className="w-full text-center font-mono text-lg sm:text-xl tracking-wider text-green-800 dark:text-green-200 select-all px-2 bg-transparent break-all"
                        style={{ letterSpacing: '0.1em', userSelect: 'all', WebkitUserSelect: 'all' }}
                        tabIndex={0}
                        title={code}
                      >
                        {code}
                      </div>
                      <div className="flex gap-3 mt-1 justify-center">
                        <button
                          onClick={handleRemoveLeadingZeroMain}
                          className="group p-2 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-200 shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-700"
                          title="Eliminar primer dígito"
                          aria-label="Eliminar primer dígito"
                        >
                          <svg className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        </button>
                        <button
                          onClick={handleCopyCode}
                          className="group p-2 rounded-full bg-green-100 hover:bg-green-200 dark:bg-green-800 dark:hover:bg-green-700 text-green-700 dark:text-green-200 shadow transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-300 dark:focus:ring-green-700"
                          title="Copiar código"
                          aria-label="Copiar código"
                        >
                          <CopyIcon className="w-4 h-4 group-hover:scale-110 transition-transform duration-200" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>          {/* Botón limpiar para móvil */}
          <AnimatePresence>
            {code && activeTab === 'mobile' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="flex justify-center mt-3"
              >
                <button
                  onClick={handleClear}
                  className="px-4 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-300 bg-gradient-to-r from-zinc-200 to-red-200 dark:from-zinc-800 dark:to-red-900 text-zinc-800 dark:text-zinc-100 hover:bg-red-500 hover:text-white font-semibold shadow"
                >
                  <TrashIcon className="w-4 h-4 inline-block mr-1" />
                  Limpiar
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {children}
    </div>
  );
}
