import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "./useAuth";
import { RecetasService } from "@/services/recetas";
import type { RecetaEntry } from "@/types/firestore";

type MutationCallbacks<T> = {
  onSuccess?: (result: T) => void;
  onError?: (error: Error) => void;
};

function isFirestoreNotFoundError(err: unknown): boolean {
  const anyErr = err as any;
  const code = typeof anyErr?.code === "string" ? anyErr.code : "";
  const message = typeof anyErr?.message === "string" ? anyErr.message : "";
  return (
    code === "not-found" ||
    /No document to update/i.test(message) ||
    /NOT_FOUND/i.test(message)
  );
}

type RecetasCacheRecord = {
  v: number;
  updatedAt: number;
  recetas: RecetaEntry[];
};

const RECETAS_CACHE_VERSION = 1;
const recetasMemoryCache = new Map<string, RecetasCacheRecord>();

function buildRecetasCacheKey(company: string): string {
  return `pricemaster_recetas_cache:${company}`;
}

function readSessionRecetasCache(key: string): RecetasCacheRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RecetasCacheRecord;
    if (!parsed || parsed.v !== RECETAS_CACHE_VERSION) return null;
    if (!Array.isArray(parsed.recetas)) return null;
    if (typeof parsed.updatedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSessionRecetasCache(key: string, record: RecetasCacheRecord): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, JSON.stringify(record));
  } catch {
    // Ignore quota errors / disabled storage.
  }
}

