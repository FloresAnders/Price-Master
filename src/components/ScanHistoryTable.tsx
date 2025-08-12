'use client'

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { Copy, Trash2, Search, Eye, MapPin, RefreshCw, Image as ImageIcon, X, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import type { ScanResult } from '@/types/firestore';
import { ScanningService } from '@/services/scanning';
import locations from '@/data/locations.json';
import { storage } from '@/config/firebase';
import { ref, listAll, getDownloadURL } from 'firebase/storage';

interface ScanHistoryTableProps {
  notify?: (message: string, color: string) => void;
}

export default function ScanHistoryTable({ notify }: ScanHistoryTableProps) {
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  
  // Image modal states
  const [showImagesModal, setShowImagesModal] = useState(false);
  const [codeImages, setCodeImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [currentImageCode, setCurrentImageCode] = useState('');
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);
  const [thumbnailLoadingStates, setThumbnailLoadingStates] = useState<{ [key: number]: boolean }>({});
  
  // Individual image modal states
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0);

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

  // Load scan history with image checking
  const loadScanHistory = useCallback(async () => {
    setLoading(true);
    try {
      const history = await ScanningService.getAllScans();
      
      // Check for images for each scan result
      const historyWithImages = await Promise.all(
        history.map(async (scan: ScanResult) => {
          const hasImages = await checkCodeHasImages(scan.code);
          return { ...scan, hasImages };
        })
      );
      
      setScanHistory(historyWithImages);
    } catch (error) {
      console.error('Error loading scan history:', error);
      notify?.('Error al cargar el historial de escaneos', 'red');
    } finally {
      setLoading(false);
    }
  }, [checkCodeHasImages, notify]);

  useEffect(() => {
    loadScanHistory();
  }, [loadScanHistory]);

  // Function to copy to clipboard
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      notify?.('Copiado al portapapeles', 'green');
    }).catch(() => {
      notify?.('Error al copiar', 'red');
    });
  };

  // Function to delete scan record
  const handleDelete = async (scanId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este registro?')) return;
    
    try {
      await ScanningService.deleteScan(scanId);
      setScanHistory(prev => prev.filter(scan => scan.id !== scanId));
      notify?.('Registro eliminado correctamente', 'orange');
    } catch (error) {
      console.error('Error deleting scan record:', error);
      notify?.('Error al eliminar el registro', 'red');
    }
  };

  // Function to load and show images for a specific code
  const showCodeImages = async (barcodeCode: string) => {
    setLoadingImages(true);
    setImageLoadError(null);
    setCurrentImageCode(barcodeCode);
    setCodeImages([]);
    setShowImagesModal(true);

    try {
      const storageRef = ref(storage, 'barcode-images/');
      const result = await listAll(storageRef);
      
      const imagePromises = result.items
        .filter(item => {
          const fileName = item.name;
          return fileName === `${barcodeCode}.jpg` || 
                 fileName.match(new RegExp(`^${barcodeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\(\\d+\\)\\.jpg$`));
        })
        .map(item => getDownloadURL(item));

      if (imagePromises.length === 0) {
        setImageLoadError('No se encontraron imágenes para este código');
        return;
      }

      const imageUrls = await Promise.all(imagePromises);
      setCodeImages(imageUrls);
    } catch (error) {
      console.error('Error loading images:', error);
      setImageLoadError('Error al cargar las imágenes');
    } finally {
      setLoadingImages(false);
    }
  };

  // Function to open individual image modal
  const openImageModal = (imageUrl: string, index: number) => {
    setSelectedImageUrl(imageUrl);
    setSelectedImageIndex(index);
    setShowImageModal(true);
  };

  // Navigate between images in modal
  const navigateImage = (direction: 'prev' | 'next') => {
    if (direction === 'prev') {
      setSelectedImageIndex(prev => prev > 0 ? prev - 1 : codeImages.length - 1);
      setSelectedImageUrl(codeImages[selectedImageIndex > 0 ? selectedImageIndex - 1 : codeImages.length - 1]);
    } else {
      setSelectedImageIndex(prev => prev < codeImages.length - 1 ? prev + 1 : 0);
      setSelectedImageUrl(codeImages[selectedImageIndex < codeImages.length - 1 ? selectedImageIndex + 1 : 0]);
    }
  };

  // Filter scan history based on search and location
  const filteredHistory = scanHistory.filter(scan => {
    const matchesSearch = scan.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         scan.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = selectedLocation === 'all' || scan.location === selectedLocation;
    return matchesSearch && matchesLocation;
  });

  // Format date
  const formatDate = (timestamp: unknown) => {
    if (!timestamp) return 'Fecha no disponible';
    
    let date: Date;
    if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (typeof timestamp === 'string' || typeof timestamp === 'number') {
      date = new Date(timestamp);
    } else {
      return 'Fecha no válida';
    }
    
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get location label
  const getLocationLabel = (locationValue: string) => {
    const location = locations.find(loc => loc.value === locationValue);
    return location ? location.label : locationValue;
  };

  return (
    <div className="space-y-6">
      {/* Search and filter controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por código o nombre de producto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          <select
            value={selectedLocation}
            onChange={(e) => setSelectedLocation(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
          >
            <option value="all">Todas las ubicaciones</option>
            {locations.map(location => (
              <option key={location.value} value={location.value}>
                {location.label}
              </option>
            ))}
          </select>
        </div>
        
        <button
          onClick={loadScanHistory}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600">{scanHistory.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total de escaneos</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600">{filteredHistory.length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Resultados filtrados</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-purple-600">{scanHistory.filter(s => s.hasImages).length}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Con imágenes</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
              <span>Cargando historial...</span>
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              {searchTerm || selectedLocation !== 'all' 
                ? 'No se encontraron resultados con los filtros aplicados' 
                : 'No hay registros de escaneos'}
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Ubicación
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredHistory.map((scan, index) => (
                  <tr key={scan.id || index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                          {scan.code}
                        </span>
                        {scan.hasImages && (
                          <ImageIcon className="w-4 h-4 text-blue-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {scan.productName ? (
                          <button
                            onClick={() => handleCopy(scan.productName!.toUpperCase())}
                            className="hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer underline decoration-dotted hover:decoration-solid transition-colors"
                            title="Clic para copiar en mayúsculas"
                          >
                            {scan.productName}
                          </button>
                        ) : (
                          'Sin nombre'
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {getLocationLabel(scan.location || '')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {formatDate(scan.timestamp)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleCopy(scan.code)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                          title="Copiar código"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        
                        {scan.hasImages && (
                          <button
                            onClick={() => showCodeImages(scan.code)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Ver imágenes"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        
                        <button
                          onClick={() => handleDelete(scan.id!)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                          title="Eliminar registro"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Images Modal */}
      {showImagesModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold">
                Imágenes para código: {currentImageCode}
              </h3>
              <button
                onClick={() => setShowImagesModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 max-h-[calc(90vh-120px)] overflow-y-auto">
              {loadingImages ? (
                <div className="flex items-center justify-center p-8">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span>Cargando imágenes...</span>
                </div>
              ) : imageLoadError ? (
                <div className="text-center p-8 text-red-500">
                  {imageLoadError}
                </div>
              ) : codeImages.length === 0 ? (
                <div className="text-center p-8 text-gray-500">
                  No se encontraron imágenes
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {codeImages.map((imageUrl, index) => (
                    <div key={index} className="relative group cursor-pointer">
                      {thumbnailLoadingStates[index] && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-lg">
                          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                        </div>
                      )}
                      <Image
                        src={imageUrl}
                        alt={`Imagen ${index + 1} para código ${currentImageCode}`}
                        width={300}
                        height={200}
                        className="w-full h-48 object-cover rounded-lg transition-transform group-hover:scale-105"
                        onLoadingComplete={() => setThumbnailLoadingStates(prev => ({ ...prev, [index]: false }))}
                        onError={() => setThumbnailLoadingStates(prev => ({ ...prev, [index]: false }))}
                        onLoadStart={() => setThumbnailLoadingStates(prev => ({ ...prev, [index]: true }))}
                        onClick={() => openImageModal(imageUrl, index)}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Individual Image Modal */}
      {showImageModal && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
          <div className="relative w-full h-full flex items-center justify-center">
            <button
              onClick={() => setShowImageModal(false)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            
            {codeImages.length > 1 && (
              <>
                <button
                  onClick={() => navigateImage('prev')}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                >
                  <ChevronLeft className="w-6 h-6 text-white" />
                </button>
                
                <button
                  onClick={() => navigateImage('next')}
                  className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 rounded-full bg-black bg-opacity-70 hover:bg-opacity-90 transition-all duration-200"
                >
                  <ChevronRight className="w-6 h-6 text-white" />
                </button>
              </>
            )}
            
            <Image
              src={selectedImageUrl}
              alt={`Imagen ${selectedImageIndex + 1} de ${codeImages.length}`}
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
            />
            
            <div className="absolute bottom-4 left-4 z-10 px-4 py-2 rounded-full bg-black bg-opacity-70 text-white text-sm">
              {selectedImageIndex + 1} de {codeImages.length}
            </div>
            
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = selectedImageUrl;
                link.download = `${currentImageCode}_${selectedImageIndex + 1}.jpg`;
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
    </div>
  );
}
