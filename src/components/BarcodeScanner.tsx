'use client';
import React, { useCallback, useRef, useEffect, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check as CheckIcon,
  Copy as CopyIcon,
  Trash as TrashIcon,
  AlertCircle as AlertIcon, 
  ScanBarcode,
  Lock as LockIcon,
  ArrowLeft as ArrowLeftIcon,
  Folder,
  Camera,
} from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { BarcodeScannerProps } from '../types/barcode';
import CameraScanner from './CameraScanner';
import ImageDropArea from './ImageDropArea';
import { useAuth } from '../hooks/useAuth';
import { hasPermission } from '../utils/permissions';
import { PictureInPicture } from './PictureInPicture';

export default function BarcodeScanner({ onDetect, onRemoveLeadingZero, children }: BarcodeScannerProps & { onRemoveLeadingZero?: (code: string) => void; children?: React.ReactNode }) {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<'image' | 'camera'>('image');

  // Picture-in-Picture state
  const [isPiPOpen, setIsPiPOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    code,
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
    setCode,
    processImage,
  } = useBarcodeScanner((detectedCode: string, productName?: string) => {
    onDetect?.(detectedCode, productName);
  });

  // Manejar pegar desde el portapapeles
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      
      const items = event.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') === 0) {
            const blob = item.getAsFile();
            if (blob) {
              const reader = new FileReader();
              reader.onload = (e) => {
                const dataURL = e.target?.result as string;
                processImage(dataURL);
              };
              reader.readAsDataURL(blob);
              event.preventDefault();
              break;
            }
          }
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => {
      document.removeEventListener('paste', handlePaste);
    };
  }, [processImage]);

  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } };
  const slideUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  // Handlers for PiP
  const handlePiPToggle = useCallback(() => {
    // Si la ventana se está cerrando (desde el PiP), solo actualizar el estado
    setIsPiPOpen(prev => !prev);
  }, []);

  const handlePiPProcessImage = useCallback((imageData: string) => {
    processImage(imageData);
  }, [processImage]);

  const handlePiPRemoveLeadingZero = useCallback((newCode: string) => {
    setCode(newCode);
    onRemoveLeadingZero?.(newCode);
  }, [setCode, onRemoveLeadingZero]);

  // Verificar si el usuario tiene permiso para usar el escáner
  if (!hasPermission(user?.permissions, 'scanner')) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
            Acceso Restringido
          </h3>
          <p className="text-[var(--muted-foreground)]">
            No tienes permisos para acceder al Escáner de Códigos de Barras.
          </p>
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            Contacta a un administrador para obtener acceso.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-4xl mx-auto bg-[var(--card-bg)] rounded-2xl border border-[var(--input-border)] shadow-lg overflow-hidden"
      tabIndex={0}
    >
      {/* Header con título y botón PiP */}
      <div className="bg-[var(--muted)] border-b border-[var(--input-border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 flex-1">
            <ScanBarcode className="w-8 h-8 text-[var(--foreground)]" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-[var(--foreground)]">Escáner de Códigos de Barras</h2>
              <p className="text-sm text-[var(--muted-foreground)]">Sube imágenes o pégalas desde el portapapeles (Ctrl+V)</p>
            </div>
          </div>
          <div className="ml-4">
            <PictureInPicture
              isOpen={isPiPOpen}
              code={code}
              onToggle={handlePiPToggle}
              onProcessImage={handlePiPProcessImage}
              onRemoveLeadingZero={handlePiPRemoveLeadingZero}
            />
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-6">
        {/* Tabs Navigation */}
        <div className="flex bg-[var(--muted)] rounded-lg p-1 mb-6">
          <button
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'image'
                ? 'bg-[var(--card-bg)] text-[var(--tab-text-active)] shadow-sm border border-[var(--input-border)]'
                : 'text-[var(--tab-text)] hover:text-[var(--tab-hover-text)]'
            }`}
            onClick={() => setActiveTab('image')}
          >
            <Folder className="w-4 h-4" />
            Imagen / Pegar
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === 'camera'
                ? 'bg-[var(--card-bg)] text-[var(--tab-text-active)] shadow-sm border border-[var(--input-border)]'
                : 'text-[var(--tab-text)] hover:text-[var(--tab-hover-text)]'
            }`}
            onClick={() => setActiveTab('camera')}
          >
            <Camera className="w-4 h-4" />
            Cámara
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'image' && (
          <div className="space-y-6">
            {/* Mensaje de "Código copiado" */}
            <AnimatePresence>
              {copySuccess && (
                <motion.div
                  {...fadeIn}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex justify-center"
                >
                  <div className="bg-green-600 border border-green-500 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2">
                    <CheckIcon className="w-4 h-4" />
                    ¡Código copiado al portapapeles!
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Resultado del escaneo */}
            <AnimatePresence>
              {(code || error) && (
                <motion.div 
                  key="result" 
                  {...slideUp} 
                  transition={{ duration: 0.4, type: "spring", bounce: 0.2 }}
                  className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6 shadow-sm"
                >
                  {error && (
                    <div className="text-center space-y-3">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                        <AlertIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-1">Error en el Escaneado</h3>
                        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
                      </div>
                    </div>
                  )}
                  
                  {code && !error && (
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="w-12 h-12 bg-[var(--badge-bg)] rounded-full flex items-center justify-center mx-auto mb-3">
                          <ScanBarcode className="w-6 h-6 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-3">¡Código Detectado!</h3>
                        
                        {/* Código detectado */}
                        <div className="bg-[var(--muted)] border border-[var(--input-border)] rounded-lg p-4 mb-4">
                          <div className="font-mono text-2xl font-bold text-[var(--foreground)] break-all">
                            {code}
                          </div>
                          {detectionMethod && (
                            <div className="mt-2">
                              <span className="inline-block px-2 py-1 bg-[var(--badge-bg)] text-white text-xs font-medium rounded">
                                Método: {detectionMethod}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Imagen escaneada preview */}
                        {imagePreview && (
                          <div className="mb-4">
                            <Image 
                              src={imagePreview} 
                              alt="Imagen escaneada" 
                              width={300}
                              height={200}
                              className="max-w-sm mx-auto rounded-lg border border-[var(--input-border)] shadow-sm object-contain"
                              unoptimized
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Botones de acción */}
                      <div className="flex justify-center gap-3">
                        <button
                          onClick={handleCopyCode}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                        >
                          <CopyIcon className="w-4 h-4" />
                          Copiar
                        </button>
                        {code && code.length > 1 && code[0] === '0' && (
                            <button
                            onClick={() => {
                              const newCode = code.slice(1);
                              setCode(newCode);
                              onRemoveLeadingZero?.(newCode);
                            }}
                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                            >
                            <ArrowLeftIcon className="w-4 h-4" />
                            Quitar &quot;0&quot;
                            </button>
                        )}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón Limpiar Todo */}
            <AnimatePresence>
              {(code || error || imagePreview) && (
                <motion.div 
                  key="clear" 
                  {...slideUp} 
                  transition={{ duration: 0.4 }} 
                  className="flex justify-center"
                >
                  <button
                    onClick={handleClear}
                    className="px-4 py-2 bg-rose-200 hover:bg-rose-300 text-rose-800 border border-rose-300 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                  >
                    <TrashIcon className="w-4 h-4" />
                    Limpiar Todo
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Área de Drag & Drop */}
            <div className="mt-6">
              <ImageDropArea
                onFileUpload={handleFileUpload}
                onDrop={handleDrop}
                onFileSelect={handleDropAreaClick}
                fileInputRef={fileInputRef}
              />
            </div>
          </div>
        )}

        {/* Tab de Cámara */}
        {activeTab === 'camera' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-[var(--badge-bg)] rounded-full flex items-center justify-center mx-auto mb-3">
                <ScanBarcode className="w-6 h-6 text-[var(--badge-text)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Escáner con Cámara</h3>
              <p className="text-[var(--muted-foreground)] text-sm">Utiliza la cámara de tu dispositivo para escanear códigos</p>
            </div>
            
            <CameraScanner
              code={code}
              error={error}
              detectionMethod={detectionMethod}
              cameraActive={cameraActive}
              liveStreamRef={liveStreamRef}
              toggleCamera={toggleCamera}
              handleClear={handleClear}
              handleCopyCode={handleCopyCode}
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}
