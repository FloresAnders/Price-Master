import { useEffect, useState } from "react";
import type { DailyClosingRecord } from "@/services/daily-closings";
import type { ProviderEntry } from "@/types/firestore";
import type { FondoEntry } from "../types";

interface UsePendingCierreDeCajaStatusParams {
  entriesHydrated: boolean;
  providers: ProviderEntry[];
  fondoEntries: FondoEntry[];
  dailyClosings: DailyClosingRecord[];
  getPrimaryMovementTime: (entry: FondoEntry) => number;
  isAutoAdjustmentProvider: (providerCode: string) => boolean;
  cierreFondoVentasProviderName: string;
}

export function usePendingCierreDeCajaStatus({
  entriesHydrated,
  providers,
  fondoEntries,
  dailyClosings,
  getPrimaryMovementTime,
  isAutoAdjustmentProvider,
  cierreFondoVentasProviderName,
}: UsePendingCierreDeCajaStatusParams) {
  const [pendingCierreDeCaja, setPendingCierreDeCaja] = useState(false);

  useEffect(() => {
    if (!entriesHydrated || providers.length === 0 || fondoEntries.length === 0) {
      return;
    }

    const sortedEntries = [...fondoEntries].sort(
      (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
    );
    let hasPendingCierreDeCaja = false;
    let cierreEntryTs = 0;

    for (const entry of sortedEntries) {
      if (isAutoAdjustmentProvider(entry.providerCode)) {
        cierreEntryTs = 0;
        break;
      }

      const providerData = providers.find((provider) => provider.code === entry.providerCode);
      if (providerData?.name?.toUpperCase() === cierreFondoVentasProviderName) {
        const parsed = Date.parse(String(entry.createdAt || ""));
        cierreEntryTs = Number.isFinite(parsed) ? parsed : 0;
        break;
      }
    }

    if (cierreEntryTs > 0) {
      let latestDailyClosingTs = 0;
      if (Array.isArray(dailyClosings) && dailyClosings.length > 0) {
        for (const record of dailyClosings) {
          const ts = Date.parse(record.createdAt || record.closingDate || "");
          if (Number.isFinite(ts) && ts > latestDailyClosingTs) {
            latestDailyClosingTs = ts;
          }
        }
      }
      hasPendingCierreDeCaja = cierreEntryTs > latestDailyClosingTs;
    } else {
      hasPendingCierreDeCaja = false;
    }

    setPendingCierreDeCaja(hasPendingCierreDeCaja);
    console.log(
      "[CIERRE-DEBUG] Estado pendingCierreDeCaja después de cargar:",
      hasPendingCierreDeCaja,
      {
        cierreEntryTs,
        latestDailyClosingTs: Array.isArray(dailyClosings)
          ? Math.max(
              ...dailyClosings.map(
                (record) => Date.parse(record.createdAt || record.closingDate || "") || 0,
              ),
            )
          : 0,
      },
    );
  }, [
    entriesHydrated,
    providers,
    fondoEntries,
    dailyClosings,
    getPrimaryMovementTime,
    isAutoAdjustmentProvider,
    cierreFondoVentasProviderName,
  ]);

  return {
    pendingCierreDeCaja,
    setPendingCierreDeCaja,
  };
}
