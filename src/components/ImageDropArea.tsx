'use client';
import React, { useState, useEffect } from 'react';
import { ImagePlus as ImagePlusIcon, Clipboard } from 'lucide-react';

interface ImageDropAreaProps {
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onFileSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ImageDropArea({ onDrop, onFileSelect, fileInputRef, onFileUpload }: ImageDropAreaProps) {
    const [recentPaste, setRecentPaste] = useState(false);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-indigo-50', 'dark:bg-indigo-900');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-indigo-50', 'dark:bg-indigo-900');
    };

    // Escuchar eventos de pegado para mostrar indicador visual
    useEffect(() => {
        const handlePasteIndicator = (event: ClipboardEvent) => {
            if (event.clipboardData && event.clipboardData.items) {
                for (let i = 0; i < event.clipboardData.items.length; i++) {
                    const item = event.clipboardData.items[i];
                    if (item.type.startsWith('image/')) {
                        setRecentPaste(true);
                        setTimeout(() => setRecentPaste(false), 2000);
                        break;
                    }
                }
            }
        };
        
        window.addEventListener('paste', handlePasteIndicator);
        return () => window.removeEventListener('paste', handlePasteIndicator);
    }, []);

    return (
        <div>
            <label className="block text-base font-semibold mx-auto text-center w-fit mb-2 text-indigo-700 dark:text-indigo-200 tracking-wide">
                Seleccionar imagen
            </label>
            <div
                className={`relative border-4 border-dashed rounded-3xl p-10 transition-all duration-300 cursor-pointer hover:border-indigo-500 bg-white dark:bg-zinc-900/70 shadow-xl group ${
                    recentPaste 
                        ? 'border-green-400 bg-green-50 dark:bg-green-900/20 ring-2 ring-green-400/50' 
                        : 'border-indigo-200 dark:border-indigo-800'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={onDrop}
                onClick={onFileSelect}
                tabIndex={0}
            >
                {recentPaste && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-green-500 text-white text-xs rounded-full animate-pulse">
                        <Clipboard className="w-3 h-3" />
                        <span>¡Pegado!</span>
                    </div>
                )}
                
                <div className="flex flex-col items-center gap-5 text-indigo-400 dark:text-indigo-300 pointer-events-none">
                    <ImagePlusIcon className="w-20 h-20 group-hover:scale-110 transition-transform duration-300" />
                    <p className="text-xl font-bold">Arrastra una imagen aquí</p>
                    <p className="text-base">o haz clic para seleccionar archivo</p>                    <div className="flex flex-col items-center gap-2 mt-2">
                        <p className="text-sm text-indigo-500 dark:text-indigo-400 font-medium">
                            💡 También puedes usar <kbd className="px-2 py-1 bg-indigo-100 dark:bg-indigo-800 rounded text-xs font-mono">Ctrl+V</kbd> repetidamente
                        </p>
                        <p className="text-xs text-indigo-400 dark:text-indigo-500">
                            Pega múltiples imágenes del portapapeles de forma continua
                        </p>
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                            ⚡ Análisis inmediato - Sin esperas ni retrasos
                        </p>
                    </div>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={onFileUpload}
                    />
                </div>
            </div>
        </div>
    );
}
