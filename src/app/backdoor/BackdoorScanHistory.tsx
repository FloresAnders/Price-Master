'use client'

import React, { useState, useEffect } from 'react';
import { History, Copy, Trash2, Search, Eye, Calendar } from 'lucide-react';
import type { ScanHistoryEntry } from '@/types/barcode';

export default function BackdoorScanHistory() {
  const [scanHistory, setScanHistory] = useState<ScanHistoryEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; color: string } | null>(null);

  // Load scan history from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('scanHistory');
    if (stored) {
      try {
        setScanHistory(JSON.parse(stored));
      } catch (error) {
        console.error('Error loading scan history:', error);
      }
    }
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
  const clearHistory = () => {
    localStorage.removeItem('scanHistory');
    setScanHistory([]);
    showNotification('Historial eliminado', 'red');
  };

  // Filter history based on search term
  const filteredHistory = scanHistory.filter(entry =>
    entry.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (entry.name && entry.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

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
          <button
            onClick={clearHistory}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Limpiar Todo
          </button>
        )}
      </div>

      {/* Search bar */}
      {scanHistory.length > 0 && (
        <div className="mb-4 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[var(--muted-foreground)]" />
          <input
            type="text"
            placeholder="Buscar en el historial..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:outline-none focus:border-blue-500"
          />
        </div>
      )}

      {/* Stats */}
      {scanHistory.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
              {scanHistory.filter(entry => entry.name).length}
            </p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-purple-800 dark:text-purple-300">Filtrados</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1">{filteredHistory.length}</p>
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
              : 'Intenta con un término de búsqueda diferente'
            }
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredHistory.map((entry, index) => (
            <div
              key={`${entry.code}-${index}`}
              className="flex items-center justify-between p-4 bg-[var(--muted)] hover:bg-[var(--hover-bg)] rounded-lg border border-[var(--input-border)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-medium text-[var(--foreground)]">
                    {entry.code}
                  </span>
                  {entry.name && (
                    <span className="text-sm text-[var(--muted-foreground)] bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                      {entry.name}
                    </span>
                  )}
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
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Footer info */}
      <div className="mt-6 pt-4 border-t border-[var(--input-border)]">
        <p className="text-sm text-[var(--muted-foreground)] text-center">
          El historial se mantiene sincronizado con la aplicación principal
        </p>
      </div>
    </div>
  );
}