export function useRecetas(options?: { companyOverride?: string }) {
  const { user, loading: authLoading } = useAuth();

  const companyFromUser = useMemo(() => (user?.ownercompanie || "").trim(), [user?.ownercompanie]);
  const isAdminLike = user?.role === "admin" || user?.role === "superadmin";
  const requestedOverride = useMemo(() => String(options?.companyOverride || "").trim(), [options?.companyOverride]);
  const company = useMemo(() => {
    if (isAdminLike && requestedOverride) return requestedOverride;
    return companyFromUser;
  }, [companyFromUser, isAdminLike, requestedOverride]);
  const noCompanyMessage = "No se pudo determinar la empresa del usuario.";

  const [recetas, setRecetas] = useState<RecetaEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);

  const cacheKey = useMemo(() => {
    const c = String(company || "").trim();
    return c ? buildRecetasCacheKey(c) : "";
  }, [company]);

  const commitCache = useCallback(
    (nextRecetas: RecetaEntry[], updatedAt?: number) => {
      if (!cacheKey) return;
      const record: RecetasCacheRecord = {
        v: RECETAS_CACHE_VERSION,
        updatedAt: typeof updatedAt === "number" ? updatedAt : Date.now(),
        recetas: nextRecetas,
      };
      recetasMemoryCache.set(cacheKey, record);
      writeSessionRecetasCache(cacheKey, record);
      setLastUpdatedAt(record.updatedAt);
    },
    [cacheKey]
  );

  const inFlightFetch = useMemo(() => ({ current: null as Promise<void> | null }), []);

  const fetchRecetas = useCallback(async () => {
    if (authLoading) return;

    if (!company) {
      setRecetas([]);
      setLastUpdatedAt(null);
      setError(user ? noCompanyMessage : null);
      setLoading(false);
      return;
    }

    if (inFlightFetch.current) {
      await inFlightFetch.current;
      return;
    }

    const p = (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await RecetasService.getRecetasOrderedByNombre(company);
        const updatedAt = Date.now();
        setRecetas(data);
        commitCache(data, updatedAt);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Error al cargar las recetas.";
        setError(message);
        console.error("Error fetching recetas:", err);
      } finally {
        setLoading(false);
      }
    })();

    inFlightFetch.current = p;
    try {
      await p;
    } finally {
      inFlightFetch.current = null;
    }
  }, [authLoading, commitCache, company, inFlightFetch, noCompanyMessage, user]);

  const addReceta = useCallback(
    async (
      input: {
        nombre: string;
        descripcion?: string;
        productos: Array<{ productId: string; gramos: number }>;
        iva?: number;
        margen: number;
        imagePath?: string;
        imageUrl?: string;
      },
      callbacks?: MutationCallbacks<RecetaEntry>
    ) => {
      try {
        setError(null);
        if (!company) throw new Error(noCompanyMessage);

        const created = await RecetasService.addReceta(company, input);
        setRecetas((prev) => {
          const next = [...prev.filter((r) => r.id !== created.id), created];
          next.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
          commitCache(next);
          return next;
        });

        callbacks?.onSuccess?.(created);
        return created;
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo guardar la receta.";
        setError(message);
        console.error("Error adding receta:", err);
        const asError = err instanceof Error ? err : new Error(message);
        callbacks?.onError?.(asError);
        throw asError;
      }
    },
    [commitCache, company, noCompanyMessage]
  );

  const removeReceta = useCallback(
    async (id: string, callbacks?: MutationCallbacks<void>) => {
      try {
        setError(null);
        if (!company) throw new Error(noCompanyMessage);

        await RecetasService.deleteReceta(company, id);
        setRecetas((prev) => {
          const next = prev.filter((r) => r.id !== id);
          commitCache(next);
          return next;
        });
        callbacks?.onSuccess?.(undefined);
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo eliminar la receta.";
        setError(message);
        console.error("Error removing receta:", err);
        const asError = err instanceof Error ? err : new Error(message);
        callbacks?.onError?.(asError);
        throw asError;
      }
    },
    [commitCache, company, noCompanyMessage]
  );

  const updateReceta = useCallback(
    async (
      id: string,
      input: {
        nombre: string;
        descripcion?: string | null;
        productos: Array<{ productId: string; gramos: number }>;
        iva?: number;
        margen: number;
        imagePath?: string;
        imageUrl?: string;
      },
      callbacks?: MutationCallbacks<RecetaEntry>
    ) => {
      try {
        setError(null);
        if (!company) throw new Error(noCompanyMessage);

        const updated = await RecetasService.updateReceta(company, id, input);
        setRecetas((prev) => {
          const next = prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
          next.sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }));
          commitCache(next);
          return next;
        });

        callbacks?.onSuccess?.(updated);
        return updated;
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo actualizar la receta.";

        // Caso común cuando otro usuario eliminó la receta: no mostrar error global,
        // dejar que la UI decida cómo informar (toast + cerrar drawer).
        if (isFirestoreNotFoundError(err)) {
          const asError = err instanceof Error ? err : new Error(message);
          callbacks?.onError?.(asError);
          throw asError;
        }

        setError(message);
        console.error("Error updating receta:", err);
        const asError = err instanceof Error ? err : new Error(message);
        callbacks?.onError?.(asError);
        throw asError;
      }
    },
    [commitCache, company, noCompanyMessage]
  );

  const evictReceta = useCallback(
    (id: string) => {
      const targetId = String(id || "").trim();
      if (!targetId) return;
      setRecetas((prev) => {
        const next = prev.filter((r) => r.id !== targetId);
        commitCache(next);
        return next;
      });
    },
    [commitCache]
  );

  useEffect(() => {
    if (authLoading) return;

    // Si no hay usuario, limpiar.
    if (!user) {
      setRecetas([]);
      setLastUpdatedAt(null);
      setError(null);
      setLoading(false);
      return;
    }

    if (!company) {
      setRecetas([]);
      setLastUpdatedAt(null);
      setError(noCompanyMessage);
      setLoading(false);
      return;
    }

    if (!cacheKey) {
      void fetchRecetas();
      return;
    }

    const cached = recetasMemoryCache.get(cacheKey) ?? readSessionRecetasCache(cacheKey);
    if (cached) {
      // No consultar a DB al ingresar si ya hay cache.
      recetasMemoryCache.set(cacheKey, cached);
      setRecetas(cached.recetas);
      setLastUpdatedAt(cached.updatedAt);
      setLoading(false);
      setError(null);
      return;
    }

    // No hay cache: una sola consulta inicial.
    void fetchRecetas();
  }, [authLoading, cacheKey, company, fetchRecetas, noCompanyMessage, user]);

  return {
    recetas,
    loading,
    error,
    addReceta,
    updateReceta,
    removeReceta,
    evictReceta,
    refetch: fetchRecetas,
    lastUpdatedAt,
  };
}
