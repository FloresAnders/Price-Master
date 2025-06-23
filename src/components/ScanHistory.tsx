'use client';
import React, { useState, useCallback, memo } from 'react';
import { Copy, Trash2, Edit3, ArrowLeftCircle } from 'lucide-react';
import type { ScanHistoryProps as BaseScanHistoryProps, ScanHistoryEntry } from '../types/barcode';

interface ScanHistoryProps extends BaseScanHistoryProps {
  notify?: (msg: string, color?: string) => void;
}

interface ScanHistoryRowProps {
  entry: ScanHistoryEntry;
  idx: number;
  editingIdx: number | null;
  editValue: string;
  setEditingIdx: React.Dispatch<React.SetStateAction<number | null>>;
  setEditValue: React.Dispatch<React.SetStateAction<string>>;
  onRename?: (code: string, name: string) => void;
  onRemoveLeadingZero?: (code: string) => void;
  onCopy?: (code: string) => void;
  onDelete?: (code: string) => void;
  notify?: (msg: string, color?: string) => void;
}

// Memoized row for performance
const ScanHistoryRow = memo(function ScanHistoryRow({
  entry,
  idx,
  editingIdx,
  editValue,
  setEditingIdx,
  setEditValue,
  onRename,
  onRemoveLeadingZero,
  onCopy,
  onDelete,
  notify,
}: ScanHistoryRowProps) {
  return (
    <div className="scan-history-row flex flex-col bg-[var(--card-bg)] dark:bg-[var(--card-bg)] rounded-2xl px-4 py-3 shadow-lg justify-between transition-all duration-300 w-full">
      <div className="flex flex-col items-start flex-1 min-w-0 w-full">
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
              className="w-full px-2 py-2 rounded border text-base mb-2 bg-white/80 dark:bg-zinc-900/80 border-indigo-200 dark:border-indigo-800"
              value={editValue}
              onChange={e => setEditValue(e.target.value)}
              autoFocus
              onBlur={() => setEditingIdx(null)}
              placeholder="Nombre personalizado"
            />
          </form>
        ) : (
          entry.name && <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-300 mb-1 truncate max-w-full">{entry.name}</span>
        )}
        <span className="font-mono text-lg md:text-xl select-all text-left break-all text-indigo-900 dark:text-indigo-100 bg-white/70 dark:bg-zinc-800/70 px-3 py-2 rounded-lg shadow-sm whitespace-nowrap overflow-x-auto w-full max-w-full" style={{ letterSpacing: '0.10em', marginTop: '0.1rem', marginBottom: '0.1rem', display: 'block' }}>
          {entry.code}
        </span>
      </div>
      <div className="flex flex-row gap-2 mt-3 w-full justify-end">
        <button
          className="p-2 text-blue-500 hover:text-blue-700 bg-blue-100 dark:bg-blue-900 rounded-full border-none"
          title="Eliminar primer dígito"
          onClick={() => {
            onRemoveLeadingZero?.(entry.code);
            notify?.('Primer dígito eliminado', 'blue');
          }}
        >
          <ArrowLeftCircle className="w-6 h-6" />
        </button>
        <button
          className="p-2 text-indigo-500 hover:text-indigo-700 bg-indigo-100 dark:bg-indigo-900 rounded-full border-none"
          title="Agregar/Editar nombre"
          onClick={() => {
            setEditingIdx(idx);
            setEditValue(entry.name || '');
          }}
        >
          <Edit3 className="w-6 h-6" />
        </button>
        <button
          className="p-2 text-green-500 hover:text-green-700 bg-green-100 dark:bg-green-900 rounded-full border-none"
          title="Copiar código"
          onClick={() => {
            onCopy?.(entry.code);
            notify?.('¡Código copiado!', 'green');
          }}
        >
          <Copy className="w-6 h-6" />
        </button>
        <button
          className="p-2 text-red-500 hover:text-red-700 bg-red-100 dark:bg-red-900 rounded-full border-none"
          title="Eliminar código"
          onClick={() => {
            onDelete?.(entry.code);
            notify?.('Código eliminado', 'red');
          }}
        >
          <Trash2 className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
});

export default function ScanHistory({ history, onCopy, onDelete, onRemoveLeadingZero, onRename, notify }: ScanHistoryProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  // Memoized handlers for row actions
  const handleRename = useCallback((code: string, name: string) => {
    onRename?.(code, name);
    notify?.('Nombre actualizado', 'indigo');
  }, [onRename, notify]);
  const handleRemoveLeadingZero = useCallback((code: string) => {
    onRemoveLeadingZero?.(code);
    notify?.('Primer dígito eliminado', 'blue');
  }, [onRemoveLeadingZero, notify]);
  const handleCopy = useCallback((code: string) => {
    onCopy?.(code);
    notify?.('¡Código copiado!', 'green');
  }, [onCopy, notify]);
  const handleDelete = useCallback((code: string) => {
    onDelete?.(code);
    notify?.('Código eliminado', 'red');
  }, [onDelete, notify]);

  if (history.length === 0) {
    return (
      <div className="p-4 rounded-lg shadow bg-[var(--card-bg)] text-[var(--tab-text)]">
        No hay escaneos aún
      </div>
    );
  }
  return (<div className="space-y-6 p-4 md:p-6 rounded-3xl shadow-2xl bg-[var(--card-bg)] dark:bg-[var(--card-bg)] border border-[var(--input-border)] scan-history-container backdrop-blur-xl w-full overflow-x-auto">
    <div className="flex items-center justify-between mb-6 md:mb-8">
      <h3 className="text-lg font-bold text-center flex-1 text-indigo-700 dark:text-indigo-200">Historial de Escaneos</h3>
      <div className="flex gap-2 ml-2">
        <button
          className="p-1 rounded-full bg-green-100 hover:bg-green-200 text-green-600 transition-colors w-8 h-8 flex items-center justify-center border border-green-200 dark:border-green-700"
          title="Exportar códigos"
          onClick={handleExport}
        >
          <Download className="w-4 h-4" />
        </button>
        <button
          className="p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors w-8 h-8 flex items-center justify-center border border-red-200 dark:border-red-700"
          title="Limpiar historial"
          onClick={() => {
            if (window.confirm('¿Seguro que deseas borrar todo el historial de escaneos?')) {
              if (typeof onDelete === 'function') {
                history.forEach(entry => onDelete(entry.code));
              }
              notify?.('Historial borrado', 'red');
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div >
    <div className="flex flex-col gap-4">
      {history.map((entry, idx) => (
        <ScanHistoryRow
          key={`${entry.code}-${idx}`}
          entry={entry}
          idx={idx}
          editingIdx={editingIdx}
          editValue={editValue}
          setEditingIdx={setEditingIdx}
          setEditValue={setEditValue}
          onRename={handleRename}
          onRemoveLeadingZero={handleRemoveLeadingZero}
          onCopy={handleCopy}
          onDelete={handleDelete}
          notify={notify}
        />
      ))}
    </div>
  </div >
  );
}
