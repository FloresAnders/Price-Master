'use client'

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { History, Copy, Trash2, Search, Eye, Calendar, MapPin, RefreshCw, Image as ImageIcon, X, Download } from 'lucide-react';
import type { ScanResult } from '@/types/firestore';
import { ScanningService } from '@/services/scanning';
import locations from '@/data/locations.json';
import { storage } from '@/config/firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';

export default function BackdoorScanHistory() {
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Image modal states
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [codeImages, setCodeImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [currentImageCode, setCurrentImageCode] = useState('');
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [thumbnailLoadingStates, setThumbnailLoadingStates] = useState<{ [key: number]: boolean }>({});

  // Function to check if a code has images
  const checkCodeHasImages = useCallback(async (barcodeCode: string): Promise<boolean> => {
    try {
      const storageRef = ref(storage, 'barcode-images/');
      const result = await listAll(storageRef);
      
      const hasImages = result.items.some(item => {
        const fileName = item.name;
        return fileName === `${barcodeCode}.jpg` || 
               fileName.match(new RegExp(`^${barcodeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)\\.jpg$`));
      });
      
      return hasImages;
    } catch (error) {
      console.error('Error checking if code has images:', error);
      return false;
    }
  }, []);

  // Load scan history from Firebase
  useEffect(() => {
    const loadScanHistory = async () => {
      try {
        setLoading(true);
        const scans = await ScanningService.getAllScans();
        // Filtrar DELIFOOD_TEST desde el inicio
        const filteredScans = scans.filter(scan => scan.location !== 'DELIFOOD_TEST');
        
        // Check which codes have images
        const scansWithImageInfo = await Promise.all(
          filteredScans.map(async (scan) => {
            const hasImages = await checkCodeHasImages(scan.code);
            return { ...scan, hasImages };
          })
        );
        
        setScanHistory(scansWithImageInfo);
      } catch (error) {
        console.error('Error loading scan history:', error);
        showNotification('Error al cargar el historial', 'red');
      } finally {
        setLoading(false);
      }
    };

    loadScanHistory();
  }, [checkCodeHasImages]);

  // Show notification
  const showNotification = (message: string, color: string = 'green') => {
    setNotification({ message, color });
    setTimeout(() => setNotification(null), 2000);
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
        // Note: This would delete all scans from Firebase - use with caution
        const deletePromises = scanHistory.map(scan =>
          scan.id ? ScanningService.deleteScan(scan.id) : Promise.resolve()
        );
        await Promise.all(deletePromises);
        setScanHistory([]);
        showNotification('Historial eliminado', 'red');
      } catch (error) {
        console.error('Error clearing history:', error);
        showNotification('Error al eliminar el historial', 'red');
      }
    }
  };

  // Delete individual scan
  const deleteScan = async (scanId: string, code: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar el código ${code}?`)) {
      try {
        await ScanningService.deleteScan(scanId);
        setScanHistory(prev => prev.filter(scan => scan.id !== scanId));
        showNotification('Código eliminado', 'red');
      } catch (error) {
        console.error('Error deleting scan:', error);
        showNotification('Error al eliminar el código', 'red');
      }
    }
  };

  // Refresh history
  const refreshHistory = async () => {
    try {
      setLoading(true);
      const scans = await ScanningService.getAllScans();
      // Filtrar DELIFOOD_TEST al actualizar
      const filteredScans = scans.filter(scan => scan.location !== 'DELIFOOD_TEST');
      setScanHistory(filteredScans);
      showNotification('Historial actualizado', 'green');
    } catch (error) {
      console.error('Error refreshing history:', error);
      showNotification('Error al actualizar el historial', 'red');
    } finally {
      setLoading(false);
    }
  };

  // Function to load images for a specific barcode from Firebase Storage
  const loadImagesForCode = useCallback(async (barcodeCode: string) => {
    setLoadingImages(true);
    setImageLoadError(null);
    
    try {
      // Reference to the barcode-images folder
      const storageRef = ref(storage, 'barcode-images/');
      
      // List all files in the barcode-images folder
      const result = await listAll(storageRef);
      
      // Filter files that match the barcode pattern
      const matchingFiles = result.items.filter(item => {
        const fileName = item.name;
        // Match exact code name or code with numbers in parentheses
        return fileName === `${barcodeCode}.jpg` || 
               fileName.match(new RegExp(`^${barcodeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)\\.jpg$`));
      });

      // Get download URLs for matching files
      const imageUrls = await Promise.all(
        matchingFiles.map(async (fileRef) => {
          try {
            return await getDownloadURL(fileRef);
          } catch (error) {
            console.error(`Error getting download URL for ${fileRef.name}:`, error);
            return null;
          }
        })
      );

      // Filter out any failed downloads
      const validUrls = imageUrls.filter(url => url !== null) as string[];
      
      setCodeImages(validUrls);
      
      if (validUrls.length === 0) {
        setImageLoadError('No se encontraron imágenes para este código');
      }
      
    } catch (error) {
      console.error('Error loading images:', error);
      setImageLoadError('Error al cargar las imágenes');
      setCodeImages([]);
    } finally {
      setLoadingImages(false);
    }
  }, []);

  // Function to open images modal
  const handleShowImages = useCallback(async (barcodeCode: string) => {
    setCurrentImageCode(barcodeCode);
    setShowImagesModal(true);
    setThumbnailLoadingStates({});
    await loadImagesForCode(barcodeCode);
  }, [loadImagesForCode]);

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

  // Keyboard navigation for image modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!showImagesModal) return;
      
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setShowImagesModal(false);
          break;
      }
    };

    if (showImagesModal) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [showImagesModal]);

  // Filter history based on search term and location
  const filteredHistory = scanHistory.filter(entry => {
    const matchesSearch = entry.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (entry.productName && entry.productName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (entry.userName && entry.userName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesLocation = selectedLocation === 'all' || entry.location === selectedLocation;

    return matchesSearch && matchesLocation;
  });

  return (
    <div className="max-w-6xl mx-auto bg-[var(--card-bg)] rounded-lg shadow p-6">
      {/* Notification */}
      {notification && (
        <div
          className={`fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 font-semibold animate-fade-in-down bg-${notification.color}-500 text-white`}
          style={{ minWidth: 180, textAlign: 'center' }}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <History className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-[var(--foreground)]">Historial de Escaneos</h2>
        </div>

        {scanHistory.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={refreshHistory}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
            <button
              onClick={clearHistory}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Limpiar Todo
            </button>
          </div>
        )}
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

              {/* Location filter */}
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:border-blue-500"
                >
                  <option value="all">Todas las ubicaciones</option>
                  {locations
                    .filter(location => location.value !== 'DELIFOOD_TEST')
                    .map((location) => (
                      <option key={location.value} value={location.value}>
                        {location.label}
                      </option>
                    ))}
                </select>
              </div>
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
                  {scanHistory.filter(entry => entry.location).length}
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
                  className="flex items-center justify-between p-4 bg-[var(--muted)] hover:bg-[var(--hover-bg)] rounded-lg border border-[var(--input-border)] transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-lg font-medium text-[var(--foreground)]">
                        {entry.code}
                      </span>
                      {entry.hasImages && (
                        <span className="text-xs text-[var(--muted-foreground)] bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Imágenes
                        </span>
                      )}
                      {entry.productName && (
                        <span className="text-sm text-[var(--muted-foreground)] bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                          {entry.productName}
                        </span>
                      )}
                      {entry.location && (
                        <span className="text-sm text-[var(--muted-foreground)] bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {entry.location}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[var(--muted-foreground)]">
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

                  <div className="flex items-center gap-2">
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
                      onClick={refreshHistory}
                      className="p-2 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-md transition-colors"
                      title="Actualizar historial"
                      disabled={loading}
                    >
                      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    {entry.id && (
                      <button
                        onClick={() => deleteScan(entry.id!, entry.code)}
                        className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
                        title="Eliminar código"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Footer info */}
          <div className="mt-6 pt-4 border-t border-[var(--input-border)]">
            <p className="text-sm text-[var(--muted-foreground)] text-center">
              Mostrando escaneos de la base de datos Firebase • Filtrados por ubicación: {
                selectedLocation === 'all'
                  ? 'Todas las ubicaciones'
                  : locations.find(loc => loc.value === selectedLocation)?.label || selectedLocation
              }
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
                          // Abrir imagen en nueva pestaña para vista completa
                          window.open(imageUrl, '_blank');
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
    </div>
  );
}
