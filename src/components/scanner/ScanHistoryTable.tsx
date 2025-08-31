// ...existing code...

'use client'
'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';
import { History, Copy, Search, Eye, Calendar, MapPin, RefreshCw, Image as ImageIcon, X, Download, ChevronLeft, ChevronRight, Lock as LockIcon, Smartphone, QrCode } from 'lucide-react';
import { useScanHistory, useScanImages } from '@/hooks/useScanHistory';
import { useAuth } from '@/hooks/useAuth';
import { EmpresasService } from '../../services/empresas';
import { hasPermission } from '../../utils/permissions';
import { generateShortMobileUrl } from '../../utils/shortEncoder';

export default function ScanHistoryTable() {
  /* Verificar permisos del usuario */
  // Hook de autenticación para obtener el usuario actual
  const { user } = useAuth();

  // Usar hooks optimizados
  const {
    scanHistory,
    loading,
    refreshHistory,
    deleteScan: deleteScanService,
    clearHistory: clearHistoryService
  } = useScanHistory();

  const {
    codeImages,
    loadingImages,
    imageLoadError,
    loadImagesForCode,
    clearImages
  } = useScanImages();

  // Load locations from DB
  const [empresas, setEmpresas] = useState<any[]>([]);

  useEffect(() => {
    const loadEmpresas = async () => {
      try {
        const data = await EmpresasService.getAllEmpresas();
        setEmpresas(data);
      } catch (error) {
        console.error('Error loading empresas:', error);
      }
    };
    loadEmpresas();
  }, []);

  // Local state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showProcessModal, setShowProcessModal] = useState<{ code: string; open: boolean } | null>(null);
  const [confirmProcess, setConfirmProcess] = useState<{ id: string; code: string } | null>(null);

  // Temporary visual selection: show checkbox checked for 2 seconds when user selects it
  const [tempSelectedId, setTempSelectedId] = useState<string | null>(null);
  const tempSelectionTimers = useRef<Record<string, number>>({});

  // Clear any pending timers on unmount
  useEffect(() => {
    return () => {
      Object.values(tempSelectionTimers.current).forEach((t) => window.clearTimeout(t));
      tempSelectionTimers.current = {};
    };
  }, []);

  // Auto-close the "Código procesado" modal 2 seconds after it opens
  useEffect(() => {
    if (!showProcessModal?.open) return;
    const t = window.setTimeout(() => {
      setShowProcessModal(null);
    }, 2000);
    return () => window.clearTimeout(t);
  }, [showProcessModal?.open]);

  // Ref for the confirm button so we can focus it when modal opens
  const confirmProcessButtonRef = useRef<HTMLButtonElement | null>(null);
  // Ref for the "Código procesado" modal close button so Enter can close it
  const showProcessCloseRef = useRef<HTMLButtonElement | null>(null);
  // Ref to hold the current deleteScan function so effects can call it before it's declared
  const deleteScanRef = useRef<((scanId: string, code: string) => Promise<void>) | null>(null);

  // When confirmProcess modal opens, focus the Procesar button
  useEffect(() => {
    if (confirmProcess) {
      // small timeout to ensure element is mounted
      setTimeout(() => {
        confirmProcessButtonRef.current?.focus();
      }, 0);
    }
  }, [confirmProcess]);

  // Focus the close button and allow Enter/Escape to close the "Código procesado" modal
  useEffect(() => {
    if (!showProcessModal?.open) return;

    // focus the close button after mount
    setTimeout(() => showProcessCloseRef.current?.focus(), 0);

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        setShowProcessModal(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showProcessModal?.open]);

  // Keyboard handler: Enter to confirm processing, Escape to cancel
  useEffect(() => {
    if (!confirmProcess) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        // call the current deleteScan via ref without awaiting to keep UI responsive
        try {
          void deleteScanRef.current?.(confirmProcess.id, confirmProcess.code);
        } catch (err) {
          console.error('Error processing scan via Enter key:', err);
        }
        setConfirmProcess(null);
      }
      if (e.key === 'Escape') {
        setConfirmProcess(null);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [confirmProcess]);

  // Date filter states
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Image modal states
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [currentImageCode, setCurrentImageCode] = useState('');
  const [thumbnailLoadingStates, setThumbnailLoadingStates] = useState<{ [key: number]: boolean }>({});

  // Individual image modal states
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

  // Mobile scanner modal state
  const [showMobileScannerModal, setShowMobileScannerModal] = useState(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [requestProductNameModal, setRequestProductNameModal] = useState<boolean>(true);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');

  // Function to generate QR Code for mobile scanner
  const generateQRCode = useCallback(async (sessionId: string, requestProductName: boolean) => {
    try {
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

      // Use short URL format only
      const mobileScanUrl = generateShortMobileUrl(baseUrl, sessionId, requestProductName);

      const qrCodeDataUrl = await QRCode.toDataURL(mobileScanUrl, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      setQrCodeDataUrl(qrCodeDataUrl);
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }, []);

  // Show notification
  const showNotification = (message: string, color: string = 'green') => {
    setNotification({ message, color });
    setTimeout(() => setNotification(null), 2000);
  };

  // Quick date filter functions
  const setDateRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const setThisWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const start = new Date(today);
    start.setDate(today.getDate() - dayOfWeek);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  const setThisMonth = () => {
    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), 1);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  };

  // Handle copy
  const handleCopy = async (code: string) => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        // Fallback for older browsers
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
  };

  // Clear all history
  const clearHistory = async () => {
    if (window.confirm('¿Estás seguro de que deseas eliminar todo el historial? Esta acción no se puede deshacer.')) {
      try {
        await clearHistoryService();
        showNotification('Historial eliminado', 'red');
      } catch (error) {
        console.error('Error clearing history:', error);
        showNotification('Error al eliminar el historial', 'red');
      }
    }
  };

  // Delete individual scan (stable reference)
  const deleteScan = useCallback(async (scanId: string, code: string) => {
    setProcessingId(scanId);
    setTimeout(async () => {
      try {
        await deleteScanService(scanId);
        setShowProcessModal({ code, open: true });
        showNotification('Código procesado y eliminado', 'green');
      } catch (error) {
        console.error('Error deleting scan:', error);
        showNotification('Error al eliminar el código', 'red');
      } finally {
        setProcessingId(null);
      }
    }, 1200); // Simula procesamiento
  }, [deleteScanService]);

  // Keep ref updated with the latest deleteScan so effects can call it safely
  useEffect(() => {
    deleteScanRef.current = deleteScan;
    return () => {
      deleteScanRef.current = null;
    };
  }, [deleteScan]);

  // Refresh history
  const handleRefreshHistory = async () => {
    try {
      const result = await refreshHistory();
      if (result.newCount > 0) {
        showNotification(`Historial actualizado - ${result.newCount} código${result.newCount > 1 ? 's' : ''} nuevo${result.newCount > 1 ? 's' : ''}`, 'green');
      } else {
        showNotification('Historial actualizado - Sin cambios', 'green');
      }
    } catch (error) {
      console.error('Error refreshing history:', error);
      showNotification('Error al actualizar el historial', 'red');
    }
  };

  // Function to open images modal
  const handleShowImages = useCallback(async (barcodeCode: string) => {
    setCurrentImageCode(barcodeCode);
    setShowImagesModal(true);
    setThumbnailLoadingStates({});
    clearImages(); // Clear previous images
    await loadImagesForCode(barcodeCode);
  }, [loadImagesForCode, clearImages]);

  // Handle thumbnail load states
  const handleThumbnailLoad = (index: number) => {
    setThumbnailLoadingStates(prev => ({ ...prev, [index]: false }));
  };

  const handleThumbnailLoadStart = (index: number) => {
    setThumbnailLoadingStates(prev => ({ ...prev, [index]: true }));
  };

  // Download individual image
  const downloadImage = async (imageUrl: string, index: number) => {
    try {
      // Use a direct link approach instead of fetch to avoid CORS issues
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = `${currentImageCode}_imagen_${index + 1}.jpg`;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';

      // Add crossorigin attribute to handle CORS
      link.setAttribute('crossorigin', 'anonymous');

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('Descarga iniciada', 'green');
    } catch (error) {
      console.error('Error downloading image:', error);
      showNotification('Error al descargar la imagen', 'red');
    }
  };

  // Download all images
  const downloadAllImages = async () => {
    if (codeImages.length === 0) return;

    try {
      // Download each image with a small delay to avoid overwhelming the browser
      for (let i = 0; i < codeImages.length; i++) {
        const imageUrl = codeImages[i];

        const link = document.createElement('a');
        link.href = imageUrl;
        link.download = `${currentImageCode}_imagen_${i + 1}.jpg`;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.setAttribute('crossorigin', 'anonymous');

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Small delay between downloads to avoid overwhelming the browser
        if (i < codeImages.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      showNotification(`${codeImages.length} descargas iniciadas`, 'green');
    } catch (error) {
      console.error('Error downloading images:', error);
      showNotification('Error al descargar las imágenes', 'red');
    }
  };

  // Functions for individual image modal
  const handleOpenImageModal = useCallback((imageUrl: string, index: number) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageIndex(index);
    setShowImageModal(true);
  }, []);

  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImageUrl('');
    setSelectedImageIndex(0);
  }, []);

  const handleNextImage = useCallback(() => {
    if (codeImages.length > 1) {
      const nextIndex = (selectedImageIndex + 1) % codeImages.length;
      setSelectedImageIndex(nextIndex);
      setSelectedImageUrl(codeImages[nextIndex]);
    }
  }, [codeImages, selectedImageIndex]);

  const handlePreviousImage = useCallback(() => {
    if (codeImages.length > 1) {
      const prevIndex = selectedImageIndex === 0 ? codeImages.length - 1 : selectedImageIndex - 1;
      setSelectedImageIndex(prevIndex);
      setSelectedImageUrl(codeImages[prevIndex]);
    }
  }, [codeImages, selectedImageIndex]);

  // Keyboard navigation for image modal and mobile scanner modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showImageModal) {
        // Disable body scroll when individual image modal is open
        document.body.style.overflow = 'hidden';

        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            handleCloseImageModal();
            break;
          case 'ArrowLeft':
            event.preventDefault();
            handlePreviousImage();
            break;
          case 'ArrowRight':
            event.preventDefault();
            handleNextImage();
            break;
        }
      } else if (showImagesModal) {
        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            setShowImagesModal(false);
            break;
        }
      } else if (showMobileScannerModal) {
        switch (event.key) {
          case 'Escape':
            event.preventDefault();
            setShowMobileScannerModal(false);
            break;
        }
      }
    };

    if (showImagesModal || showImageModal || showMobileScannerModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => {
        // Re-enable body scroll when modal is closed
        if (showImageModal) {
          document.body.style.overflow = 'unset';
        }
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [showImagesModal, showImageModal, showMobileScannerModal, handleCloseImageModal, handlePreviousImage, handleNextImage]);

  // Generate QR code when modal opens
  useEffect(() => {
    if (showMobileScannerModal && typeof window !== 'undefined') {
      const sessionId = `scan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setCurrentSessionId(sessionId);
      generateQRCode(sessionId, requestProductNameModal);
    }
  }, [showMobileScannerModal, generateQRCode, requestProductNameModal]);

  // Regenerate QR code when requestProductNameModal changes
  useEffect(() => {
    if (showMobileScannerModal && currentSessionId && typeof window !== 'undefined') {
      generateQRCode(currentSessionId, requestProductNameModal);
    }
  }, [requestProductNameModal, currentSessionId, showMobileScannerModal, generateQRCode]);

  // Filter history based on search term, location, dates, and user permissions
  const filteredHistory = scanHistory.filter(entry => {
    const matchesSearch = entry.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.productName && entry.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.userName && entry.userName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLocation = selectedLocation === 'all' || entry.ownercompanie === selectedLocation;

    // Date filtering
    let matchesDateRange = true;
    if (startDate || endDate) {
      const entryDate = new Date(entry.timestamp);
      const startDateTime = startDate ? new Date(startDate + 'T00:00:00') : null;
      const endDateTime = endDate ? new Date(endDate + 'T23:59:59') : null;

      if (startDateTime && entryDate < startDateTime) {
        matchesDateRange = false;
      }
      if (endDateTime && entryDate > endDateTime) {
        matchesDateRange = false;
      }
    }

    // Filtrar por empresas permitidas para el usuario
    let matchesUserLocations = true;
    if (user?.permissions?.scanhistory && user.permissions.scanhistoryEmpresas) {
      // Si el usuario tiene empresas específicas configuradas, filtrar por ellas
      if (user.permissions.scanhistoryEmpresas.length > 0) {
        matchesUserLocations = entry.ownercompanie ?
          user.permissions.scanhistoryEmpresas.includes(entry.ownercompanie) : false;
      }
      // Si no tiene empresas específicas configuradas pero tiene permiso de scanhistory, puede ver todas
    } else if (!user?.permissions?.scanhistory) {
      // Si el usuario no tiene permiso de scanhistory, no puede ver nada
      matchesUserLocations = false;
    }

    return matchesSearch && matchesLocation && matchesDateRange && matchesUserLocations;
  });

  // Filtrar las ubicaciones disponibles en el selector basado en los permisos del usuario
  // Map companies to availableLocations-like array for selector; filter by user's empresa permissions
  const availableLocations = empresas
    .map(empresa => ({
      value: empresa.name,
      label: `${empresa.name} - ${empresa.ubicacion}`
    }))
    .filter(location => {
      if (!user?.permissions?.scanhistory) return false;
      // If user has no specific empresas set, allow all locations
      if (!user.permissions.scanhistoryEmpresas || user.permissions.scanhistoryEmpresas.length === 0) {
        return true;
      }
      // Otherwise allow locations whose value (which corresponds to empresa name) is included in scanhistoryEmpresas
      return user.permissions.scanhistoryEmpresas.includes(location.value);
    });

  // Verificar si el usuario tiene permiso para ver el historial de escaneos
  if (!hasPermission(user?.permissions, 'scanhistory')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Historial de Escaneos.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6 barcode-mobile">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down bg-${notification.color}-500 text-white`}
          style={{ minWidth: 180, textAlign: 'center' }}
        >
          {notification.message}
        </div>
      )}

      {/* Verificar permisos del usuario */}
      {!user?.permissions?.scanhistory ? (
        <div className="text-center py-12">
          <History className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
            Sin permisos para ver el historial
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al historial de escaneos. Contacta a tu administrador para obtener acceso.
          </p>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-600" />
              <h2 className="text-2xl font-bold text-[var(--foreground)]">Historial de Escaneos</h2>
              {user.permissions.scanhistoryEmpresas && user.permissions.scanhistoryEmpresas.length > 0 && (
                <span className="text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">
                  Limitado a: {user.permissions.scanhistoryEmpresas.join(', ')}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowMobileScannerModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                title="Abrir Escáner Móvil"
              >
                <Smartphone className="w-4 h-4" />
                Escáner Móvil
              </button>
              <button
                onClick={handleRefreshHistory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Actualizar
              </button>
              {scanHistory.length > 0 && (
                <>
                  <button
                    onClick={clearHistory}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                  >
                    {/* Eliminado Trash2, ya no se usa ícono de eliminar aquí */}
                    Limpiar Todo
                  </button>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-[var(--muted-foreground)] mt-2">Cargando historial...</p>
            </div>
          )}

          {!loading && (
            <>
              {/* Filters */}
              {scanHistory.length > 0 && (
                <div className="mb-6 space-y-4">
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                    <input
                      type="text"
                      placeholder="Buscar en el historial..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Filters row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Location filter */}
                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                      <select
                        value={selectedLocation}
                        onChange={(e) => setSelectedLocation(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:border-blue-500"
                      >
                        <option value="all">Todas las empresas permitidas</option>
                        {availableLocations
                          .filter(location => location.value !== 'DELIFOOD_TEST')
                          .map(location => (
                            <option key={location.value} value={location.value}>
                              {location.label}
                            </option>
                          ))}
                      </select>
                    </div>

                    {/* Start date filter */}
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:border-blue-500"
                        placeholder="Fecha inicio"
                        title="Filtrar desde fecha"
                      />
                    </div>

                    {/* End date filter */}
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:border-blue-500"
                        placeholder="Fecha fin"
                        title="Filtrar hasta fecha"
                      />
                    </div>
                  </div>

                  {/* Quick date filters */}
                  <div className="flex flex-wrap gap-2">
                    <span className="text-sm text-[var(--muted-foreground)] flex items-center">
                      Filtros rápidos:
                    </span>
                    <button
                      onClick={() => setDateRange(0)}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                      Hoy
                    </button>
                    <button
                      onClick={() => setDateRange(1)}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                      Ayer
                    </button>
                    <button
                      onClick={() => setDateRange(7)}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                      Últimos 7 días
                    </button>
                    <button
                      onClick={() => setThisWeek()}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                      Esta semana
                    </button>
                    <button
                      onClick={() => setDateRange(30)}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                      Últimos 30 días
                    </button>
                    <button
                      onClick={() => setThisMonth()}
                      className="px-3 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors"
                    >
                      Este mes
                    </button>
                  </div>

                  {/* Clear filters button */}
                  {(searchTerm || selectedLocation !== 'all' || startDate || endDate) && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedLocation('all');
                          setStartDate('');
                          setEndDate('');
                        }}
                        className="px-4 py-2 text-sm bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors flex items-center gap-2"
                      >
                        <X className="w-4 h-4" />
                        Limpiar filtros
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Stats */}
              {scanHistory.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Total Escaneos</span>
                    </div>
                    <p className="text-2xl font-bold text-blue-600 mt-1">{scanHistory.length}</p>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-green-600" />
                      <span className="text-sm font-medium text-green-800 dark:text-green-300">Con Nombre</span>
                    </div>
                    <p className="text-2xl font-bold text-green-600 mt-1">
                      {scanHistory.filter(entry => entry.productName).length}
                    </p>
                  </div>

                  <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-5 h-5 text-purple-600" />
                      <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Con Imágenes</span>
                    </div>
                    <p className="text-2xl font-bold text-purple-600 mt-1">
                      {scanHistory.filter(entry => entry.hasImages).length}
                    </p>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <Search className="w-5 h-5 text-amber-600" />
                      <span className="text-sm font-medium text-amber-800 dark:text-amber-300">Filtrados</span>
                    </div>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{filteredHistory.length}</p>
                  </div>

                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-orange-600" />
                      <span className="text-sm font-medium text-orange-800 dark:text-orange-300">Con Ubicación</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-600 mt-1">
                      {scanHistory.filter(entry => entry.ownercompanie).length}
                    </p>
                  </div>
                </div>
              )}

              {/* History list */}
              {filteredHistory.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-16 h-16 text-[var(--muted-foreground)] mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-[var(--foreground)] mb-2">
                    {scanHistory.length === 0 ? 'No hay escaneos en el historial' : 'No se encontraron resultados'}
                  </h3>
                  <p className="text-[var(--muted-foreground)]">
                    {scanHistory.length === 0
                      ? 'Los códigos escaneados aparecerán aquí automáticamente'
                      : 'Intenta con un término de búsqueda diferente o selecciona otra ubicación'
                    }
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredHistory.map((entry, index) => (
                    <div
                      key={`${entry.code}-${entry.id || index}`}
                      className="scan-history-row flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 bg-[var(--muted)] hover:bg-[var(--hover-bg)] rounded-lg border border-[var(--input-border)] transition-colors"
                    >
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 mb-2 w-full">
                          <span className="font-mono text-lg font-medium text-[var(--foreground)] break-words w-full block">
                            {entry.code}
                          </span>
                          <div className="flex flex-wrap gap-2 w-full">
                            {entry.hasImages && (
                              <span className="text-xs text-[var(--muted-foreground)] bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded flex items-center gap-1">
                                <ImageIcon className="w-3 h-3" />
                                Imágenes
                              </span>
                            )}
                            {entry.productName && (
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText((entry.productName || '').toUpperCase());
                                  showNotification('¡Nombre copiado!', 'blue');
                                }}
                                className="text-sm text-[var(--muted-foreground)] bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors cursor-pointer uppercase"
                                title="Clic para copiar nombre"
                              >
                                {entry.productName.toUpperCase()}
                              </button>
                            )}
                            {entry.ownercompanie && (
                              <span className="text-sm text-[var(--muted-foreground)] bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {entry.ownercompanie}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-[var(--muted-foreground)] w-full">
                          <span>
                            Fuente: {entry.source === 'mobile' ? '📱 Móvil' : '💻 Web'}
                          </span>
                          {entry.userName && (
                            <span>Usuario: {entry.userName}</span>
                          )}
                          <span>
                            {entry.timestamp.toLocaleDateString()} {entry.timestamp.toLocaleTimeString()}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${entry.processed
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                            : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
                            }`}>
                            {entry.processed ? 'Procesado' : 'Pendiente'}
                          </span>
                        </div>
                      </div>

                      <div className="actions flex flex-row flex-wrap items-center gap-2 mt-2 sm:mt-0">
                        <button
                          onClick={() => handleCopy(entry.code)}
                          className="p-2 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                          title="Copiar código"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        {entry.hasImages && (
                          <button
                            onClick={() => handleShowImages(entry.code)}
                            className="p-2 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-md transition-colors"
                            title="Ver imágenes"
                          >
                            <ImageIcon className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={handleRefreshHistory}
                          className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md transition-colors"
                          title="Actualizar historial"
                          disabled={loading}
                        >
                          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        {entry.id && (
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={processingId === entry.id || tempSelectedId === entry.id}
                              disabled={processingId === entry.id}
                              onChange={() => {
                                // show temporary selection for 2 seconds
                                setTempSelectedId(entry.id!);
                                // clear existing timer for this id
                                if (tempSelectionTimers.current[entry.id!]) {
                                  window.clearTimeout(tempSelectionTimers.current[entry.id!]);
                                }
                                // start timer to unset after 2s
                                const t = window.setTimeout(() => {
                                  if (tempSelectedId === entry.id) setTempSelectedId(null);
                                  delete tempSelectionTimers.current[entry.id!];
                                }, 2000);
                                tempSelectionTimers.current[entry.id!] = t as unknown as number;

                                // open confirm modal
                                setConfirmProcess({ id: entry.id!, code: entry.code });
                              }}
                              className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500 dark:focus:ring-green-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                              title="Procesar y eliminar código"
                            />
                            <span className="text-xs text-green-700 dark:text-green-300">Procesar</span>
                            {processingId === entry.id && (
                              <span className="ml-2 text-xs text-yellow-600 animate-pulse">Procesando...</span>
                            )}
                          </label>
                        )}
                        {/* Modal de confirmación de procesamiento */}
                        {confirmProcess && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-2 sm:px-0">
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-sm flex flex-col items-center p-4 sm:p-8 gap-4 mx-2 sm:mx-auto">
                              <div className="mb-2 sm:mb-4 w-full flex justify-center">
                                <span className="inline-block bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 rounded-full px-3 py-1 text-sm font-semibold">Confirmar procesamiento</span>
                              </div>
                              <div className="text-center mb-4 sm:mb-6 break-words w-full">
                                <p className="text-base sm:text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">¿Procesar el código <span className="font-mono text-green-700 dark:text-green-300 break-all">{confirmProcess.code}</span>?</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Esta acción eliminará el código y sus imágenes asociadas.</p>
                              </div>
                              <div className="flex flex-col sm:flex-row gap-2 w-full">
                                <button
                                  type="button"
                                  ref={confirmProcessButtonRef}
                                  onClick={() => {
                                    deleteScan(confirmProcess.id, confirmProcess.code);
                                    setConfirmProcess(null);
                                  }}
                                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                                >
                                  Procesar
                                </button>
                                <button
                                  onClick={() => setConfirmProcess(null)}
                                  className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-gray-400 hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                        {/* Modal de procesamiento y eliminación */}
                        {showProcessModal?.open && (
                          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 px-2 sm:px-0">
                            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg w-full max-w-sm flex flex-col items-center p-4 sm:p-8 gap-4">
                              <div className="mb-2 sm:mb-4 w-full flex justify-center">
                                <span className="inline-block bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 rounded-full px-3 py-1 text-sm font-semibold">Código procesado</span>
                              </div>
                              <div className="text-center mb-4 sm:mb-6 break-words w-full">
                                <p className="text-base sm:text-lg font-medium text-gray-800 dark:text-gray-100 mb-2">El código <span className="font-mono text-green-700 dark:text-green-300 break-all">{showProcessModal.code}</span> fue procesado.</p>
                                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Las imágenes asociadas también han sido eliminadas.</p>
                              </div>
                              <button
                                type="button"
                                ref={showProcessCloseRef}
                                onClick={() => setShowProcessModal(null)}
                                className="w-full sm:w-auto px-4 sm:px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                              >
                                Cerrar
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer info */}
              <div className="mt-6 pt-4 border-t border-[var(--input-border)]">
                <p className="text-sm text-[var(--muted-foreground)] text-center">
                  Mostrando escaneos • Filtrados por ubicación: {
                    selectedLocation === 'all'
                      ? (user?.permissions?.scanhistoryEmpresas && user.permissions.scanhistoryEmpresas.length > 0
                        ? `Empresas permitidas (${user.permissions.scanhistoryEmpresas.join(', ')})`
                        : 'Todas las ubicaciones')
                      : availableLocations.find(loc => loc.value === selectedLocation)?.label || selectedLocation
                  }
                  {(startDate || endDate) && (
                    <>
                      {' • '}
                      Rango de fechas: {
                        startDate && endDate
                          ? `${new Date(startDate).toLocaleDateString()} - ${new Date(endDate).toLocaleDateString()}`
                          : startDate
                            ? `Desde ${new Date(startDate).toLocaleDateString()}`
                            : `Hasta ${new Date(endDate).toLocaleDateString()}`
                      }
                    </>
                  )}
                </p>
              </div>
            </>
          )}

          {/* Images Modal */}
          {showImagesModal && (
            <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col">
              {/* Header */}
              <div className="bg-black bg-opacity-50 p-4 flex items-center justify-between">
                <div className="text-white">
                  <h3 className="text-lg font-semibold">
                    Imágenes del código: {currentImageCode}
                  </h3>
                  {codeImages.length > 0 && (
                    <p className="text-sm text-gray-300 mt-1">
                      {codeImages.length} imagen{codeImages.length > 1 ? 'es' : ''} encontrada{codeImages.length > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => setShowImagesModal(false)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-full transition-colors text-white"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 p-8 overflow-y-auto">
                {loadingImages ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                      <p>Cargando imágenes...</p>
                    </div>
                  </div>
                ) : imageLoadError ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No se encontraron imágenes</h3>
                      <p className="text-gray-300">{imageLoadError}</p>
                    </div>
                  </div>
                ) : codeImages.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {codeImages.map((imageUrl, index) => (
                      <div key={index} className="relative group">
                        <div className="aspect-square overflow-hidden rounded-lg bg-black bg-opacity-30">
                          {thumbnailLoadingStates[index] && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                            </div>
                          )}
                          <Image
                            src={imageUrl}
                            alt={`Imagen ${index + 1} del código ${currentImageCode}`}
                            width={400}
                            height={400}
                            className="w-full h-full object-cover cursor-pointer transition-transform duration-200 group-hover:scale-105"
                            loading="lazy"
                            onLoadStart={() => handleThumbnailLoadStart(index)}
                            onLoad={() => handleThumbnailLoad(index)}
                            onError={() => handleThumbnailLoad(index)}
                            onClick={() => {
                              // Abrir imagen en modal de pantalla completa
                              handleOpenImageModal(imageUrl, index);
                            }}
                          />
                        </div>
                        <div className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-sm px-2 py-1 rounded">
                          {index + 1}
                        </div>
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadImage(imageUrl, index);
                            }}
                            className="p-1 bg-black bg-opacity-70 text-white rounded-full hover:bg-opacity-90 transition-colors"
                            title="Descargar imagen"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-white">
                      <ImageIcon className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No se encontraron imágenes</h3>
                      <p className="text-gray-300">Este código no tiene imágenes asociadas</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="bg-black bg-opacity-50 p-4 flex items-center justify-between">
                <div className="text-white text-sm opacity-70">
                  Click en imagen para ver completa • ESC para cerrar
                </div>
                {codeImages.length > 0 && (
                  <button
                    onClick={() => downloadAllImages()}
                    className="flex items-center gap-2 px-4 py-2 bg-white bg-opacity-20 hover:bg-opacity-30 text-white rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    Descargar todas
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Individual Image Modal - 90% Screen */}
          {showImageModal && (
            <div
              className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-[9999]"
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 9999,
                isolation: 'isolate'
              }}
            >
              <div className="relative w-[90%] h-[90%] flex items-center justify-center">
                {/* Close Button */}
                <button
                  onClick={handleCloseImageModal}
                  className="absolute top-4 right-4 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                >
                  <X className="w-6 h-6 text-white" />
                </button>

                {/* Image Counter */}
                {codeImages.length > 1 && (
                  <div className="absolute top-4 left-4 z-10 px-4 py-2 rounded-full bg-black bg-opacity-70 text-white text-sm font-medium">
                    {selectedImageIndex + 1} de {codeImages.length}
                  </div>
                )}

                {/* Previous Button */}
                {codeImages.length > 1 && (
                  <button
                    onClick={handlePreviousImage}
                    className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                  >
                    <ChevronLeft className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Next Button */}
                {codeImages.length > 1 && (
                  <button
                    onClick={handleNextImage}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                  >
                    <ChevronRight className="w-6 h-6 text-white" />
                  </button>
                )}

                {/* Main Image */}
                <Image
                  src={selectedImageUrl}
                  alt={`Imagen ${selectedImageIndex + 1} del código ${currentImageCode}`}
                  width={1200}
                  height={800}
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                  onError={(e) => {
                    console.error(`Error loading selected image:`, e);
                  }}
                />

                {/* Image Info */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black bg-opacity-70 text-white text-sm">
                  Código: {currentImageCode} • Imagen {selectedImageIndex + 1} de {codeImages.length}
                </div>

                {/* Download Button */}
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = selectedImageUrl;
                    link.download = `${currentImageCode}_imagen_${selectedImageIndex + 1}.jpg`;
                    link.target = '_blank';
                    link.rel = 'noopener noreferrer';
                    link.setAttribute('crossorigin', 'anonymous');
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="absolute bottom-4 right-4 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200 flex items-center gap-2"
                >
                  <Download className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          )}

          {/* Mobile Scanner Modal */}
          {showMobileScannerModal && (
            <div className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center p-4 z-50">
              <div className="bg-[var(--card-bg)] rounded-lg w-full max-w-lg mx-auto max-h-[90vh] overflow-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center gap-3">
                    <Smartphone className="w-6 h-6 text-green-600" />
                    <h3 className="text-xl font-semibold text-[var(--foreground)]">
                      Escáner Móvil
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      setShowMobileScannerModal(false);
                      setQrCodeDataUrl('');
                      setCurrentSessionId('');
                      setRequestProductNameModal(true);
                    }}
                    className="p-2 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <X className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6">
                  <div className="text-center space-y-4">
                    {/* Configuración desde PC para móvil */}
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800 max-w-md mx-auto space-y-4">
                      <h4 className="text-base font-semibold text-blue-800 dark:text-blue-200 mb-3">
                        Configuración para Móvil
                      </h4>

                      {/* Checkbox para nombres de productos */}
                      <label className="flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requestProductNameModal}
                          onChange={(e) => setRequestProductNameModal(e.target.checked)}
                          className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600 mt-0.5"
                        />
                        <div className="text-left">
                          <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                            Solicitar nombres de productos en móvil
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 leading-relaxed">
                            {requestProductNameModal
                              ? "El móvil pedirá ingresar nombres opcionales para cada código escaneado"
                              : "El móvil solo enviará códigos de barras sin solicitar nombres"
                            }
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* QR Code o Link */}
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-6">
                      <p className="text-sm text-[var(--muted-foreground)] mb-4">
                        Escanea este código QR con tu teléfono o haz clic en el botón para abrir el escáner móvil:
                      </p>

                      {/* Generate Mobile Scanner URL */}
                      {(() => {
                        const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

                        // Use short URL format only
                        const mobileScanUrl = generateShortMobileUrl(baseUrl, currentSessionId, requestProductNameModal);

                        return (
                          <div className="space-y-4">
                            {/* QR Code */}
                            <div className="w-48 h-48 mx-auto bg-white rounded-lg flex items-center justify-center border">
                              {qrCodeDataUrl ? (
                                <Image
                                  src={qrCodeDataUrl}
                                  alt="Código QR del Escáner Móvil"
                                  width={192}
                                  height={192}
                                  className="w-full h-full object-contain"
                                />
                              ) : (
                                <div className="text-center">
                                  <QrCode className="w-12 h-12 text-gray-400 mx-auto mb-2 animate-pulse" />
                                  <p className="text-xs text-gray-500">Generando QR...</p>
                                </div>
                              )}
                            </div>

                            {/* URL Manual */}
                            <div className="text-left">
                              <p className="text-xs text-[var(--muted-foreground)] mb-2">
                                O ingresa manualmente esta URL en tu móvil:
                              </p>
                              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-2">
                                <code className="text-xs text-gray-700 dark:text-gray-300 break-all">
                                  {mobileScanUrl}
                                </code>
                              </div>
                            </div>

                            {/* Buttons */}
                            <div className="space-y-2">
                              {/* Mobile Link Button */}
                              <button
                                onClick={() => {
                                  window.open(mobileScanUrl, '_blank');
                                }}
                                className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-medium"
                              >
                                <Smartphone className="w-5 h-5" />
                                Abrir Escáner en Nueva Pestaña
                              </button>

                              {/* Copy Link */}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(mobileScanUrl);
                                  showNotification('¡Enlace copiado al portapapeles!', 'green');
                                }}
                                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-[var(--foreground)] rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center justify-center gap-2"
                              >
                                <Copy className="w-4 h-4" />
                                Copiar Enlace
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* Instructions */}
                    <div className="text-left space-y-2 text-sm text-[var(--muted-foreground)]">
                      <h5 className="font-semibold text-[var(--foreground)]">Instrucciones:</h5>
                      <ul className="list-disc list-inside space-y-1">
                        <li>Asegúrate de que tu teléfono y computadora estén en la misma red</li>
                        <li>Abre el enlace en tu teléfono móvil</li>
                        <li>Permite el acceso a la cámara cuando se solicite</li>
                        <li>Escanea códigos de barras con la cámara de tu teléfono</li>
                        <li>Los códigos aparecerán automáticamente en este historial</li>
                      </ul>
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-600">
                  <button
                    onClick={() => {
                      setShowMobileScannerModal(false);
                      setQrCodeDataUrl('');
                      setCurrentSessionId('');
                      setRequestProductNameModal(true);
                    }}
                    className="w-full bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 px-6 py-3 rounded-lg text-white font-medium text-lg transition-colors"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
