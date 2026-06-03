import {
  Fragment,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import {
  Banknote,
  Clock,
  EyeIcon,
  FileText,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  XCircle,
} from "lucide-react";
import type { MovementAccountKey } from "@/services/movimientos-fondos";
import { FondoDateRangeFilters } from "./FondoDateRangeFilters";
import {
  FONDO_EGRESO_TYPES,
  FONDO_GASTO_TYPES,
  FONDO_INGRESO_TYPES,
} from "../constants";
import type { FondoEntry, FondoMovementType } from "../types";
import { formatMovementType } from "../utils/helpers";

type PageSize = "daily" | number | "all";

interface MovementProviderOption {
  code: string;
  name: string;
  type?: FondoMovementType;
  category?: "Ingreso" | "Gasto" | "Egreso";
  correonotifi?: string;
}

interface Props {
  filterProviderCode: string | "all";
  setFilterProviderCode: Dispatch<SetStateAction<string | "all">>;
  setProviderFilter: Dispatch<SetStateAction<string>>;
  providerSearchInput: string;
  setProviderSearchInput: Dispatch<SetStateAction<string>>;
  isProviderDropdownOpen: boolean;
  setIsProviderDropdownOpen: Dispatch<SetStateAction<boolean>>;
  movementProvidersLoading: boolean;
  filteredProvidersForFilter: MovementProviderOption[];
  filterPaymentType: FondoEntry["paymentType"] | "all";
  setFilterPaymentType: Dispatch<SetStateAction<FondoEntry["paymentType"] | "all">>;
  setTypeFilter: Dispatch<SetStateAction<string>>;
  typeSearchInput: string;
  setTypeSearchInput: Dispatch<SetStateAction<string>>;
  isTypeDropdownOpen: boolean;
  setIsTypeDropdownOpen: Dispatch<SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  filtersDropdownRef: MutableRefObject<HTMLDivElement | null>;
  filtersDropdownOpen: boolean;
  setFiltersDropdownOpen: Dispatch<SetStateAction<boolean>>;
  showPendingClosingCreditInvoices: boolean;
  setShowPendingClosingCreditInvoices: Dispatch<SetStateAction<boolean>>;
  filterEditedOnly: boolean;
  setFilterEditedOnly: Dispatch<SetStateAction<boolean>>;
  quickRange: string | null;
  todayKey: string;
  fromFilter: string | null;
  setFromFilter: Dispatch<SetStateAction<string | null>>;
  toFilter: string | null;
  setToFilter: Dispatch<SetStateAction<string | null>>;
  calendarFromOpen: boolean;
  setCalendarFromOpen: Dispatch<SetStateAction<boolean>>;
  calendarToOpen: boolean;
  setCalendarToOpen: Dispatch<SetStateAction<boolean>>;
  calendarFromMonth: Date;
  setCalendarFromMonth: Dispatch<SetStateAction<Date>>;
  calendarToMonth: Date;
  setCalendarToMonth: Dispatch<SetStateAction<Date>>;
  formatKeyToDisplay: (key: string) => string;
  setQuickRange: Dispatch<SetStateAction<string | null>>;
  setPageSize: Dispatch<SetStateAction<PageSize>>;
  setPageIndex: Dispatch<SetStateAction<number>>;
  fromCalendarRef: MutableRefObject<HTMLDivElement | null>;
  toCalendarRef: MutableRefObject<HTMLDivElement | null>;
  fromButtonRef: MutableRefObject<HTMLButtonElement | null>;
  toButtonRef: MutableRefObject<HTMLButtonElement | null>;
  accountKey: MovementAccountKey;
  setDailyClosingHistoryRange: Dispatch<SetStateAction<string>>;
  setDailyClosingHistoryOpen: Dispatch<SetStateAction<boolean>>;
  closingsAreLoading: boolean;
  pendingCierreDeCaja: boolean;
  handleOpenDailyClosing: () => void;
  handleOpenCreateMovement: () => void | Promise<void>;
  entriesHydrated: boolean;
}

export function FondoFiltersToolbar({
  filterProviderCode,
  setFilterProviderCode,
  setProviderFilter,
  providerSearchInput,
  setProviderSearchInput,
  isProviderDropdownOpen,
  setIsProviderDropdownOpen,
  movementProvidersLoading,
  filteredProvidersForFilter,
  filterPaymentType,
  setFilterPaymentType,
  setTypeFilter,
  typeSearchInput,
  setTypeSearchInput,
  isTypeDropdownOpen,
  setIsTypeDropdownOpen,
  searchQuery,
  setSearchQuery,
  filtersDropdownRef,
  filtersDropdownOpen,
  setFiltersDropdownOpen,
  showPendingClosingCreditInvoices,
  setShowPendingClosingCreditInvoices,
  filterEditedOnly,
  setFilterEditedOnly,
  quickRange,
  todayKey,
  fromFilter,
  setFromFilter,
  toFilter,
  setToFilter,
  calendarFromOpen,
  setCalendarFromOpen,
  calendarToOpen,
  setCalendarToOpen,
  calendarFromMonth,
  setCalendarFromMonth,
  calendarToMonth,
  setCalendarToMonth,
  formatKeyToDisplay,
  setQuickRange,
  setPageSize,
  setPageIndex,
  fromCalendarRef,
  toCalendarRef,
  fromButtonRef,
  toButtonRef,
  accountKey,
  setDailyClosingHistoryRange,
  setDailyClosingHistoryOpen,
  closingsAreLoading,
  pendingCierreDeCaja,
  handleOpenDailyClosing,
  handleOpenCreateMovement,
  entriesHydrated,
}: Props) {
  return (
    <section className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-center">
        {/* Proveedor: busqueda con autocomplete como en el drawer de agregar movimiento */}
        <div className="relative min-w-0">
          <div className="relative">
            {filterProviderCode !== "all" && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFilterProviderCode("all");
                  setProviderFilter("");
                  setProviderSearchInput("");
                }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                tabIndex={-1}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            <input
              value={providerSearchInput}
              onChange={(e) => {
                const value = e.target.value;
                setProviderSearchInput(value);
                setIsProviderDropdownOpen(true);
                if (value.trim() === "") {
                  setFilterProviderCode("all");
                  setProviderFilter("");
                }
              }}
              onFocus={() => setIsProviderDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsProviderDropdownOpen(false), 200);
              }}
              className={`h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)] ${
                filterProviderCode !== "all" ? "pl-10 pr-11" : "pr-11"
              }`}
              placeholder={
                movementProvidersLoading
                  ? "Cargando proveedores..."
                  : "  Buscar proveedor"
              }
            />
            <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
              <Search className="h-4 w-4" />
            </span>
          </div>
          {isProviderDropdownOpen && !movementProvidersLoading && (
            <div className="absolute z-[9999] mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
              {providerSearchInput.trim() === "" && (
                <button
                  type="button"
                  className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                    filterProviderCode === "all"
                      ? "bg-cyan-500/20 text-cyan-50"
                      : "text-cyan-100/70"
                  }`}
                  onMouseDown={() => {
                    setFilterProviderCode("all");
                    setProviderFilter("");
                    setProviderSearchInput("");
                    setIsProviderDropdownOpen(false);
                  }}
                >
                  Todos los proveedores
                </button>
              )}
              {filteredProvidersForFilter.length > 0 ? (
                filteredProvidersForFilter.map((p) => (
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
                      setProviderSearchInput(`${p.name} (${p.code})`);
                      setIsProviderDropdownOpen(false);
                    }}
                  >
                    {p.name} ({p.code})
                  </button>
                ))
              ) : (
                <div className="px-3 py-6 text-center text-sm text-cyan-100/50">
                  No se encontraron proveedores
                </div>
              )}
            </div>
          )}
        </div>

        {/* Tipo de movimiento: busqueda con autocomplete */}
        <div className="relative min-w-0">
          <div className="relative">
            {filterPaymentType !== "all" && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setFilterPaymentType("all");
                  setTypeFilter("");
                  setTypeSearchInput("");
                }}
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 text-red-400 transition-colors hover:text-red-300"
                tabIndex={-1}
              >
                <XCircle className="h-4 w-4" />
              </button>
            )}
            <input
              value={typeSearchInput}
              onChange={(e) => {
                const value = e.target.value;
                setTypeSearchInput(value);
                setIsTypeDropdownOpen(true);
                if (value.trim() === "") {
                  setFilterPaymentType("all");
                  setTypeFilter("");
                }
              }}
              onFocus={() => setIsTypeDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setIsTypeDropdownOpen(false), 200);
              }}
              className={`h-11 w-full rounded border border-cyan-700/35 bg-cyan-950/25 text-sm text-[var(--foreground)] outline-none transition-colors placeholder:text-cyan-100/70 hover:border-cyan-500/45 focus:border-[var(--accent)] ${
                filterPaymentType !== "all" ? "pl-10 pr-11" : "pr-11"
              }`}
              placeholder="  Buscar tipo de movimiento"
            />
            <span className="pointer-events-none absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center text-cyan-100/80">
              <Search className="h-4 w-4" />
            </span>
          </div>
          {isTypeDropdownOpen && (
            <div className="absolute z-[9999] mt-2 w-full max-h-64 overflow-y-auto rounded-lg border border-cyan-600/45 bg-[#0d1117] shadow-2xl shadow-black/70">
              {typeSearchInput.trim() === "" && (
                <button
                  type="button"
                  className={`w-full rounded px-3 py-2 text-left text-sm transition-colors hover:bg-cyan-950/80 ${
                    filterPaymentType === "all"
                      ? "bg-cyan-500/20 text-cyan-50"
                      : "text-cyan-100/70"
                  }`}
                  onMouseDown={() => {
                    setFilterPaymentType("all");
                    setTypeFilter("");
                    setTypeSearchInput("");
                    setIsTypeDropdownOpen(false);
                  }}
                >
                  Todos los tipos
                </button>
              )}
              {(() => {
                const search = typeSearchInput.toLowerCase().trim();
                const hasFilter = search !== "";
                const groups = [
                  { group: "Ingresos", types: FONDO_INGRESO_TYPES },
                  { group: "Gastos", types: FONDO_GASTO_TYPES },
                  { group: "Egresos", types: FONDO_EGRESO_TYPES },
                ];
                return groups.map(({ group, types }) => {
                  const filtered = hasFilter
                    ? types.filter(
                        (t) =>
                          formatMovementType(t).toLowerCase().includes(search) ||
                          t.toLowerCase().includes(search),
                      )
                    : types;
                  if (filtered.length === 0) return null;
                  return (
                    <Fragment key={group}>
                      <div className="px-3 py-1.5 text-xs font-semibold text-cyan-100/50 uppercase tracking-wider">
                        {group}
                      </div>
                      {filtered.map((t) => (
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
                            setTypeSearchInput(formatMovementType(t));
                            setIsTypeDropdownOpen(false);
                          }}
                        >
                          {formatMovementType(t)}
                        </button>
                      ))}
                    </Fragment>
                  );
                });
              })()}
            </div>
          )}
        </div>

        {/* Buscar factura: mantener input con icono tal como estaba */}
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

        <div className="flex min-h-11 w-full items-center rounded-xl border border-cyan-700/35 bg-cyan-950/20 px-3 py-2 text-sm text-[var(--foreground)] xl:justify-self-end">
          <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-center xl:w-auto">
            {/* Dropdown Vista */}
            <div className="relative w-full sm:w-auto" ref={filtersDropdownRef}>
              <button
                type="button"
                onClick={() => setFiltersDropdownOpen((prev) => !prev)}
                className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-transparent px-3 text-xs font-semibold tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)]/20 active:scale-[0.98] sm:w-auto"
                aria-haspopup="menu"
                aria-expanded={filtersDropdownOpen}
                title="Mostrar facturas en especifico estado o editados"
              >
                <EyeIcon className="h-3.5 w-3.5" />
                <span>Vista</span>
              </button>
              {filtersDropdownOpen && (
                <div className="absolute left-1/2 top-full z-[9999] mt-2 w-[260px] -translate-x-1/2 rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] shadow-2xl">
                  <div className="flex flex-col py-1">
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={showPendingClosingCreditInvoices}
                        onChange={(event) =>
                          setShowPendingClosingCreditInvoices(
                            event.target.checked,
                          )
                        }
                        className="h-4 w-4 accent-amber-400"
                      />
                      <FileText className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      <span className="leading-tight">
                        Facturas de crédito pendientes
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20">
                      <input
                        type="checkbox"
                        checked={filterEditedOnly}
                        onChange={(e) => setFilterEditedOnly(e.target.checked)}
                        className="h-4 w-4 rounded border-[var(--input-border)] accent-[var(--accent)]"
                      />
                      <Pencil className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      <span>Editados</span>
                    </label>
                  </div>
                </div>
              )}
            </div>

            {/* Botón limpiar */}
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
              className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--input-border)] bg-transparent px-3 text-xs font-semibold tracking-wide text-[var(--foreground)] transition-all duration-150 hover:border-[var(--accent)] hover:bg-[var(--muted)]/20 active:scale-[0.98] sm:w-auto"
              title="Limpiar filtros"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Limpiar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 border-t border-[var(--input-border)] pt-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <FondoDateRangeFilters
              quickRange={quickRange}
              todayKey={todayKey}
              fromFilter={fromFilter}
              toFilter={toFilter}
              calendarFromOpen={calendarFromOpen}
              calendarToOpen={calendarToOpen}
              calendarFromMonth={calendarFromMonth}
              calendarToMonth={calendarToMonth}
              formatKeyToDisplay={formatKeyToDisplay}
              setQuickRange={setQuickRange}
              setFromFilter={setFromFilter}
              setToFilter={setToFilter}
              setPageSize={setPageSize}
              setPageIndex={setPageIndex}
              setCalendarFromOpen={setCalendarFromOpen}
              setCalendarToOpen={setCalendarToOpen}
              setCalendarFromMonth={setCalendarFromMonth}
              setCalendarToMonth={setCalendarToMonth}
              fromCalendarRef={fromCalendarRef}
              toCalendarRef={toCalendarRef}
              fromButtonRef={fromButtonRef}
              toButtonRef={toButtonRef}
              showTopBorder={false}
            />
          </div>
          {accountKey === "FondoGeneral" && (
            <div className="relative group flex items-end sm:shrink-0">
              <button
                type="button"
                onClick={() => {
                  setDailyClosingHistoryRange("today");
                  setDailyClosingHistoryOpen(true);
                }}
                disabled={closingsAreLoading}
                className="inline-flex h-11 w-full items-center justify-center rounded border border-cyan-700/35 bg-cyan-950/25 text-cyan-100/80 transition-colors hover:border-cyan-500/45 hover:bg-cyan-900/25 hover:text-[var(--foreground)] disabled:opacity-60 sm:w-11"
                title="Cierres anteriores"
                aria-label="Cierres anteriores"
              >
                <Clock className="h-4 w-4" />
              </button>
              <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--card-bg)] border border-[var(--input-border)] text-[var(--foreground)] text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                Cierres anteriores
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--input-border)]"></div>
              </div>
            </div>
          )}
        </div>

        <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:w-auto lg:min-w-[348px]">
          {accountKey === "FondoGeneral" && (
            <div className="relative group min-w-0 flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenDailyClosing}
                  disabled={!pendingCierreDeCaja}
                  className={`flex h-11 flex-1 items-center justify-center gap-2 rounded border px-3 text-sm font-semibold shadow-sm transition-all duration-150 ${
                    !pendingCierreDeCaja
                      ? "cursor-not-allowed border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70"
                      : "border-yellow-600/40 bg-yellow-500/10 text-yellow-400/80 hover:-translate-y-0.5 hover:border-yellow-500/60 hover:bg-yellow-500/20 hover:shadow-md hover:shadow-yellow-950/20 active:translate-y-0 active:scale-[0.99]"
                  }`}
                >
                  <Banknote className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Registrar cierre</span>
                </button>
              </div>
              {!pendingCierreDeCaja && (
                <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-yellow-500 text-black text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  ?? Debe agregar un movimiento de &quot;CIERRE FONDO VENTAS&quot; primero
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                </div>
              )}
            </div>
          )}
          <div className="relative group min-w-0">
            <button
              type="button"
              onClick={handleOpenCreateMovement}
              disabled={
                (accountKey === "FondoGeneral" && pendingCierreDeCaja) ||
                !entriesHydrated
              }
              className={`flex h-11 w-full items-center justify-center gap-2 rounded border px-3 text-sm font-semibold shadow-sm transition-all duration-150 ${
                (accountKey === "FondoGeneral" && pendingCierreDeCaja) ||
                !entriesHydrated
                  ? "cursor-not-allowed border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70"
                  : "border-cyan-500/50 bg-transparent text-cyan-300 hover:-translate-y-0.5 hover:border-cyan-400/70 hover:bg-cyan-500/10 hover:shadow-md hover:shadow-cyan-950/25 active:translate-y-0 active:scale-[0.99]"
              }`}
            >
              <Plus className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Agregar movimiento</span>
            </button>
            {accountKey === "FondoGeneral" &&
              pendingCierreDeCaja &&
              entriesHydrated && (
                <div className="hidden sm:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-yellow-500 text-black text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none">
                  Debe realizar el &quot;Registrar cierre&quot; para seguir agregando movimientos
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                </div>
              )}
          </div>
        </div>
      </div>
    </section>
  );
}
