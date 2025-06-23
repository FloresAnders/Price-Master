'use client';

import { useState } from 'react';

interface Location {
  id: string;
  label: string;
  value: string;
  names?: string[];
}

interface Sorteo {
  id: string;
  name: string;
}

interface FirebaseData {
  locations: number;
  sorteos: number;
  users: number;
  locationsData?: Location[];
  sorteosData?: Sorteo[];
  usersData?: unknown[];
}

export default function FirebaseMigration() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [data, setData] = useState<FirebaseData | null>(null);

  const handleMigration = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/firebase-test', {
        method: 'POST',
      });
      const result = await response.json();

      if (result.success) {
        setMessage('¡Migración completada exitosamente!');
        setData(result.data);
      } else {
        setMessage(`Error en la migración: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error en la migración: ${error}`);
      console.error('Migration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/firebase-test');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
        setMessage('Datos cargados exitosamente');
      } else {
        setMessage(`Error cargando datos: ${result.error}`);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setMessage(`Error cargando datos: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar todos los datos de Firestore?')) {
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/firebase-test', {
        method: 'DELETE',
      });
      const result = await response.json();

      if (result.success) {
        setMessage('Datos eliminados exitosamente!');
        setData(null);
      } else {
        setMessage(`Error eliminando datos: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Error eliminando datos: ${error}`);
      console.error('Clear data error:', error);
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Migración Firebase - Price Master</h1>

      <div className="space-y-4 mb-8">
        <button
          onClick={handleMigration}
          disabled={isLoading}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50"
        >
          {isLoading ? 'Migrando...' : 'Ejecutar Migración'}
        </button>

        <button
          onClick={loadData}
          disabled={isLoading}
          className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 ml-2"
        >
          Cargar Datos
        </button>

        <button
          onClick={handleClearData}
          disabled={isLoading}
          className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 ml-2"
        >
          Limpiar Datos
        </button>
      </div>

      {message && (
        <div className={`p-4 mb-4 rounded ${message.includes('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {message}
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Locations ({data.locations})</h2>
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">              {data.locationsData && data.locationsData.length > 0 ? (
              data.locationsData.map((location: Location) => (
                <div key={location.id} className="mb-3 p-3 bg-white rounded border">
                  <h3 className="font-semibold">{location.label}</h3>
                  <p className="text-sm text-gray-600">Value: {location.value}</p>
                  <p className="text-sm text-gray-600">
                    Names: {location.names?.join(', ')}
                  </p>
                  <p className="text-xs text-gray-400">ID: {location.id}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No hay locations cargadas</p>
            )}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4">Sorteos ({data.sorteos})</h2>
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">              {data.sorteosData && data.sorteosData.length > 0 ? (
              data.sorteosData.map((sorteo: Sorteo) => (
                <div key={sorteo.id} className="mb-2 p-2 bg-white rounded border">
                  <p className="font-medium">{sorteo.name}</p>
                  <p className="text-xs text-gray-400">ID: {sorteo.id}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500">No hay sorteos cargados</p>
            )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
