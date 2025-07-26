'use client'

import React, { useState, useEffect } from 'react';
import { History, Copy, Trash2, Search, Eye, Calendar, MapPin, RefreshCw } from 'lucide-react';
import type { ScanResult } from '@/types/firestore';
import { ScanningService } from '@/services/scanning';
import locations from '@/data/locations.json';

export default function BackdoorScanHistory() {
  const [scanHistory, setScanHistory] = useState<ScanResult[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLocation, setSelectedLocation] = useState<string>('all');
  const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load scan history from Firebase
  useEffect(() => {
    const loadScanHistory = async () => {
      try {
        setLoading(true);
        const scans = await ScanningService.getAllScans();
        // Filtrar DELIFOOD_TEST desde el inicio
        const filteredScans = scans.filter(scan => scan.location !== 'DELIFOOD_TEST');
        setScanHistory(filteredScans);
      } catch (error) {
        console.error('Error loading scan history:', error);
        showNotification('Error al cargar el historial', 'red');
      } finally {
        setLoading(false);
      }
    };

    loadScanHistory();
  }, []);

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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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
                  <Search className="w-5 h-5 text-purple-600" />
                  <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Filtrados</span>
                </div>
                <p className="text-2xl font-bold text-purple-600 mt-1">{filteredHistory.length}</p>
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
    </div>
  );
}
