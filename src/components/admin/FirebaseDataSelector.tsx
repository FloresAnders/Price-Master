import React, { useState, useEffect } from 'react';
import { useSorteos } from '../../hooks/useFirebase';
import { EmpresasService } from '../../services/empresas';
import type { Empresas, Sorteo } from '../../types/firestore';

interface FirebaseDataSelectorProps {
  onEmpresaSelect?: (empresa: Empresas) => void;
  onSorteoSelect?: (sorteo: Sorteo) => void;
}

export default function FirebaseDataSelector({
  onEmpresaSelect,
  onSorteoSelect
}: FirebaseDataSelectorProps) {
  const { sorteos, loading: sorteosLoading, error: sorteosError } = useSorteos();
  const [empresas, setEmpresas] = useState<Empresas[]>([]);
  const [empresasLoading, setEmpresasLoading] = useState(true);
  const [empresasError, setEmpresasError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadEmpresas = async () => {
      try {
        setEmpresasLoading(true);
        const data = await EmpresasService.getAllEmpresas();
        setEmpresas(data);
      } catch (err) {
        setEmpresasError(err instanceof Error ? err.message : 'Error loading empresas');
      } finally {
        setEmpresasLoading(false);
      }
    };
    loadEmpresas();
  }, []);

  // Filter data based on search term
  const filteredEmpresas = empresas.filter(empresa =>
    empresa.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    empresa.ubicacion.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSorteos = sorteos.filter(sorteo =>
    sorteo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (empresasLoading || sorteosLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Cargando datos...</span>
      </div>
    );
  }

  if (empresasError || sorteosError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {empresasError || sorteosError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar empresas o sorteos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2 top-2 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Empresas */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Empresas ({filteredEmpresas.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredEmpresas.map((empresa) => (
              <div
                key={empresa.id}
                onClick={() => onEmpresaSelect?.(empresa)}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="font-medium">{empresa.name}</div>
                <div className="text-sm text-gray-600">
                  {empresa.ubicacion}
                </div>
              </div>
            ))}
            {filteredEmpresas.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No se encontraron empresas
              </p>
            )}
          </div>
        </div>

        {/* Sorteos */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Sorteos ({filteredSorteos.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredSorteos.map((sorteo) => (
              <div
                key={sorteo.id}
                onClick={() => onSorteoSelect?.(sorteo)}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="font-medium">{sorteo.name}</div>
              </div>
            ))}
            {filteredSorteos.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No se encontraron sorteos
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
