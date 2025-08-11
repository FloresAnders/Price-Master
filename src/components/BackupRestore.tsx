'use client';

import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader, FileText, Database } from 'lucide-react';
import { ClientBackupService, BackupData } from '../services/backup-client';

export default function BackupRestore() {
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [backupInfo, setBackupInfo] = useState<BackupData | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json' || file.name.endsWith('.json')) {
        setSelectedFile(file);
        setStatus('idle');
        setMessage('');
        setBackupInfo(null);

        // Preview backup info
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            const backupData = JSON.parse(content);
            
            if (ClientBackupService.validateBackup(backupData)) {
              setBackupInfo(backupData);
              setMessage('✅ Archivo de backup válido detectado');
              setStatus('success');
            } else {
              setMessage('❌ El archivo no es un backup válido');
              setStatus('error');
              setSelectedFile(null);
            }
          } catch {
            setMessage('❌ Error al leer el archivo JSON');
            setStatus('error');
            setSelectedFile(null);
          }
        };
        reader.readAsText(file);
      } else {
        setMessage('❌ Por favor selecciona un archivo JSON válido');
        setStatus('error');
        setSelectedFile(null);
      }
    }
  };

  const handleRestore = async () => {
    if (!selectedFile || !backupInfo) return;

    setIsRestoring(true);
    setStatus('idle');
    setMessage('Restaurando configuración CCSS...');

    try {
      await ClientBackupService.restoreCcssBackup(backupInfo);
      setStatus('success');
      setMessage('✅ Configuración CCSS restaurada exitosamente');
    } catch (error) {
      console.error('Error restoring backup:', error);
      setStatus('error');
      setMessage('❌ Error al restaurar el backup: ' + (error instanceof Error ? error.message : 'Error desconocido'));
    } finally {
      setIsRestoring(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setBackupInfo(null);
    setStatus('idle');
    setMessage('');
  };

  return (
    <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-6 shadow-lg">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
          <Database className="w-6 h-6 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-orange-900 dark:text-orange-100">
            🔄 Restaurar Backup CCSS
          </h3>
          <p className="text-orange-700 dark:text-orange-300 text-sm">
            Carga un archivo de backup para restaurar la configuración
          </p>
        </div>
      </div>

      {/* File Upload Area */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-orange-900 dark:text-orange-100 mb-2">
          📄 Seleccionar archivo de backup:
        </label>
        <div className="relative">
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleFileSelect}
            className="hidden"
            id="backup-file-input"
          />
          <label
            htmlFor="backup-file-input"
            className="flex items-center justify-center w-full px-4 py-8 border-2 border-dashed border-orange-300 dark:border-orange-700 rounded-lg cursor-pointer hover:border-orange-400 dark:hover:border-orange-600 transition-colors bg-white dark:bg-gray-800"
          >
            <div className="text-center">
              <Upload className="w-12 h-12 text-orange-400 mx-auto mb-4" />
              <p className="text-orange-700 dark:text-orange-300 font-medium">
                {selectedFile ? selectedFile.name : 'Haz clic para seleccionar un archivo JSON'}
              </p>
              <p className="text-orange-500 dark:text-orange-400 text-sm mt-1">
                Archivos soportados: .json
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Backup Info Preview */}
      {backupInfo && (
        <div className="mb-4 p-4 bg-white dark:bg-gray-800 border border-orange-200 dark:border-orange-700 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-orange-600" />
            <h4 className="font-semibold text-orange-900 dark:text-orange-100">Información del Backup:</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-orange-600 dark:text-orange-400 font-medium">Fecha de creación:</span>
              <p className="text-orange-800 dark:text-orange-200">{new Date(backupInfo.timestamp).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-orange-600 dark:text-orange-400 font-medium">Exportado por:</span>
              <p className="text-orange-800 dark:text-orange-200">{backupInfo.metadata?.exportedBy || 'Desconocido'}</p>
            </div>
            <div>
              <span className="text-orange-600 dark:text-orange-400 font-medium">Versión del sistema:</span>
              <p className="text-orange-800 dark:text-orange-200">{backupInfo.metadata?.systemVersion || 'Desconocido'}</p>
            </div>
            <div>
              <span className="text-orange-600 dark:text-orange-400 font-medium">Versión del backup:</span>
              <p className="text-orange-800 dark:text-orange-200">{backupInfo.version}</p>
            </div>
          </div>
        </div>
      )}

      {/* Status Message */}
      {message && (
        <div className={`mb-4 p-4 rounded-lg border ${
          status === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-200' 
            : status === 'error'
            ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-200'
            : 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-200'
        }`}>
          <div className="flex items-center gap-2">
            {status === 'success' && <CheckCircle className="w-5 h-5" />}
            {status === 'error' && <AlertCircle className="w-5 h-5" />}
            {status === 'idle' && isRestoring && <Loader className="w-5 h-5 animate-spin" />}
            <span className="text-sm font-medium">{message}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={handleRestore}
          disabled={!selectedFile || !backupInfo || isRestoring}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg font-medium transition-colors"
        >
          {isRestoring ? (
            <Loader className="w-5 h-5 animate-spin" />
          ) : (
            <Database className="w-5 h-5" />
          )}
          {isRestoring ? 'Restaurando...' : 'Restaurar Configuración'}
        </button>

        <button
          onClick={resetForm}
          disabled={isRestoring}
          className="px-4 py-3 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          Limpiar
        </button>
      </div>

      {/* Warning */}
      <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
          <span className="font-semibold text-yellow-800 dark:text-yellow-300">⚠️ Advertencia Importante</span>
        </div>
        <p className="text-yellow-700 dark:text-yellow-300 text-sm">
          La restauración del backup reemplazará completamente la configuración CCSS actual. 
          Esta acción no se puede deshacer. Asegúrate de que el archivo de backup sea válido y confiable.
        </p>
      </div>
    </div>
  );
}
