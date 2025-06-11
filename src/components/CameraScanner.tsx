'use client';
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Camera as CameraIcon,
    RefreshCw as RefreshIcon,
    Check as CheckIcon,
    Copy as CopyIcon,
    Trash as TrashIcon,
    AlertCircle as AlertIcon,
} from 'lucide-react';

interface CameraScannerProps {
    code: string | null;
    error: string | null;
    detectionMethod: string | null;
    cameraActive: boolean;
    liveStreamRef: React.RefObject<HTMLDivElement | null>;
    toggleCamera: () => void;
    handleClear: () => void;
    handleCopyCode: () => void;
    onRemoveLeadingZero?: () => void;
}

export default function CameraScanner({
    code,
    error,
    detectionMethod,
    cameraActive,
    liveStreamRef,
    toggleCamera,
    handleClear,
    handleCopyCode,
    onRemoveLeadingZero,
}: CameraScannerProps) {
    const [cameraVideoReady, setCameraVideoReady] = useState(false);

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

    const slideUp = { initial: { opacity: 0, y: 20 }, animate: { opacity: 1, y: 0 } };
    const fadeIn = { initial: { opacity: 0 }, animate: { opacity: 1 } };

    return (
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
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
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
                {code && (
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
                                            onClick={onRemoveLeadingZero}
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
    );
}
