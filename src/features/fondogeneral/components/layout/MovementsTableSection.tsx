"use client";

import React from "react";
import {
  Pencil,
  Banknote,
  Clock,
  Layers,
  Tag,
  FileText,
  UserCircle,
  ArrowUpDown,
  ArrowUpRight,
  ArrowDownRight,
  ChevronDown,
  CheckCircle,
  RotateCcw,
  Loader2,
} from "lucide-react";
import type { FondoEntry, FondoMovementType } from "../../types.ts";
import type { MovementCurrencyKey } from "../../../../shared/services/movimientos-fondos";
import type { DailyClosingRecord } from "@/shared/services/daily-closings";
import type { FacturaMovement } from "../../../../shared/services/facturas";
import {
  isAutoAdjustmentProvider,
  isEgresoType,
  isGastoType,
  formatMovementType,
  hasGeneralClosingAdjustmentNotes,
  hasGeneralClosingNoDiffNotes,
  isPaidFcrMovement,
  getPrimaryMovementTime,
  getPrimaryMovementManager,
  getPrimaryMovementDateISO,
  resolveEffectiveEgresoAmount,
  roundMoney2,
} from "../../utils/helpers.ts";
import {
  AUTO_ADJUSTMENT_PROVIDER_CODE,
  AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY,
  AUTO_ADJUSTMENT_OPENING_TYPE,
  APERTURA_FONDO_PROVIDER_CODE,
} from "../../constants.ts";
import { FondoMovementsSkeleton } from "../FondoMovementsSkeleton.tsx";
import { PendingCreditInvoicesSection } from "../invoices/PendingCreditInvoicesSection.tsx";
import { MovementNotesBlock } from "../MovementNotesBlock.tsx";
import { MovementActionsCell } from "../MovementActionsCell.tsx";
import { AppliedCreditNotesDetails } from "../AppliedCreditNotesDetails.tsx";
import { PaidFcrInfoRow } from "../PaidFcrInfoRow.tsx";
import { FondoTotalsSummary } from "../FondoTotalsSummary.tsx";
import { FondoCurrentBalanceCard } from "../FondoCurrentBalanceCard.tsx";

type MovementsTableSectionProps = {
  fondoEntries: FondoEntry[];
  filteredEntries: FondoEntry[];
  showPendingClosingCreditInvoices: boolean;
  isFondoMovementsLoading: boolean;
  pendingClosingCreditInvoices: FacturaMovement[];
  providersMap: Map<string, string>;
  dateTimeFormatter: Intl.DateTimeFormat;
  formatByCurrency: (currency: "CRC" | "USD", value: number) => string;
  openClosingInvoicePaymentModal: (invoice: FacturaMovement) => void;
  groupedByDay: Map<string, FondoEntry[]>;
  pageRange: { from: number; to: number };
  pageSize: number | "all" | "daily";
  setPageSize: (value: number | "all" | "daily") => void;
  rememberFilters: boolean;
  setRememberFilters: (value: boolean) => void;
  keepFiltersAcrossCompanies: boolean;
  setKeepFiltersAcrossCompanies: (value: boolean) => void;
  isAdminUser: boolean;
  isSuperAdminUser: boolean;
  handlePrevPage: () => void;
  disablePrevButton: boolean;
  isDailyMode: boolean;
  formatGroupLabel: (key: string) => string;
  currentDailyKey: string;
  pageIndex: number;
  totalPages: number;
  handleNextPage: () => void;
  disableNextButton: boolean;
  fromFilter: string | null;
  toFilter: string | null;
  setFromFilter: (value: string | null) => void;
  setToFilter: (value: string | null) => void;
  setPageIndex: (value: number) => void;
  columnWidths: Record<string, string>;
  startResizing: (e: React.MouseEvent, key: string) => void;
  sortAsc: boolean;
  setSortAsc: React.Dispatch<React.SetStateAction<boolean>>;
  providerTypesMap: Map<string, FondoMovementType>;
  balanceAfterByIdCRC: Map<string, number>;
  balanceAfterByIdUSD: Map<string, number>;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  currencyEnabled: Record<MovementCurrencyKey, boolean>;
  dailyClosings: DailyClosingRecord[];
  expandedOpeningBalances: Set<string>;
  toggleExpandedOpeningBalance: (key: string) => void;
  expandedFcrInfoRows: Set<string>;
  setExpandedFcrInfoRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  expandedAppliedCreditNotesRows: Set<string>;
  setExpandedAppliedCreditNotesRows: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAuditModalData: (data: { history?: unknown[] } | null) => void;
  setAuditModalOpen: (open: boolean) => void;
  isMovementLocked: (entry: FondoEntry) => boolean;
  isCashOpeningMovement: (entry: FondoEntry) => boolean;
  isCierreFondoVentasMovement: (entry: FondoEntry) => boolean;
  isPrincipalAdmin: boolean;
  latestCierreFondoVentasMovementId: string | null;
  editingEntryId: string | null;
  handleEditMovement: (entry: FondoEntry) => void;
  handleDeleteMovement: (entry: FondoEntry) => void;
  isSingleDayFilter: boolean;
  superAdminTotalsOpen: boolean;
  setSuperAdminTotalsOpen: React.Dispatch<React.SetStateAction<boolean>>;
  totalsByCurrency: Record<
    "CRC" | "USD",
    { ingreso: number; egreso: number }
  >;
  enabledBalanceCurrencies: MovementCurrencyKey[];
};

