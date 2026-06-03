import type {
  Dispatch,
  MutableRefObject,
  ReactNode,
  SetStateAction,
} from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { dateKeyFromDate } from "../utils/helpers";

interface Props {
  quickRange: string | null;
  todayKey: string;
  fromFilter: string | null;
  toFilter: string | null;
  calendarFromOpen: boolean;
  calendarToOpen: boolean;
  calendarFromMonth: Date;
  calendarToMonth: Date;
  formatKeyToDisplay: (key: string) => string;
  setQuickRange: Dispatch<SetStateAction<string | null>>;
  setFromFilter: Dispatch<SetStateAction<string | null>>;
  setToFilter: Dispatch<SetStateAction<string | null>>;
  setPageSize: Dispatch<SetStateAction<"daily" | number | "all">>;
  setPageIndex: Dispatch<SetStateAction<number>>;
  setCalendarFromOpen: Dispatch<SetStateAction<boolean>>;
  setCalendarToOpen: Dispatch<SetStateAction<boolean>>;
  setCalendarFromMonth: Dispatch<SetStateAction<Date>>;
  setCalendarToMonth: Dispatch<SetStateAction<Date>>;
  fromCalendarRef: MutableRefObject<HTMLDivElement | null>;
  toCalendarRef: MutableRefObject<HTMLDivElement | null>;
  fromButtonRef: MutableRefObject<HTMLButtonElement | null>;
  toButtonRef: MutableRefObject<HTMLButtonElement | null>;
  rightSlot?: ReactNode;
  showTopBorder?: boolean;
  className?: string;
}

function renderMonthCells({
  monthDate,
  todayKey,
  selectedKey,
  padKeyPrefix,
  onSelectDay,
}: {
  monthDate: Date;
  todayKey: string;
  selectedKey: string | null;
  padKeyPrefix: string;
  onSelectDay: (key: string) => void;
}) {
  const cells: ReactNode[] = [];
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const first = new Date(year, month, 1);
  const start = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < start; i++) {
    cells.push(<div key={`pad-${padKeyPrefix}-${i}`} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const key = dateKeyFromDate(d);
    const enabled = key <= todayKey;
    const isSelected = selectedKey === key;

    if (enabled) {
      cells.push(
        <button
          key={key}
          type="button"
          onClick={() => onSelectDay(key)}
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
}

export function FondoDateRangeFilters({
  quickRange,
  todayKey,
  fromFilter,
  toFilter,
  calendarFromOpen,
  calendarToOpen,
  calendarFromMonth,
  calendarToMonth,
  formatKeyToDisplay,
  setQuickRange,
  setFromFilter,
  setToFilter,
  setPageSize,
  setPageIndex,
  setCalendarFromOpen,
  setCalendarToOpen,
  setCalendarFromMonth,
  setCalendarToMonth,
  fromCalendarRef,
  toCalendarRef,
  fromButtonRef,
  toButtonRef,
  rightSlot,
  showTopBorder = true,
  className,
}: Props) {
  return (
    <div
      className={[
        "w-full min-w-0",
        showTopBorder ? "border-t border-[var(--input-border)] pt-3" : "",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_minmax(150px,170px)_auto] xl:items-end">
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
                  {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                    <div key={`${d}-${i}`} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                  {renderMonthCells({
                    monthDate: calendarFromMonth,
                    todayKey,
                    selectedKey: fromFilter,
                    padKeyPrefix: "f",
                    onSelectDay: (key) => {
                      setQuickRange(null);
                      setFromFilter(key);
                      setCalendarFromOpen(false);
                      setPageSize("all");
                      setPageIndex(0);
                    },
                  })}
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
                  {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
                    <div key={`${d}-${i}`} className="py-1">
                      {d}
                    </div>
                  ))}
                </div>

                <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                  {renderMonthCells({
                    monthDate: calendarToMonth,
                    todayKey,
                    selectedKey: toFilter,
                    padKeyPrefix: "t",
                    onSelectDay: (key) => {
                      setQuickRange(null);
                      setToFilter(key);
                      setCalendarToOpen(false);
                      setPageSize("all");
                      setPageIndex(0);
                    },
                  })}
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
                const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes como inicio
                from = new Date(now.setDate(diff));
                to = new Date();
              } else if (v === "lastweek") {
                const day = now.getDay();
                const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
                from = new Date(now.getFullYear(), now.getMonth(), diff);
                to = new Date(now.getFullYear(), now.getMonth(), diff + 6);
              } else if (v === "lastmonth") {
                const first = new Date(
                  now.getFullYear(),
                  now.getMonth() - 1,
                  1,
                );
                const last = new Date(now.getFullYear(), now.getMonth(), 0);
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

        {rightSlot ? <div className="flex items-end">{rightSlot}</div> : null}
      </div>
    </div>
  );
}
