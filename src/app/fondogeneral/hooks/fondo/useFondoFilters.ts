"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  FONDO_INGRESO_TYPES,
  FONDO_EGRESO_TYPES,
} from "../../constants";
import {
  formatMovementType,
  isIngresoType,
  isEgresoType,
  isGastoType,
  getPrimaryMovementDateISO,
  getPrimaryMovementTime,
  dateKeyFromDate,
} from "../../utils/helpers";
import { getCostaRicaCurrentDateKey } from "../../utils/costaRicaDay";
import type { FondoEntry, FondoMovementType } from "../../types";

interface MovementProvider {
  code: string;
  name: string;
  type?: FondoMovementType;
  category?: "Ingreso" | "Gasto" | "Egreso";
  correonotifi?: string;
}

interface Props {
  fondoEntries: FondoEntry[];
  movementProviders: MovementProvider[];
  mode: "all" | "ingreso" | "egreso";
  serverFilteringEnabled?: boolean;
}

export function useFondoFilters({
  fondoEntries,
  movementProviders,
  mode,
  serverFilteringEnabled = false,
}: Props) {
  const todayKey = useMemo(() => getCostaRicaCurrentDateKey(), []);

  const providersMap = useMemo(() => {
    const map = new Map<string, string>();
    movementProviders.forEach((p) => map.set(p.code, p.name));
    return map;
  }, [movementProviders]);
  const [pageSize, setPageSize] = useState<"daily" | number | "all">("daily");
  const [pageIndex, setPageIndex] = useState(0);
  const [currentDailyKey, setCurrentDailyKey] = useState(() =>
    getCostaRicaCurrentDateKey(),
  );

  const [sortAsc, setSortAsc] = useState(() => {
    if (typeof window !== "undefined") {
      const touched = localStorage.getItem("fondogeneral-sortAscTouched");
      const saved = localStorage.getItem("fondogeneral-sortAsc");
      if (touched === "true" && saved !== null) return JSON.parse(saved);
      return false;
    }
    return false;
  });

  const [fromFilter, setFromFilter] = useState<string | null>(null);
  const [toFilter, setToFilter] = useState<string | null>(null);

  const [calendarFromOpen, setCalendarFromOpen] = useState(false);
  const [calendarToOpen, setCalendarToOpen] = useState(false);
  const [calendarFromMonth, setCalendarFromMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarToMonth, setCalendarToMonth] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const [filterProviderCode, setFilterProviderCode] = useState<string | "all">(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("fondogeneral-filterProviderCode");
        return saved !== null ? saved : "all";
      }
      return "all";
    },
  );
  const [providerFilter, setProviderFilter] = useState("");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);
  const [providerSearchInput, setProviderSearchInput] = useState("");

  const filteredProvidersForFilter = useMemo(() => {
    const search = providerSearchInput.toLowerCase().trim();
    if (!search) return movementProviders;
    return movementProviders.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.code.toLowerCase().includes(search),
    );
  }, [movementProviders, providerSearchInput]);

  const initialFilterPaymentType: FondoEntry["paymentType"] | "all" =
    mode === "all"
      ? "all"
      : mode === "ingreso"
        ? FONDO_INGRESO_TYPES[0]
        : FONDO_EGRESO_TYPES[0];
  const [filterPaymentType, setFilterPaymentType] = useState<
    FondoEntry["paymentType"] | "all"
  >(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fondogeneral-filterPaymentType");
      return saved !== null
        ? (saved as FondoEntry["paymentType"] | "all")
        : initialFilterPaymentType;
    }
    return initialFilterPaymentType;
  });
  const [typeFilter, setTypeFilter] = useState("");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [typeSearchInput, setTypeSearchInput] = useState("");
  const [filterEditedOnly, setFilterEditedOnly] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fondogeneral-filterEditedOnly");
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [filtersDropdownOpen, setFiltersDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fondogeneral-searchQuery");
      return saved !== null ? saved : "";
    }
    return "";
  });
  const [notesSearchQuery, setNotesSearchQuery] = useState("");
  const [appliedFromFilter, setAppliedFromFilter] = useState<string | null>(null);
  const [appliedToFilter, setAppliedToFilter] = useState<string | null>(null);
  const [appliedProviderCode, setAppliedProviderCode] = useState<string | "all">(
    "all",
  );
  const [appliedPaymentType, setAppliedPaymentType] = useState<
    FondoEntry["paymentType"] | "all"
  >("all");
  const [appliedInvoiceNumber, setAppliedInvoiceNumber] = useState("");
  const [rememberFilters, setRememberFilters] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fondogeneral-rememberFilters");
      return saved !== null ? JSON.parse(saved) : false;
    }
    return false;
  });
  const [keepFiltersAcrossCompanies, setKeepFiltersAcrossCompanies] = useState(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem(
          "fondogeneral-keepFiltersAcrossCompanies",
        );
        return saved !== null ? JSON.parse(saved) : false;
      }
      return false;
    },
  );

  const [columnWidths, setColumnWidths] = useState<Record<string, string>>({
    hora: "110px",
    motivo: "260px",
    tipo: "160px",
    factura: "70px",
    monto: "140px",
    encargado: "120px",
    editar: "120px",
  });
  const resizingRef = useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const filtersDropdownRef = useRef<HTMLDivElement | null>(null);
  const fromCalendarRef = useRef<HTMLDivElement | null>(null);
  const toCalendarRef = useRef<HTMLDivElement | null>(null);
  const fromButtonRef = useRef<HTMLButtonElement | null>(null);
  const toButtonRef = useRef<HTMLButtonElement | null>(null);

  const startResizing = (event: React.MouseEvent, key: string) => {
    event.preventDefault();
    const startWidth = parseInt(columnWidths[key] || "100", 10) || 100;
    resizingRef.current = { key, startX: event.clientX, startWidth };
  };

  useEffect(() => {
    localStorage.setItem("fondogeneral-sortAsc", JSON.stringify(sortAsc));
  }, [sortAsc]);

  // Sync provider filter with selection
  useEffect(() => {
    if (filterProviderCode === "all") {
      setProviderFilter("");
      setProviderSearchInput("");
    } else {
      const option = movementProviders.find(
        (p) => p.code === filterProviderCode,
      );
      const display = option
        ? `${option.name} (${option.code})`
        : filterProviderCode;
      setProviderFilter(display);
      setProviderSearchInput(display);
    }
  }, [filterProviderCode, movementProviders]);

  // Sync type filter with selection
  useEffect(() => {
    if (filterPaymentType === "all") {
      setTypeFilter("");
      setTypeSearchInput("");
    } else {
      const display = formatMovementType(filterPaymentType);
      setTypeFilter(display);
      setTypeSearchInput(display);
    }
  }, [filterPaymentType]);

  // Save rememberFilters. If disabled, clear saved filters from storage.
  useEffect(() => {
    localStorage.setItem(
      "fondogeneral-rememberFilters",
      JSON.stringify(rememberFilters),
    );
    if (!rememberFilters && typeof window !== "undefined") {
      try {
        const keysToClear = [
          "fondogeneral-fromFilter",
          "fondogeneral-toFilter",
          "fondogeneral-filterProviderCode",
          "fondogeneral-filterPaymentType",
          "fondogeneral-filterEditedOnly",
          "fondogeneral-searchQuery",
          "fondogeneral-pageSize",
        ];
        for (const k of keysToClear) localStorage.removeItem(k);
      } catch {
        // ignore storage errors
      }
    }
  }, [rememberFilters]);

  // Save keepFiltersAcrossCompanies preference
  useEffect(() => {
    localStorage.setItem(
      "fondogeneral-keepFiltersAcrossCompanies",
      JSON.stringify(keepFiltersAcrossCompanies),
    );
  }, [keepFiltersAcrossCompanies]);

  // Save filters if rememberFilters is true
  useEffect(() => {
    if (rememberFilters) {
      localStorage.setItem("fondogeneral-fromFilter", fromFilter || "");
      localStorage.setItem("fondogeneral-toFilter", toFilter || "");
      localStorage.setItem(
        "fondogeneral-filterProviderCode",
        filterProviderCode,
      );
      localStorage.setItem("fondogeneral-filterPaymentType", filterPaymentType);
      localStorage.setItem(
        "fondogeneral-filterEditedOnly",
        JSON.stringify(filterEditedOnly),
      );
      localStorage.setItem("fondogeneral-searchQuery", searchQuery);
      localStorage.setItem("fondogeneral-pageSize", String(pageSize));
    }
  }, [
    rememberFilters,
    fromFilter,
    toFilter,
    filterProviderCode,
    filterPaymentType,
    filterEditedOnly,
    searchQuery,
    pageSize,
  ]);

  // Column resize handler
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const r = resizingRef.current;
      if (!r) return;
      const delta = e.clientX - r.startX;
      const newW = Math.max(40, r.startWidth + delta);
      setColumnWidths((prev) => ({ ...prev, [r.key]: `${newW}px` }));
    };
    const onUp = () => {
      resizingRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [columnWidths]);

  // Close calendars when clicking outside
  useEffect(() => {
    if (!calendarFromOpen && !calendarToOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (calendarFromOpen) {
        if (
          fromCalendarRef.current &&
          target &&
          fromCalendarRef.current.contains(target)
        )
          return;
        if (
          fromButtonRef.current &&
          target &&
          fromButtonRef.current.contains(target)
        )
          return;
        setCalendarFromOpen(false);
      }
      if (calendarToOpen) {
        if (
          toCalendarRef.current &&
          target &&
          toCalendarRef.current.contains(target)
        )
          return;
        if (
          toButtonRef.current &&
          target &&
          toButtonRef.current.contains(target)
        )
          return;
        setCalendarToOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [calendarFromOpen, calendarToOpen]);

  // Close filters dropdown on outside click
  useEffect(() => {
    if (!filtersDropdownOpen) return;

    const handler = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        filtersDropdownRef.current &&
        filtersDropdownRef.current.contains(target)
      )
        return;
      setFiltersDropdownOpen(false);
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filtersDropdownOpen]);

  const applyServerSearchFilters = useCallback(() => {
    setAppliedFromFilter(fromFilter);
    setAppliedToFilter(toFilter);
    setAppliedProviderCode(filterProviderCode);
    setAppliedPaymentType(filterPaymentType);
    setAppliedInvoiceNumber(searchQuery.trim());
    setPageIndex(0);
  }, [
    filterPaymentType,
    filterProviderCode,
    fromFilter,
    searchQuery,
    toFilter,
  ]);

  const applyAutomaticDateRange = useCallback(
    (from: string, to: string) => {
      if (!serverFilteringEnabled) return;
      setAppliedFromFilter(from);
      setAppliedToFilter(to);
      setAppliedProviderCode("all");
      setAppliedPaymentType("all");
      setAppliedInvoiceNumber("");
      setPageIndex(0);
    },
    [serverFilteringEnabled],
  );

  const resetAppliedSearchFilters = useCallback(() => {
    setAppliedFromFilter(null);
    setAppliedToFilter(null);
    setAppliedProviderCode("all");
    setAppliedPaymentType("all");
    setAppliedInvoiceNumber("");
    setNotesSearchQuery("");
    setPageIndex(0);
  }, []);

  const effectiveFromFilter = serverFilteringEnabled
    ? appliedFromFilter
    : fromFilter;
  const effectiveToFilter = serverFilteringEnabled ? appliedToFilter : toFilter;
  const effectiveProviderCode = serverFilteringEnabled
    ? appliedProviderCode
    : filterProviderCode;
  const effectivePaymentType = serverFilteringEnabled
    ? appliedPaymentType
    : filterPaymentType;
  const effectiveInvoiceNumber = serverFilteringEnabled
    ? appliedInvoiceNumber
    : searchQuery;

  const hasFirestoreFilterDraft = Boolean(
    (filterProviderCode && filterProviderCode !== "all") ||
      (filterPaymentType && filterPaymentType !== "all") ||
      searchQuery.trim(),
  );

  const displayedEntries = useMemo(() => {
    const sorted = [...fondoEntries].sort(
      (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
    );
    return sortAsc ? sorted.reverse() : sorted;
  }, [fondoEntries, sortAsc]);

  // days that have at least one movement
  const daysWithMovements = useMemo(() => {
    const s = new Set<string>();
    fondoEntries.forEach((entry) => {
      const d = new Date(getPrimaryMovementDateISO(entry));
      if (!Number.isNaN(d.getTime())) s.add(dateKeyFromDate(d));
    });
    return s;
  }, [fondoEntries]);

  // Apply all active filters
  const filteredEntries = useMemo(() => {
    let base = displayedEntries.slice();

    // date filtering (from/to)
    if (effectiveFromFilter || effectiveToFilter) {
      base = base.filter((entry) => {
        const key = dateKeyFromDate(new Date(getPrimaryMovementDateISO(entry)));
        if (effectiveFromFilter && effectiveToFilter)
          return key >= effectiveFromFilter && key <= effectiveToFilter;
        if (effectiveFromFilter && !effectiveToFilter)
          return key === effectiveFromFilter;
        if (!effectiveFromFilter && effectiveToFilter)
          return key === effectiveToFilter;
        return true;
      });
    }

    // restrict by tab mode
    if (mode === "ingreso") {
      base = base.filter((e) => isIngresoType(e.paymentType));
    } else if (mode === "egreso") {
      base = base.filter((e) => isEgresoType(e.paymentType));
    }

    // provider filter
    if (effectiveProviderCode && effectiveProviderCode !== "all") {
      base = base.filter((e) => e.providerCode === effectiveProviderCode);
    }

    // payment type filter
    if (effectivePaymentType && effectivePaymentType !== "all") {
      base = base.filter((e) => e.paymentType === effectivePaymentType);
    }

    // edited only
    if (filterEditedOnly) {
      base = base.filter((e) => !!e.isAudit);
    }

    // Invoice is an exact Firestore-backed filter. Notes remain a local,
    // partial-text filter over the movements already loaded.
    const invoice = effectiveInvoiceNumber.trim().toLowerCase();
    if (invoice) {
      base = base.filter(
        (entry) => String(entry.invoiceNumber ?? "").trim().toLowerCase() === invoice,
      );
    }

    const notesQuery = notesSearchQuery.trim().toLowerCase();
    if (notesQuery) {
      base = base.filter((entry) =>
        String(entry.notes ?? "").toLowerCase().includes(notesQuery),
      );
    }

    return base;
  }, [
    displayedEntries,
    effectiveFromFilter,
    effectiveToFilter,
    effectiveProviderCode,
    effectivePaymentType,
    filterEditedOnly,
    effectiveInvoiceNumber,
    notesSearchQuery,
    mode,
  ]);

  const earliestEntryKey = useMemo<string | null>(() => {
    let earliest: string | null = null;
    filteredEntries.forEach((entry) => {
      const date = new Date(getPrimaryMovementDateISO(entry));
      if (Number.isNaN(date.getTime())) return;
      const key = dateKeyFromDate(date);
      if (!earliest || key < earliest) earliest = key;
    });
    return earliest;
  }, [filteredEntries]);

  const totalPages = useMemo(() => {
    if (pageSize === "all" || pageSize === "daily") return 1;
    return Math.max(1, Math.ceil(filteredEntries.length / pageSize));
  }, [filteredEntries.length, pageSize]);

  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  useEffect(() => {
    if (pageSize === "daily") {
      setPageIndex(0);
      setCurrentDailyKey(todayKey);
      return;
    }
    setPageIndex(0);
  }, [pageSize, todayKey]);

  const paginatedEntries = useMemo(() => {
    if (pageSize === "all") return filteredEntries;
    if (pageSize === "daily") {
      return filteredEntries.filter(
        (entry) =>
          dateKeyFromDate(new Date(getPrimaryMovementDateISO(entry))) ===
          currentDailyKey,
      );
    }
    const start = pageIndex * pageSize;
    return filteredEntries.slice(start, start + pageSize);
  }, [filteredEntries, pageIndex, pageSize, currentDailyKey]);

  const isDailyMode = pageSize === "daily";

  const shiftDateKey = useCallback((key: string, delta: number) => {
    const [yearStr, monthStr, dayStr] = key.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    if (
      !Number.isFinite(year) ||
      !Number.isFinite(month) ||
      !Number.isFinite(day)
    )
      return key;
    const date = new Date(year, month - 1, day);
    date.setDate(date.getDate() + delta);
    return dateKeyFromDate(date);
  }, []);

  const disablePrevButton = isDailyMode
    ? currentDailyKey <= "1970-01-01"
    : pageIndex <= 0;
  const disableNextButton = isDailyMode
    ? currentDailyKey >= todayKey
    : pageIndex >= totalPages - 1;

  const pageRange = useMemo(() => {
    if (filteredEntries.length === 0) return { from: 0, to: 0 };
    if (isDailyMode || pageSize === "all") return { from: 1, to: filteredEntries.length };
    const from = pageIndex * (pageSize as number) + 1;
    const to = Math.min(filteredEntries.length, (pageIndex + 1) * (pageSize as number));
    return { from, to };
  }, [filteredEntries.length, pageIndex, pageSize, isDailyMode]);

  const handlePrevPage = useCallback(() => {
    if (isDailyMode) {
      setCurrentDailyKey((prev) => {
        if (prev <= "1970-01-01") return "1970-01-01";
        return shiftDateKey(prev, -1);
      });
      return;
    }
    setPageIndex((p) => Math.max(0, p - 1));
  }, [isDailyMode, shiftDateKey]);

  const handleNextPage = useCallback(() => {
    if (isDailyMode) {
      setCurrentDailyKey((prev) => {
        if (prev >= todayKey) return todayKey;
        const shifted = shiftDateKey(prev, 1);
        return shifted > todayKey ? todayKey : shifted;
      });
      return;
    }
    setPageIndex((p) => Math.min(totalPages - 1, p + 1));
  }, [isDailyMode, shiftDateKey, todayKey, totalPages]);

  // Group visible entries by day
  const groupedByDay = useMemo(() => {
    const map = new Map<string, FondoEntry[]>();
    paginatedEntries.forEach((entry) => {
      const d = new Date(getPrimaryMovementDateISO(entry));
      const key =
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0");
      const arr = map.get(key) ?? [];
      arr.push(entry);
      map.set(key, arr);
    });
    return map;
  }, [paginatedEntries]);

  const dateOnlyFormatter = useMemo(
    () => new Intl.DateTimeFormat("es-CR", { dateStyle: "medium" }),
    [],
  );
  const formatGroupLabel = (isoDateKey: string) => {
    const [y, m, d] = isoDateKey.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return dateOnlyFormatter.format(date);
  };

  const formatKeyToDisplay = (isoDateKey: string | null) => {
    if (!isoDateKey) return "dd/mm/yyyy";
    const [y, m, d] = isoDateKey.split("-").map(Number);
    const dd = String(d).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const yyyy = String(y);
    return `${dd}/${mm}/${yyyy}`;
  };

  const isFilterActive = useMemo(() => {
    return Boolean(
      effectiveFromFilter ||
      effectiveToFilter ||
      (effectiveProviderCode && effectiveProviderCode !== "all") ||
      (effectivePaymentType && effectivePaymentType !== "all") ||
      filterEditedOnly ||
      effectiveInvoiceNumber.trim().length > 0 ||
      notesSearchQuery.trim().length > 0,
    );
  }, [
    effectiveFromFilter,
    effectiveToFilter,
    effectiveProviderCode,
    effectivePaymentType,
    filterEditedOnly,
    effectiveInvoiceNumber,
    notesSearchQuery,
  ]);

  const isSingleDayFilter = useMemo(() => {
    return Boolean(
      effectiveFromFilter &&
        effectiveToFilter &&
        effectiveFromFilter === effectiveToFilter,
    );
  }, [effectiveFromFilter, effectiveToFilter]);

  return {
    // Page/pagination state
    pageSize,
    setPageSize,
    pageIndex,
    setPageIndex,
    currentDailyKey,
    setCurrentDailyKey,
    // Sort
    sortAsc,
    setSortAsc,
    // Date range
    fromFilter,
    setFromFilter,
    toFilter,
    setToFilter,
    // Calendar UI state
    calendarFromOpen,
    setCalendarFromOpen,
    calendarToOpen,
    setCalendarToOpen,
    calendarFromMonth,
    setCalendarFromMonth,
    calendarToMonth,
    setCalendarToMonth,
    // Provider filter
    filterProviderCode,
    setFilterProviderCode,
    providerFilter,
    setProviderFilter,
    isProviderDropdownOpen,
    setIsProviderDropdownOpen,
    providerSearchInput,
    setProviderSearchInput,
    filteredProvidersForFilter,
    // Payment type filter
    filterPaymentType,
    setFilterPaymentType,
    typeFilter,
    setTypeFilter,
    isTypeDropdownOpen,
    setIsTypeDropdownOpen,
    typeSearchInput,
    setTypeSearchInput,
    // Advanced filters
    filterEditedOnly,
    setFilterEditedOnly,
    filtersDropdownOpen,
    setFiltersDropdownOpen,
    searchQuery,
    setSearchQuery,
    notesSearchQuery,
    setNotesSearchQuery,
    appliedFromFilter,
    appliedToFilter,
    appliedProviderCode,
    appliedPaymentType,
    appliedInvoiceNumber,
    effectiveFromFilter,
    effectiveToFilter,
    effectiveProviderCode,
    effectivePaymentType,
    effectiveInvoiceNumber,
    hasFirestoreFilterDraft,
    applyServerSearchFilters,
    applyAutomaticDateRange,
    resetAppliedSearchFilters,
    rememberFilters,
    setRememberFilters,
    keepFiltersAcrossCompanies,
    setKeepFiltersAcrossCompanies,
    // Column resize
    columnWidths,
    setColumnWidths,
    resizingRef,
    startResizing,
    // Refs for dropdowns/calendars
    filtersDropdownRef,
    fromCalendarRef,
    toCalendarRef,
    fromButtonRef,
    toButtonRef,
    // Derived data
    todayKey,
    providersMap,
    displayedEntries,
    daysWithMovements,
    filteredEntries,
    earliestEntryKey,
    totalPages,
    paginatedEntries,
    isDailyMode,
    shiftDateKey,
    disablePrevButton,
    disableNextButton,
    pageRange,
    handlePrevPage,
    handleNextPage,
    groupedByDay,
    formatGroupLabel,
    formatKeyToDisplay,
    isFilterActive,
    isSingleDayFilter,
    dateOnlyFormatter,
  };
}
