import { useCallback, useEffect, useRef, useState } from "react";
import { ProvidersService } from "../services/providers";
import type { ProviderEntry } from "../types/firestore";
import {
  readFondoCache,
  subscribeFondoCacheInvalidation,
  writeFondoCache,
  type FondoCacheIdentity,
  type FondoCacheScope,
} from "../services/fondo-cache";
import { loadFondoCachedResource } from "../app/fondogeneral/utils/cachedResourceLoader";

const PROVIDERS_TTL_MS = 16 * 60 * 60_000;

export function useProviders(
  company?: string,
  cacheIdentity?: FondoCacheIdentity,
) {
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);
  const ignoreNextInvalidationRef = useRef(false);

  const buildCacheScope = useCallback((): FondoCacheScope | null => {
    const trimmedCompany = (company || "").trim();
    if (
      !trimmedCompany ||
      !cacheIdentity?.userId?.trim() ||
      !cacheIdentity.ownerId?.trim()
    ) {
      return null;
    }
    return {
      ...cacheIdentity,
      companyId: trimmedCompany,
      resource: "providers",
    };
  }, [cacheIdentity, company]);

  const filterCompanyProviders = useCallback(
    (data: ProviderEntry[], trimmedCompany: string) =>
      data.filter(
        (provider) =>
          (provider.company || "").trim().toLowerCase() ===
          trimmedCompany.toLowerCase(),
      ),
    [],
  );

  const fetchProviders = useCallback(async (options?: { skipCache?: boolean }) => {
    const trimmedCompany = (company || "").trim();
    const requestId = ++requestIdRef.current;

    if (!trimmedCompany) {
      setProviders([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cacheScope = buildCacheScope();
      const applyProviders = (data: ProviderEntry[]) => {
        if (requestId !== requestIdRef.current) return;
        setProviders(filterCompanyProviders(data, trimmedCompany));
      };
      const result =
        cacheScope && !options?.skipCache
          ? await loadFondoCachedResource({
              readCache: () => readFondoCache<ProviderEntry[]>(cacheScope),
              loadRemote: () => ProvidersService.getProviders(trimmedCompany),
              writeCache: (data) =>
                writeFondoCache(cacheScope, data, PROVIDERS_TTL_MS),
              onCachedData: (data) => {
                applyProviders(data);
                if (requestId === requestIdRef.current) setLoading(false);
              },
            })
          : {
              data: await ProvidersService.getProviders(trimmedCompany),
              source: "server" as const,
            };

      if (requestId === requestIdRef.current) {
        applyProviders(result.data);
        if (cacheScope && options?.skipCache) {
          await writeFondoCache(cacheScope, result.data, PROVIDERS_TTL_MS);
        }
        if (result.source === "stale-cache") {
          setError("No se pudo actualizar proveedores; se muestra la caché disponible.");
        }
      }
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      const message =
        err instanceof Error ? err.message : "Error al cargar los proveedores.";
      setError(message);
      console.error("Error fetching providers:", err);
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [buildCacheScope, company, filterCompanyProviders]);

  const addProvider = useCallback(
    async (
      name: string,
      type?: string,
      correonotifi?: string,
      agent?: ProviderEntry["agent"],
      visit?: ProviderEntry["visit"],
      accountId?: ProviderEntry["accountId"],
      explicitCategory?: "Ingreso" | "Gasto" | "Egreso",
    ) => {
      const trimmedCompany = (company || "").trim();
      if (!trimmedCompany) {
        const message = "No se pudo determinar la empresa del usuario.";
        setError(message);
        throw new Error(message);
      }

      try {
        setError(null);
        ignoreNextInvalidationRef.current = true;
        await ProvidersService.addProvider(
          trimmedCompany,
          name,
          type,
          correonotifi,
          agent,
          visit,
          accountId,
          explicitCategory,
        );
        await fetchProviders({ skipCache: true });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo guardar el proveedor.";
        setError(message);
        console.error("Error adding provider:", err);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [company, fetchProviders],
  );

  const removeProvider = useCallback(
    async (code: string) => {
      const trimmedCompany = (company || "").trim();
      if (!trimmedCompany) {
        const message = "No se pudo determinar la empresa del usuario.";
        setError(message);
        throw new Error(message);
      }

      try {
        setError(null);
        ignoreNextInvalidationRef.current = true;
        await ProvidersService.removeProvider(trimmedCompany, code);
        await fetchProviders({ skipCache: true });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo eliminar el proveedor.";
        setError(message);
        console.error("Error removing provider:", err);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [company, fetchProviders],
  );

  const updateProvider = useCallback(
    async (
      code: string,
      name: string,
      type?: string,
      correonotifi?: string,
      agent?: ProviderEntry["agent"],
      visit?: ProviderEntry["visit"],
      accountId?: ProviderEntry["accountId"],
      explicitCategory?: "Ingreso" | "Gasto" | "Egreso",
    ) => {
      const trimmedCompany = (company || "").trim();
      if (!trimmedCompany) {
        const message = "No se pudo determinar la empresa del usuario.";
        setError(message);
        throw new Error(message);
      }

      try {
        setError(null);
        ignoreNextInvalidationRef.current = true;
        await ProvidersService.updateProvider(
          trimmedCompany,
          code,
          name,
          type,
          correonotifi,
          agent,
          visit,
          accountId,
          explicitCategory,
        );
        await fetchProviders({ skipCache: true });
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo actualizar el proveedor.";
        setError(message);
        console.error("Error updating provider:", err);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [company, fetchProviders],
  );

  useEffect(() => {
    void fetchProviders();
  }, [fetchProviders]);

  useEffect(() => {
    const cacheScope = buildCacheScope();
    if (!cacheScope) return;
    return subscribeFondoCacheInvalidation((match) => {
      if (ignoreNextInvalidationRef.current) {
        ignoreNextInvalidationRef.current = false;
        return;
      }
      if (
        match.resource === "providers" &&
        (!match.userId || match.userId === cacheScope.userId) &&
        (!match.companyId || match.companyId === cacheScope.companyId) &&
        (!match.databaseId || match.databaseId === cacheScope.databaseId)
      ) {
        void fetchProviders({ skipCache: true });
      }
    });
  }, [buildCacheScope, fetchProviders]);

  return {
    providers,
    loading,
    error,
    addProvider,
    removeProvider,
    updateProvider,
    refetch: fetchProviders,
  };
}
