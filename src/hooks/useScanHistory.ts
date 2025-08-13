'use client'

import { useState, useEffect, useCallback } from 'react';
import { ScanningService } from '@/services/scanning';
import type { ScanResult } from '@/types/firestore';

export function useScanHistory() {
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Function to check if codes have images (optimized batch operation)
  const checkCodesHaveImages = useCallback(async (scans: ScanResult[]): Promise<ScanResult[]> => {
    try {
      const codes = scans.map(scan => scan.code);
      const imageStatusMap = await ScanningService.checkMultipleCodesHaveImages(codes);
      
      return scans.map(scan => ({
        ...scan,
        hasImages: imageStatusMap.get(scan.code) || false
      }));
    } catch (error) {
      console.error('Error checking codes for images:', error);
      // En caso de error, retornar scans sin modificar
      return scans.map(scan => ({ ...scan, hasImages: false }));
    }
  }, []);

  // Load scan history from Firebase
  const loadScanHistory = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const scans = await ScanningService.getAllScans();
      // Filtrar DELIFOOD_TEST desde el inicio
      const filteredScans = scans.filter(scan => scan.location !== 'DELIFOOD_TEST');
      
      // Check which codes have images (optimized batch operation)
      const scansWithImageInfo = await checkCodesHaveImages(filteredScans);
      
      // Ordenar por timestamp descendente (más recientes primero)
      scansWithImageInfo.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setScanHistory(scansWithImageInfo);
    } catch (error) {
      console.error('Error loading scan history:', error);
      setError('Error al cargar el historial');
    } finally {
      setLoading(false);
    }
  }, [checkCodesHaveImages]);

  // Refresh history with smart caching
  const refreshHistory = useCallback(async (): Promise<{ newCount: number }> => {
    try {
      setLoading(true);
      setError(null);
      
      // Forzar actualización de caché
      ScanningService.forceRefreshCache();
      
      const scans = await ScanningService.getAllScans();
      // Filtrar DELIFOOD_TEST al actualizar
      const filteredScans = scans.filter(scan => scan.location !== 'DELIFOOD_TEST');
      
      // Obtener códigos existentes para comparar
      const existingCodes = new Set(scanHistory.map(scan => scan.code));
      
      // Identificar códigos nuevos que necesitan verificación de imágenes
      const newScans = filteredScans.filter(scan => !existingCodes.has(scan.code));
      const existingScans = filteredScans.filter(scan => existingCodes.has(scan.code));
      
      // Verificar imágenes solo para códigos nuevos (en batch)
      const newScansWithImageStatus = newScans.length > 0 
        ? await checkCodesHaveImages(newScans)
        : [];
      
      // Mantener el estado de imágenes de los códigos existentes
      const existingScansWithCurrentImageStatus = existingScans.map(scan => {
        const existingScan = scanHistory.find(existing => existing.code === scan.code);
        return { ...scan, hasImages: existingScan?.hasImages || false };
      });
      
      // Combinar todos los escaneos
      const allScansWithImageStatus = [...existingScansWithCurrentImageStatus, ...newScansWithImageStatus];
      
      // Ordenar por timestamp descendente (más recientes primero)
      allScansWithImageStatus.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setScanHistory(allScansWithImageStatus);
      
      return { newCount: newScans.length };
    } catch (error) {
      console.error('Error refreshing history:', error);
      setError('Error al actualizar el historial');
      return { newCount: 0 };
    } finally {
      setLoading(false);
    }
  }, [scanHistory, checkCodesHaveImages]);

  // Delete scan
  const deleteScan = useCallback(async (scanId: string): Promise<void> => {
    try {
      await ScanningService.deleteScan(scanId);
      setScanHistory(prev => prev.filter(scan => scan.id !== scanId));
    } catch (error) {
      console.error('Error deleting scan:', error);
      throw error;
    }
  }, []);

  // Clear all history
  const clearHistory = useCallback(async (): Promise<void> => {
    try {
      const deletePromises = scanHistory.map(scan =>
        scan.id ? ScanningService.deleteScan(scan.id) : Promise.resolve()
      );
      await Promise.all(deletePromises);
      setScanHistory([]);
      ScanningService.forceRefreshCache();
    } catch (error) {
      console.error('Error clearing history:', error);
      throw error;
    }
  }, [scanHistory]);

  // Load initial data
  useEffect(() => {
    loadScanHistory();
  }, [loadScanHistory]);

  return {
    scanHistory,
    loading,
    error,
    refreshHistory,
    deleteScan,
    clearHistory,
    loadScanHistory
  };
}

// Hook para manejar imágenes de forma optimizada
export function useScanImages() {
  const [codeImages, setCodeImages] = useState<string[]>([]);
  const [loadingImages, setLoadingImages] = useState(false);
  const [imageLoadError, setImageLoadError] = useState<string | null>(null);

  const loadImagesForCode = useCallback(async (barcodeCode: string) => {
    setLoadingImages(true);
    setImageLoadError(null);
    
    try {
      const imageUrls = await ScanningService.getImagesForCode(barcodeCode);
      
      setCodeImages(imageUrls);
      
      if (imageUrls.length === 0) {
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

  const clearImages = useCallback(() => {
    setCodeImages([]);
    setImageLoadError(null);
    setLoadingImages(false);
  }, []);

  return {
    codeImages,
    loadingImages,
    imageLoadError,
    loadImagesForCode,
    clearImages
  };
}
