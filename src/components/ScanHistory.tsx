'use client';
import React, { useState } from 'react';
import { Copy, Trash2, Edit3, ArrowLeftCircle } from 'lucide-react';
import type { ScanHistoryProps as BaseScanHistoryProps, ScanHistoryEntry } from '../types/barcode';

interface ScanHistoryProps extends BaseScanHistoryProps {
  notify?: (msg: string, color?: string) => void;
}

export default function ScanHistory({ history, onCopy, onDelete, onRemoveLeadingZero, onRename, notify }: ScanHistoryProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  if (history.length === 0) {
    return (
      <div className="p-4 rounded-lg shadow bg-[var(--card-bg)] text-[var(--tab-text)]">
        No hay escaneos aún
      </div>
    );
  }

  return (
    <div className="space-y-2 p-4 rounded-lg shadow bg-[var(--card-bg)] text-[var(--foreground)]">
      <h3 className="mb-4 text-center text-lg font-semibold">Historial de Escaneos</h3>
      {history.map((entry, idx) => (
        <div key={`${entry.code}-${idx}`} className="flex items-center gap-2 bg-[var(--input-bg)] rounded px-2 py-1">
          {/* Remove leading zero */}
          <button
            className="p-1 text-blue-500 hover:text-blue-700"
            title="Eliminar primer dígito"
            onClick={() => {
              onRemoveLeadingZero?.(entry.code);
              notify?.('Primer dígito eliminado', 'blue');
            }}
          >
            <ArrowLeftCircle className="w-5 h-5" />
          </button>
          <div className="flex-1 flex flex-col items-start">
            {editingIdx === idx ? (
              <form
                onSubmit={e => {
                  e.preventDefault();
                  onRename?.(entry.code, editValue);
                  setEditingIdx(null);
                  notify?.('Nombre actualizado', 'indigo');
                }}
                className="w-full flex flex-col gap-1"
              >
                <input
                  className="w-full px-2 py-1 rounded border text-sm mb-1"
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  autoFocus
                  onBlur={() => setEditingIdx(null)}
                  placeholder="Nombre personalizado"
                />
              </form>
            ) : (
              entry.name && <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 mb-0.5">{entry.name}</span>
            )}
            <span className="font-mono text-base select-all">{entry.code}</span>
          </div>
          {/* Rename */}
          <button
            className="p-1 text-indigo-500 hover:text-indigo-700"
            title="Agregar/Editar nombre"
            onClick={() => {
              setEditingIdx(idx);
              setEditValue(entry.name || '');
            }}
          >
            <Edit3 className="w-5 h-5" />
          </button>
          {/* Copy */}
          <button
            className="p-1 text-green-500 hover:text-green-700"
            title="Copiar código"
            onClick={() => {
              onCopy?.(entry.code);
              notify?.('¡Código copiado!', 'green');
            }}
          >
            <Copy className="w-5 h-5" />
          </button>
          {/* Delete */}
          <button
            className="p-1 text-red-500 hover:text-red-700"
            title="Eliminar código"
            onClick={() => {
              onDelete?.(entry.code);
              notify?.('Código eliminado', 'red');
            }}
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      ))}
    </div>
  );
}
