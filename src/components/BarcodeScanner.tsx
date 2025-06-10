'use client';
import React, { useCallback, useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Camera as CameraIcon,
  RefreshCw as RefreshIcon,
  Check as CheckIcon,
  Copy as CopyIcon,
  Trash as TrashIcon,
  AlertCircle as AlertIcon,
  ScanBarcode,
  Loader2 as LoaderIcon,
  ImagePlus as ImagePlusIcon,
} from 'lucide-react';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import type { BarcodeScannerProps } from '../types/barcode';

export default function BarcodeScanner({ onDetect, onRemoveLeadingZero, children }: BarcodeScannerProps & { onRemoveLeadingZero?: (code: string) => void; children?: React.ReactNode }) {
  const [activeTab, setActiveTab] = useState<'image' | 'camera'>('image');
  const {
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
    setCode,
  } = useBarcodeScanner(onDetect);
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraVideoReady, setCameraVideoReady] = useState(false);

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
  }, [processImage]);

  // Handler para eliminar primer dígito del código escaneado principal
  const handleRemoveLeadingZeroMain = useCallback(() => {
    if (code && code.length > 1 && code[0] === '0') {
      setCode(code.slice(1)); // update overlay code immediately
      onRemoveLeadingZero?.(code);
    }
  }, [code, setCode, onRemoveLeadingZero]);

  // Effect to detect when video stream is ready
  useEffect(() => {
    let interval: number;
    if (cameraActive) {
      setCameraVideoReady(false);
      interval = window.setInterval(() => {
        const video = liveStreamRef.current?.querySelector('video');
        if (video && video.readyState >= 3) {
          setCameraVideoReady(true);
          clearInterval(interval);
        }
      }, 200);
    } else {
      setCameraVideoReady(false);
    }
    return () => clearInterval(interval);
  }, [cameraActive, liveStreamRef]);

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
          className={`px-6 py-2 rounded-r-xl font-bold text-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-900 ${activeTab === 'camera' ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white/80 dark:bg-zinc-900/80 text-indigo-700 dark:text-indigo-200 border border-indigo-200 dark:border-indigo-800'}`}
          onClick={() => setActiveTab('camera')}
        >
          Cámara
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
          </AnimatePresence>
          {/* Área de carga de imagen */}
          <motion.div {...slideUp} transition={{ duration: 0.5 }}>
            <label className="block text-base font-semibold mx-auto text-center w-fit mb-2 text-indigo-700 dark:text-indigo-200 tracking-wide">
              Seleccionar imagen
            </label>
            <div
              className="relative border-4 border-dashed rounded-3xl p-10 transition-colors duration-300 cursor-pointer hover:border-indigo-500 bg-white dark:bg-zinc-900/70 border-indigo-200 dark:border-indigo-800 shadow-xl group"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-indigo-50', 'dark:bg-indigo-900'); }}
              onDragLeave={(e) => { e.currentTarget.classList.remove('bg-indigo-50', 'dark:bg-indigo-900'); }}
              onDrop={handleDrop}
              onClick={handleDropAreaClick}
              tabIndex={0}
            >
              <div className="flex flex-col items-center gap-5 text-indigo-400 dark:text-indigo-300 pointer-events-none">
                <ImagePlusIcon className="w-20 h-20 group-hover:scale-110 transition-transform duration-300" />
                <p className="text-xl font-bold">Arrastra una imagen aquí</p>
                <p className="text-base">o haz clic para seleccionar archivo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
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
      )}
      {activeTab === 'camera' && (
        <div>
          {/* Botón para iniciar/detener cámara */}
          <div className="flex flex-col items-center gap-4 mb-6">
            <button
              onClick={toggleCamera}
              className={`px-6 py-3 rounded-xl focus:outline-none focus:ring-4 focus:ring-indigo-300 dark:focus:ring-indigo-900 transition-all duration-300 flex items-center gap-3 font-bold shadow-lg text-lg
                ${cameraActive ? 'bg-gradient-to-r from-pink-500 to-indigo-500 text-white scale-105 ring-2 ring-pink-300 dark:ring-pink-800' : 'bg-white dark:bg-[var(--card-bg)] text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-zinc-700 border border-[var(--input-border)]'}`}
            >
              {cameraActive ? (
                <>
                  <RefreshIcon className="w-6 h-6 animate-spin" />
                  Detener Cámara
                </>
              ) : (
                <>
                  <CameraIcon className="w-6 h-6" />
                  Iniciar Cámara
                </>
              )}
            </button>
            <p className="text-xs text-indigo-500 dark:text-indigo-300 font-semibold tracking-wide">
              Escaneo en vivo usando la cámara
            </p>
          </div>
          {/* Contenedor de cámara */}
          <AnimatePresence>
            {cameraActive && (
              <motion.div
                key="camera"
                {...slideUp}
                transition={{ duration: 0.5 }}
                ref={liveStreamRef}
                className="w-full h-80 bg-[var(--card-bg)] dark:bg-[var(--card-bg)] rounded-3xl overflow-hidden mb-6 relative border-4 border-[var(--input-border)] shadow-2xl flex items-center justify-center"
              >
                {/* Pulsing overlay until video is ready */}
                {!cameraVideoReady && (
                  <motion.div
                    className="absolute inset-0 bg-transparent dark:bg-black/40"
                    animate={{ opacity: [0.4, 0.6, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}

                {/* Guide rectangle always visible */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-4/5 h-20 border-4 border-dashed border-indigo-200 dark:border-indigo-300 rounded-2xl shadow-xl animate-pulse-slow" />
                </div>

                {/* Error message overlay if any */}
                {error && (
                  <div className="absolute inset-0 flex items-center justify-center z-30">
                    <span className="text-red-600 bg-white/90 px-4 py-2 rounded-xl shadow font-bold">{error}</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Código detectado por cámara */}
          <AnimatePresence>
            {code && cameraActive && (
              <motion.div {...slideUp} transition={{ duration: 0.5 }} className="mb-2 flex justify-center w-full items-center">
                <div className="w-full max-w-md relative rounded-2xl shadow-xl overflow-hidden border-2 border-indigo-400 dark:border-indigo-700 bg-white/80 dark:bg-transparent min-h-[120px] flex items-center justify-center">
                  <div className="absolute inset-0 bg-black/40 dark:bg-black/60 z-10" />
                  <div className="absolute inset-0 z-20 flex flex-col items-center justify-center">
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
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Botón limpiar solo para cámara */}
          <AnimatePresence>
            {(code || error) && cameraActive && (
              <motion.div key="clear-cam" {...slideUp} transition={{ duration: 0.5 }} className="flex justify-center mb-6">
                <button
                  onClick={handleClear}
                  className="px-7 py-3 text-base rounded-xl focus:outline-none focus:ring-2 focus:ring-red-400 transition-colors duration-300 bg-gradient-to-r from-zinc-200 to-red-200 dark:from-zinc-800 dark:to-red-900 text-zinc-800 dark:text-zinc-100 hover:bg-red-500 hover:text-white font-bold shadow-lg"
                >
                  <TrashIcon className="w-5 h-5 inline-block mr-2" />
                  Limpiar Todo
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {/* Mensaje de error para cámara */}
          <AnimatePresence>
            {error && cameraActive && (
              <motion.div
                key="error-cam"
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
      )}
      {children}
    </div>
  );
}
