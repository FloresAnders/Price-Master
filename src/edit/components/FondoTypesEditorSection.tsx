'use client';

import React from 'react';
import { Plus, Trash2 } from 'lucide-react';

import type { FondoMovementTypeConfig } from '../../types/firestore';

type Props = {
  fondoTypesData: FondoMovementTypeConfig[];
  seedFondoTypes: () => void | Promise<void>;
  addFondoType: (category: 'INGRESO' | 'GASTO' | 'EGRESO') => void | Promise<void>;
  updateFondoType: (index: number, field: keyof FondoMovementTypeConfig, value: string | number) => void | Promise<void>;
  removeFondoType: (index: number) => void;
  moveFondoTypeUp: (index: number) => void | Promise<void>;
  moveFondoTypeDown: (index: number) => void | Promise<void>;
};

export default function FondoTypesEditorSection({
  fondoTypesData,
  seedFondoTypes,
  addFondoType,
  updateFondoType,
  removeFondoType,
  moveFondoTypeUp,
  moveFondoTypeDown,
}: Props) {
  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <h4 className="text-base sm:text-lg lg:text-xl font-semibold">Tipos de Movimientos de Fondo</h4>
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-0.5 sm:mt-1">
            Gestiona los tipos de movimientos disponibles
          </p>
        </div>
        {fondoTypesData.length === 0 && (
          <button
            onClick={seedFondoTypes}
            className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-xs sm:text-sm flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Inicializar Tipos
          </button>
        )}
      </div>

      {/* Sección INGRESO */}
      <div className="border border-green-200 dark:border-green-700 rounded-lg p-2.5 sm:p-3 lg:p-4 bg-green-50 dark:bg-green-900/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 sm:mb-3">
          <h5 className="text-sm sm:text-base lg:text-lg font-semibold text-green-700 dark:text-green-300">INGRESO</h5>
          <button
            onClick={() => addFondoType('INGRESO')}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Agregar
          </button>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {fondoTypesData
            .map((type, index) => ({ type, originalIndex: index }))
            .filter(({ type }) => type.category === 'INGRESO')
            .map(({ type, originalIndex }, relativeIndex, arr) => (
              <div
                key={type.id || originalIndex}
                className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 p-2 sm:p-2.5 lg:p-3 rounded-md border border-green-300 dark:border-green-600"
              >
                <div className="flex flex-col gap-0.5 sm:gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveFondoTypeUp(originalIndex)}
                    disabled={relativeIndex === 0}
                    className="p-0.5 sm:p-1 text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                    title="Arriba"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveFondoTypeDown(originalIndex)}
                    disabled={relativeIndex === arr.length - 1}
                    className="p-0.5 sm:p-1 text-green-600 hover:text-green-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                    title="Abajo"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="text"
                  value={type.name}
                  onChange={(e) => updateFondoType(originalIndex, 'name', e.target.value)}
                  className="flex-1 min-w-0 px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 border border-green-300 dark:border-green-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm"
                  placeholder="Nombre"
                />
                <button
                  onClick={() => removeFondoType(originalIndex)}
                  className="p-1.5 sm:px-2.5 sm:py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex-shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Sección GASTO */}
      <div className="border border-orange-200 dark:border-orange-700 rounded-lg p-2.5 sm:p-3 lg:p-4 bg-orange-50 dark:bg-orange-900/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 sm:mb-3">
          <h5 className="text-sm sm:text-base lg:text-lg font-semibold text-orange-700 dark:text-orange-300">GASTO</h5>
          <button
            onClick={() => addFondoType('GASTO')}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Agregar
          </button>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {fondoTypesData
            .map((type, index) => ({ type, originalIndex: index }))
            .filter(({ type }) => type.category === 'GASTO')
            .map(({ type, originalIndex }, relativeIndex, arr) => (
              <div
                key={type.id || originalIndex}
                className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 p-2 sm:p-2.5 lg:p-3 rounded-md border border-orange-300 dark:border-orange-600"
              >
                <div className="flex flex-col gap-0.5 sm:gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveFondoTypeUp(originalIndex)}
                    disabled={relativeIndex === 0}
                    className="p-0.5 sm:p-1 text-orange-600 hover:text-orange-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                    title="Arriba"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveFondoTypeDown(originalIndex)}
                    disabled={relativeIndex === arr.length - 1}
                    className="p-0.5 sm:p-1 text-orange-600 hover:text-orange-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                    title="Abajo"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="text"
                  value={type.name}
                  onChange={(e) => updateFondoType(originalIndex, 'name', e.target.value)}
                  className="flex-1 min-w-0 px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 border border-orange-300 dark:border-orange-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm"
                  placeholder="Nombre"
                />
                <button
                  onClick={() => removeFondoType(originalIndex)}
                  className="p-1.5 sm:px-2.5 sm:py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex-shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>

      {/* Sección EGRESO */}
      <div className="border border-blue-200 dark:border-blue-700 rounded-lg p-2.5 sm:p-3 lg:p-4 bg-blue-50 dark:bg-blue-900/10">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-2 sm:mb-3">
          <h5 className="text-sm sm:text-base lg:text-lg font-semibold text-blue-700 dark:text-blue-300">EGRESO</h5>
          <button
            onClick={() => addFondoType('EGRESO')}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-xs sm:text-sm flex items-center justify-center gap-1 sm:gap-1.5 w-full sm:w-auto whitespace-nowrap"
          >
            <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            Agregar
          </button>
        </div>
        <div className="space-y-1.5 sm:space-y-2">
          {fondoTypesData
            .map((type, index) => ({ type, originalIndex: index }))
            .filter(({ type }) => type.category === 'EGRESO')
            .map(({ type, originalIndex }, relativeIndex, arr) => (
              <div
                key={type.id || originalIndex}
                className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-gray-800 p-2 sm:p-2.5 lg:p-3 rounded-md border border-blue-300 dark:border-blue-600"
              >
                <div className="flex flex-col gap-0.5 sm:gap-1 flex-shrink-0">
                  <button
                    onClick={() => moveFondoTypeUp(originalIndex)}
                    disabled={relativeIndex === 0}
                    className="p-0.5 sm:p-1 text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                    title="Arriba"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveFondoTypeDown(originalIndex)}
                    disabled={relativeIndex === arr.length - 1}
                    className="p-0.5 sm:p-1 text-blue-600 hover:text-blue-800 disabled:opacity-30 disabled:cursor-not-allowed text-xs sm:text-sm"
                    title="Abajo"
                  >
                    ▼
                  </button>
                </div>
                <input
                  type="text"
                  value={type.name}
                  onChange={(e) => updateFondoType(originalIndex, 'name', e.target.value)}
                  className="flex-1 min-w-0 px-2 sm:px-2.5 lg:px-3 py-1.5 sm:py-2 border border-blue-300 dark:border-blue-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-xs sm:text-sm"
                  placeholder="Nombre"
                />
                <button
                  onClick={() => removeFondoType(originalIndex)}
                  className="p-1.5 sm:px-2.5 sm:py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors flex-shrink-0"
                  title="Eliminar"
                >
                  <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
