'use client';

import React, { useState } from 'react';
import { Upload, AlertCircle, CheckCircle, Loader, FileText, Database, Mail, Download, HardDrive } from 'lucide-react';

interface CompleteBackupData {
  timestamp: string;
  version: string;
  data: {
    locations: { collection: any[]; count: number };
    users: { collection: any[]; count: number };
    schedules: { collection: any[]; count: number };
    payrollRecords: { collection: any[]; count: number };
  };
  metadata: {
    exportedBy: string;
    exportedAt: string;
    systemVersion: string;
    backupType: 'complete-database';
    totalRecords: number;
    collections: string[];
  };
}

interface IndividualBackupData {
  timestamp: string;
  version: string;
  serviceName: string;
  data: {
    collection: any[];
    count: number;
  };
  metadata: {
    exportedBy: string;
    exportedAt: string;
    systemVersion: string;
    backupType: 'individual-service';
  };
}

interface BackupData {
  timestamp: string;
  version: string;
  ccssConfig: {
    default?: any;
    collection?: any[];
  };
  metadata: {
    exportedBy: string;
    exportedAt: string;
    systemVersion: string;
  };
}

export default function CompleteBackupRestore() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [backupInfo, setBackupInfo] = useState<CompleteBackupData | IndividualBackupData | BackupData | null>(null);
  const [email, setEmail] = useState('');
  const [exportedBy, setExportedBy] = useState('');
  const [backupType, setBackupType] = useState<'complete' | 'individual'>('complete');

  const validateBackup = (backupData: unknown): { isValid: boolean; type: 'ccss' | 'complete' | 'individual' | 'unknown' } => {
    try {
      const data = backupData as any;
      
      // Check for individual service backup structure
      if (data &&
          typeof data.timestamp === 'string' &&
          typeof data.version === 'string' &&
          typeof data.serviceName === 'string' &&
          data.data &&
          Array.isArray(data.data.collection) &&
          typeof data.data.count === 'number' &&
          data.metadata &&
          typeof data.metadata.exportedBy === 'string' &&
          data.metadata.backupType === 'individual-service') {
        return { isValid: true, type: 'individual' };
      }
      
      // Check for complete backup structure
      if (data &&
          typeof data.timestamp === 'string' &&
          typeof data.version === 'string' &&
          data.data &&
          data.data.locations &&
          data.data.users &&
          data.data.schedules &&
          data.data.payrollRecords &&
          data.metadata &&
          typeof data.metadata.exportedBy === 'string' &&
          data.metadata.backupType === 'complete-database') {
        return { isValid: true, type: 'complete' };
      }
      
      // Check for CCSS backup structure (legacy)
      if (data &&
          typeof data.timestamp === 'string' &&
          typeof data.version === 'string' &&
          data.ccssConfig &&
          data.metadata &&
          typeof data.metadata.exportedBy === 'string') {
        return { isValid: true, type: 'ccss' };
      }
      
      return { isValid: false, type: 'unknown' };
    } catch {
      return { isValid: false, type: 'unknown' };
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        setMessage('Validando archivo...');
        setStatus('idle');
        
        const text = await file.text();
        const backupData = JSON.parse(text);
        
        const validation = validateBackup(backupData);
        
        if (validation.isValid) {
          setSelectedFile(file);
          setBackupInfo(backupData);
          setMessage(`✅ Archivo válido: Backup de tipo ${validation.type}`);
          setStatus('success');
        } else {
          setMessage('❌ Archivo inválido: No es un backup válido');
          setStatus('error');
          setSelectedFile(null);
          setBackupInfo(null);
        }
      } catch (error) {
        setMessage('❌ Error al leer el archivo: Formato JSON inválido');
        setStatus('error');
        setSelectedFile(null);
        setBackupInfo(null);
      }
    }
  };

  const handleGenerateBackup = async (action: 'download' | 'email') => {
    if (action === 'email' && !email.trim()) {
      setMessage('❌ Por favor ingresa un email válido');
      setStatus('error');
      return;
    }

    if (!exportedBy.trim()) {
      setMessage('❌ Por favor ingresa el nombre de quien exporta');
      setStatus('error');
      return;
    }

    setIsGenerating(true);
    setStatus('idle');
    setMessage(backupType === 'individual' ? 'Generando archivos individuales de backup...' : 'Generando backup completo de la base de datos...');

    try {
      const response = await fetch('/api/backup/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          exportedBy: exportedBy.trim(),
          action,
          email: action === 'email' ? email.trim() : undefined,
          backupType: backupType
        }),
      });

      const result = await response.json();

      if (result.success) {
        if (action === 'download') {
          if (backupType === 'individual' && result.backups) {
            // Download individual files
            const now = new Date();
            const dateStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}`;
            
            const services = ['locations', 'users', 'schedules', 'payrollRecords'];
            
            services.forEach((serviceName) => {
              const serviceData = result.backups[serviceName];
              const jsonString = JSON.stringify(serviceData, null, 2);
              const blob = new Blob([jsonString], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              
              const link = document.createElement('a');
              link.href = url;
              link.download = `${serviceName}_backup_${dateStr}.json`;
              link.style.display = 'none';
              document.body.appendChild(link);
              link.click();
              
              setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
              }, 100);
            });
            
            setMessage('✅ Archivos individuales descargados exitosamente');
          } else if (backupType === 'complete' && result.backup) {
            // Download single complete file
            const jsonString = JSON.stringify(result.backup, null, 2);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const now = new Date();
            const filename = `backup_completo_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.json`;
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            
            setMessage('✅ Backup completo descargado exitosamente');
          }
        } else {
          setMessage(result.message);
        }
        setStatus('success');
      } else {
        setMessage(result.error);
        setStatus('error');
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setStatus('error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedFile || !backupInfo) return;

    setIsRestoring(true);
    setStatus('idle');
    setMessage('Restaurando backup...');

    try {
      const response = await fetch('/api/backup/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          backupData: backupInfo
        }),
      });

      const result = await response.json();

      if (result.success) {
        setMessage(result.message);
        setStatus('success');
      } else {
        setMessage(result.error);
        setStatus('error');
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'Error desconocido'}`);
      setStatus('error');
    } finally {
      setIsRestoring(false);
    }
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <FileText className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'success':
        return 'text-green-600 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
      case 'error':
        return 'text-red-600 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      default:
        return 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Backup Generation Section */}
      <div className="space-y-6">
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-6">
          <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
            <Database className="w-5 h-5 mr-2 text-emerald-600" />
            Generar Backup
          </h4>

          {/* Backup Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[var(--foreground)] mb-3">
              Tipo de Backup:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--input-bg)] transition-colors">
                <input
                  type="radio"
                  name="backupType"
                  value="complete"
                  checked={backupType === 'complete'}
                  onChange={(e) => setBackupType(e.target.value as 'complete' | 'individual')}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-[var(--foreground)]">Archivo Único</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Un solo archivo JSON con todos los servicios</p>
                </div>
              </label>
              
              <label className="flex items-center p-3 border border-[var(--border)] rounded-lg cursor-pointer hover:bg-[var(--input-bg)] transition-colors">
                <input
                  type="radio"
                  name="backupType"
                  value="individual"
                  checked={backupType === 'individual'}
                  onChange={(e) => setBackupType(e.target.value as 'complete' | 'individual')}
                  className="mr-3"
                />
                <div>
                  <p className="font-medium text-[var(--foreground)]">Archivos Individuales</p>
                  <p className="text-xs text-[var(--muted-foreground)]">Un archivo JSON por cada servicio</p>
                </div>
              </label>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Exportado por:
              </label>
              <input
                type="text"
                value={exportedBy}
                onChange={(e) => setExportedBy(e.target.value)}
                placeholder="Nombre de la persona que exporta"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Email (opcional):
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => handleGenerateBackup('download')}
                disabled={isGenerating || !exportedBy.trim()}
                className="flex items-center justify-center px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200"
              >
                {isGenerating ? (
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? 'Generando...' : 'Descargar'}
              </button>

              <button
                onClick={() => handleGenerateBackup('email')}
                disabled={isGenerating || !exportedBy.trim() || !email.trim()}
                className="flex items-center justify-center px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200"
              >
                {isGenerating ? (
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4 mr-2" />
                )}
                {isGenerating ? 'Enviando...' : 'Enviar por Email'}
              </button>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg border flex items-start ${getStatusColor()}`}>
            {getStatusIcon()}
            <span className="ml-2 text-sm">{message}</span>
          </div>
        )}
      </div>

      {/* Restoration Section */}
      <div className="space-y-6">
        <div className="bg-[var(--background)] rounded-lg border border-[var(--border)] p-6">
          <h4 className="text-lg font-semibold text-[var(--foreground)] mb-4 flex items-center">
            <Upload className="w-5 h-5 mr-2 text-blue-600" />
            Restaurar Backup
          </h4>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--foreground)] mb-2">
                Seleccionar archivo de backup:
              </label>
              <input
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg bg-[var(--input-bg)] text-[var(--foreground)] file:mr-4 file:py-1 file:px-4 file:rounded-lg file:border-0 file:bg-emerald-600 file:text-white hover:file:bg-emerald-700"
              />
            </div>

            {backupInfo && (
              <div className="bg-[var(--input-bg)] rounded-lg p-4 border border-[var(--border)]">
                <h5 className="font-semibold text-[var(--foreground)] mb-2">Información del Backup:</h5>
                <div className="space-y-1 text-sm text-[var(--muted-foreground)]">
                  {'serviceName' in backupInfo ? (
                    <>
                      <p><strong>Servicio:</strong> {backupInfo.serviceName}</p>
                      <p><strong>Registros:</strong> {backupInfo.data.count}</p>
                    </>
                  ) : 'data' in backupInfo ? (
                    <>
                      <p><strong>Locations:</strong> {backupInfo.data.locations.count}</p>
                      <p><strong>Users:</strong> {backupInfo.data.users.count}</p>
                      <p><strong>Schedules:</strong> {backupInfo.data.schedules.count}</p>
                      <p><strong>Payroll Records:</strong> {backupInfo.data.payrollRecords.count}</p>
                      <p><strong>Total:</strong> {backupInfo.metadata.totalRecords}</p>
                    </>
                  ) : (
                    <p><strong>Tipo:</strong> CCSS Configuration</p>
                  )}
                  <p><strong>Exportado por:</strong> {backupInfo.metadata.exportedBy}</p>
                  <p><strong>Fecha:</strong> {new Date(backupInfo.metadata.exportedAt).toLocaleString()}</p>
                  <p><strong>Versión:</strong> {backupInfo.version}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleRestoreBackup}
              disabled={isRestoring || !selectedFile || !backupInfo}
              className="w-full flex items-center justify-center px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors duration-200"
            >
              {isRestoring ? (
                <Loader className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <HardDrive className="w-4 h-4 mr-2" />
              )}
              {isRestoring ? 'Restaurando...' : 'Restaurar Backup'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
