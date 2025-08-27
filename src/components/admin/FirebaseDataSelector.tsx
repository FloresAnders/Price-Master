import React, { useState } from 'react';
import { useLocations, useSorteos } from '../../hooks/useFirebase';
import type { Location, Sorteo } from '../../types/firestore';

interface FirebaseDataSelectorProps {
  onLocationSelect?: (location: Location) => void;
  onSorteoSelect?: (sorteo: Sorteo) => void;
}

export default function FirebaseDataSelector({
  onLocationSelect,
  onSorteoSelect
}: FirebaseDataSelectorProps) {
  const { locations, loading: locationsLoading, error: locationsError } = useLocations();
  const { sorteos, loading: sorteosLoading, error: sorteosError } = useSorteos();
  const [searchTerm, setSearchTerm] = useState('');

  // Filter data based on search term
  const filteredLocations = locations.filter(location =>
    location.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.names.some(name => name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredSorteos = sorteos.filter(sorteo =>
    sorteo.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (locationsLoading || sorteosLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2">Cargando datos...</span>
      </div>
    );
  }

  if (locationsError || sorteosError) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        Error: {locationsError || sorteosError}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar locations o sorteos..."
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
        {/* Locations */}
        <div>
          <h3 className="text-lg font-semibold mb-3">
            Locations ({filteredLocations.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {filteredLocations.map((location) => (
              <div
                key={location.id}
                onClick={() => onLocationSelect?.(location)}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <div className="font-medium">{location.label}</div>
                <div className="text-sm text-gray-600">
                  {location.names.join(', ')}
                </div>
              </div>
            ))}
            {filteredLocations.length === 0 && (
              <p className="text-gray-500 text-center py-4">
                No se encontraron locations
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
