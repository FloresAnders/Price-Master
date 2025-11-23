import { useState, useEffect, useCallback } from 'react';
import { SorteosService } from '../services/sorteos';
import { UsersService } from '../services/users';
import { CcssConfigService } from '../services/ccss-config';
import { Sorteo, User, CcssConfig } from '../types/firestore';
import { useAuth } from './useAuth';
import { useActorOwnership } from './useActorOwnership';

// Export the schedules hook
export { useSchedules } from './useSchedules';

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

export function useUsers() {
  const { user: currentUser } = useAuth();
  const { ownerIds: actorOwnerIds } = useActorOwnership(currentUser);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterUsersByOwner = useCallback((list: User[]): User[] => {
    if (!currentUser || currentUser.role === 'superadmin') return list;
    const allowed = new Set(actorOwnerIds.map(id => String(id)));
    if (allowed.size === 0) return list;
    return list.filter(user => {
      if (!user) return false;
      if (user.id && currentUser.id && String(user.id) === String(currentUser.id)) return true;
      if (!user.ownerId) return false;
      return allowed.has(String(user.ownerId));
    });
  }, [actorOwnerIds, currentUser]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await UsersService.getAllUsersAs(currentUser);
      setUsers(filterUsersByOwner(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  }, [currentUser, filterUsersByOwner]);

  const addUser = useCallback(async (user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      setError(null);
  const id = await UsersService.createUserAs(currentUser, user);
      await fetchUsers(); // Refresh list
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error adding user');
      throw err;
    }
  }, [fetchUsers, currentUser]);

  const updateUser = useCallback(async (id: string, user: Partial<User>) => {
    try {
      setError(null);
  await UsersService.updateUserAs(currentUser, id, user);
      await fetchUsers(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating user');
      throw err;
    }
  }, [fetchUsers, currentUser]);

  const deleteUser = useCallback(async (id: string) => {
    try {
      setError(null);
  await UsersService.deleteUserAs(currentUser, id);
      await fetchUsers(); // Refresh list
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error deleting user');
      throw err;
    }
  }, [fetchUsers, currentUser]);

  const searchUsers = useCallback(async (searchTerm: string) => {
    try {
      setError(null);
      const results = await UsersService.searchUsersAs(currentUser, searchTerm);
      return filterUsersByOwner(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error searching users');
      throw err;
    }
  }, [currentUser, filterUsersByOwner]);

  const getUsersByRole = useCallback(async (role: 'admin' | 'user' | 'superadmin') => {
    try {
      setError(null);
      const results = await UsersService.findUsersByRole(currentUser, role);
      return filterUsersByOwner(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error getting users by role');
      throw err;
    }
  }, [currentUser, filterUsersByOwner]);
  const getActiveUsers = useCallback(async () => {
    try {
      setError(null);
      const results = await UsersService.getActiveUsersAs(currentUser);
      return filterUsersByOwner(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error getting active users');
      throw err;
    }
  }, [currentUser, filterUsersByOwner]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    loading,
    error,
    addUser,
    updateUser,
    deleteUser,
    searchUsers,
    getUsersByRole,
    getActiveUsers,
    refetch: fetchUsers
  };
}

export function useCcssConfig() {
  const [ccssConfig, setCcssConfig] = useState<CcssConfig>({ 
    ownerId: '', 
    companie: [{ 
      ownerCompanie: '', 
      mt: 3672.46, 
      tc: 11017.39, 
      valorhora: 1441, 
      horabruta: 1529.62 
    }] 
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCcssConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Este hook necesita un ownerId - se debería refactorizar para recibirlo como parámetro
      // Por ahora usamos un valor por defecto
      const data = await CcssConfigService.getCcssConfig('default');
      if (data) {
        setCcssConfig(data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error loading CCSS config');
      console.error('Error fetching CCSS config:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateCcssConfig = useCallback(async (config: Omit<CcssConfig, 'id' | 'updatedAt'>) => {
    try {
      setError(null);
      await CcssConfigService.updateCcssConfig(config);
      await fetchCcssConfig(); // Refresh config
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error updating CCSS config');
      throw err;
    }
  }, [fetchCcssConfig]);

  useEffect(() => {
    fetchCcssConfig();
  }, [fetchCcssConfig]);

  return {
    ccssConfig,
    loading,
    error,
    updateCcssConfig,
    refetch: fetchCcssConfig
  };
}

export function useFirebaseData() {
  const sorteosHook = useSorteos();
  const usersHook = useUsers();
  const ccssConfigHook = useCcssConfig();

  const loading = sorteosHook.loading || usersHook.loading || ccssConfigHook.loading;
  const error = sorteosHook.error || usersHook.error || ccssConfigHook.error;

  return {
    sorteos: sorteosHook,
    users: usersHook,
    ccssConfig: ccssConfigHook,
    loading,
    error,
    refetchAll: () => {
      sorteosHook.refetch();
      usersHook.refetch();
      ccssConfigHook.refetch();
    }
  };
}
