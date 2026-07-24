import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock3, RefreshCw, Trash2 } from "lucide-react";
import { getLayoutPref, setLayoutPref } from "../../../services/layoutPrefsDb";
import type { RegistroTucanRecord } from "../../../types/firestore";
import { iconBoxClass, sectionClass } from "./styles";
import type { RegistroTucanSortOrder } from "./types";

type RegistroTucanColumnKey =
  | "fecha"
  | "hora"
  | "saldoPaginaTucan"
  | "saldoFondoTucan"
  | "pagosHoy"
  | "total"
  | "usuario"
  | "acciones";

type RegistroTucanColumn = {
  key: RegistroTucanColumnKey;
  label: string;
  defaultWidth: number;
  minWidth: number;
};

const COLUMN_WIDTHS_PREF_KEY = "registro-tucan-records-column-widths";
const MAX_COLUMN_WIDTH = 800;
const KEYBOARD_RESIZE_STEP = 10;
const KEYBOARD_RESIZE_LARGE_STEP = 40;

const BASE_COLUMNS: RegistroTucanColumn[] = [
  { key: "fecha", label: "Fecha", defaultWidth: 120, minWidth: 90 },
  { key: "hora", label: "Hora", defaultWidth: 100, minWidth: 80 },
  {
    key: "saldoPaginaTucan",
    label: "Pagina Tucan",
    defaultWidth: 160,
    minWidth: 120,
  },
  {
    key: "saldoFondoTucan",
    label: "Fondo Tucan",
    defaultWidth: 160,
    minWidth: 120,
  },
  { key: "pagosHoy", label: "pagosHoy", defaultWidth: 140, minWidth: 110 },
  { key: "total", label: "Total", defaultWidth: 140, minWidth: 110 },
  { key: "usuario", label: "Usuario", defaultWidth: 240, minWidth: 140 },
];

const ACTIONS_COLUMN: RegistroTucanColumn = {
  key: "acciones",
  label: "Acciones",
  defaultWidth: 100,
  minWidth: 90,
};

function buildDefaultColumnWidths(): Record<RegistroTucanColumnKey, number> {
  return [...BASE_COLUMNS, ACTIONS_COLUMN].reduce(
    (acc, column) => {
      acc[column.key] = column.defaultWidth;
      return acc;
    },
    {} as Record<RegistroTucanColumnKey, number>,
  );
}

function clampColumnWidth(value: number, column: RegistroTucanColumn): number {
  return Math.max(column.minWidth, Math.min(MAX_COLUMN_WIDTH, value));
}

type RegistroTucanRecordsProps = {
  records: RegistroTucanRecord[];
  recordsLoading: boolean;
  sortOrder: RegistroTucanSortOrder;
  canDeleteRecords: boolean;
  onSortOrderChange: (value: RegistroTucanSortOrder) => void;
  onRefresh: () => void;
  onDelete: (record: RegistroTucanRecord) => void;
  formatCRC: (value: number) => string;
};

