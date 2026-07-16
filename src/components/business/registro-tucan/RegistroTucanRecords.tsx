import { Clock3, RefreshCw, Trash2 } from "lucide-react";
import type { RegistroTucanRecord } from "../../../types/firestore";
import { iconBoxClass, sectionClass } from "./styles";
import type { RegistroTucanSortOrder } from "./types";

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
            <table className="w-full min-w-[760px] border-separate border-spacing-0 text-xs sm:text-sm">
              <thead className="sticky top-0 z-10 bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
                <tr>
                  <th className="py-2 pr-3">Fecha</th>
                  <th className="py-2 pr-3">Hora</th>
                  <th className="py-2 pr-3">Pagina Tucan</th>
                  <th className="py-2 pr-3">Fondo Tucan</th>
                  <th className="py-2 pr-3">pagosHoy</th>
                  <th className="py-2 pr-3">Total</th>
                  <th className="py-2 pr-3">Usuario</th>
                  {canDeleteRecords && <th className="py-2 pr-3">Acciones</th>}
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
                      <div>{record.createdByName || "-"}</div>
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
