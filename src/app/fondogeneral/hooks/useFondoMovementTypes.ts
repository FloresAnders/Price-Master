"use client";

import { useState, useEffect } from "react";
import { FondoMovementTypesService } from "@/services/fondo-movement-types";
import { setFondoMovementTypes } from "../constants";

export function useFondoMovementTypes(activeOwnerId: string) {
  const [fondoTypesLoaded, setFondoTypesLoaded] = useState(false);
  const [ingresoTypes, setIngresoTypes] = useState<string[]>([]);
  const [gastoTypes, setGastoTypes] = useState<string[]>([]);
  const [egresoTypes, setEgresoTypes] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadTypes = async () => {
      try {
        const types =
          await FondoMovementTypesService.getMovementTypesByCategoriesWithCache(
            activeOwnerId,
          );

        if (!isMounted) return;

        setIngresoTypes(types.INGRESO);
        setGastoTypes(types.GASTO);
        setEgresoTypes(types.EGRESO);
        setFondoTypesLoaded(true);

        setFondoMovementTypes(types);

        console.log("[FondoTypes] Loaded:", types);
      } catch (err) {
        console.error("Error loading fondo movement types:", err);
        if (isMounted) {
          setFondoTypesLoaded(true);
        }
      }
    };

    const handleFondoTypesUpdate = (event: Event) => {
      const eventOwnerId = String(
        (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId || "",
      ).trim();
      if (activeOwnerId && eventOwnerId && eventOwnerId !== activeOwnerId) {
        return;
      }
      if (!isMounted) return;

      console.log("[FondoTypes] Cache updated, reloading types...");

      loadTypes();
    };

    loadTypes();

    window.addEventListener(
      "fondoMovementTypesUpdated",
      handleFondoTypesUpdate,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "fondoMovementTypesUpdated",
        handleFondoTypesUpdate,
      );
    };
  }, [activeOwnerId]);

  return { fondoTypesLoaded, ingresoTypes, gastoTypes, egresoTypes };
}
