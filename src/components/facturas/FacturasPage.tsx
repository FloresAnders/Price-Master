"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Plus,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Search,
} from "lucide-react";
import { useProviders } from "@/hooks/useProviders";
import { useAuth } from "@/hooks/useAuth";
import useToast from "@/hooks/useToast";
import { FacturasService, type FacturaMovement } from "@/services/facturas";

const formatMovementType = (type: string) => {
  const trimmed = String(type || "").trim();
  if (!trimmed) return "";
  return trimmed.replace(/_/g, " ");
};

const dateKeyFromDate = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const dateKeyFromIso = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return dateKeyFromDate(d);
};

const formatKeyToDisplay = (key: string): string => {
  const parts = String(key || "").split("-");
  if (parts.length !== 3) return key;
  const [yyyy, mm, dd] = parts;
  return `${dd}/${mm}/${yyyy}`;
};

export default function FacturasCreditoPage() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const company = useMemo(
    () => String(user?.ownercompanie || "").trim(),
    [user?.ownercompanie],
  );

  const { providers, loading: providersLoading } = useProviders(company);

  const [movements, setMovements] = useState<FacturaMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);

  // Filter state (mirrors Fondo toolbar names)
  const [providerFilter, setProviderFilter] = useState("");
  const [filterProviderCode, setFilterProviderCode] = useState<string>("all");
  const [isProviderDropdownOpen, setIsProviderDropdownOpen] = useState(false);

  const [typeFilter, setTypeFilter] = useState("");
  const [filterPaymentType, setFilterPaymentType] = useState<string>("all");
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterEditedOnly, setFilterEditedOnly] = useState(false);

  const [fromFilter, setFromFilter] = useState<string | null>(null);
  const [toFilter, setToFilter] = useState<string | null>(null);
  const [quickRange, setQuickRange] = useState<string | null>(null);

  const [calendarFromOpen, setCalendarFromOpen] = useState(false);
  const [calendarToOpen, setCalendarToOpen] = useState(false);
  const [calendarFromMonth, setCalendarFromMonth] = useState<Date>(() => {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    return m;
  });
  const [calendarToMonth, setCalendarToMonth] = useState<Date>(() => {
    const m = new Date();
    m.setDate(1);
    m.setHours(0, 0, 0, 0);
    return m;
  });

  const [pageSize, setPageSize] = useState<"daily" | "all">("daily");
  const [pageIndex, setPageIndex] = useState(0);

  const fromButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const toButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const fromCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const toCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const providerDropdownRef = React.useRef<HTMLDivElement | null>(null);
  const typeDropdownRef = React.useRef<HTMLDivElement | null>(null);

  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  useEffect(() => {
    let cancelled = false;
    if (!company) {
      setMovements([]);
      return;
    }

    setMovementsLoading(true);
    FacturasService.listMovementsByEmpresa(company, { limit: 800 })
      .then((data) => {
        if (cancelled) return;
        setMovements(data);
      })
      .catch((err) => {
        console.error("[FACTURAS] Error loading movements:", err);
        if (!cancelled) {
          showToast(
            "No se pudieron cargar las facturas. Intente de nuevo.",
            "error",
            5000,
          );
        }
      })
      .finally(() => {
        if (!cancelled) setMovementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [company, showToast]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;

      if (
        isProviderDropdownOpen &&
        providerDropdownRef.current &&
        !providerDropdownRef.current.contains(target)
      ) {
        setIsProviderDropdownOpen(false);
      }
      if (
        isTypeDropdownOpen &&
        typeDropdownRef.current &&
        !typeDropdownRef.current.contains(target)
      ) {
        setIsTypeDropdownOpen(false);
      }

      if (
        calendarFromOpen &&
        fromCalendarRef.current &&
        fromButtonRef.current &&
        !fromCalendarRef.current.contains(target) &&
        !fromButtonRef.current.contains(target)
      ) {
        setCalendarFromOpen(false);
      }

      if (
        calendarToOpen &&
        toCalendarRef.current &&
        toButtonRef.current &&
        !toCalendarRef.current.contains(target) &&
        !toButtonRef.current.contains(target)
      ) {
        setCalendarToOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [
    calendarFromOpen,
    calendarToOpen,
    isProviderDropdownOpen,
    isTypeDropdownOpen,
  ]);

  const providerNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of providers) map.set(p.code, p.name || p.code);
    return map;
  }, [providers]);

  const movementTypes = useMemo(() => {
    const set = new Set<string>();
    for (const m of movements) {
      const t = String(m.paymentType || "").trim();
      if (t) set.add(t);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [movements]);

  // Keep the toolbar JSX structure intact.
  const FONDO_INGRESO_TYPES = movementTypes;
  const FONDO_GASTO_TYPES: string[] = [];
  const FONDO_EGRESO_TYPES: string[] = [];

  const filteredMovements = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return movements.filter((m) => {
      if (filterProviderCode !== "all" && m.providerCode !== filterProviderCode)
        return false;
      if (filterPaymentType !== "all" && m.paymentType !== filterPaymentType)
        return false;

      if (fromFilter || toFilter) {
        const key = dateKeyFromIso(m.createdAt);
        if (fromFilter && key && key < fromFilter) return false;
        if (toFilter && key && key > toFilter) return false;
      }

      if (filterEditedOnly) {
        // Facturas copy doesn't currently persist audit fields; keep checkbox behavior non-breaking.
        const anyAudit = Boolean((m as any).isAudit);
        if (!anyAudit) return false;
      }

      if (q) {
        const haystack = [
          m.invoiceNumber,
          m.providerCode,
          providerNameByCode.get(m.providerCode) || "",
          m.notes,
          m.manager,
          m.paymentType,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    movements,
    filterProviderCode,
    filterPaymentType,
    fromFilter,
    toFilter,
    filterEditedOnly,
    searchQuery,
    providerNameByCode,
  ]);

  const handleOpenCreateMovement = () => {
    showToast(
      "Para registrar una factura a crédito, cree el movimiento como FCR en Fondo General.",
      "info",
      5000,
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-2 py-3 sm:px-4 sm:py-6 lg:py-8">
      <div className="rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] p-3 shadow-sm sm:p-4 md:p-5 space-y-4">
        <section className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
            {/* Proveedor */}
            <div className="relative min-w-0" ref={providerDropdownRef}>
              <button
                type="button"
                onClick={() => setIsProviderDropdownOpen((prev) => !prev)}
                className="h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 focus:border-[var(--accent)] flex items-center justify-between"
                title="Filtrar por proveedor"
                aria-label="Filtrar por proveedor"
              >
                <span className="flex items-center gap-2 truncate">
                  <Search className="h-4 w-4 text-cyan-100/80" />
                  <span className={providerFilter ? "" : "text-cyan-100/70"}>
                    {providerFilter ||
                      (providersLoading ? "Cargando..." : "Proveedor")}
                  </span>
                </span>
                <span className="text-cyan-100/80">⌄</span>
              </button>
              {isProviderDropdownOpen && (
                <div className="absolute z-[9999] mt-2 w-full max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                    onMouseDown={() => {
                      setFilterProviderCode("all");
                      setProviderFilter("");
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    Todos los proveedores
                  </button>
                  {providers.map((p) => (
                    <button
                      key={p.code}
                      type="button"
                      className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                        filterProviderCode === p.code
                          ? "bg-cyan-500/20 text-cyan-50"
                          : "text-[var(--foreground)]"
                      }`}
                      onMouseDown={() => {
                        setFilterProviderCode(p.code);
                        setProviderFilter(`${p.name} (${p.code})`);
                        setIsProviderDropdownOpen(false);
                      }}
                    >
                      {p.name} ({p.code})
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tipo */}
            <div className="relative min-w-0" ref={typeDropdownRef}>
              <button
                type="button"
                onClick={() => setIsTypeDropdownOpen((prev) => !prev)}
                className="h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 px-3 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-cyan-500/45 focus:border-[var(--accent)] flex items-center justify-between"
                title="Filtrar por tipo"
                aria-label="Filtrar por tipo"
              >
                <span className={typeFilter ? "" : "text-cyan-100/70"}>
                  {typeFilter || "Tipo movimiento"}
                </span>
                <span className="text-cyan-100/80">⌄</span>
              </button>
              {isTypeDropdownOpen && (
                <div className="absolute z-[9999] mt-2 w-full max-h-56 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
                  <button
                    type="button"
                    className="w-full rounded px-3 py-2 text-left text-sm text-cyan-100/70 transition-colors hover:bg-cyan-950/80"
                    onMouseDown={() => {
                      setFilterPaymentType("all");
                      setTypeFilter("");
                      setIsTypeDropdownOpen(false);
                    }}
                  >
                    Todos los tipos
                  </button>
                  {[
                    { group: "Ingresos", types: FONDO_INGRESO_TYPES },
                    { group: "Gastos", types: FONDO_GASTO_TYPES },
                    { group: "Egresos", types: FONDO_EGRESO_TYPES },
                  ].map(({ group, types }) => (
                    <React.Fragment key={group}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-cyan-100/50 uppercase">
                        {group}
                      </div>
                      {types.map((t) => (
                        <button
                          key={t}
                          type="button"
                          className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                            filterPaymentType === t
                              ? "bg-cyan-500/20 text-cyan-50"
                              : "text-[var(--foreground)]"
                          }`}
                          onMouseDown={() => {
                            setFilterPaymentType(t);
                            setTypeFilter(formatMovementType(t));
                            setIsTypeDropdownOpen(false);
                          }}
                        >
                          {formatMovementType(t)}
                        </button>
                      ))}
                      {types.length === 0 && (
                        <div className="px-3 pb-2 text-xs text-cyan-100/40">
                          —
                        </div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>

            {/* Buscar */}
            <div className="relative min-w-0">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar factura, notas..."
                className="h-11 w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] py-2 pl-3 pr-11 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--muted-foreground)] hover:border-[var(--accent)]/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1"
                aria-label="Buscar movimientos"
              />
              <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)]">
                <Search className="h-4 w-4" />
              </span>
            </div>

            <div className="flex h-11 min-w-0 flex-col justify-center gap-2 rounded border border-cyan-700/35 bg-cyan-950/25 px-3 py-0 text-sm text-[var(--foreground)] sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center justify-between gap-3 sm:w-full">
                <div>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filterEditedOnly}
                      onChange={(e) => setFilterEditedOnly(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--accent)]"
                    />
                    <span className="text-sm">Editados</span>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setFilterProviderCode("all");
                    setFilterPaymentType("all");
                    setFilterEditedOnly(false);
                    setSearchQuery("");
                    setFromFilter(null);
                    setToFilter(null);
                    setQuickRange(null);

                    setCalendarFromOpen(false);
                    setCalendarToOpen(false);
                    const m = new Date();
                    m.setDate(1);
                    m.setHours(0, 0, 0, 0);
                    setCalendarFromMonth(new Date(m));
                    setCalendarToMonth(new Date(m));

                    setPageSize("daily");
                    setPageIndex(0);
                  }}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded border border-[var(--input-border)] px-3 text-xs font-semibold uppercase tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)] active:scale-[0.98]"
                  title="Limpiar filtros"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Limpiar</span>
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-[var(--input-border)] pt-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_minmax(150px,170px)] lg:items-end">
              <div className="relative min-w-0">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Desde
                </label>
                <button
                  type="button"
                  ref={fromButtonRef}
                  onClick={() => setCalendarFromOpen((prev) => !prev)}
                  className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] [&_[aria-disabled='true']]:opacity-25"
                  title="Seleccionar fecha desde"
                  aria-label="Seleccionar fecha desde"
                >
                  <span className="truncate text-sm font-medium">
                    {fromFilter ? formatKeyToDisplay(fromFilter) : "dd/mm/yyyy"}
                  </span>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                </button>

                {calendarFromOpen && (
                  <div
                    ref={fromCalendarRef}
                    className="absolute left-0 top-full mt-1 sm:mt-2 z-50 w-full min-w-[280px] sm:w-72"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 sm:p-3 text-[var(--foreground)] shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const m = new Date(calendarFromMonth);
                            m.setMonth(m.getMonth() - 1);
                            setCalendarFromMonth(new Date(m));
                          }}
                          className="p-1 rounded hover:bg-[var(--muted)]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="text-sm font-semibold capitalize">
                          {calendarFromMonth.toLocaleString("es-CR", {
                            month: "long",
                            year: "numeric",
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const m = new Date(calendarFromMonth);
                            m.setMonth(m.getMonth() + 1);
                            setCalendarFromMonth(new Date(m));
                          }}
                          className="p-1 rounded hover:bg-[var(--muted)]"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                        {[
                          "D",
                          "L",
                          "M",
                          "M",
                          "J",
                          "V",
                          "S",
                        ].map((d, i) => (
                          <div key={`${d}-${i}`} className="py-1">
                            {d}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                        {(() => {
                          const cells: React.ReactNode[] = [];
                          const year = calendarFromMonth.getFullYear();
                          const month = calendarFromMonth.getMonth();
                          const first = new Date(year, month, 1);
                          const start = first.getDay();
                          const daysInMonth = new Date(
                            year,
                            month + 1,
                            0,
                          ).getDate();

                          for (let i = 0; i < start; i++)
                            cells.push(<div key={`pad-f-${i}`} />);

                          for (let day = 1; day <= daysInMonth; day++) {
                            const d = new Date(year, month, day);
                            const key = dateKeyFromDate(d);
                            const enabled = key <= todayKey;
                            const isSelected = fromFilter === key;
                            if (enabled) {
                              cells.push(
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setQuickRange(null);
                                    setFromFilter(key);
                                    setCalendarFromOpen(false);
                                    setPageSize("all");
                                    setPageIndex(0);
                                  }}
                                  className={`py-1 rounded ${
                                    isSelected
                                      ? "bg-[var(--accent)] text-white"
                                      : "hover:bg-[var(--muted)]"
                                  }`}
                                >
                                  {day}
                                </button>,
                              );
                            } else {
                              cells.push(
                                <div
                                  key={key}
                                  className="py-1 text-[var(--muted-foreground)] opacity-60"
                                >
                                  {day}
                                </div>,
                              );
                            }
                          }
                          return cells;
                        })()}
                      </div>

                      <div className="mt-3 flex justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const todayKey = dateKeyFromDate(new Date());
                            setQuickRange(null);
                            setFromFilter(todayKey);
                            setCalendarFromOpen(false);
                          }}
                          className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        >
                          Limpiar
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarFromOpen(false)}
                          className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="relative min-w-0">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Hasta
                </label>
                <button
                  type="button"
                  ref={toButtonRef}
                  onClick={() => setCalendarToOpen((prev) => !prev)}
                  className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  title="Seleccionar fecha hasta"
                  aria-label="Seleccionar fecha hasta"
                >
                  <span className="truncate text-sm font-medium">
                    {toFilter ? formatKeyToDisplay(toFilter) : "dd/mm/yyyy"}
                  </span>
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
                    <CalendarDays className="h-4 w-4" />
                  </span>
                </button>

                {calendarToOpen && (
                  <div
                    ref={toCalendarRef}
                    className="absolute left-0 top-full mt-2 z-50 w-full sm:w-64"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-3 text-[var(--foreground)] shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const m = new Date(calendarToMonth);
                            m.setMonth(m.getMonth() - 1);
                            setCalendarToMonth(new Date(m));
                          }}
                          className="p-1 rounded hover:bg-[var(--muted)]"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <div className="text-sm font-semibold capitalize">
                          {calendarToMonth.toLocaleString("es-CR", {
                            month: "long",
                            year: "numeric",
                          })}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const m = new Date(calendarToMonth);
                            m.setMonth(m.getMonth() + 1);
                            setCalendarToMonth(new Date(m));
                          }}
                          className="p-1 rounded hover:bg-[var(--muted)]"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted-foreground)]">
                        {[
                          "D",
                          "L",
                          "M",
                          "M",
                          "J",
                          "V",
                          "S",
                        ].map((d, i) => (
                          <div key={`${d}-${i}`} className="py-1">
                            {d}
                          </div>
                        ))}
                      </div>

                      <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                        {(() => {
                          const cells: React.ReactNode[] = [];
                          const year = calendarToMonth.getFullYear();
                          const month = calendarToMonth.getMonth();
                          const first = new Date(year, month, 1);
                          const start = first.getDay();
                          const daysInMonth = new Date(
                            year,
                            month + 1,
                            0,
                          ).getDate();

                          for (let i = 0; i < start; i++)
                            cells.push(<div key={`pad-t-${i}`} />);

                          for (let day = 1; day <= daysInMonth; day++) {
                            const d = new Date(year, month, day);
                            const key = dateKeyFromDate(d);
                            const enabled = key <= todayKey;
                            const isSelected = toFilter === key;
                            if (enabled) {
                              cells.push(
                                <button
                                  key={key}
                                  type="button"
                                  onClick={() => {
                                    setQuickRange(null);
                                    setToFilter(key);
                                    setCalendarToOpen(false);
                                    setPageSize("all");
                                    setPageIndex(0);
                                  }}
                                  className={`py-1 rounded ${
                                    isSelected
                                      ? "bg-[var(--accent)] text-white"
                                      : "hover:bg-[var(--muted)]"
                                  }`}
                                >
                                  {day}
                                </button>,
                              );
                            } else {
                              cells.push(
                                <div
                                  key={key}
                                  className="py-1 text-[var(--muted-foreground)] opacity-60"
                                >
                                  {day}
                                </div>,
                              );
                            }
                          }
                          return cells;
                        })()}
                      </div>

                      <div className="mt-3 flex justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const todayKey = dateKeyFromDate(new Date());
                            setQuickRange(null);
                            setToFilter(todayKey);
                            setCalendarToOpen(false);
                          }}
                          className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        >
                          Limpiar
                        </button>
                        <button
                          type="button"
                          onClick={() => setCalendarToOpen(false)}
                          className="px-2 py-1 rounded border border-[var(--input-border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        >
                          Cerrar
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Filtro
                </label>
                <select
                  className="h-11 w-full min-w-0 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm font-medium text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus-visible:ring-2 focus-visible:ring-[var(--accent)]/60 focus-visible:ring-offset-1"
                  value={quickRange || ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setQuickRange(v || null);
                    const now = new Date();
                    let from: Date | null = null;
                    let to: Date | null = null;
                    if (v === "today") {
                      const t = new Date(now);
                      from = to = t;
                    } else if (v === "yesterday") {
                      const y = new Date(now);
                      y.setDate(now.getDate() - 1);
                      from = to = y;
                    } else if (v === "thisweek") {
                      const day = now.getDay();
                      const diff =
                        now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
                      from = new Date(now.setDate(diff));
                      to = new Date();
                    } else if (v === "lastweek") {
                      const day = now.getDay();
                      const diff =
                        now.getDate() -
                        day +
                        (day === 0 ? -6 : 1) -
                        7;
                      from = new Date(now.getFullYear(), now.getMonth(), diff);
                      to = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        diff + 6,
                      );
                    } else if (v === "lastmonth") {
                      const first = new Date(
                        now.getFullYear(),
                        now.getMonth() - 1,
                        1,
                      );
                      const last = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        0,
                      );
                      from = first;
                      to = last;
                    } else if (v === "month") {
                      const first = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        1,
                      );
                      const last = new Date(
                        now.getFullYear(),
                        now.getMonth() + 1,
                        0,
                      );
                      from = first;
                      to = last;
                    } else if (v === "last30") {
                      const last = new Date();
                      const first = new Date();
                      first.setDate(last.getDate() - 29);
                      from = first;
                      to = last;
                    }
                    if (from && to) {
                      setFromFilter(dateKeyFromDate(from));
                      setToFilter(dateKeyFromDate(to));
                      setPageSize("all");
                      setPageIndex(0);
                    }
                  }}
                >
                  <option value="">Filtro de fecha</option>
                  <option value="today">Hoy</option>
                  <option value="yesterday">Ayer</option>
                  <option value="thisweek">Esta semana</option>
                  <option value="lastweek">Semana anterior</option>
                  <option value="lastmonth">Mes anterior</option>
                  <option value="last30">Últimos 30 días</option>
                  <option value="month">Mes actual</option>
                </select>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[348px]">
              <div className="relative group min-w-0">
                <button
                  type="button"
                  onClick={handleOpenCreateMovement}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded border border-[var(--accent)] bg-[var(--accent)] px-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] hover:shadow-md hover:shadow-sky-950/25 active:translate-y-0 active:scale-[0.99]"
                >
                  <Plus className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Agregar factura</span>
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[var(--input-border)]">
            <div className="text-sm font-semibold text-[var(--foreground)]">
              Facturas ({filteredMovements.length})
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {movementsLoading ? "Cargando..." : company || ""}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-[var(--muted-foreground)]">
                <tr className="border-b border-[var(--input-border)]">
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Proveedor</th>
                  <th className="px-3 py-2 text-left">Factura</th>
                  <th className="px-3 py-2 text-left">Tipo</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-left">Doc</th>
                </tr>
              </thead>
              <tbody>
                {filteredMovements.map((m) => {
                  const amount =
                    m.amountEgreso > 0 ? -m.amountEgreso : m.amountIngreso;
                  const amountLabel =
                    amount < 0
                      ? `-${Math.abs(amount).toLocaleString("es-CR")}`
                      : amount.toLocaleString("es-CR");
                  return (
                    <tr
                      key={m.id}
                      className="border-b border-[var(--input-border)] hover:bg-[var(--muted)]/10"
                    >
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatKeyToDisplay(dateKeyFromIso(m.createdAt))}
                      </td>
                      <td className="px-3 py-2">
                        <div className="truncate max-w-[280px]">
                          {providerNameByCode.get(m.providerCode) ||
                            m.providerCode}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)]">
                          {m.providerCode}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {m.invoiceNumber}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {formatMovementType(m.paymentType)}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {amountLabel} {m.currency}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {m.invoiceDocType}
                      </td>
                    </tr>
                  );
                })}
                {!movementsLoading && filteredMovements.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-6 text-center text-sm text-[var(--muted-foreground)]"
                    >
                      No hay facturas para los filtros seleccionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
