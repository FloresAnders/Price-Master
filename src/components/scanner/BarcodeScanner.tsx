"use client";
import React, { useRef, useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  Copy as CopyIcon,
  AlertCircle as AlertIcon,
  ScanBarcode,
  Lock as LockIcon,
  ArrowLeft as ArrowLeftIcon,
  Folder,
  Camera,
  X as CloseIcon,
  Minus as MinimizeIcon,
  Maximize2 as ExpandIcon,
} from "lucide-react";
import { useBarcodeScanner } from "../../hooks/useBarcodeScanner";
import type { BarcodeScannerProps } from "../../types/barcode";
import CameraScanner from "./CameraScanner";
import ImageDropArea from "./ImageDropArea";
import { useAuth } from "../../hooks/useAuth";
import { hasPermission } from "../../utils/permissions";

export default function BarcodeScanner({
  onDetect,
  onRemoveLeadingZero,
  children,
}: BarcodeScannerProps & {
  onRemoveLeadingZero?: (code: string) => void;
  children?: React.ReactNode;
}) {
  /* Verificar permisos del usuario */
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"image" | "camera">("image");

  const containerRef = useRef<HTMLDivElement | null>(null);

  const {
    code,
    error,
    imagePreview,
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
  } = useBarcodeScanner((detectedCode: string, productName?: string) => {
    onDetect?.(detectedCode, productName);
  });

  // Manejar pegar desde el portapapeles
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      // Evitar interferir con campos de texto activos (inputs/textareas/elementos editables)
      const active = document.activeElement as
        | (HTMLElement & { isContentEditable?: boolean })
        | null;
      if (active) {
        const tag = active.tagName;
        const isEditable =
          typeof active.isContentEditable === "boolean"
            ? active.isContentEditable
            : active.hasAttribute && active.hasAttribute("contenteditable");
        if (tag === "INPUT" || tag === "TEXTAREA" || isEditable) return;
      }

      const items = event.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") === 0) {
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
    };

    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [processImage]);

  const slideUp = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  };

  // Results stack: allow multiple detected results, each can be opened/minimized/closed
  type ScanResult = {
    id: string;
    code: string;
    imagePreview?: string | null;
    detectionMethod?: string | null;
    createdAt: number;
    open: boolean;
  };

  const STORAGE_KEY = "barcode-scanner-results";
  // Inicializar desde localStorage para persistir entre módulos y recargas
  const [results, setResults] = useState<ScanResult[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: ScanResult[] = JSON.parse(stored);
        // Asegurar que todos los resultados cargados comiencen cerrados (minimizados)
        return parsed.map((r) => ({ ...r, open: false }));
      }
    } catch (e) {
      console.warn("Error al leer resultados guardados:", e);
    }
    return [];
  });
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Persistir resultados en localStorage cada vez que cambien
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(results));
    } catch (e) {
      console.warn("Error al guardar resultados en localStorage:", e);
    }
  }, [results]);
  useEffect(() => {
    if (!code || error) return;

    const timeoutId = window.setTimeout(() => {
      const id = String(Date.now());
      const newResult: ScanResult = {
        id,
        code,
        imagePreview: imagePreview || null,
        detectionMethod: detectionMethod || null,
        createdAt: Date.now(),
        open: true,
      };
      setResults((prev) => [newResult, ...prev.map((r) => ({ ...r, open: false }))]);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [code, error, imagePreview, detectionMethod]);

  const openResult = (id: string) => setResults((prev) => prev.map((r) => ({ ...r, open: r.id === id })));
  const minimizeResult = (id: string) => setResults((prev) => prev.map((r) => (r.id === id ? { ...r, open: false } : r)));
  const closeResult = (id: string) =>
    setResults((prev) => {
      const closing = prev.find((r) => r.id === id);
      const next = prev.filter((r) => r.id !== id);
      if (closing && closing.open) {
        handleClear();
      }
      return next;
    });

  // Verificar si el usuario tiene permiso para usar el escáner
  if (!hasPermission(user?.permissions, "scanner")) {
    return (
      <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
        <div className="text-center">
          <LockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">Acceso Restringido</h3>
          <p className="text-neutral-400">No tienes permisos para acceder al Escáner de Códigos de Barras.</p>
          <p className="text-sm text-neutral-400 mt-2">Contacta a un administrador para obtener acceso.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full max-w-5xl mx-auto bg-[var(--card-bg)] rounded-2xl border border-[var(--input-border)] shadow-lg overflow-hidden"
      tabIndex={0}
    >
      {/* Header con título y botón PiP */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 border-b border-neutral-800 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center gap-2 flex-1">
            <ScanBarcode className="w-8 h-8 text-white" />
            <div className="text-center">
              <h2 className="text-xl font-bold text-white">
                Escáner de Códigos de Barras
              </h2>
              <p className="text-sm text-neutral-400">
                Sube imágenes o pégalas desde el portapapeles (Ctrl+V)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="p-6">
        {/* Tabs Navigation */}
        <div className="flex bg-neutral-800 rounded-lg p-1 mb-6">
          <button
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === "image"
                ? "bg-neutral-900 text-white shadow-sm border border-neutral-700"
                : "text-neutral-300 hover:text-white"
            }`}
            onClick={() => setActiveTab("image")}
          >
            <Folder className="w-4 h-4" />
            Imagen / Pegar
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-md font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
              activeTab === "camera"
                ? "bg-neutral-900 text-white shadow-sm border border-neutral-700"
                : "text-neutral-300 hover:text-white"
            }`}
            onClick={() => setActiveTab("camera")}
          >
            <Camera className="w-4 h-4" />
            Cámara
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "image" && (
          <div className="space-y-6">
            {/* Mensaje global de copiado removido: usamos confirmación en el botón */}

            {/* Resultado del escaneo: ahora en modal */}
            <AnimatePresence>
              {error && (
                <motion.div
                  key="error"
                  {...slideUp}
                  transition={{ duration: 0.3 }}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 shadow-sm"
                >
                  <div className="text-center space-y-2">
                    <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                      <AlertIcon className="w-5 h-5 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-md font-semibold text-red-700 dark:text-red-300">
                        Error en el Escaneado
                      </h3>
                      <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {(() => {
                const active = results.find((r) => r.open);
                if (!active) return null;
                return (
                  <motion.div
                    key={`active-modal-${active.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.12 }}
                    className="fixed inset-0 z-40"
                  >
                    <div
                      className="absolute inset-0 bg-black/30 backdrop-blur-sm"
                      onClick={() => minimizeResult(active.id)}
                    />

                    <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                      <motion.div
                        onClick={(e) => e.stopPropagation()}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.12 }}
                        className="w-full max-w-[640px] rounded-xl bg-neutral-900 text-white border border-neutral-800 shadow-xl overflow-hidden pointer-events-auto"
                      >
                        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-800">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center">
                              <ScanBarcode className="w-4 h-4 text-white" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">Código Detectado</div>
                              <div className="text-xs text-neutral-400">Resultado del escaneo</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              title="Minimizar"
                              onClick={() => minimizeResult(active.id)}
                              className="p-1 rounded hover:bg-neutral-800"
                            >
                              <MinimizeIcon className="w-4 h-4 text-neutral-300" />
                            </button>
                            <button
                              title="Cerrar"
                              onClick={() => closeResult(active.id)}
                              className="p-1 rounded hover:bg-neutral-800"
                            >
                              <CloseIcon className="w-4 h-4 text-neutral-300" />
                            </button>
                          </div>
                        </div>

                        <div className="p-6 space-y-4">
                          <div className="text-center">
                            <div className="font-mono text-2xl font-bold break-all">{active.code}</div>
                            {active.detectionMethod && (
                              <div className="mt-2">
                                <span className="inline-block px-2 py-1 bg-indigo-600 text-white text-xs font-medium rounded">
                                  Método: {active.detectionMethod}
                                </span>
                              </div>
                            )}
                          </div>

                          {active.imagePreview && (
                            <div className="mx-auto w-full max-w-sm">
                              <Image
                                src={active.imagePreview}
                                alt="Imagen escaneada"
                                width={600}
                                height={400}
                                className="w-full rounded-md object-contain border border-neutral-800"
                                unoptimized
                              />
                            </div>
                          )}

                          <div className="flex justify-center gap-3">
                            <div>
                              <button
                                onClick={async () => {
                                  try {
                                    await navigator.clipboard.writeText(active.code);
                                    setCopiedId(active.id);
                                    setTimeout(() => setCopiedId((id) => (id === active.id ? null : id)), 1400);
                                  } catch (e) {
                                    console.error("copy failed", e);
                                  }
                                }}
                                className={`px-4 py-2 ${copiedId === active.id ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'} text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2`}
                              >
                                <CopyIcon className="w-4 h-4" />
                                {copiedId === active.id ? "Copiado" : "Copiar"}
                              </button>
                            </div>

                            {active.code && active.code.length > 1 && active.code[0] === "0" && (
                              <button
                                onClick={() => {
                                  const newCode = active.code.slice(1);
                                  setResults((prev) => prev.map((r) => (r.id === active.id ? { ...r, code: newCode } : r)));
                                  onRemoveLeadingZero?.(newCode);
                                }}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                              >
                                <ArrowLeftIcon className="w-4 h-4" /> Quitar &quot;0&quot;
                              </button>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    </div>
                  </motion.div>
                );
              })()}
            </AnimatePresence>

            {/* Botón "Limpiar Todo" eliminado: limpieza manejada por cierre de modal */}

            {/* Área de Drag & Drop */}
            {/* Minimized stack above the Drop area */}
            {results.length > 0 && (
              <div className="flex flex-col gap-2 mb-4">
                {results
                  .filter((r) => !r.open)
                  .map((r) => (
                    <div
                      key={`min-${r.id}`}
                      className="flex items-center justify-between bg-neutral-800 text-white p-3 rounded-lg border border-neutral-700"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => openResult(r.id)}
                          title="Abrir resultado"
                          className="flex items-center gap-3 text-left focus:outline-none group"
                        >
                          <ExpandIcon className="w-5 h-5 text-neutral-300 group-hover:text-white" />
                          <div className="font-mono font-bold truncate max-w-xs group-hover:text-white">{r.code}</div>
                          {r.detectionMethod && (
                            <span className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">{r.detectionMethod}</span>
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(r.code);
                              setCopiedId(r.id);
                              setTimeout(() => setCopiedId((id) => (id === r.id ? null : id)), 1400);
                            } catch (e) {
                              console.error("copy failed", e);
                            }
                          }}
                          title="Copiar"
                          className={`flex items-center gap-2 px-3 py-1 rounded text-sm transition-colors duration-150 ${
                            copiedId === r.id ? "bg-emerald-600 text-white" : "bg-indigo-600 text-white hover:bg-indigo-700"
                          }`}
                        >
                          <CopyIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">{copiedId === r.id ? "Copiado" : "Copiar"}</span>
                        </button>

                        <button
                          onClick={() => closeResult(r.id)}
                          title="Cerrar"
                          className="flex items-center gap-2 px-3 py-1 bg-rose-600 rounded hover:bg-rose-500 text-sm text-white shadow-sm"
                        >
                          <CloseIcon className="w-4 h-4" />
                          <span className="hidden sm:inline">Cerrar</span>
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

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
        {activeTab === "camera" && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center mx-auto mb-3">
                <ScanBarcode className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Escáner con Cámara</h3>
              <p className="text-neutral-400 text-sm">Utiliza la cámara de tu dispositivo para escanear códigos</p>
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
