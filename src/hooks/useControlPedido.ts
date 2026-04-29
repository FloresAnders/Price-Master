import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ControlPedidoService,
  type ControlPedidoEntry,
} from "../services/controlpedido";

export function useControlPedido(
  company?: string,
  weekStartKey?: number,
  enabled: boolean = true,
) {
  type SubscriptionState = {
    key: string | null;
    entries: ControlPedidoEntry[];
    error: string | null;
  };

  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>(
    () => ({
      key: null,
      entries: [],
      error: null,
    }),
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const normalizedCompany = useMemo(() => (company || "").trim(), [company]);
  const normalizedWeekStartKey =
    typeof weekStartKey === "number" && Number.isFinite(weekStartKey)
      ? weekStartKey
      : undefined;

  const canSubscribe =
    enabled &&
    Boolean(normalizedCompany) &&
    normalizedWeekStartKey !== undefined;
  const subscriptionKey = canSubscribe
    ? `${normalizedCompany}::${normalizedWeekStartKey}`
    : null;

  const activeSubscriptionIdRef = useRef(0);

  useEffect(() => {
    if (!canSubscribe || !subscriptionKey) {
      return;
    }

    activeSubscriptionIdRef.current += 1;
    const subscriptionId = activeSubscriptionIdRef.current;

    const unsubscribe = ControlPedidoService.subscribeWeek(
      normalizedCompany,
      normalizedWeekStartKey,
      (next) => {
        if (activeSubscriptionIdRef.current !== subscriptionId) return;
        setSubscriptionState({
          key: subscriptionKey,
          entries: next,
          error: null,
        });
      },
      (err) => {
        const message =
          err instanceof Error
            ? err.message
            : "Error al cargar control de pedido.";
        if (activeSubscriptionIdRef.current !== subscriptionId) return;
        setSubscriptionState({
          key: subscriptionKey,
          entries: [],
          error: message,
        });
      },
    );

    return () => unsubscribe();
  }, [
    canSubscribe,
    subscriptionKey,
    normalizedCompany,
    normalizedWeekStartKey,
  ]);

  const entries =
    subscriptionKey && subscriptionState.key === subscriptionKey
      ? subscriptionState.entries
      : [];
  const subscriptionError =
    subscriptionKey && subscriptionState.key === subscriptionKey
      ? subscriptionState.error
      : null;
  const loading =
    Boolean(subscriptionKey) && subscriptionState.key !== subscriptionKey;
  const error = subscriptionError ?? actionError;

  const addOrder = useCallback(
    async (payload: Omit<ControlPedidoEntry, "id" | "createdAt">) => {
      if (!normalizedCompany) {
        const message = "No se pudo determinar la empresa del usuario.";
        setActionError(message);
        throw new Error(message);
      }

      try {
        setActionError(null);
        await ControlPedidoService.addEntry(normalizedCompany, payload);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo guardar el control de pedido.";
        setActionError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [normalizedCompany],
  );

  const deleteOrdersForProviderReceiveDay = useCallback(
    async (providerCode: string, receiveDateKey: number) => {
      if (!normalizedCompany) {
        const message = "No se pudo determinar la empresa del usuario.";
        setActionError(message);
        throw new Error(message);
      }

      try {
        setActionError(null);
        return await ControlPedidoService.deleteByProviderAndReceiveDateKey(
          normalizedCompany,
          providerCode,
          receiveDateKey,
        );
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "No se pudo eliminar el control de pedido.";
        setActionError(message);
        throw err instanceof Error ? err : new Error(message);
      }
    },
    [normalizedCompany],
  );

  return {
    entries,
    loading,
    error,
    addOrder,
    deleteOrdersForProviderReceiveDay,
  };
}
