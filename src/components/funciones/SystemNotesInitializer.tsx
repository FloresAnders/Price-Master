'use client';

import React from 'react';
import { X } from 'lucide-react';
import versionData from '@/data/version.json';

type SystemNote = {
  version: string;
  date: string;
  title: string;
  description: string;
};

const STORAGE_KEY = 'system_notes_version';

export default function SystemNotesInitializer() {
  const [note, setNote] = React.useState<SystemNote | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);

  // Cargar la versión almacenada en localStorage y determinar si mostrar las notas
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      // Obtener la versión almacenada en localStorage
      const storedVersion = localStorage.getItem(STORAGE_KEY);
      const currentVersion = versionData.notasDeSistemas;
      const systemNotes = versionData.systemNotes as SystemNote[];

      console.log('Sistema de Notas - Versión actual:', currentVersion);
      console.log('Sistema de Notas - Versión almacenada:', storedVersion);

      // Si la versión actual es diferente a la almacenada, mostrar las notas
      if (storedVersion !== currentVersion && systemNotes && systemNotes.length > 0) {
        // Encontrar la nota correspondiente a la versión actual
        const currentNote = systemNotes.find(
          (n: SystemNote) => n.version === currentVersion
        );

        if (currentNote) {
          setNote(currentNote);
          setIsOpen(true);
          // Actualizar la versión almacenada
          localStorage.setItem(STORAGE_KEY, currentVersion);
        }
      }
    } catch (error) {
      console.warn('Error cargando notas del sistema:', error);
    }
  }, []);

  const handleClose = React.useCallback(() => {
    setIsOpen(false);
    setNote(null);
  }, []);

  if (!isOpen || !note) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60">
      <div className="relative w-full h-full max-w-2xl max-h-[90vh] bg-[var(--card-bg)] border border-[var(--input-border)] rounded-2xl shadow-2xl p-6 md:p-10 overflow-auto">
        {/* Botón de cerrar */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-4 right-4 inline-flex items-center justify-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)] w-10 h-10 text-[var(--foreground)] hover:opacity-90 transition-opacity"
          aria-label="Cerrar"
          title="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Contenido */}
        <div className="space-y-4">
          {/* Etiqueta de versión */}
          <div className="text-xs font-semibold text-[var(--muted-foreground)] uppercase tracking-widest">
            Notas del Sistema — v{note.version}
          </div>

          {/* Título */}
          <h2 className="text-3xl md:text-4xl font-bold text-[var(--foreground)] leading-tight">
            {note.title}
          </h2>

          {/* Fecha */}
          <div className="text-sm text-[var(--muted-foreground)]">
            {new Date(note.date).toLocaleDateString('es-CR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>

          {/* Descripción */}
          <div className="pt-6 text-base md:text-lg text-[var(--foreground)] whitespace-pre-wrap leading-relaxed">
            {note.description}
          </div>

          {/* Botón de confirmar */}
          <div className="pt-8 flex justify-end">
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
