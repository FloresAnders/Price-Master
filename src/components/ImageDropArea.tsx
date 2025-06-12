'use client';
import React from 'react';
import { ImagePlus as ImagePlusIcon } from 'lucide-react';

interface ImageDropAreaProps {
    onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    onFileSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ImageDropArea({ onDrop, onFileSelect, fileInputRef, onFileUpload }: ImageDropAreaProps) {
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.currentTarget.classList.add('bg-indigo-50', 'dark:bg-indigo-900');
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.currentTarget.classList.remove('bg-indigo-50', 'dark:bg-indigo-900');
    };

    return (
        <div>
            <label className="block text-base font-semibold mx-auto text-center w-fit mb-2 text-indigo-700 dark:text-indigo-200 tracking-wide">
                Seleccionar imagen
            </label>
            <div
                className="relative border-4 border-dashed rounded-3xl p-10 transition-colors duration-300 cursor-pointer hover:border-indigo-500 bg-white dark:bg-zinc-900/70 border-indigo-200 dark:border-indigo-800 shadow-xl group" onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={onDrop}
                onClick={onFileSelect}
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
                        onChange={onFileUpload}
                    />
                </div>
            </div>
        </div>
    );
}
