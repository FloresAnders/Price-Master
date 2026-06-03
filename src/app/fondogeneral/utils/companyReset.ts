import { FONDO_EGRESO_TYPES, FONDO_INGRESO_TYPES } from "../constants";
import { dateKeyFromDate } from "./helpers";

type FondoSectionMode = "all" | "ingreso" | "egreso";

type CompanyResetDeps = {
  mode: FondoSectionMode;
  keepFiltersAcrossCompanies: boolean;
  setEntriesHydrated: (value: boolean) => void;
  setHydratedCompany: (value: string) => void;
  setFondoEntries: (value: any[]) => void;
  storageSnapshotRef: { current: unknown | null };
  setInitialAmount: (value: string) => void;
  setInitialAmountUSD: (value: string) => void;
  setDailyClosingsHydrated: (value: boolean) => void;
  setDailyClosings: (value: any[]) => void;
  setDailyClosingsRefreshing: (value: boolean) => void;
  dailyClosingsRequestCountRef: { current: number };
  loadedDailyClosingKeysRef: { current: Set<string> };
  loadingDailyClosingKeysRef: { current: Set<string> };
  setCurrencyEnabled: (value: { CRC: true; USD: true }) => void;
  setMovementModalOpen: (value: boolean) => void;
  resetFondoForm: () => void;
  setMovementAutoCloseLocked: (value: boolean) => void;
  setSelectedProvider: (value: string) => void;
  setFilterProviderCode: (value: string) => void;
  setFilterPaymentType: (value: string) => void;
  setFilterEditedOnly: (value: boolean) => void;
  setSearchQuery: (value: string) => void;
  setFromFilter: (value: string) => void;
  setToFilter: (value: string) => void;
  setQuickRange: (value: string) => void;
  setPageIndex: (value: number) => void;
};

export function resetStateForCompanyChange({
  mode,
  keepFiltersAcrossCompanies,
  setEntriesHydrated,
  setHydratedCompany,
  setFondoEntries,
  storageSnapshotRef,
  setInitialAmount,
  setInitialAmountUSD,
  setDailyClosingsHydrated,
  setDailyClosings,
  setDailyClosingsRefreshing,
  dailyClosingsRequestCountRef,
  loadedDailyClosingKeysRef,
  loadingDailyClosingKeysRef,
  setCurrencyEnabled,
  setMovementModalOpen,
  resetFondoForm,
  setMovementAutoCloseLocked,
  setSelectedProvider,
  setFilterProviderCode,
  setFilterPaymentType,
  setFilterEditedOnly,
  setSearchQuery,
  setFromFilter,
  setToFilter,
  setQuickRange,
  setPageIndex,
}: CompanyResetDeps) {
  setEntriesHydrated(false);
  setHydratedCompany("");
  setFondoEntries([]);
  storageSnapshotRef.current = null;
  setInitialAmount("0");
  setInitialAmountUSD("0");
  setDailyClosingsHydrated(false);
  setDailyClosings([]);
  setDailyClosingsRefreshing(false);
  dailyClosingsRequestCountRef.current = 0;
  loadedDailyClosingKeysRef.current = new Set();
  loadingDailyClosingKeysRef.current = new Set();
  setCurrencyEnabled({ CRC: true, USD: true });
  setMovementModalOpen(false);
  resetFondoForm();
  setMovementAutoCloseLocked(false);
  setSelectedProvider("");

  if (!keepFiltersAcrossCompanies) {
    const todayKey = dateKeyFromDate(new Date());
    setFilterProviderCode("all");
    setFilterPaymentType(
      mode === "all"
        ? "all"
        : mode === "ingreso"
          ? FONDO_INGRESO_TYPES[0]
          : FONDO_EGRESO_TYPES[0],
    );
    setFilterEditedOnly(false);
    setSearchQuery("");
    setFromFilter(todayKey);
    setToFilter(todayKey);
    setQuickRange("today");
  }

  setPageIndex(0);
}
