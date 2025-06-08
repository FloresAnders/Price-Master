'use client';
import React from 'react';
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

export default function BarcodeScanner({ onDetect }: BarcodeScannerProps) {
  const {
    code,
    isLoading,
    error,
    imagePreview,
    copySuccess,
    detectionMethod,
    cameraActive,
    imgRef,
    fileInputRef,
    liveStreamRef,
    handleFileUpload,
    handleDrop,
    handleDropAreaClick,
    handleClear,
    handleCopyCode,
    toggleCamera,
  } = useBarcodeScanner(onDetect);

  const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } };
  const slideUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col gap-8 p-8 rounded-2xl shadow-2xl transition-colors duration-500 bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--input-border)]">
      {/* Encabezado y botón toggle Cámara */}
      <motion.div {...slideUp} transition={{ duration: 0.5 }} className="text-center flex flex-col items-center gap-3">
        <div className="p-4 rounded-full bg-gradient-to-tr from-indigo-500 to-blue-400 text-white shadow-xl">
          <ScanBarcode className="w-10 h-10 animate-pulse" />
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Pega una imagen (Ctrl+V), sube un archivo o usa la cámara
        </p>
        <button
          onClick={toggleCamera}
          className={`px-5 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300 flex items-center gap-2 font-semibold shadow-md
            ${cameraActive ? 'bg-gradient-to-r from-pink-500 to-indigo-500 text-white' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-indigo-100 dark:hover:bg-indigo-900'}`}
        >
          {cameraActive ? (
            <>
              <RefreshIcon className="w-5 h-5 animate-spin" />
              Detener Cámara
            </>
          ) : (
            <>
              <CameraIcon className="w-5 h-5" />
              Iniciar Cámara
            </>
          )}
        </button>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
          Métodos de detección: <span className="font-semibold">ZBar‑WASM → Quagga 2 → Básica</span>
        </p>
      </motion.div>

      {/* Mensaje de “Código copiado” */}
      <AnimatePresence>
        {copySuccess && (
          <motion.div
            {...fadeIn}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="fixed top-6 right-6 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-2 bg-green-500 text-white font-semibold animate-bounce"
          >
            <CheckIcon className="w-5 h-5" />
            <span>¡Código copiado automáticamente!</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mostrar código detectado */}
      <motion.div {...slideUp} transition={{ duration: 0.5 }} className="mb-4 text-center">
        <label className="block text-sm font-medium mx-auto text-center w-fit mb-2 text-zinc-700 dark:text-zinc-200">
          Código detectado:
        </label>
        <div className="flex gap-2 justify-center">
          <input
            type="text"
            value={code}
            readOnly
            placeholder="Aquí aparecerá el código escaneado"
            className="flex-1 max-w-md px-3 py-2 text-center rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-100 font-mono text-lg shadow-sm"
          />
          {code && (
            <button
              onClick={handleCopyCode}
              className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300 flex items-center gap-1 bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow"
            >
              <CopyIcon className="w-4 h-4" />
              Copiar
            </button>
          )}
        </div>
        {detectionMethod && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            Detectado usando: <span className="font-semibold">{detectionMethod}</span>
          </p>
        )}
      </motion.div>

      {/* Contenedor de cámara (solo si cameraActive===true) */}
      <AnimatePresence>
        {cameraActive && (
          <motion.div
            key="camera"
            {...slideUp}
            transition={{ duration: 0.5 }}
            ref={liveStreamRef}
            className="w-full h-72 bg-black rounded-xl overflow-hidden mb-4 relative border-4 border-indigo-500 shadow-lg"
          >
            <div className="absolute inset-0 pointer-events-none">
              <motion.div
                className="absolute inset-0 bg-black bg-opacity-30"
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-4/5 h-16 border-2 border-dashed border-indigo-300 rounded-lg" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Área de carga de imagen (solo si cameraActive===false) */}
      {!cameraActive && (
        <motion.div {...slideUp} transition={{ duration: 0.5 }}>
          <label className="block text-sm font-medium mx-auto text-center w-fit mb-2 text-zinc-700 dark:text-zinc-200">
            Seleccionar imagen:
          </label>
          <div
            className="relative border-2 border-dashed rounded-xl p-8 transition-colors duration-300 cursor-pointer hover:border-indigo-500 bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700"
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('bg-indigo-50', 'dark:bg-indigo-900'); }}
            onDragLeave={(e) => { e.currentTarget.classList.remove('bg-indigo-50', 'dark:bg-indigo-900'); }}
            onDrop={handleDrop}
            onClick={handleDropAreaClick}
          >
            <div className="flex flex-col items-center gap-4 text-zinc-400 dark:text-zinc-500 pointer-events-none">
              <ImagePlusIcon className="w-14 h-14" />
              <p className="text-lg font-semibold">Arrastra una imagen aquí</p>
              <p className="text-sm">o haz clic para seleccionar archivo</p>
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
      )}

      {/* Botón “Limpiar Todo” */}
      <AnimatePresence>
        {(code || error || imagePreview || cameraActive) && (
          <motion.div
            key="clear"
            {...slideUp}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <button
              onClick={handleClear}
              className="px-6 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors duration-300 bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100 hover:bg-red-500 hover:text-white font-semibold shadow"
            >
              <TrashIcon className="w-5 h-5 inline-block mr-1" />
              Limpiar Todo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spinner mientras procesa imagen (solo en modo imagen) */}
      <AnimatePresence>
        {!cameraActive && isLoading && (
          <motion.div
            key="spinner"
            {...fadeIn}
            transition={{ duration: 0.3 }}
            className="text-center p-4 rounded-xl flex items-center justify-center gap-3 bg-zinc-100 dark:bg-zinc-800 text-indigo-600 dark:text-indigo-300 shadow"
          >
            <LoaderIcon className="w-7 h-7 animate-spin" />
            <p className="font-semibold">Procesando imagen...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensaje de error (imagen o cámara) */}
      <AnimatePresence>
        {error && (
          <motion.div
            key="error"
            {...fadeIn}
            transition={{ duration: 0.3 }}
            className="text-center text-red-600 bg-red-100 dark:bg-red-900 p-4 rounded-xl flex flex-col items-center gap-2 border border-red-200 dark:border-red-800 shadow"
          >
            <AlertIcon className="w-6 h-6" />
            <p className="text-sm font-semibold">{error}</p>
            <button
              onClick={handleClear}
              className="mt-2 text-xs bg-red-200 dark:bg-red-800 hover:bg-red-300 dark:hover:bg-red-700 px-3 py-1 rounded transition-colors duration-300 font-semibold"
            >
              Intentar de nuevo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vista previa de la imagen estática cargada o snapshot de cámara */}
      <AnimatePresence>
        {!cameraActive && imagePreview && (
          <motion.div
            key="preview"
            {...slideUp}
            transition={{ duration: 0.5 }}
            className="border rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 shadow"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={imagePreview}
              alt="Preview"
              className="w-full max-h-60 object-contain transition-opacity duration-500"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mensaje de éxito de detección (solo modo imagen) */}
      <AnimatePresence>
        {!cameraActive && code && !isLoading && (
          <motion.div
            key="success"
            {...slideUp}
            transition={{ duration: 0.5 }}
            className="text-center p-4 rounded-xl flex flex-col items-center gap-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 shadow"
          >
            <div className="flex items-center justify-center gap-2">
              <CheckIcon className="w-5 h-5" />
              <p className="text-sm font-semibold">
                ¡Código detectado y copiado!
              </p>
            </div>
            <p className="text-xs">
              Código: <span className="font-mono bg-white dark:bg-zinc-800 px-2 rounded-lg shadow text-zinc-800 dark:text-zinc-100">{code}</span>
            </p>
            <p className="text-xs">
              Método: <span className="font-semibold">{detectionMethod}</span>
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
