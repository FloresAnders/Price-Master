import { useState, useEffect, useCallback } from 'react';
import { LocationsService } from '../services/locations';
import { SorteosService } from '../services/sorteos';
import { Location, Sorteo } from '../types/firestore';

// Export the schedules hook
export { useSchedules } from './useSchedules';

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await LocationsService.getAllLocations();
      setLocations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading locations');
      console.error('Error fetching locations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addLocation = useCallback(async (location: Omit<Location, 'id'>) => {
    try {
      setError(null);
      const id = await LocationsService.addLocation(location);
      await fetchLocations(); // Refresh list
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding location');
      throw err;
    }
  }, [fetchLocations]);

  const updateLocation = useCallback(async (id: string, location: Partial<Location>) => {
    try {
      setError(null);
      await LocationsService.updateLocation(id, location);
      await fetchLocations(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating location');
      throw err;
    }
  }, [fetchLocations]);

  const deleteLocation = useCallback(async (id: string) => {
    try {
      setError(null);
      await LocationsService.deleteLocation(id);
      await fetchLocations(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting location');
      throw err;
    }
  }, [fetchLocations]);

  const searchLocationsByName = useCallback(async (name: string) => {
    try {
      setError(null);
      return await LocationsService.findLocationsByName(name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error searching locations');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return {
    locations,
    loading,
    error,
    addLocation,
    updateLocation,
    deleteLocation,
    searchLocationsByName,
    refetch: fetchLocations
  };
}

export function useSorteos() {
  const [sorteos, setSorteos] = useState<Sorteo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSorteos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await SorteosService.getAllSorteos();
      setSorteos(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading sorteos');
      console.error('Error fetching sorteos:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addSorteo = useCallback(async (sorteo: Omit<Sorteo, 'id'>) => {
    try {
      setError(null);
      const id = await SorteosService.addSorteo(sorteo);
      await fetchSorteos(); // Refresh list
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding sorteo');
      throw err;
    }
  }, [fetchSorteos]);

  const updateSorteo = useCallback(async (id: string, sorteo: Partial<Sorteo>) => {
    try {
      setError(null);
      await SorteosService.updateSorteo(id, sorteo);
      await fetchSorteos(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating sorteo');
      throw err;
    }
  }, [fetchSorteos]);

  const deleteSorteo = useCallback(async (id: string) => {
    try {
      setError(null);
      await SorteosService.deleteSorteo(id);
      await fetchSorteos(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting sorteo');
      throw err;
    }
  }, [fetchSorteos]);

  const searchSorteos = useCallback(async (searchTerm: string) => {
    try {
      setError(null);
      return await SorteosService.searchSorteos(searchTerm);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error searching sorteos');
      throw err;
    }
  }, []);

  useEffect(() => {
    fetchSorteos();
  }, [fetchSorteos]);

  return {
    sorteos,
    loading,
    error,
    addSorteo,
    updateSorteo,
    deleteSorteo,
    searchSorteos,
    refetch: fetchSorteos
  };
}

export function useFirebaseData() {
  const locationsHook = useLocations();
  const sorteosHook = useSorteos();

  const loading = locationsHook.loading || sorteosHook.loading;
  const error = locationsHook.error || sorteosHook.error;

  return {
    locations: locationsHook,
    sorteos: sorteosHook,
    loading,
    error,
    refetchAll: () => {
      locationsHook.refetch();
      sorteosHook.refetch();
    }
  };
}
