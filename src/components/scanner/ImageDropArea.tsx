"use client";
import React, { useEffect, useState } from "react";
import { ImagePlus as ImagePlusIcon, Clipboard } from "lucide-react";

interface ImageDropAreaProps {
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onFileSelect: (event: React.MouseEvent<HTMLDivElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function ImageDropArea({
  onDrop,
  onFileSelect,
  fileInputRef,
  onFileUpload,
}: ImageDropAreaProps) {
  const [recentPaste, setRecentPaste] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    setDragActive(false);
  };

  const handleDropInternal = (e: React.DragEvent<HTMLDivElement>) => {
    setDragActive(false);
    onDrop(e);
  };

  // Escuchar eventos de pegado para mostrar indicador visual
  useEffect(() => {
    const handlePasteIndicator = (event: ClipboardEvent) => {
      if (event.clipboardData && event.clipboardData.items) {
        for (let i = 0; i < event.clipboardData.items.length; i++) {
          const item = event.clipboardData.items[i];
          if (item.type.startsWith("image/")) {
            setRecentPaste(true);
            setTimeout(() => setRecentPaste(false), 2000);
            break;
          }
        }
      }
    };

    window.addEventListener("paste", handlePasteIndicator);
    return () => window.removeEventListener("paste", handlePasteIndicator);
  }, []);

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold mx-auto text-center w-fit mb-3 text-cyan-300/90 tracking-[0.16em] uppercase">
        Seleccionar imagen
      </label>
      <div
        className={`relative w-full min-h-[360px] border border-dashed rounded-[28px] px-6 py-8 md:px-10 md:py-12 transition-all duration-300 cursor-pointer overflow-hidden group shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur-sm ${
          dragActive
            ? "border-cyan-400 bg-[linear-gradient(180deg,rgba(14,37,64,0.98)_0%,rgba(6,10,22,0.98)_100%)] ring-2 ring-cyan-400/40"
            : recentPaste
              ? "border-emerald-400/80 bg-[linear-gradient(180deg,rgba(9,44,48,0.95)_0%,rgba(6,10,22,0.98)_100%)] ring-2 ring-emerald-400/35"
              : "border-slate-600/70 bg-[linear-gradient(180deg,rgba(14,20,38,0.96)_0%,rgba(9,12,22,0.98)_100%)] hover:border-cyan-300/70"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDropInternal}
        onClick={onFileSelect}
        tabIndex={0}
      >
        {recentPaste && (
          <div className="absolute top-4 right-4 flex items-center gap-1 px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-full shadow-lg animate-pulse">
            <Clipboard className="w-3 h-3" />
            <span>¡Pegado!</span>
          </div>
        )}

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-x-8 top-8 h-px bg-gradient-to-r from-transparent via-cyan-500/30 to-transparent" />
          <div className="absolute -left-16 top-10 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl" />
          <div className="absolute -right-12 bottom-6 h-52 w-52 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative flex min-h-[300px] flex-col items-center justify-center gap-5 text-cyan-200 pointer-events-none text-center">
          <div className="rounded-full border border-cyan-400/25 bg-cyan-400/10 p-5 shadow-[0_0_40px_rgba(34,211,238,0.12)] transition-transform duration-300 group-hover:scale-105">
            <ImagePlusIcon className="w-16 h-16 md:w-20 md:h-20 text-cyan-300" />
          </div>
          <div className="space-y-2 max-w-md">
            <p className="text-2xl md:text-3xl font-bold tracking-tight text-white">Arrastra una imagen aquí</p>
            <p className="text-sm md:text-base text-slate-300">o haz clic para seleccionar archivo</p>
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
