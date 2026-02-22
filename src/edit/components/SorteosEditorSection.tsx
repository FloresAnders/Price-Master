'use client';

import React from 'react';
import { FileText } from 'lucide-react';

import type { Sorteo } from '../../types/firestore';

type Props = {
  sorteosData: Sorteo[];
  addSorteo: () => void;
  updateSorteo: (index: number, field: keyof Sorteo, value: string) => void;
  removeSorteo: (index: number) => void;
};

export default function SorteosEditorSection({
  sorteosData,
  addSorteo,
  updateSorteo,
  removeSorteo,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
        <div>
          <h4 className="text-lg sm:text-xl font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
            Configuración de Sorteos
          </h4>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            Gestiona los sorteos disponibles en el sistema
          </p>
        </div>
        <button
          onClick={addSorteo}
          className="px-4 py-2 sm:px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base w-full sm:w-auto"
        >
          <span className="hidden sm:inline">Agregar Sorteo</span>
          <span className="sm:hidden">+ Sorteo</span>
        </button>
      </div>

      {sorteosData.map((sorteo, index) => (
        <div
          key={sorteo.id || index}
          className="border border-[var(--input-border)] rounded-lg p-3 sm:p-4 md:p-6"
        >
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-start sm:items-center">
            <div className="flex-1 w-full">
              <label className="block text-sm font-medium mb-1">Nombre del Sorteo:</label>
              <input
                type="text"
                value={sorteo.name}
                onChange={(e) => updateSorteo(index, 'name', e.target.value)}
                className="w-full px-3 py-2 border border-[var(--input-border)] rounded-md"
                style={{ background: 'var(--input-bg)', color: 'var(--foreground)' }}
                placeholder="Ingrese el nombre del sorteo"
              />
            </div>

            <button
              onClick={() => removeSorteo(index)}
              className="px-3 py-2 sm:px-4 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm sm:text-base w-full sm:w-auto mt-2 sm:mt-0 whitespace-nowrap"
            >
              <span className="hidden sm:inline">Eliminar</span>
              <span className="sm:hidden">Delete</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
