"use client";

import type { DailyClosingRecord } from "@/shared/services/daily-closings";
import type { ClosingReconciliation } from "@/shared/domain/reconciliation";
import type { DailyClosingFormValues } from "../modals/DailyClosingModal.tsx";
import type { CashOpeningFormValues } from "../modals/CashOpeningModal.tsx";
import type { FacturaMovement } from "../../../../shared/services/facturas";
import type { PendingCreditNoteOption } from "../../utils/helpers.ts";
import type { FondoEntry } from "../../types.ts";
import type { AuditHistoryModalData } from "../audit-history-modal/AuditHistoryModal.types.ts";
import DailyClosingHistoryModal from "../../../../components/modals/DailyClosingHistoryModal";
import { AuditHistoryModal } from "../audit-history-modal";
import DailyClosingModal from "../modals/DailyClosingModal.tsx";
import DailyClosingSummaryModal from "../modals/DailyClosingSummaryModal.tsx";
import CashOpeningModal from "../modals/CashOpeningModal.tsx";
import FacturaPaymentModal from "../modals/FacturaPaymentModal.tsx";
import { FondoConfirmModals } from "../FondoConfirmModals.tsx";
import ConfirmModal from "../../../../shared/components/ui/ConfirmModal";

export type FondoSectionModalsProps = {
  auditModalOpen: boolean;
  onCloseAuditModal: () => void;
  auditModalData: AuditHistoryModalData;
  dateTimeFormatter: Intl.DateTimeFormat;
  formatByCurrency: (currency: "CRC" | "USD", value: number) => string;
  providersMap: Map<string, string>;

  dailyClosingModalOpen: boolean;
  editingDailyClosingId: string | null;
  dailyClosingInitialValues: DailyClosingFormValues | null;
  onCloseDailyClosing: () => void;
  onConfirmDailyClosing: (
    closing: DailyClosingFormValues,
  ) => Promise<DailyClosingRecord | null>;
  onDailyClosingTurnoChange: (turno: "D" | "N" | undefined) => void;
  dailyClosingTurno: "D" | "N" | undefined;
  onShowDailyClosingHistory: () => void;
  employeeOptions: string[];
  employeesLoading: boolean;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  requireSingleClosingReason: boolean;
  managerReadonly: boolean;
  requireTurnoSelection: boolean;
  cierreFondoVentasMinutesBeforeEnd: number;
  cierreFondoVentasMinutesAfterEnd: number;
  previousReconciliation: ClosingReconciliation | null | undefined;
  cumulativeContica: { r08: number; t11: number };
  systemVerificationEnabled: boolean;

  dailyClosingSummaryRecord: DailyClosingRecord | null;
  onCloseDailyClosingSummary: () => void;

  closingPaymentModalOpen: boolean;
  closingPaymentTarget: FacturaMovement | null;
  providerName: string;
  closingPaymentAmount: string;
  closingPaymentNotes: string;
  closingPaymentManager2: string;
  closingPaymentCreditNoteIds: string[];
  closingPaymentSubmitting: boolean;
  onCloseClosingPaymentModal: () => void;
  onPaymentAmountChange: (value: string) => void;
  onPaymentNotesChange: (value: string) => void;
  onPaymentManager2Change: (value: string) => void;
  onSubmitPartialPayment: () => void;
  onSubmitFullPayment: () => void;
  closingPaymentAvailableCreditNotes: PendingCreditNoteOption[];
  closingPaymentCreditNotesTotal: number;
  onToggleClosingPaymentCreditNote: (id: string) => void;


  confirmOpenCreateMovement: boolean;
  onConfirmOpenCreateMovement: () => void;
  onCancelOpenCreateMovement: () => void;
  company: string;
  accountKey: string;

  missingShiftModalOpen: boolean;
  missingShiftExpectedShift: string;
  missingShiftDateKey: string;
  onCloseMissingShift: () => void;
  onGoToControlHorario: () => void;

  confirmPhysicalCountOpen: boolean;
  handleCancelPhysicalCount: () => void;
  handleOpenCashOpening: () => void;
  pendingCierreModalOpen: boolean;
  closePendingCierreModal: () => void;
  confirmDeleteEntry: {
    open: boolean;
    entry?: { invoiceNumber?: string | null } | null;
  };
  confirmDeleteMovement: () => void;
  cancelDeleteMovement: () => void;

  cashOpeningModalOpen: boolean;
  cashOpeningInitialValues: CashOpeningFormValues | null;
  cashOpeningEditingEntry: FondoEntry | null;
  onCloseCashOpening: () => void;
  onConfirmCashOpening: (opening: CashOpeningFormValues) => void;
  managerReadonlyCashOpening: boolean;
  cashOpeningDraftStorageKey: string;

  pendingZeroAmountCreditNoteModalOpen: boolean;
  pendingZeroAmountCreditNotes: unknown[];
  onClosePendingZeroAmount: () => void;

  negativeBalanceModal: {
    open: boolean;
    amount: number;
    currency: "CRC" | "USD";
    resultingNegativeAmount: number;
  };
  onCloseNegativeBalance: () => void;

  dailyClosingHistoryOpen: boolean;
  onCloseDailyClosingHistory: () => void;
  closingsAreLoading: boolean;
  dailyClosings: DailyClosingRecord[];
  dailyClosingHistoryRange: string;
  onQuickRangeChange: (range: string) => void;
  dailyClosingDateFormatter: Intl.DateTimeFormat;
  buildBreakdownLines: (
    currency: "CRC" | "USD",
    breakdown?: Record<number, number>,
  ) => string[];
  formatDailyClosingDiff: (
    currency: "CRC" | "USD",
    diff: number,
  ) => string;
  getDailyClosingDiffClass: (diff: number) => string;
  fondoEntries: FondoEntry[];
  isAutoAdjustmentProvider: (providerCode: unknown) => boolean;
  expandedClosings: Set<string>;
  setExpandedClosings: React.Dispatch<React.SetStateAction<Set<string>>>;
  canDeleteLatestClosing: boolean;
  latestClosingLabel: string;
  onDeleteLatestClosing: (reason: string) => Promise<void>;
};