export function MovementsTableSection(props: MovementsTableSectionProps) {
  const {
    fondoEntries,
    filteredEntries,
    showPendingClosingCreditInvoices,
    isFondoMovementsLoading,
    pendingClosingCreditInvoices,
    providersMap,
    dateTimeFormatter,
    formatByCurrency,
    openClosingInvoicePaymentModal,
    groupedByDay,
    pageRange,
    pageSize,
    setPageSize,
    rememberFilters,
    setRememberFilters,
    keepFiltersAcrossCompanies,
    setKeepFiltersAcrossCompanies,
    isAdminUser,
    isSuperAdminUser,
    handlePrevPage,
    disablePrevButton,
    isDailyMode,
    formatGroupLabel,
    currentDailyKey,
    pageIndex,
    totalPages,
    handleNextPage,
    disableNextButton,
    fromFilter,
    toFilter,
    setFromFilter,
    setToFilter,
    setPageIndex,
    columnWidths,
    startResizing,
    sortAsc,
    setSortAsc,
    providerTypesMap,
    balanceAfterByIdCRC,
    balanceAfterByIdUSD,
    currentBalanceCRC,
    currentBalanceUSD,
    currencyEnabled,
    dailyClosings,
    expandedOpeningBalances,
    toggleExpandedOpeningBalance,
    expandedFcrInfoRows,
    setExpandedFcrInfoRows,
    expandedAppliedCreditNotesRows,
    setExpandedAppliedCreditNotesRows,
    setAuditModalData,
    setAuditModalOpen,
    isMovementLocked,
    isCashOpeningMovement,
    isCierreFondoVentasMovement,
    isPrincipalAdmin,
    latestCierreFondoVentasMovementId,
    editingEntryId,
    handleEditMovement,
    handleDeleteMovement,
    isSingleDayFilter,
    superAdminTotalsOpen,
    setSuperAdminTotalsOpen,
    totalsByCurrency,
    enabledBalanceCurrencies,
  } = props;

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0">
      {fondoEntries.length === 0 && !showPendingClosingCreditInvoices ? (
        isFondoMovementsLoading ? (
          <FondoMovementsSkeleton />
        ) : (
          <div className="flex min-h-[180px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--input-border)] bg-[var(--card-bg)]/60 px-4 py-6 text-center">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded border border-[var(--input-border)] bg-[var(--muted)]/20 text-[var(--muted-foreground)]">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-sm font-medium text-[var(--foreground)]">
              No hay movimientos aun.
            </p>
            <p className="mt-1 text-xs text-[var(--muted-foreground)]">
              Los registros apareceran aqui cuando se agregue el primer
              movimiento.
            </p>
          </div>
        )
      ) : (
        <div className="relative overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
          {isFondoMovementsLoading && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#020617]/35 backdrop-blur-sm">
              <div className="flex min-w-[210px] flex-col items-center rounded-lg border border-cyan-400/25 bg-[#0d1117]/85 px-5 py-4 text-center shadow-2xl shadow-black/40">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <div className="absolute inset-0 animate-ping rounded-full bg-cyan-400/20" />
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-cyan-400/30 bg-cyan-500/10">
                    <Loader2 className="h-6 w-6 animate-spin text-cyan-200" />
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-cyan-50">
                  Actualizando movimientos
                </p>
                <p className="mt-1 text-xs text-cyan-100/60">
                  Aplicando filtros y fechas
                </p>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-4 border-b border-[var(--input-border)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
                Movimientos ({filteredEntries.length})
              </h2>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Mostrando {pageRange.from}-{pageRange.to} de{" "}
                {filteredEntries.length}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide">
                  Mostrar
                </span>
                <select
                  value={
                    pageSize === "all"
                      ? "all"
                      : pageSize === "daily"
                        ? "daily"
                        : String(pageSize)
                  }
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "all") setPageSize("all");
                    else if (v === "daily") setPageSize("daily");
                    else setPageSize(Number.parseInt(v, 10) || 10);
                  }}
                  className="h-9 min-w-0 flex-1 rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-2 text-xs text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 sm:flex-initial"
                >
                  <option value="daily">Diariamente</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="all">Todos</option>
                </select>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <div className="flex flex-col items-start gap-2 text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-cyan-700/35 bg-cyan-950/25 px-2.5 py-2 transition-colors hover:border-cyan-500/45">
                    <input
                      aria-label="Recordar filtros"
                      title="Recordar filtros"
                      className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                      type="checkbox"
                      checked={rememberFilters}
                      onChange={(e) => setRememberFilters(e.target.checked)}
                    />
                    <span className="whitespace-nowrap text-xs">
                      Recordar ajustes
                    </span>
                  </label>
                  {isAdminUser && (
                    <label className="flex cursor-pointer items-center gap-2 rounded border border-cyan-700/35 bg-cyan-950/25 px-2.5 py-2 transition-colors hover:border-cyan-500/45">
                      <input
                        aria-label="Mantener filtros entre empresas"
                        title="Mantener filtros entre empresas"
                        className="h-4 w-4 cursor-pointer accent-[var(--accent)]"
                        type="checkbox"
                        checked={keepFiltersAcrossCompanies}
                        onChange={(e) =>
                          setKeepFiltersAcrossCompanies(e.target.checked)
                        }
                      />
                      <span className="whitespace-nowrap text-xs">
                        Mantener entre empresas
                      </span>
                    </label>
                  )}
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={disablePrevButton}
                    className="h-9 flex-1 rounded border border-[var(--input-border)] px-3 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
                  >
                    Ant
                  </button>
                  <div className="rounded border border-cyan-700/35 bg-cyan-950/25 px-2 py-2 text-[10px] font-medium text-[var(--foreground)] sm:text-xs whitespace-nowrap">
                    {isDailyMode
                      ? formatGroupLabel(currentDailyKey)
                      : `${Math.min(pageIndex + 1, totalPages)}/${totalPages}`}
                  </div>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={disableNextButton}
                    className="h-9 flex-1 rounded border border-[var(--input-border)] px-3 text-xs font-medium transition-colors hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:cursor-not-allowed disabled:opacity-45 sm:flex-initial"
                  >
                    Sig
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="max-h-[28rem] overflow-y-auto sm:max-h-[36rem]">
            {(fromFilter || toFilter) && (
              <div className="px-2 sm:px-3 py-2">
                <div className="text-xs sm:text-sm text-[var(--muted-foreground)] flex flex-col sm:flex-row sm:items-center gap-2">
                  <span>
                    Filtro:{" "}
                    {fromFilter ? formatGroupLabel(fromFilter) : "-"}
                    {toFilter ? ` ? ${formatGroupLabel(toFilter)}` : ""}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFromFilter(null);
                      setToFilter(null);
                      setPageIndex(0);
                      setPageSize("daily");
                    }}
                    className="px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)] text-xs self-start"
                  >
                    Limpiar
                  </button>
                </div>
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs sm:text-sm">
                <colgroup>
                  <col style={{ width: columnWidths.hora }} />
                  <col style={{ width: columnWidths.motivo }} />
                  <col style={{ width: columnWidths.tipo }} />
                  <col style={{ width: columnWidths.factura }} />
                  <col style={{ width: columnWidths.monto }} />
                  <col style={{ width: columnWidths.encargado }} />
                  <col style={{ width: columnWidths.editar }} />
                </colgroup>
                <thead className="sticky top-0 z-10 bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Hora
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "hora")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4" />
                          Motivo
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "motivo")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center gap-2">
                          <Tag className="w-4 h-4" />
                          Tipo
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "tipo")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                           Nro. factura
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "factura")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center gap-2">
                          <Banknote className="w-4 h-4" />
                          Monto
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "monto")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center gap-2">
                          <UserCircle className="w-4 h-4" />
                          Encargado
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "encargado")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                    <th className="px-3 py-2 text-left font-semibold">
                      <div className="relative pr-2">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setSortAsc((prev: boolean) => {
                                try {
                                  localStorage.setItem(
                                    "fondogeneral-sortAscTouched",
                                    "true",
                                  );
                                } catch {
                                  // ignore storage errors
                                }
                                return !prev;
                              })
                            }
                            title={
                              sortAsc
                                ? "Mostrar más reciente arriba"
                                : "Mostrar más reciente abajo"
                            }
                            aria-label="Invertir orden de movimientos"
                            className="p-1 border border-[var(--input-border)] rounded hover:bg-[var(--muted)]"
                          >
                            <ArrowUpDown className="w-4 h-4" />
                          </button>
                        </div>
                        <div
                          onMouseDown={(e) => startResizing(e, "editar")}
                          className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                          style={{ touchAction: "none" }}
                        >
                          <div
                            style={{
                              width: 2,
                              height: "70%",
                              background: "rgba(255,255,255,0.18)",
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    </th>
                  </tr>
                </thead>
                <PendingCreditInvoicesSection
                  showPendingClosingCreditInvoices={showPendingClosingCreditInvoices}
                  pendingClosingCreditInvoices={pendingClosingCreditInvoices}
                  providersMap={providersMap}
                  dateTimeFormatter={dateTimeFormatter}
                  formatByCurrency={formatByCurrency}
                  onOpenPaymentModal={openClosingInvoicePaymentModal}
                />
                {Array.from(groupedByDay.entries()).map(
                  ([dayKey, entries]) => (
                    <tbody key={dayKey}>
                      {entries.map((fe) => {
                        // the newest entry is the first element in fondoEntries (inserted at index 0)
                        const isMostRecent = fe.id === fondoEntries[0]?.id;
                        const providerName =
                          providersMap.get(fe.providerCode) ??
                          fe.providerCode;
                        const providerType = providerTypesMap.get(
                          fe.providerCode,
                        );
                        const entryCurrency =
                          (fe.currency as "CRC" | "USD") || "CRC";
                        const normalizedIngreso = roundMoney2(
                          fe.amountIngreso || 0,
                        );
                        const normalizedEgreso = roundMoney2(
                          resolveEffectiveEgresoAmount(fe),
                        );
                        const invoiceEgresoAmount = roundMoney2(
                          String(fe.id || "").startsWith("fcr-pago-")
                            ? (fe.originalAmount ?? fe.amountEgreso) || 0
                            : (fe.amountEgreso || 0),
                        );
                        const appliedCreditNotesTotal = Array.isArray(
                          fe.appliedCreditNotes,
                        )
                          ? fe.appliedCreditNotes.reduce(
                              (sum, note) =>
                                sum +
                                Math.max(
                                  0,
                                  roundMoney2(note.appliedAmount),
                                ),
                              0,
                            )
                          : 0;
                        const appliedCreditNotesAdjustment = Math.max(
                          0,
                          Math.abs(
                            invoiceEgresoAmount -
                              appliedCreditNotesTotal -
                              normalizedEgreso,
                          ),
                        );
                        const appliedCreditNotesAdjustmentIsPositive =
                          normalizedEgreso >
                          Math.max(0, invoiceEgresoAmount - appliedCreditNotesTotal);
                        const appliedCreditNotesAdjustmentLabel = appliedCreditNotesAdjustmentIsPositive
                          ? "Redondeo"
                          : "Redondeo";
                        const appliedCreditNotesAdjustmentPrefix = appliedCreditNotesAdjustmentIsPositive
                          ? "+"
                          : "-";
                        let isEntryEgreso =
                          isEgresoType(fe.paymentType) ||
                          isGastoType(fe.paymentType);
                        if (
                          normalizedIngreso > 0 &&
                          normalizedEgreso === 0
                        ) {
                          isEntryEgreso = false;
                        } else if (
                          normalizedEgreso > 0 &&
                          normalizedIngreso === 0
                        ) {
                          isEntryEgreso = true;
                        }
                        const movementAmount = isEntryEgreso
                          ? normalizedEgreso
                          : normalizedIngreso;
                        const balanceAfter =
                          entryCurrency === "USD"
                            ? (balanceAfterByIdUSD.get(fe.id) ??
                              roundMoney2(currentBalanceUSD))
                            : (balanceAfterByIdCRC.get(fe.id) ??
                              roundMoney2(currentBalanceCRC));
                        // compute the balance immediately before this movement was applied (in the movement currency)
                        const previousBalance = isEntryEgreso
                          ? balanceAfter + normalizedEgreso
                          : balanceAfter - normalizedIngreso;
                        const isPaidFcrEntry = isPaidFcrMovement(fe);
                        const isLockedMovement = isMovementLocked(fe);
                        const primaryManager =
                          getPrimaryMovementManager(fe);
                        const primaryDateIso =
                          getPrimaryMovementDateISO(fe);
                        const recordedAt = new Date(primaryDateIso);
                        const formattedDate = Number.isNaN(
                          recordedAt.getTime(),
                        )
                          ? "Sin fecha"
                          : dateTimeFormatter.format(recordedAt);
                        const originalRegisteredAt = new Date(
                          fe.invoiceCreatedAt || fe.createdAt,
                        );
                        const formattedOriginalRegisteredAt = Number.isNaN(
                          originalRegisteredAt.getTime(),
                        )
                          ? "Sin fecha"
                          : dateTimeFormatter.format(originalRegisteredAt);
                        const isFcrInfoExpanded = expandedFcrInfoRows.has(
                          fe.id,
                        );
                        const owedFcrAmountRaw =
                          fe.amountDue ?? fe.balanceDue;
                        const owedFcrAmount = Number.isFinite(
                          Number(owedFcrAmountRaw),
                        )
                          ? Math.max(
                              0,
                              roundMoney2(owedFcrAmountRaw),
                            )
                          : null;

                        const originalFcrAmount = Number.isFinite(
                          Number(fe.originalAmount),
                        )
                          ? Math.max(
                              0,
                              roundMoney2(fe.originalAmount),
                            )
                          : null;
                        const isAppliedCreditNotesExpanded =
                          expandedAppliedCreditNotesRows.has(fe.id);
                        const hasAppliedCreditNotes =
                          Array.isArray(fe.appliedCreditNotes) &&
                          fe.appliedCreditNotes.length > 0;
                        const isAutoAdjustment = isAutoAdjustmentProvider(
                          fe.providerCode,
                        );
                        const providerNameUpper = String(providerName)
                          .trim()
                          .toUpperCase();
                        const isGeneralClosingRow =
                          providerNameUpper ===
                            AUTO_ADJUSTMENT_PROVIDER_CODE ||
                          providerNameUpper ===
                            AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY ||
                          hasGeneralClosingAdjustmentNotes(fe.notes);
                        const isCashOpeningRow =
                          fe.providerCode === APERTURA_FONDO_PROVIDER_CODE ||
                          providerNameUpper === APERTURA_FONDO_PROVIDER_CODE;
                        const isCashOpeningAdjustment =
                          isCashOpeningRow &&
                          String(fe.notes || "")
                            .toUpperCase()
                            .includes("AJUSTE APLICADO AL SALDO DE APERTURA");
                        const displayPaymentType =
                          isCashOpeningAdjustment
                            ? AUTO_ADJUSTMENT_OPENING_TYPE
                            : (isAutoAdjustment || isGeneralClosingRow) &&
                          !hasGeneralClosingNoDiffNotes(fe.notes) &&
                          fe.paymentType !== "INFORMATIVO"
                            ? "AJUSTE CIERRE"
                            : fe.paymentType === "INFORMATIVO" &&
                                providerType
                              ? providerType
                              : !providerType
                                ? "INFORMATIVO"
                                : fe.paymentType;
                        const isSuccessfulClosing =
                          isAutoAdjustment && movementAmount === 0;
                        const amountPrefix = isEntryEgreso ? "-" : "+";
                        // prepare tooltip text for edited entries
                        let auditTooltip: string | undefined;
                        let parsedAudit: any | null = null;
                        if (fe.isAudit && fe.auditDetails) {
                          try {
                            const parsed = JSON.parse(
                              fe.auditDetails,
                            ) as any;
                            // normalize to history array for backward compatibility
                            let history: any[] = [];
                            if (Array.isArray(parsed?.history)) {
                              history = parsed.history;
                            } else if (parsed?.before && parsed?.after) {
                              history = [
                                {
                                  at: parsed.at ?? fe.createdAt,
                                  before: parsed.before,
                                  after: parsed.after,
                                },
                              ];
                            }
                            parsedAudit = { history };

                            // build tooltip from accumulated history (show each change timestamp + small summary)
                            const lines: string[] = history.map((h) => {
                              const at = h?.at
                                ? dateTimeFormatter.format(new Date(h.at))
                                  : "-";
                              const before = h?.before ?? {};
                              const after = h?.after ?? {};
                              const parts: string[] = [];

                              // Con el nuevo formato simplificado, mostramos todos los campos presentes
                              if (
                                "providerCode" in before ||
                                "providerCode" in after
                              ) {
                                parts.push(
                                  `Proveedor: ${before.providerCode ?? "-"} -> ${
                                    after.providerCode ?? "-"
                                  }`,
                                );
                              }
                              if (
                                "invoiceNumber" in before ||
                                "invoiceNumber" in after
                              ) {
                                parts.push(
                                  `Factura: ${before.invoiceNumber ?? "-"} -> ${
                                    after.invoiceNumber ?? "-"
                                  }`,
                                );
                              }
                              if (
                                "paymentType" in before ||
                                "paymentType" in after
                              ) {
                                parts.push(
                                  `Tipo: ${before.paymentType ?? "-"} -> ${
                                    after.paymentType ?? "-"
                                  }`,
                                );
                              }

                              // Manejar cambio de moneda
                              if (
                                "currency" in before ||
                                "currency" in after
                              ) {
                                const beforeCur =
                                  before.currency || entryCurrency || "CRC";
                                const afterCur =
                                  after.currency || entryCurrency || "CRC";
                                if (beforeCur !== afterCur) {
                                  parts.push(
                                    `Moneda: ${beforeCur} ? ${afterCur}`,
                                  );
                                }
                              }

                              // Manejar montos (pueden estar en amountEgreso o amountIngreso)
                              if (
                                "amountEgreso" in before ||
                                "amountEgreso" in after ||
                                "amountIngreso" in before ||
                                "amountIngreso" in after
                              ) {
                                const beforeAmt = Number(
                                  before.amountEgreso ||
                                    before.amountIngreso ||
                                    0,
                                );
                                const afterAmt = Number(
                                  after.amountEgreso ||
                                    after.amountIngreso ||
                                    0,
                                );
                                const beforeCur =
                                  (before.currency as "CRC" | "USD") ||
                                  entryCurrency ||
                                  "CRC";
                                const afterCur =
                                  (after.currency as "CRC" | "USD") ||
                                  entryCurrency ||
                                  "CRC";
                                parts.push(
                                  `Monto: ${formatByCurrency(
                                    beforeCur,
                                    beforeAmt,
                                  )} ? ${formatByCurrency(afterCur, afterAmt)}`,
                                );
                              }

                              if (
                                "manager" in before ||
                                "manager" in after
                              ) {
                                parts.push(
                                  `Encargado: ${before.manager ?? "-"} -> ${
                                    after.manager ?? "-"
                                  }`,
                                );
                              }
                              if ("notes" in before || "notes" in after) {
                                parts.push(
                                  `Notas: "${before.notes ?? ""}" ? "${
                                    after.notes ?? ""
                                  }"`,
                                );
                              }

                              return `${at}: ${
                                parts.join("; ") ||
                                "Editado (sin cambios detectados)"
                              } `;
                            });
                            auditTooltip = lines.join("\n");
                          } catch {
                            auditTooltip = "Editado";
                            parsedAudit = null;
                          }
                        }
                        return (
                          <React.Fragment key={fe.id}>
                            <tr
                              className={`transition-colors hover:bg-[var(--muted)]/35 [&>td]:border-b [&>td]:border-cyan-900/35 ${
                                isMostRecent
                                  ? "bg-gray-500/10 hover:bg-gray-500/20"
                                  : ""
                              } ${isMovementLocked(fe) ? "opacity-60" : ""}`}
                            >
                              <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                {formattedDate}
                              </td>
                              <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                <div className="flex items-center gap-2">
                                  <div className="font-semibold text-[var(--foreground)]">
                                    {providerName}
                                  </div>

                                  {fe.isAudit && (
                                    <div
                                      role="button"
                                      tabIndex={0}
                                      onClick={() => {
                                        if (parsedAudit) {
                                          setAuditModalData(parsedAudit);
                                          setAuditModalOpen(true);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (
                                          (e.key === "Enter" ||
                                            e.key === " ") &&
                                          parsedAudit
                                        ) {
                                          setAuditModalData(parsedAudit);
                                          setAuditModalOpen(true);
                                        }
                                      }}
                                      title={auditTooltip}
                                      className="inline-flex cursor-pointer items-center gap-1.5 rounded border border-yellow-500/25 bg-yellow-500/10 px-2 py-0.5 text-[11px] text-yellow-300 transition-colors hover:bg-yellow-500/20"
                                    >
                                      <Pencil className="w-3 h-3 text-yellow-300" />
                                      <span>Editado</span>
                                    </div>
                                  )}
                                  {isPaidFcrMovement(fe) && (
                                    <span className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">
                                      <Tag className="w-3 h-3" />
                                      FC
                                    </span>
                                  )}
                                </div>
                                <MovementNotesBlock notes={fe.notes} />
                              </td>
                              <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                <span className="inline-flex max-w-full items-center rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-2 py-1 text-xs text-[var(--foreground)]">
                                  {displayPaymentType === "INFORMATIVO"
                                    ? "-"
                                    : formatMovementType(
                                        displayPaymentType,
                                      )}
                                </span>
                              </td>
                              <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                <span className="font-medium text-[var(--foreground)]">
                                  #{fe.invoiceNumber}
                                </span>
                              </td>
                              <td className="px-3 py-2 align-top">
                                {isCashOpeningRow ? (
                                  (() => {
                                    const openingCRC = Math.trunc(
                                      fe.openingBalanceCRC ?? 0,
                                    );
                                    const openingUSD = Math.trunc(
                                      fe.openingBalanceUSD ?? 0,
                                    );
                                    const breakdownCRC =
                                      fe.openingBreakdownCRC ?? fe.breakdown ?? {};
                                    const breakdownUSD =
                                      fe.openingBreakdownUSD ?? {};
                                    const keyCRC = `${fe.id}:CRC`;
                                    const keyUSD = `${fe.id}:USD`;
                                    const isCRCExpanded = expandedOpeningBalances.has(keyCRC);
                                    const isUSDExpanded = expandedOpeningBalances.has(keyUSD);

                                    const renderBills = (
                                      breakdown: Record<number, number>,
                                      expanded: boolean,
                                    ) => {
                                      if (!expanded) return null;
                                      const items = Object.entries(breakdown)
                                        .filter(([, count]) => Number(count) > 0)
                                        .map(([denom, count]) => `${denom}x${count}`)
                                        .join(" · ");
                                      return (
                                        <div className="mt-1 rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-2 py-1 text-left text-xs text-[var(--foreground)]">
                                          {items || "-"}
                                        </div>
                                      );
                                    };

                                    return (
                                      <div className="flex flex-col gap-1 text-right">
                                        <div className="text-xs text-[var(--muted-foreground)]">
                                          Saldo de apertura
                                        </div>
                                        {currencyEnabled.CRC && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleExpandedOpeningBalance(keyCRC)
                                            }
                                            aria-expanded={isCRCExpanded}
                                            className="flex w-full flex-col items-end rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-3 py-1 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/25"
                                          >
                                            <span>{formatByCurrency("CRC", openingCRC)}</span>
                                            {renderBills(breakdownCRC, isCRCExpanded)}
                                          </button>
                                        )}
                                        {currencyEnabled.USD && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              toggleExpandedOpeningBalance(keyUSD)
                                            }
                                            aria-expanded={isUSDExpanded}
                                            className="flex w-full flex-col items-end rounded border border-[var(--input-border)] bg-[var(--muted)]/15 px-3 py-1 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/25"
                                          >
                                            <span>{formatByCurrency("USD", openingUSD)}</span>
                                            {renderBills(breakdownUSD, isUSDExpanded)}
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })()
                                ) : isAutoAdjustment ? (
                                  (() => {
                                    const closingRecord = fe.originalEntryId
                                      ? dailyClosings.find(
                                          (d) =>
                                            d.id === fe.originalEntryId,
                                        )
                                      : null;

                                    const hasPersistedClosingBalance =
                                      fe.closingBalanceCRC !== undefined ||
                                      fe.closingBalanceUSD !== undefined ||
                                      Boolean(closingRecord);

                                    if (!hasPersistedClosingBalance) {
                                      if (isSuccessfulClosing) {
                                        return (
                                          <div className="text-center text-[var(--muted-foreground)]">
                                            -
                                          </div>
                                        );
                                      }

                                      return (
                                        <div className="flex flex-col gap-1 text-right">
                                          <div className="flex items-center justify-end gap-2">
                                            {isEntryEgreso ? (
                                              <ArrowUpRight className="w-4 h-4 text-red-500" />
                                            ) : (
                                              <ArrowDownRight className="w-4 h-4 text-green-500" />
                                            )}
                                            <span
                                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                                isEntryEgreso
                                                  ? "bg-red-500/10 text-red-400"
                                                  : "bg-emerald-500/10 text-emerald-400"
                                              }`}
                                            >
                                              {`${amountPrefix} ${formatByCurrency(
                                                entryCurrency,
                                                movementAmount,
                                              )}`}
                                            </span>
                                          </div>
                                          <span className="text-xs text-[var(--muted-foreground)] flex items-center justify-center gap-1">
                                            <span>Saldo anterior:</span>
                                            <span>
                                              {formatByCurrency(
                                                entryCurrency,
                                                previousBalance,
                                              )}
                                            </span>
                                          </span>
                                        </div>
                                      );
                                    }

                                    const closingCRC = Math.trunc(
                                      fe.closingBalanceCRC ??
                                        closingRecord?.totalCRC ??
                                        closingRecord?.recordedBalanceCRC ??
                                        0,
                                    );
                                    const closingUSD = Math.trunc(
                                      fe.closingBalanceUSD ??
                                        closingRecord?.totalUSD ??
                                        closingRecord?.recordedBalanceUSD ??
                                        0,
                                    );

                                    return (
                                      <div className="flex flex-col gap-1 text-right">
                                        {movementAmount !== 0 ? (
                                          <div className="flex items-center justify-end gap-2">
                                            {isEntryEgreso ? (
                                              <ArrowUpRight className="w-4 h-4 text-red-500" />
                                            ) : (
                                              <ArrowDownRight className="w-4 h-4 text-green-500" />
                                            )}
                                            <span
                                              className={`rounded px-2 py-1 text-xs font-semibold ${
                                                isEntryEgreso
                                                  ? "bg-red-500/10 text-red-400"
                                                  : "bg-emerald-500/10 text-emerald-400"
                                              }`}
                                            >
                                              {`${amountPrefix} ${formatByCurrency(
                                                entryCurrency,
                                                movementAmount,
                                              )}`}
                                            </span>
                                          </div>
                                        ) : null}

                                        <div className="text-xs text-[var(--muted-foreground)]">
                                          Saldo al cierre
                                        </div>
                                        <div className="text-sm font-semibold text-[var(--foreground)] flex flex-col gap-0.5">
                                          {currencyEnabled.CRC && (
                                            <div>
                                              {formatByCurrency(
                                                "CRC",
                                                closingCRC,
                                              )}
                                            </div>
                                          )}
                                          {currencyEnabled.USD && (
                                            <div>
                                              {formatByCurrency(
                                                "USD",
                                                closingUSD,
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })()
                                ) : isSuccessfulClosing ? (
                                  <div className="text-center text-[var(--muted-foreground)]">
                                    -
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-1 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {isEntryEgreso ? (
                                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                                      ) : (
                                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                                      )}
                                      <span
                                        className={`pl-4 rounded px-2 py-1 font-semibold whitespace-nowrap text-[var(--foreground)] ${
                                          isEntryEgreso
                                            ? "bg-red-500/10 text-red-400"
                                            : "bg-emerald-500/10 text-emerald-400"
                                        } ${
                                          isEntryEgreso &&
                                          appliedCreditNotesTotal > 0
                                            ? "text-sm"
                                            : "text-sm"
                                        }`}
                                      >
                                        {`${amountPrefix} ${formatByCurrency(
                                          entryCurrency,
                                          movementAmount,
                                        )}`}
                                      </span>
                                    </div>
                                    <div className="mt-0.5 flex w-full min-w-0 flex-col gap-1 self-start text-left">
                                      <div className="flex w-full flex-col items-center gap-0 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1">
                                        <span className="flex items-center justify-center gap-1 text-xs text-[var(--muted-foreground)]">
                                          <Banknote className="h-3 w-3 shrink-0" />
                                          Saldo anterior
                                        </span>
                                        <span className="w-full pl-4 text-center text-sm font-semibold text-[var(--foreground)] whitespace-nowrap">
                                          {formatByCurrency(
                                            entryCurrency,
                                            previousBalance,
                                          )}
                                        </span>
                                      </div>
                                      {isEntryEgreso &&
                                        (appliedCreditNotesTotal > 0 ||
                                          appliedCreditNotesAdjustment >
                                            0) && (
                                          <>
                                            <div className="flex w-full items-center gap-0 rounded bg-sky-500/10 px-2 py-1">
                                              <span className="flex items-center justify-center gap-1 text-xs text-sky-200">
                                                <FileText className="h-3 w-3 shrink-0" />
                                                Factura
                                              </span>
                                              <span className="w-full pl-4 text-center text-sm font-semibold text-sky-100 whitespace-nowrap">
                                                {formatByCurrency(
                                                  entryCurrency,
                                                  invoiceEgresoAmount,
                                                )}
                                              </span>
                                            </div>
                                            {appliedCreditNotesTotal >
                                              0 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setExpandedAppliedCreditNotesRows(
                                                    (prev) => {
                                                      const next = new Set(
                                                        prev,
                                                      );
                                                      if (next.has(fe.id)) {
                                                        next.delete(fe.id);
                                                      } else {
                                                        next.add(fe.id);
                                                      }
                                                      return next;
                                                    },
                                                  );
                                                }}
                                                title={isAppliedCreditNotesExpanded ? "Ocultar NCs" : "Ver NCs aplicadas"}
                                                aria-expanded={isAppliedCreditNotesExpanded}
                                                className={`flex w-full gap-0 rounded border px-2 py-1 text-left transition-all ${
                                                  isAppliedCreditNotesExpanded
                                                    ? "border-yellow-500/40 bg-yellow-500/30"
                                                    : "border-yellow-500/20 bg-yellow-500/20 hover:border-yellow-500/30 hover:bg-yellow-500/25"
                                                }`}
                                              >
                                                <span className="flex items-center justify-center gap-1 text-xs text-yellow-300">
                                                  <Tag className="h-3 w-3 shrink-0" />
                                                  NC
                                                </span>
                                                <span className="flex items-center justify-end gap-1 pl-4 text-center text-sm font-semibold text-yellow-300 whitespace-nowrap">
                                                  -
                                                  {formatByCurrency(
                                                    entryCurrency,
                                                    appliedCreditNotesTotal,
                                                  )}
                                                  <ChevronDown className={`h-3 w-3 transition-transform duration-200 ${
                                                    isAppliedCreditNotesExpanded ? "rotate-180" : ""
                                                  }`} />
                                                </span>
                                              </button>
                                            )}
                                            {appliedCreditNotesAdjustment >
                                              0 &&
                                              (!isPaidFcrEntry ||
                                                (owedFcrAmount !== null &&
                                                  owedFcrAmount <= 0)) && (
                                              <div className="flex w-full items-center gap-0 rounded border border-orange-500/15 bg-orange-500/10 px-2 py-1">
                                                <span className="flex items-center justify-center gap-1 text-xs text-orange-200">
                                                  <RotateCcw className="h-3 w-3 shrink-0" />
                                                  {appliedCreditNotesAdjustmentLabel}
                                                </span>
                                                <span className="flex w-full items-center justify-end gap-1 pl-4 text-center text-sm font-semibold text-orange-200 whitespace-nowrap">
                                                  {appliedCreditNotesAdjustmentPrefix}
                                                  {formatByCurrency(
                                                    entryCurrency,
                                                    appliedCreditNotesAdjustment,
                                                  )}
                                                </span>
                                              </div>
                                            )}
                                            {hasAppliedCreditNotes &&
                                              isAppliedCreditNotesExpanded &&
                                              Array.isArray(
                                                fe.appliedCreditNotes,
                                              ) &&
                                              fe.appliedCreditNotes.map(
                                                (note) => {
                                                  const noteLabel =
                                                    note.invoiceNumber
                                                      ? `NC #${note.invoiceNumber}`
                                                      : `NC ${note.id}`;
                                                  const appliedAmount =
                                                    Math.max(
                                                      0,
                                                      Math.trunc(
                                                        Number(
                                                          note.appliedAmount,
                                                        ) || 0,
                                                      ),
                                                    );
                                                  return (
                                                    <div
                                                      key={note.id}
                                                      className="flex w-full items-center gap-0 rounded border border-yellow-500/10 bg-yellow-500/5 px-2 py-0.5"
                                                    >
                                                      <span className="flex items-center gap-1 text-[11px] text-yellow-200">
                                                        <CheckCircle className="h-2.5 w-2.5 shrink-0" />
                                                        {noteLabel}
                                                      </span>
                                                      <span className="w-full text-right text-xs font-medium text-yellow-200">
                                                        -
                                                        {formatByCurrency(
                                                          entryCurrency,
                                                          appliedAmount,
                                                        )}
                                                      </span>
                                                    </div>
                                                  );
                                                },
                                              )}
                                          </>
                                        )}
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                {primaryManager}
                              </td>
                              <MovementActionsCell
                                entry={fe}
                                isCashOpeningMovement={isCashOpeningMovement(fe)}
                                isLockedMovement={isLockedMovement}
                                isPaidFcrEntry={isPaidFcrEntry}
                                hasAppliedCreditNotes={hasAppliedCreditNotes}
                                isAppliedCreditNotesExpanded={isAppliedCreditNotesExpanded}
                                isFcrInfoExpanded={isFcrInfoExpanded}
                                isAutoAdjustment={isAutoAdjustment}
                                isPrincipalAdmin={isPrincipalAdmin}
                                isSuperAdminUser={isSuperAdminUser}
                                latestCierreFondoVentasMovementId={latestCierreFondoVentasMovementId}
                                editingEntryId={editingEntryId}
                                isCierreFondoVentasMovement={isCierreFondoVentasMovement}
                                onEdit={handleEditMovement}
                                onDelete={handleDeleteMovement}
                                onToggleFcrInfo={(entryId) => {
                                  setExpandedFcrInfoRows((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(entryId)) {
                                      next.delete(entryId);
                                    } else {
                                      next.add(entryId);
                                    }
                                    return next;
                                  });
                                }}
                                onToggleAppliedCreditNotes={(entryId) => {
                                  setExpandedAppliedCreditNotesRows((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(entryId)) {
                                      next.delete(entryId);
                                    } else {
                                      next.add(entryId);
                                    }
                                    return next;
                                  });
                                }}
                              />
                            </tr>

                            {hasAppliedCreditNotes &&
                              isAppliedCreditNotesExpanded &&
                              !isPaidFcrEntry && (
                                <AppliedCreditNotesDetails
                                  notes={fe.appliedCreditNotes!}
                                  currency={entryCurrency}
                                  appliedCreditNotesTotal={appliedCreditNotesTotal}
                                  formatByCurrency={formatByCurrency}
                                  variant="sky"
                                  colSpan={7}
                                />
                              )}

                            {isPaidFcrEntry && isFcrInfoExpanded && (
                              <PaidFcrInfoRow
                                primaryManager={primaryManager}
                                formattedDate={formattedDate}
                                manager={fe.manager}
                                formattedOriginalRegisteredAt={formattedOriginalRegisteredAt}
                                originalFcrAmount={originalFcrAmount}
                                owedFcrAmount={owedFcrAmount}
                                entryCurrency={entryCurrency}
                                hasAppliedCreditNotes={hasAppliedCreditNotes}
                                appliedCreditNotes={fe.appliedCreditNotes ?? []}
                                appliedCreditNotesTotal={appliedCreditNotesTotal}
                                appliedCreditNotesAdjustment={appliedCreditNotesAdjustment}
                                formatByCurrency={formatByCurrency}
                                colSpan={7}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  ),
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Totals for the current search / filters */}
      {isSingleDayFilter &&
        filteredEntries.length > 0 &&
        (isAdminUser || isSuperAdminUser) && (
          <FondoTotalsSummary
            isSuperAdminUser={isSuperAdminUser}
            superAdminTotalsOpen={superAdminTotalsOpen}
            onToggleSuperAdminTotalsOpen={() =>
              setSuperAdminTotalsOpen((p) => !p)
            }
            totalsByCurrency={totalsByCurrency}
            formatByCurrency={formatByCurrency}
          />
        )}
    </div>

        <FondoCurrentBalanceCard
          enabledBalanceCurrencies={enabledBalanceCurrencies}
          currentBalanceCRC={currentBalanceCRC}
          currentBalanceUSD={currentBalanceUSD}
          formatByCurrency={formatByCurrency}
        />
    </div>
  );
}
