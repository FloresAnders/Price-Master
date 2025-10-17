'use client';
import React, { useEffect, useState } from 'react';
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
        e.currentTarget.style.backgroundColor = 'var(--muted)';
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.style.backgroundColor = '';
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
            <label className="block text-base font-semibold mx-auto text-center w-fit mb-2 text-[var(--primary)] tracking-wide">
                Seleccionar imagen
            </label>
            <div
                className={`relative border-4 border-dashed rounded-3xl p-10 transition-all duration-300 cursor-pointer hover:border-[var(--primary)] bg-[var(--background)] dark:bg-zinc-900/70 shadow-xl group ${recentPaste
                    ? 'border-[var(--success)] bg-[var(--muted)] ring-2 ring-[var(--success)]/50'
                    : 'border-[var(--border)]'
                    }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={onDrop}
                onClick={onFileSelect}
                tabIndex={0}
            >
                {recentPaste && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-[var(--success)] text-white text-xs rounded-full animate-pulse">
                        <Clipboard className="w-3 h-3" />
                        <span>¡Pegado!</span>
                    </div>
                )}

                <div className="flex flex-col items-center gap-5 text-[var(--primary)] pointer-events-none">
                    <ImagePlusIcon className="w-20 h-20 group-hover:scale-110 transition-transform duration-300" />
                    <p className="text-xl font-bold">Arrastra una imagen aquí</p>
                    <p className="text-base">o haz clic para seleccionar archivo</p>
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