export function FondoSectionModals(props: FondoSectionModalsProps) {
  const {
    auditModalOpen,
    onCloseAuditModal,
    auditModalData,
    dateTimeFormatter,
    formatByCurrency,
    providersMap,

    dailyClosingModalOpen,
    editingDailyClosingId,
    dailyClosingInitialValues,
    onCloseDailyClosing,
    onConfirmDailyClosing,
    onDailyClosingTurnoChange,
    dailyClosingTurno,
    onShowDailyClosingHistory,
    employeeOptions,
    employeesLoading,
    currentBalanceCRC,
    currentBalanceUSD,
    requireSingleClosingReason,
    managerReadonly,
    requireTurnoSelection,
    cierreFondoVentasMinutesBeforeEnd,
    cierreFondoVentasMinutesAfterEnd,
    previousReconciliation,
    cumulativeContica,
    systemVerificationEnabled,

    dailyClosingSummaryRecord,
    onCloseDailyClosingSummary,

    closingPaymentModalOpen,
    closingPaymentTarget,
    providerName,
    closingPaymentAmount,
    closingPaymentNotes,
    closingPaymentManager2,
    closingPaymentCreditNoteIds,
    closingPaymentSubmitting,
    onCloseClosingPaymentModal,
    onPaymentAmountChange,
    onPaymentNotesChange,
    onPaymentManager2Change,
    onSubmitPartialPayment,
    onSubmitFullPayment,
    closingPaymentAvailableCreditNotes,
    closingPaymentCreditNotesTotal,
    onToggleClosingPaymentCreditNote,

    confirmOpenCreateMovement,
    onConfirmOpenCreateMovement,
    onCancelOpenCreateMovement,
    company,
    accountKey,

    missingShiftModalOpen,
    missingShiftExpectedShift,
    missingShiftDateKey,
    onCloseMissingShift,
    onGoToControlHorario,

    confirmPhysicalCountOpen,
    handleCancelPhysicalCount,
    handleOpenCashOpening,
    pendingCierreModalOpen,
    closePendingCierreModal,
    confirmDeleteEntry,
    confirmDeleteMovement,
    cancelDeleteMovement,

    cashOpeningModalOpen,
    cashOpeningInitialValues,
    cashOpeningEditingEntry,
    onCloseCashOpening,
    onConfirmCashOpening,
    managerReadonlyCashOpening,
    cashOpeningDraftStorageKey,

    pendingZeroAmountCreditNoteModalOpen,
    pendingZeroAmountCreditNotes,
    onClosePendingZeroAmount,

    negativeBalanceModal,
    onCloseNegativeBalance,

    dailyClosingHistoryOpen,
    onCloseDailyClosingHistory,
    closingsAreLoading,
    dailyClosings,
    dailyClosingHistoryRange,
    onQuickRangeChange,
    dailyClosingDateFormatter,
    buildBreakdownLines,
    formatDailyClosingDiff,
    getDailyClosingDiffClass,
    fondoEntries,
    isAutoAdjustmentProvider,
    expandedClosings,
    setExpandedClosings,
    canDeleteLatestClosing,
    latestClosingLabel,
    onDeleteLatestClosing,
  } = props;

  return (
    <>
      <AuditHistoryModal
        open={auditModalOpen}
        onClose={onCloseAuditModal}
        auditModalData={auditModalData}
        dateTimeFormatter={dateTimeFormatter}
        formatByCurrency={formatByCurrency}
        providersMap={providersMap}
      />
      {/* daily closings block removed from inline view */}
      <DailyClosingModal
        key={`daily-${dailyClosingModalOpen ? "open" : "closed"}-${editingDailyClosingId ?? dailyClosingInitialValues?.closingDate ?? "new"}`}
        open={dailyClosingModalOpen}
        onClose={onCloseDailyClosing}
        onConfirm={onConfirmDailyClosing}
        onTurnoChange={onDailyClosingTurnoChange}
        initialValues={dailyClosingInitialValues}
        editId={editingDailyClosingId}
        onShowHistory={onShowDailyClosingHistory}
        employees={employeeOptions}
        loadingEmployees={employeesLoading}
        currentBalanceCRC={currentBalanceCRC}
        currentBalanceUSD={currentBalanceUSD}
        requireSingleClosingReason={requireSingleClosingReason}
        managerReadonly={managerReadonly}
        turno={dailyClosingTurno}
        requireTurnoSelection={requireTurnoSelection}
        cierreFondoVentasMinutesBeforeEnd={cierreFondoVentasMinutesBeforeEnd}
        cierreFondoVentasMinutesAfterEnd={cierreFondoVentasMinutesAfterEnd}
        previousReconciliation={previousReconciliation}
        cumulativeContica={cumulativeContica}
        systemVerificationEnabled={systemVerificationEnabled}
      />

      <DailyClosingSummaryModal
        open={Boolean(dailyClosingSummaryRecord)}
        record={dailyClosingSummaryRecord}
        onClose={onCloseDailyClosingSummary}
      />

      <FacturaPaymentModal
        open={closingPaymentModalOpen}
        target={closingPaymentTarget}
        providerName={providerName}
        employeeOptions={employeeOptions}
        employeesLoading={employeesLoading}
        balanceCRC={currentBalanceCRC}
        balanceUSD={currentBalanceUSD}
        paymentAmount={closingPaymentAmount}
        paymentNotes={closingPaymentNotes}
        paymentManager2={closingPaymentManager2}
        selectedPaymentPaid={Math.max(
          0,
          Math.trunc(Number(closingPaymentTarget?.paidAmount) || 0),
        )}
        selectedPaymentBalance={Math.max(
          0,
          Math.trunc(
            Number(
              closingPaymentTarget?.balanceDue ??
                Math.max(
                  0,
                  Math.trunc(
                    Number(
                      closingPaymentTarget?.originalAmount ??
                        closingPaymentTarget?.amount,
                    ) || 0,
                  ),
                ) -
                  Math.max(
                    0,
                    Math.trunc(Number(closingPaymentTarget?.paidAmount) || 0),
                  ),
            ) || 0,
          ),
        )}
        selectedPaymentStatus={String(
          closingPaymentTarget?.paymentStatus || "PENDIENTE",
        )}
        paymentSubmitting={closingPaymentSubmitting}
        canSubmitFullPayment={true}
        allowPartialPayment={true}
        onClose={onCloseClosingPaymentModal}
        onPaymentAmountChange={onPaymentAmountChange}
        onPaymentNotesChange={onPaymentNotesChange}
        onPaymentManager2Change={onPaymentManager2Change}
        onSubmitPartial={() => void onSubmitPartialPayment()}
        onSubmitFull={() => void onSubmitFullPayment()}
        pendingCreditNotes={closingPaymentAvailableCreditNotes}
        selectedCreditNoteIds={closingPaymentCreditNoteIds}
        onToggleCreditNote={onToggleClosingPaymentCreditNote}
        creditNotesAppliedTotal={closingPaymentCreditNotesTotal}
      />

      <ConfirmModal
        open={confirmOpenCreateMovement}
        title="Confirmar empresa y cuenta"
        message={`Vas a registrar un movimiento en la empresa "${
          company || ""
        }" y en la cuenta "${accountKey}". Verifica que sea correcto antes de continuar.`}
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        onConfirm={onConfirmOpenCreateMovement}
        onCancel={onCancelOpenCreateMovement}
      />

      <ConfirmModal
        open={missingShiftModalOpen}
        title="Turno no asignado"
        message={`No se cuenta con un turno (${missingShiftExpectedShift}) asignado para ${missingShiftDateKey || "hoy"}. Debes asignarlo en Control Horario para continuar.`}
        confirmText="Ir a Control Horario"
        cancelText="Cancelar"
        actionType="change"
        onConfirm={onGoToControlHorario}
        onCancel={onCloseMissingShift}
      />

      <FondoConfirmModals
        confirmPhysicalCountOpen={confirmPhysicalCountOpen}
        handleCancelPhysicalCount={handleCancelPhysicalCount}
        handleOpenCashOpening={handleOpenCashOpening}
        pendingCierreModalOpen={pendingCierreModalOpen}
        closePendingCierreModal={closePendingCierreModal}
        confirmDeleteEntry={confirmDeleteEntry}
        confirmDeleteMovement={confirmDeleteMovement}
        cancelDeleteMovement={cancelDeleteMovement}
      />

      <CashOpeningModal
        key={`cash-opening-${cashOpeningModalOpen ? "open" : "closed"}-${cashOpeningEditingEntry?.id ?? cashOpeningInitialValues?.openingDate ?? "new"}`}
        open={cashOpeningModalOpen}
        onClose={onCloseCashOpening}
        onConfirm={onConfirmCashOpening}
        initialValues={cashOpeningInitialValues}
        employees={employeeOptions}
        loadingEmployees={employeesLoading}
        currentBalanceCRC={currentBalanceCRC}
        currentBalanceUSD={currentBalanceUSD}
        managerReadonly={managerReadonlyCashOpening}
        persistDraft={!cashOpeningEditingEntry}
        draftStorageKey={cashOpeningDraftStorageKey}
      />

      <ConfirmModal
        open={pendingZeroAmountCreditNoteModalOpen}
        title="NC pendiente en monto 0"
        message={`Existe ${
          pendingZeroAmountCreditNotes.length === 1
            ? "una nota de credito pendiente con monto 0"
            : `${pendingZeroAmountCreditNotes.length} notas de credito pendientes con monto 0`
        }. Debes corregir el monto desde FC/NC antes de agregar un movimiento.`}
        singleButton
        singleButtonText="Ir a FC/NC"
        actionType="change"
        onCancel={onClosePendingZeroAmount}
        onConfirm={() => {}}
      />

      <ConfirmModal
        open={negativeBalanceModal.open}
        title="Saldo insuficiente"
        message={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta acción no puede llevarse a cabo porque el saldo quedaría en
              negativo.
            </p>

            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Monto de la salida
                </span>
                <span className="font-semibold">
                  {negativeBalanceModal.currency === "USD" ? "$ " : "₡ "}
                  {new Intl.NumberFormat(
                    negativeBalanceModal.currency === "USD" ? "en-US" : "es-CR",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    },
                  ).format(negativeBalanceModal.amount)}
                </span>
              </div>

              <div className="border-t border-destructive/20" />

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">
                  Saldo resultante
                </span>
                <span className="font-semibold text-destructive flex items-center gap-1">
                  <span>?</span>
                  {negativeBalanceModal.currency === "USD" ? "$ " : "₡ "}
                  {new Intl.NumberFormat(
                    negativeBalanceModal.currency === "USD" ? "en-US" : "es-CR",
                    {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    },
                  ).format(negativeBalanceModal.resultingNegativeAmount)}
                </span>
              </div>
            </div>
          </div>
        }
        confirmText="De Acuerdo"
        cancelText=""
        singleButton={true}
        singleButtonText="De Acuerdo"
        actionType="assign"
        onConfirm={onCloseNegativeBalance}
        onCancel={onCloseNegativeBalance}
      />

      <DailyClosingHistoryModal
        open={dailyClosingHistoryOpen}
        onClose={onCloseDailyClosingHistory}
        closingsAreLoading={closingsAreLoading}
        dailyClosings={dailyClosings}
        quickRange={dailyClosingHistoryRange}
        onQuickRangeChange={onQuickRangeChange}
        dailyClosingDateFormatter={dailyClosingDateFormatter}
        dateTimeFormatter={dateTimeFormatter}
        buildBreakdownLines={buildBreakdownLines}
        formatByCurrency={formatByCurrency}
        formatDailyClosingDiff={formatDailyClosingDiff}
        getDailyClosingDiffClass={getDailyClosingDiffClass}
        fondoEntries={fondoEntries}
        isAutoAdjustmentProvider={isAutoAdjustmentProvider}
        expandedClosings={expandedClosings}
        setExpandedClosings={setExpandedClosings}
        canDeleteLatestClosing={canDeleteLatestClosing}
        latestClosingLabel={latestClosingLabel}
        onDeleteLatestClosing={onDeleteLatestClosing}
      />
    </>
  );
}
