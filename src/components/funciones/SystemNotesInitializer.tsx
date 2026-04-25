'use client';

import React from 'react';
import { X } from 'lucide-react';
import { db } from '@/config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
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
  const unsubscribeRef = React.useRef<(() => void) | null>(null);
  const lastNotifiedVersionRef = React.useRef<string | null>(null);

  // Cargar la versión almacenada en localStorage al montar
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedVersion = localStorage.getItem(STORAGE_KEY);
      if (storedVersion) {
        lastNotifiedVersionRef.current = storedVersion;
      }
    } catch (error) {
      console.warn('Error cargando versión almacenada:', error);
    }
  }, []);

  // Escuchar cambios en tiempo real desde Firestore
  React.useEffect(() => {
    const versionRef = doc(db, 'version', 'current');

    unsubscribeRef.current = onSnapshot(
      versionRef,
      (docSnap) => {
        if (!docSnap.exists()) {
          console.warn('No se encontró el documento de versión en Firestore');
          return;
        }

        const firestoreData = docSnap.data();
        const notasDeSistemasDb = String(firestoreData?.notasDeSistemas || '').trim();
        const systemNotesDb = Array.isArray(firestoreData?.systemNotes)
          ? firestoreData.systemNotes
          : [];

        console.log('Sistema de Notas - Versión en Firestore:', notasDeSistemasDb);
        console.log('Sistema de Notas - Última versión notificada:', lastNotifiedVersionRef.current);

        // Si la versión es diferente a la última notificada, mostrar las notas
        if (
          notasDeSistemasDb &&
          notasDeSistemasDb !== lastNotifiedVersionRef.current
        ) {
          // Encontrar la nota correspondiente a la versión actual
          const currentNote = (systemNotesDb as SystemNote[]).find(
            (n: SystemNote) => n.version === notasDeSistemasDb
          );

          if (currentNote) {
            console.log('Mostrando nota del sistema para versión:', notasDeSistemasDb);
            setNote(currentNote);
            setIsOpen(true);
            lastNotifiedVersionRef.current = notasDeSistemasDb;

            // Actualizar localStorage
            try {
              localStorage.setItem(STORAGE_KEY, notasDeSistemasDb);
            } catch (error) {
              console.warn('Error guardando versión en localStorage:', error);
            }
          }
        }
      },
      (error) => {
        console.warn('Error escuchando cambios de notas del sistema:', error);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, []);

  // Cargar versión local al montar (fallback si Firestore no está disponible)
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const storedVersion = localStorage.getItem(STORAGE_KEY);
      const currentVersion = versionData.notasDeSistemas;
      const systemNotes = versionData.systemNotes as SystemNote[];

      console.log('Sistema de Notas - Versión local:', currentVersion);
      console.log('Sistema de Notas - Versión almacenada:', storedVersion);

      // Solo usar fallback si no tenemos datos de Firestore y es diferente
      if (
        storedVersion !== currentVersion &&
        systemNotes &&
        systemNotes.length > 0 &&
        !isOpen
      ) {
        const currentNote = systemNotes.find(
          (n: SystemNote) => n.version === currentVersion
        );

        if (currentNote && !lastNotifiedVersionRef.current) {
          setNote(currentNote);
          setIsOpen(true);
          lastNotifiedVersionRef.current = currentVersion;
          localStorage.setItem(STORAGE_KEY, currentVersion);
        }
      }
    } catch (error) {
      console.warn('Error cargando notas del sistema:', error);
    }
  }, [isOpen]);

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