export function RegistroTucanRecords({
  records,
  recordsLoading,
  sortOrder,
  canDeleteRecords,
  onSortOrderChange,
  onRefresh,
  onDelete,
  formatCRC,
}: RegistroTucanRecordsProps) {
  const columns = useMemo(
    () => (canDeleteRecords ? [...BASE_COLUMNS, ACTIONS_COLUMN] : BASE_COLUMNS),
    [canDeleteRecords],
  );
  const columnsByKey = useMemo(
    () => new Map(columns.map((column) => [column.key, column])),
    [columns],
  );
  const [columnWidths, setColumnWidths] = useState<
    Record<RegistroTucanColumnKey, number>
  >(buildDefaultColumnWidths);
  const resizeStateRef = useRef<{
    key: RegistroTucanColumnKey;
    startX: number;
    startWidth: number;
  } | null>(null);
  const latestColumnWidthsRef = useRef(columnWidths);
  const previousBodyStylesRef = useRef<{
    cursor: string;
    userSelect: string;
  } | null>(null);

  useEffect(() => {
    latestColumnWidthsRef.current = columnWidths;
  }, [columnWidths]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const saved = await getLayoutPref<Partial<Record<string, number>>>(
          COLUMN_WIDTHS_PREF_KEY,
        );
        if (cancelled || !saved || typeof saved !== "object") return;

        setColumnWidths((prev) => {
          const next = { ...prev };
          for (const column of [...BASE_COLUMNS, ACTIONS_COLUMN]) {
            const savedWidth = saved[column.key];
            if (typeof savedWidth !== "number" || !Number.isFinite(savedWidth)) {
              continue;
            }
            next[column.key] = clampColumnWidth(savedWidth, column);
          }
          return next;
        });
      } catch {
        // Keep defaults when IndexedDB is unavailable.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const persistColumnWidths = useCallback(
    (widths: Record<RegistroTucanColumnKey, number>) => {
      void setLayoutPref(COLUMN_WIDTHS_PREF_KEY, widths).catch(() => {
        // Ignore layout preference persistence failures.
      });
    },
    [],
  );

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const state = resizeStateRef.current;
      if (!state) return;
      const column = columnsByKey.get(state.key);
      if (!column) return;

      const delta = event.clientX - state.startX;
      const nextWidth = clampColumnWidth(state.startWidth + delta, column);
      setColumnWidths((prev) => {
        const next = { ...prev, [state.key]: nextWidth };
        latestColumnWidthsRef.current = next;
        return next;
      });
    };

    const handlePointerUp = () => {
      if (!resizeStateRef.current) return;
      resizeStateRef.current = null;
      if (previousBodyStylesRef.current) {
        document.body.style.cursor = previousBodyStylesRef.current.cursor;
        document.body.style.userSelect =
          previousBodyStylesRef.current.userSelect;
        previousBodyStylesRef.current = null;
      }
      persistColumnWidths(latestColumnWidthsRef.current);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      if (previousBodyStylesRef.current) {
        document.body.style.cursor = previousBodyStylesRef.current.cursor;
        document.body.style.userSelect =
          previousBodyStylesRef.current.userSelect;
        previousBodyStylesRef.current = null;
      }
    };
  }, [columnsByKey, persistColumnWidths]);

  const startColumnResize = useCallback(
    (event: React.PointerEvent, key: RegistroTucanColumnKey) => {
      const column = columnsByKey.get(key);
      if (!column) return;

      event.preventDefault();
      event.stopPropagation();
      resizeStateRef.current = {
        key,
        startX: event.clientX,
        startWidth: columnWidths[key] ?? column.defaultWidth,
      };
      previousBodyStylesRef.current = {
        cursor: document.body.style.cursor,
        userSelect: document.body.style.userSelect,
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [columnWidths, columnsByKey],
  );

  const adjustColumnWidth = useCallback(
    (key: RegistroTucanColumnKey, delta: number) => {
      const column = columnsByKey.get(key);
      if (!column) return;

      setColumnWidths((prev) => {
        const currentWidth = prev[key] ?? column.defaultWidth;
        const nextWidth = clampColumnWidth(currentWidth + delta, column);
        if (nextWidth === currentWidth) return prev;

        const next = { ...prev, [key]: nextWidth };
        latestColumnWidthsRef.current = next;
        persistColumnWidths(next);
        return next;
      });
    },
    [columnsByKey, persistColumnWidths],
  );

  const handleColumnResizeKeyDown = useCallback(
    (event: React.KeyboardEvent, key: RegistroTucanColumnKey) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;

      event.preventDefault();
      const step = event.shiftKey
        ? KEYBOARD_RESIZE_LARGE_STEP
        : KEYBOARD_RESIZE_STEP;
      adjustColumnWidth(key, event.key === "ArrowLeft" ? -step : step);
    },
    [adjustColumnWidth],
  );

  const tableMinWidth = useMemo(
    () =>
      columns.reduce(
        (total, column) =>
          total + (columnWidths[column.key] ?? column.defaultWidth),
        0,
      ),
    [columns, columnWidths],
  );

  return (
    <section className={sectionClass}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className={iconBoxClass}>
            <Clock3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--foreground)]">
              Registros recientes
            </h2>
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              Aqui se mostraran los registros guardados.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="inline-flex rounded-full border border-cyan-700/35 bg-cyan-950/25 p-1"
            aria-label="Ordenar registros"
          >
            <button
              type="button"
              onClick={() => onSortOrderChange("asc")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                sortOrder === "asc"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-cyan-100/60 hover:text-cyan-50"
              }`}
              aria-pressed={sortOrder === "asc"}
            >
              Mas antiguo
            </button>
            <button
              type="button"
              onClick={() => onSortOrderChange("desc")}
              className={`rounded-full px-3 py-1 text-xs transition ${
                sortOrder === "desc"
                  ? "bg-cyan-400 text-slate-950"
                  : "text-cyan-100/60 hover:text-cyan-50"
              }`}
              aria-pressed={sortOrder === "desc"}
            >
              Mas reciente
            </button>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={recordsLoading}
            className="inline-flex h-11 items-center justify-center gap-2 rounded border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-all duration-150 hover:border-cyan-500/45 hover:bg-cyan-950/25 active:scale-[0.99] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${recordsLoading ? "animate-spin" : ""}`}
            />
            Actualizar
          </button>
        </div>
      </div>

      {recordsLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">Cargando...</p>
      ) : records.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)]/60 px-4 py-6 text-center text-sm text-[var(--muted-foreground)]">
          No hay registros guardados.
        </p>
      ) : (
        <div className="relative overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
          <div className="overflow-x-auto">
            <table
              className="w-full table-fixed border-separate border-spacing-0 text-xs sm:text-sm"
              style={{ minWidth: tableMinWidth }}
            >
              <colgroup>
                {columns.map((column) => (
                  <col
                    key={column.key}
                    style={{
                      width: columnWidths[column.key] ?? column.defaultWidth,
                    }}
                  />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className="relative px-3 py-2 text-left font-semibold select-none"
                    >
                      <span className="block truncate pr-3">
                        {column.label}
                      </span>
                      <div
                        role="separator"
                        aria-orientation="vertical"
                        aria-label={`Redimensionar columna ${column.label}`}
                        aria-valuemin={column.minWidth}
                        aria-valuemax={MAX_COLUMN_WIDTH}
                        aria-valuenow={
                          columnWidths[column.key] ?? column.defaultWidth
                        }
                        tabIndex={0}
                        title="Arrastra para ajustar ancho"
                        onPointerDown={(event) =>
                          startColumnResize(event, column.key)
                        }
                        onKeyDown={(event) =>
                          handleColumnResizeKeyDown(event, column.key)
                        }
                        className="absolute top-0 right-0 flex h-full w-3 cursor-col-resize items-center justify-center"
                        style={{ touchAction: "none" }}
                      >
                        <span className="h-[70%] w-0.5 rounded bg-cyan-50/25" />
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr
                    key={record.id}
                    className="transition-colors hover:bg-[var(--muted)]/35 [&>td]:border-b [&>td]:border-cyan-900/35"
                  >
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {record.fecha}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {record.hora || "-"}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {formatCRC(record.saldoPaginaTucan)}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {formatCRC(record.saldoFondoTucan)}
                    </td>
                    <td className="px-3 py-2 text-[var(--foreground)]">
                      {formatCRC(
                        record.pagosHoy ?? record.saldoSinpesRecibidos,
                      )}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[var(--foreground)]">
                      {formatCRC(record.total)}
                    </td>
                    <td className="px-3 py-2 text-[var(--muted-foreground)]">
                      <div className="truncate">
                        {record.createdByName || "-"}
                      </div>
                      {record.motivo?.trim() && (
                        <div className="mt-1 rounded border border-cyan-700/25 bg-cyan-950/25 px-2 py-1 text-xs text-cyan-50/85">
                          <span className="font-semibold text-cyan-100/70">
                            Motivo:
                          </span>{" "}
                          {record.motivo.trim()}
                        </div>
                      )}
                    </td>
                    {canDeleteRecords && (
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => onDelete(record)}
                          disabled={recordsLoading}
                          className="inline-flex h-9 w-9 items-center justify-center rounded border border-red-500/40 bg-red-950/20 text-red-100 transition-colors hover:border-red-300/60 hover:bg-red-900/30 disabled:opacity-50"
                          title="Eliminar registro"
                          aria-label="Eliminar registro"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
