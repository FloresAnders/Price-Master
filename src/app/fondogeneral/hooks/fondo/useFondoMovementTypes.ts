"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FondoMovementTypesService } from "@/services/fondo-movement-types";
import {
  invalidateFondoCache,
  readFondoCache,
  subscribeFondoCacheInvalidation,
  writeFondoCache,
  type FondoCacheIdentity,
  type FondoCacheScope,
} from "@/services/fondo-cache";
import type { FondoMovementTypeConfig } from "@/types/firestore";
import { setFondoMovementTypes } from "../../constants";
import { loadFondoCachedResource } from "../../utils/cachedResourceLoader";

const MOVEMENT_TYPES_TTL_MS = 30 * 60_000;

type FondoModuleStatus =
  | "idle"
  | "loading-cache"
  | "ready-cache"
  | "syncing"
  | "ready"
  | "error";

const groupTypes = (types: FondoMovementTypeConfig[]) => ({
  INGRESO: types.filter((type) => type.category === "INGRESO").map((type) => type.name),
  GASTO: types.filter((type) => type.category === "GASTO").map((type) => type.name),
  EGRESO: types.filter((type) => type.category === "EGRESO").map((type) => type.name),
});

export function useFondoMovementTypes(
  activeOwnerId: string,
  cacheIdentity?: FondoCacheIdentity,
  company = "",
) {
  const [status, setStatus] = useState<FondoModuleStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [ingresoTypes, setIngresoTypes] = useState<string[]>([]);
  const [gastoTypes, setGastoTypes] = useState<string[]>([]);
  const [egresoTypes, setEgresoTypes] = useState<string[]>([]);
  const requestIdRef = useRef(0);
  const ignoreNextInvalidationRef = useRef(false);

  const cacheScope = useMemo<FondoCacheScope | null>(() => {
    if (
      !activeOwnerId.trim() ||
      !cacheIdentity?.userId?.trim() ||
      !cacheIdentity.ownerId?.trim()
    ) {
      return null;
    }
    return {
      ...cacheIdentity,
      companyId: company.trim(),
      resource: "movement-types",
    };
  }, [activeOwnerId, cacheIdentity, company]);

  const applyTypes = useCallback((types: FondoMovementTypeConfig[]) => {
    const grouped = groupTypes(types);
    setIngresoTypes(grouped.INGRESO);
    setGastoTypes(grouped.GASTO);
    setEgresoTypes(grouped.EGRESO);
    setFondoMovementTypes(grouped);
  }, []);

  const loadTypes = useCallback(
    async (options?: { skipCache?: boolean }) => {
      const requestId = ++requestIdRef.current;
      if (!activeOwnerId.trim()) {
        applyTypes([]);
        setStatus("ready");
        setError(null);
        return;
      }

      setStatus(options?.skipCache ? "syncing" : "loading-cache");
      setError(null);
      try {
        const result =
          cacheScope && !options?.skipCache
            ? await loadFondoCachedResource({
                readCache: () =>
                  readFondoCache<FondoMovementTypeConfig[]>(cacheScope),
                loadRemote: () =>
                  FondoMovementTypesService.getAllMovementTypes(activeOwnerId),
                writeCache: (types) =>
                  writeFondoCache(cacheScope, types, MOVEMENT_TYPES_TTL_MS),
                onCachedData: (types) => {
                  if (requestId !== requestIdRef.current) return;
                  applyTypes(types);
                  setStatus("ready-cache");
                },
              })
            : {
                data:
                  await FondoMovementTypesService.getAllMovementTypes(
                    activeOwnerId,
                  ),
                source: "server" as const,
              };

        if (requestId !== requestIdRef.current) return;
        applyTypes(result.data);
        if (cacheScope && options?.skipCache) {
          await writeFondoCache(
            cacheScope,
            result.data,
            MOVEMENT_TYPES_TTL_MS,
          );
        }
        if (result.source === "stale-cache") {
          setStatus("ready-cache");
          setError("No se pudieron actualizar los tipos; se muestra la caché disponible.");
        } else {
          setStatus(result.source === "cache" ? "ready-cache" : "ready");
        }
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return;
        console.error("Error loading fondo movement types:", loadError);
        setStatus("error");
        setError("No se pudieron cargar los tipos de movimientos.");
      }
    },
    [activeOwnerId, applyTypes, cacheScope],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadTypes();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadTypes]);

  useEffect(() => {
    if (!cacheScope) return;
    return subscribeFondoCacheInvalidation((match) => {
      if (ignoreNextInvalidationRef.current) {
        ignoreNextInvalidationRef.current = false;
        return;
      }
      if (
        match.resource === "movement-types" &&
        (!match.userId || match.userId === cacheScope.userId) &&
        (!match.ownerId || match.ownerId === cacheScope.ownerId) &&
        (!match.databaseId || match.databaseId === cacheScope.databaseId)
      ) {
        void loadTypes({ skipCache: true });
      }
    });
  }, [cacheScope, loadTypes]);

  useEffect(() => {
    const handleFondoTypesUpdate = (event: Event) => {
      const eventOwnerId = String(
        (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId || "",
      ).trim();
      if (activeOwnerId && eventOwnerId && eventOwnerId !== activeOwnerId) return;
      void (async () => {
        if (cacheScope) {
          ignoreNextInvalidationRef.current = true;
          await invalidateFondoCache(cacheScope);
        }
        await loadTypes({ skipCache: true });
      })();
    };

    window.addEventListener("fondoMovementTypesUpdated", handleFondoTypesUpdate);
    return () => {
      requestIdRef.current += 1;
      window.removeEventListener(
        "fondoMovementTypesUpdated",
        handleFondoTypesUpdate,
      );
    };
  }, [activeOwnerId, cacheScope, loadTypes]);

  return {
    fondoTypesLoaded:
      status === "ready" || status === "ready-cache" || status === "error",
    fondoTypesStatus: status,
    fondoTypesError: error,
    retryFondoTypes: () => loadTypes({ skipCache: true }),
    ingresoTypes,
    gastoTypes,
    egresoTypes,
  };
}
