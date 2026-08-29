import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  RefreshCw,
} from "lucide-react";

import ConfirmModal from "../../../../components/ui/ConfirmModal";
import { isWithinCierreRange } from "../../utils/turnoRango";
import {
  SINGLE_CLOSING_REASON_INVALID_MESSAGE,
  SINGLE_CLOSING_REASON_MIN_LENGTH,
  validateSingleClosingReason,
} from "../../utils/closing/singleClosingReason";
import { reconcileClosing, type ClosingReconciliation } from "@/domain/reconciliation";
import {
  getBillCountKeyAction,
  parseBillCountInput,
} from "@/components/business/cash-counter-tabs/utils";
import type { DailyClosingRecord } from "@/services/daily-closings";
import {
  formatSystemVerificationMoneyInput as formatMoneyInput,
  normalizeSystemVerificationMoneyInput as normalizeMoneyInput,
} from "@/utils/systemVerificationMoneyInput";
// Usar botones nativos con clases Tailwind en vez de un componente Button central

const CRC_DENOMINATIONS: readonly number[] = [
  20000, 10000, 5000, 2000, 1000, 500, 100, 50, 25,
];
const USD_DENOMINATIONS: readonly number[] = [100, 50, 20, 10, 5, 1];
const RELEVANT_RECONCILIATION_DIFF_THRESHOLD = 500;

type CountState = Record<number, string>;

const buildInitialCounts = (denominations: readonly number[]): CountState => {
  return denominations.reduce<CountState>((acc, denom) => {
    acc[denom] = "";
    return acc;
  }, {} as CountState);
};

const buildCountsFromBreakdown = (
  denominations: readonly number[],
  breakdown: Record<number, number> | undefined | null,
): CountState => {
  const initial = buildInitialCounts(denominations);
  if (!breakdown) return initial;

  Object.entries(breakdown).forEach(([denom, count]) => {
    const d = Number(denom);
    if (Number.isFinite(d) && denominations.includes(d)) {
      initial[d] = String(count ?? 0) || "";
    }
  });

  return initial;
};

const buildFormState = (
  initialValues: DailyClosingFormValues | null | undefined,
) => {
  return {
    closingDateISO: initialValues?.closingDate || new Date().toISOString(),
    manager: initialValues?.manager || "",
    notes: initialValues?.notes || "",
    crcCounts: buildCountsFromBreakdown(
      CRC_DENOMINATIONS,
      initialValues?.breakdownCRC,
    ),
    usdCounts: buildCountsFromBreakdown(
      USD_DENOMINATIONS,
      initialValues?.breakdownUSD,
    ),
  };
};

const DAILY_CLOSING_MODAL_DRAFT_KEY = "fondogeneral-daily-closing-modal-draft";
const DAILY_CLOSING_TUCAN_TURNO_D_KEY_PREFIX =
  "fondogeneral-daily-closing-tucan-turno-d";
const DAILY_CLOSING_TIEMPOS_TURNO_D_KEY_PREFIX =
  "fondogeneral-daily-closing-tiempos-turno-d";

type DailyClosingModalDraft = {
  manager?: string;
  notes?: string;
  singleClosingReason?: string;
  crcCounts?: CountState;
  usdCounts?: CountState;
  r08?: string;
  t11?: string;
  tucanCumulative?: string;
  tiemposCumulative?: string;
};

const readDailyClosingDraft = (): DailyClosingModalDraft | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DAILY_CLOSING_MODAL_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object"
      ? (parsed as DailyClosingModalDraft)
      : null;
  } catch {
    return null;
  }
};

const buildTucanTurnoDKey = (closingDateISO: string) => {
  const dateKey = closingDateISO.slice(0, 10);
  return `${DAILY_CLOSING_TUCAN_TURNO_D_KEY_PREFIX}-${dateKey}`;
};

const buildTiemposTurnoDKey = (closingDateISO: string) => {
  const dateKey = closingDateISO.slice(0, 10);
  return `${DAILY_CLOSING_TIEMPOS_TURNO_D_KEY_PREFIX}-${dateKey}`;
};

const readTucanTurnoDValue = (closingDateISO: string): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildTucanTurnoDKey(closingDateISO));
    if (!raw) return null;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const readTiemposTurnoDValue = (closingDateISO: string): number | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(buildTiemposTurnoDKey(closingDateISO));
    if (!raw) return null;
    const value = Number.parseFloat(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
};

const writeTucanTurnoDValue = (closingDateISO: string, value: number) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!Number.isFinite(value) || value <= 0) {
      window.localStorage.removeItem(buildTucanTurnoDKey(closingDateISO));
      return;
    }
    window.localStorage.setItem(buildTucanTurnoDKey(closingDateISO), String(value));
  } catch {
    // ignore storage errors
  }
};

const writeTiemposTurnoDValue = (closingDateISO: string, value: number) => {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (!Number.isFinite(value) || value <= 0) {
      window.localStorage.removeItem(buildTiemposTurnoDKey(closingDateISO));
      return;
    }
    window.localStorage.setItem(buildTiemposTurnoDKey(closingDateISO), String(value));
  } catch {
    // ignore storage errors
  }
};

const clearTurnoDSystemValues = (closingDateISO: string) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(buildTucanTurnoDKey(closingDateISO));
    window.localStorage.removeItem(buildTiemposTurnoDKey(closingDateISO));
  } catch {
    // ignore storage errors
  }
};

export const clearDailyClosingModalDraft = () => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DAILY_CLOSING_MODAL_DRAFT_KEY);
  } catch {
    // ignore storage errors
  }
};

export type DailyClosingFormValues = {
  closingDate: string;
  manager: string;
  notes: string;
  singleClosingReason?: string;
  noMovements?: boolean;
  noMovementsReason?: string;
  totalCRC: number;
  totalUSD: number;
  breakdownCRC: Record<number, number>;
  breakdownUSD: Record<number, number>;
  turno?: "D" | "N";
  sinTurno?: true;
  r08: number;
  t11: number;
  tucanCumulative: number;
  tiemposCumulative: number;
};

type DailyClosingTurnoSelection = "D" | "N" | "none";

const resolveInitialTurnoSelection = (
  initialValues: DailyClosingFormValues | null | undefined,
  turno: "D" | "N" | undefined,
  requireBlankSelection: boolean,
): DailyClosingTurnoSelection | "" => {
  if (initialValues?.sinTurno) return "none";
  if (initialValues?.turno === "D" || initialValues?.turno === "N") {
    return initialValues.turno;
  }
  if (requireBlankSelection) return "";
  if (turno === "D" || turno === "N") return turno;
  return "";
};

type DailyClosingModalProps = {
  open: boolean;
  onClose: () => void;
  onConfirm: (values: DailyClosingFormValues) => Promise<DailyClosingRecord | null>;
  onTurnoChange?: (turno: "D" | "N" | undefined) => void;
  initialValues?: DailyClosingFormValues | null;
  editId?: string | null;
  onShowHistory?: () => void;
  employees: string[];
  loadingEmployees: boolean;
  currentBalanceCRC: number;
  currentBalanceUSD: number;
  requireSingleClosingReason?: boolean;
  managerReadonly?: boolean;

  turno?: "D" | "N";
  requireTurnoSelection?: boolean;
  cierreFondoVentasMinutesBeforeEnd: number;
  cierreFondoVentasMinutesAfterEnd: number;
  previousReconciliation?: ClosingReconciliation | null;
  cumulativeContica?: { r08: number; t11: number };
  systemVerificationEnabled?: boolean;
};

const DailyClosingModal: React.FC<DailyClosingModalProps> = ({
  open,
  onClose,
  onConfirm,
  onTurnoChange,
  initialValues,
  editId,
  onShowHistory,
  employees,
  loadingEmployees,
  currentBalanceCRC,
  currentBalanceUSD,
  requireSingleClosingReason = false,
  managerReadonly = false,
  turno,
  requireTurnoSelection = false,
  cierreFondoVentasMinutesBeforeEnd,
  cierreFondoVentasMinutesAfterEnd,
  previousReconciliation,
  cumulativeContica,
  systemVerificationEnabled = true,
}) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const openTurnoResetRef = useRef(false);
  const managerFieldRef = useRef<HTMLSelectElement | HTMLInputElement | null>(
    null,
  );
  const savedDraft = useMemo(() => (editId ? null : readDailyClosingDraft()), [editId]);

  const [closingDateISO] = useState(
    () => buildFormState(initialValues).closingDateISO,
  );

  const [manager, setManager] = useState(
    () => savedDraft?.manager ?? buildFormState(initialValues).manager,
  );
  const displayedManager = useMemo(() => manager, [manager]);

  const [notes, setNotes] = useState(
    () => savedDraft?.notes ?? buildFormState(initialValues).notes,
  );
  const [singleClosingReason, setSingleClosingReason] = useState(
    () => savedDraft?.singleClosingReason ?? initialValues?.singleClosingReason ?? "",
  );
  const [crcCounts, setCrcCounts] = useState<CountState>(
    () => ({ ...buildFormState(initialValues).crcCounts, ...(savedDraft?.crcCounts ?? {}) }),
  );
  const [usdCounts, setUsdCounts] = useState<CountState>(
    () => ({ ...buildFormState(initialValues).usdCounts, ...(savedDraft?.usdCounts ?? {}) }),
  );
  const [r08, setR08] = useState(() => savedDraft?.r08 ?? (initialValues?.r08 != null ? String(initialValues.r08) : ""));
  const [t11, setT11] = useState(() => savedDraft?.t11 ?? (initialValues?.t11 != null ? String(initialValues.t11) : ""));
  const [tucanCumulative, setTucanCumulative] = useState(() => savedDraft?.tucanCumulative ?? (initialValues?.tucanCumulative != null ? String(initialValues.tucanCumulative) : ""));
  const [tiemposCumulative, setTiemposCumulative] = useState(() => savedDraft?.tiemposCumulative ?? (initialValues?.tiemposCumulative != null ? String(initialValues.tiemposCumulative) : ""));
  const [turnoSelection, setTurnoSelection] = useState<
    DailyClosingTurnoSelection | ""
  >(() =>
    resolveInitialTurnoSelection(
      initialValues,
      turno,
      requireTurnoSelection && !editId,
    ),
  );
  const selectedTurno =
    turnoSelection === "D" || turnoSelection === "N" ? turnoSelection : undefined;
  const selectedSinTurno = turnoSelection === "none";
  const verificationActive = systemVerificationEnabled && !selectedSinTurno;
  const storedTucanTurnoD = open ? readTucanTurnoDValue(closingDateISO) : null;
  const storedTiemposTurnoD = open
    ? readTiemposTurnoDValue(closingDateISO)
    : null;

  const [confirmDiffOpen, setConfirmDiffOpen] = useState(false);
  const [pendingSubmitValues, setPendingSubmitValues] =
    useState<DailyClosingFormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);


  const secondaryButtonClass =
    "inline-flex h-11 items-center justify-center rounded-lg border border-[var(--input-border)] px-4 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20 disabled:cursor-not-allowed disabled:opacity-60";
  const primaryButtonClass =
    "inline-flex h-11 min-w-[11rem] items-center justify-center gap-2 rounded-lg border border-[var(--accent)] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-md active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--card-bg)] disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-60 disabled:shadow-none";

  const crcFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  );
  const usdFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }),
    [],
  );
  const closingDateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CR", {
        dateStyle: "long",
        timeStyle: "short",
      }),
    [],
  );

  const formatCurrency = useCallback(
    (currency: "CRC" | "USD", value: number) =>
      currency === "USD"
        ? `$ ${usdFormatter.format(value)}`
        : `₡ ${crcFormatter.format(value)}`,
    [usdFormatter, crcFormatter],
  );

  const normalizeCount = useCallback((raw: string) => {
    if (!raw) return 0;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, []);

  const totalCRC = useMemo(
    () =>
      CRC_DENOMINATIONS.reduce(
        (sum, denom) => sum + denom * normalizeCount(crcCounts[denom]),
        0,
      ),
    [crcCounts, normalizeCount],
  );
  const totalUSD = useMemo(
    () =>
      USD_DENOMINATIONS.reduce(
        (sum, denom) => sum + denom * normalizeCount(usdCounts[denom]),
        0,
      ),
    [usdCounts, normalizeCount],
  );

  const diffCRC = totalCRC - currentBalanceCRC;
  const diffUSD = totalUSD - currentBalanceUSD;
  const hasAnyCash = totalCRC > 0 || totalUSD > 0;
  const parseAmount = (value: string) => Number.parseFloat(normalizeMoneyInput(value) || "0") || 0;
  const r08Num = parseAmount(r08);
  const t11Num = parseAmount(t11);
  const tucanNum = parseAmount(tucanCumulative);
  const tiemposNum = parseAmount(tiemposCumulative);
  const tucanBelowTurnoD =
    selectedTurno === "N" &&
    storedTucanTurnoD !== null &&
    tucanNum > 0 &&
    tucanNum < storedTucanTurnoD;
  const tiemposBelowTurnoD =
    selectedTurno === "N" &&
    storedTiemposTurnoD !== null &&
    tiemposNum > 0 &&
    tiemposNum < storedTiemposTurnoD;
  const hasZeroClosingReport =
    verificationActive &&
    (r08Num === 0 || t11Num === 0 || tucanNum === 0 || tiemposNum === 0);
  const submitDisabled =
    submitting ||
    turnoSelection === "" ||
    displayedManager.trim().length === 0 ||
    !hasAnyCash ||
    hasZeroClosingReport ||
    (verificationActive && tucanBelowTurnoD) ||
    (verificationActive && tiemposBelowTurnoD) ||
    (requireSingleClosingReason &&
      !selectedSinTurno &&
      !validateSingleClosingReason(singleClosingReason).valid);
  const hasDifferences = diffCRC !== 0 || diffUSD !== 0;

  const reconciliationPreview = useMemo(() => {
    if (!verificationActive) return null;
    try { return reconcileClosing({ r08: r08Num, t11: t11Num, tucanCumulative: tucanNum, tiemposCumulative: tiemposNum, previous: previousReconciliation, cumulativeR08: (cumulativeContica?.r08 || 0) + r08Num, cumulativeT11: (cumulativeContica?.t11 || 0) + t11Num, isFinalShift: selectedTurno === "N" }); } catch { return null; }
  }, [verificationActive, r08Num, t11Num, tucanNum, tiemposNum, previousReconciliation, cumulativeContica, selectedTurno]);
  const conticaTucanDiff =
    reconciliationPreview?.calculated.tucanDifference ?? r08Num - tucanNum;
  const conticaTiemposDiff =
    reconciliationPreview?.calculated.tiemposDifference ?? t11Num - tiemposNum;

  const formatCRCAmount = useCallback(
    (value: number) => formatCurrency("CRC", Math.abs(value)),
    [formatCurrency],
  );

  const formatReconciliationDifference = useCallback(
    (value: number) => {
      if (value === 0) return "Cuadra";
      return value > 0
        ? `Sobra ${formatCRCAmount(value)}`
        : `Falta ${formatCRCAmount(value)}`;
    },
    [formatCRCAmount],
  );

  const isRelevantReconciliationDifference = useCallback(
    (value: number) => Math.abs(value) > RELEVANT_RECONCILIATION_DIFF_THRESHOLD,
    [],
  );

  const reconciliationStatusLabel = useMemo(() => {
    if (!reconciliationPreview) return "";
    switch (reconciliationPreview.tiemposStatus) {
      case "MATCHED":
        return "Todo cuadra";
      case "TEMPORARY_PENDING":
        return "Queda diferencia para revisar en el siguiente turno";
      case "PARTIALLY_RESOLVED":
        return "Se ajustó parte de una diferencia anterior";
      case "RESOLVED":
        return "Diferencia anterior resuelta";
      case "REAL_DIFFERENCE":
        return "Hay una diferencia real en este turno";
      case "DAILY_UNRESOLVED":
        return "El cierre del día queda con diferencia";
      default:
        return "Revisión pendiente";
    }
  }, [reconciliationPreview]);

  const reconciliationTone = useMemo(() => {
    if (!reconciliationPreview) return "neutral";
    if (hasZeroClosingReport) return "neutral";
    if (tucanBelowTurnoD || tiemposBelowTurnoD) return "danger";
    const hasRelevantTucanDifference = isRelevantReconciliationDifference(
      reconciliationPreview.calculated.tucanDifference,
    );
    if (
      hasRelevantTucanDifference ||
      reconciliationPreview.tiemposStatus === "REAL_DIFFERENCE" ||
      reconciliationPreview.tiemposStatus === "DAILY_UNRESOLVED"
    ) {
      return "danger";
    }
    if (
      reconciliationPreview.calculated.tucanDifference !== 0 ||
      reconciliationPreview.calculated.tiemposDifference !== 0
    ) {
      return "warning";
    }
    if (reconciliationPreview.tiemposStatus === "RESOLVED") {
      return "success";
    }
    if (
      reconciliationPreview.tiemposStatus === "TEMPORARY_PENDING" ||
      reconciliationPreview.tiemposStatus === "PARTIALLY_RESOLVED"
    ) {
      return "warning";
    }
    return "success";
  }, [
    reconciliationPreview,
    hasZeroClosingReport,
    tucanBelowTurnoD,
    tiemposBelowTurnoD,
    isRelevantReconciliationDifference,
  ]);

  const reconciliationToneClass = useMemo(() => {
    switch (reconciliationTone) {
      case "success":
        return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
      case "warning":
        return "border-amber-500/35 bg-amber-500/10 text-amber-100";
      case "danger":
        return "border-red-500/35 bg-red-500/10 text-red-100";
      default:
        return "border-[var(--input-border)] bg-[var(--muted)]/10 text-[var(--foreground)]";
    }
  }, [reconciliationTone]);

  const reconciliationHeadline = useMemo(() => {
    if (!reconciliationPreview || hasZeroClosingReport) return "Complete los datos";
    if (reconciliationTone === "success") return "Todo cuadra";
    if (
      reconciliationPreview.calculated.tucanDifference !== 0 &&
      !isRelevantReconciliationDifference(reconciliationPreview.calculated.tucanDifference)
    ) {
      return "Diferencia no relevante";
    }
    if (reconciliationTone === "warning") return "Existe una diferencia compensable";
    return "Revisar cierre";
  }, [
    reconciliationPreview,
    hasZeroClosingReport,
    reconciliationTone,
    isRelevantReconciliationDifference,
  ]);

  const reconciliationSummaryText = useMemo(() => {
    if (!reconciliationPreview || hasZeroClosingReport) return "Ingrese R08, T11, Tucan y Tiempos para verificar.";
    if (reconciliationTone === "success") return "No existen diferencias pendientes.";
    if (tucanBelowTurnoD || tiemposBelowTurnoD) return "El reporte nocturno no puede ser menor al turno diurno.";
    if (reconciliationPreview.calculated.tucanDifference !== 0) {
      if (!isRelevantReconciliationDifference(reconciliationPreview.calculated.tucanDifference)) {
        return `Diferencia menor o igual a ${formatCRCAmount(RELEVANT_RECONCILIATION_DIFF_THRESHOLD)}. No requiere revision.`;
      }
      return reconciliationPreview.calculated.tucanDifference > 0
        ? `Contica registra ${formatCRCAmount(reconciliationPreview.calculated.tucanDifference)} mas que Tucan.`
        : `Tucan posee ${formatCRCAmount(reconciliationPreview.calculated.tucanDifference)} mas que Contica.`;
    }
    if (reconciliationTone === "warning") return reconciliationStatusLabel;
    return reconciliationStatusLabel;
  }, [
    reconciliationPreview,
    hasZeroClosingReport,
    reconciliationTone,
    reconciliationStatusLabel,
    tucanBelowTurnoD,
    tiemposBelowTurnoD,
    formatCRCAmount,
    isRelevantReconciliationDifference,
  ]);

  const reconciliationActionText = useMemo(() => {
    if (!reconciliationPreview || hasZeroClosingReport) return "Completar datos para ver accion requerida.";
    if (reconciliationTone === "success") return "No requiere accion.";
    if (tucanBelowTurnoD || tiemposBelowTurnoD) return "Corregir acumulados antes de guardar.";
    if (
      reconciliationPreview.calculated.tucanDifference !== 0 &&
      !isRelevantReconciliationDifference(reconciliationPreview.calculated.tucanDifference)
    ) {
      return "No requiere revision.";
    }
    if (reconciliationTone === "warning") return "Esperar al siguiente turno y validar compensacion.";
    return "Revisar movimientos y validar reporte de Contica.";
  }, [
    reconciliationPreview,
    hasZeroClosingReport,
    reconciliationTone,
    tucanBelowTurnoD,
    tiemposBelowTurnoD,
    isRelevantReconciliationDifference,
  ]);

  const buildVerificationStatus = useCallback(
    (sourceLabel: string, diff: number, status?: ClosingReconciliation["tiemposStatus"]) => {
      if (diff === 0 && (!status || status === "MATCHED")) {
        return {
          label: "Coincide",
          text: "No requiere accion.",
          className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        };
      }
      if (status === "RESOLVED") {
        return {
          label: "Coincide",
          text: "Diferencia anterior resuelta. No requiere accion.",
          className: "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
        };
      }
      if (sourceLabel === "Tucan" && diff !== 0 && !isRelevantReconciliationDifference(diff)) {
        return {
          label: "Diferencia no relevante",
          text: `${formatReconciliationDifference(diff)}. No requiere revision.`,
          className: "border-amber-500/25 bg-amber-500/10 text-amber-100",
        };
      }
      if (status === "TEMPORARY_PENDING" || status === "PARTIALLY_RESOLVED") {
        return {
          label: formatReconciliationDifference(diff),
          text: "Esperar al siguiente turno.",
          className: "border-amber-500/25 bg-amber-500/10 text-amber-100",
        };
      }
      return {
        label: formatReconciliationDifference(diff),
        text:
          diff > 0
            ? `Contica registra ${formatCRCAmount(diff)} mas que ${sourceLabel}.`
            : `${sourceLabel} posee ${formatCRCAmount(diff)} mas que Contica.`,
        className: "border-red-500/25 bg-red-500/10 text-red-100",
      };
    },
    [formatCRCAmount, formatReconciliationDifference, isRelevantReconciliationDifference],
  );

  const compensationResultLabel = useMemo(() => {
    if (!reconciliationPreview) return "Pendiente siguiente";
    return reconciliationPreview.calculated.tiemposRealShiftDifference !== 0
      ? "Diferencia real"
      : "Pendiente siguiente";
  }, [reconciliationPreview]);

  const compensationResultValue = useMemo(() => {
    if (!reconciliationPreview) return 0;
    return reconciliationPreview.calculated.tiemposRealShiftDifference !== 0
      ? reconciliationPreview.calculated.tiemposRealShiftDifference
      : reconciliationPreview.calculated.tiemposPendingAfterClosing;
  }, [reconciliationPreview]);

  const submitDisabledReason = useMemo(() => {
    if (submitting) {
      return "Guardando cierre. Espere un momento.";
    }
    if (turnoSelection === "") {
      return "Selecciona el turno para poder guardar.";
    }
    if (displayedManager.trim().length === 0) {
      return "Selecciona un encargado para poder guardar.";
    }
    if (!hasAnyCash) {
      return "No se puede guardar: el efectivo está en 0. Ingresa el conteo en colones o dólares para realizar el cierre.";
    }
    if (hasZeroClosingReport) {
      return "No se puede guardar debido a la falta de R08, T11, Tucan y Tiempos";
    }
    if (verificationActive && tucanBelowTurnoD) {
      return `No se puede guardar: Tucan nocturno no puede ser menor al turno D (${formatCurrency("CRC", storedTucanTurnoD ?? 0)}).`;
    }
    if (verificationActive && tiemposBelowTurnoD) {
      return `No se puede guardar: Tiempos nocturno no puede ser menor al turno D (${formatCurrency("CRC", storedTiemposTurnoD ?? 0)}).`;
    }
    if (
      requireSingleClosingReason &&
      !selectedSinTurno &&
      !validateSingleClosingReason(singleClosingReason).valid
    ) {
      return SINGLE_CLOSING_REASON_INVALID_MESSAGE;
    }
    return "";
  }, [
    displayedManager,
    hasAnyCash,
    hasZeroClosingReport,
    turnoSelection,
    verificationActive,
    tucanBelowTurnoD,
    storedTucanTurnoD,
    tiemposBelowTurnoD,
    storedTiemposTurnoD,
    formatCurrency,
    requireSingleClosingReason,
    selectedSinTurno,
    singleClosingReason,
    submitting,
  ]);

  const differenceLabel = useCallback(
    (currency: "CRC" | "USD", diff: number) => {
      if (diff === 0) return "sin diferencias";
      const sign = diff > 0 ? "+" : "-";
      return `${sign} ${formatCurrency(currency, Math.abs(diff))}`;
    },
    [formatCurrency],
  );

  const differencesConfirmMessage = useMemo(() => {
    if (!hasDifferences) return "";

    const lines: string[] = [
      "Hay diferencias entre el efectivo contado y el saldo registrado.",
      "",
    ];

    if (diffCRC !== 0) {
      lines.push(
        `Colones: contado ${formatCurrency("CRC", totalCRC)} · registrado ${formatCurrency("CRC", currentBalanceCRC)} · diferencia ${differenceLabel("CRC", diffCRC)}`,
      );
    }
    if (diffUSD !== 0) {
      lines.push(
        `Dólares: contado ${formatCurrency("USD", totalUSD)} · registrado ${formatCurrency("USD", currentBalanceUSD)} · diferencia ${differenceLabel("USD", diffUSD)}`,
      );
    }

    lines.push("", "¿Deseas guardar el cierre de todos modos?");
    return lines.join("\n");
  }, [
    hasDifferences,
    totalCRC,
    totalUSD,
    currentBalanceCRC,
    currentBalanceUSD,
    diffCRC,
    diffUSD,
    formatCurrency,
    differenceLabel,
  ]);

  useEffect(() => {
    if (!open) return;
    if (!openTurnoResetRef.current) {
      openTurnoResetRef.current = true;
      const nextTurnoSelection = resolveInitialTurnoSelection(
        initialValues,
        turno,
        requireTurnoSelection && !editId,
      );
      setTurnoSelection(nextTurnoSelection);
      onTurnoChange?.(
        nextTurnoSelection === "D" || nextTurnoSelection === "N"
          ? nextTurnoSelection
          : undefined,
      );
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    editId,
    initialValues,
    onClose,
    onTurnoChange,
    open,
    requireTurnoSelection,
    turno,
  ]);

  useEffect(() => {
    if (open) return;
    openTurnoResetRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || selectedTurno !== "D") return;
    writeTucanTurnoDValue(closingDateISO, tucanNum);
    writeTiemposTurnoDValue(closingDateISO, tiemposNum);
  }, [open, selectedTurno, closingDateISO, tucanNum, tiemposNum]);

  useEffect(() => {
    if (!open || editId) return;
    try {
      window.localStorage.setItem(
        DAILY_CLOSING_MODAL_DRAFT_KEY,
        JSON.stringify({
          manager,
          notes,
          singleClosingReason,
          crcCounts,
          usdCounts,
          r08,
          t11,
          tucanCumulative,
          tiemposCumulative,
        } satisfies DailyClosingModalDraft),
      );
    } catch {
      // ignore storage errors
    }
  }, [
    open,
    editId,
    manager,
    notes,
    singleClosingReason,
    crcCounts,
    usdCounts,
    r08,
    t11,
    tucanCumulative,
    tiemposCumulative,
  ]);

  const handleCountChange = (
    currency: "CRC" | "USD",
    denom: number,
    value: string,
  ) => {
    const sanitized = value.replace(/[^0-9+\-=.\s]/g, "");
    if (currency === "CRC") {
      setCrcCounts((prev) => ({ ...prev, [denom]: sanitized }));
    } else {
      setUsdCounts((prev) => ({ ...prev, [denom]: sanitized }));
    }
  };

  const commitCount = (currency: "CRC" | "USD", denom: number) => {
    if (currency === "CRC") {
      setCrcCounts((prev) => {
        const current = prev[denom] ?? "";
        const parsed = parseBillCountInput(current);
        return { ...prev, [denom]: parsed > 0 ? String(parsed) : "" };
      });
    } else {
      setUsdCounts((prev) => {
        const current = prev[denom] ?? "";
        const parsed = parseBillCountInput(current);
        return { ...prev, [denom]: parsed > 0 ? String(parsed) : "" };
      });
    }
  };

  const insertCountFormulaOperator = (
    input: HTMLInputElement,
    operator: "+" | "-",
  ) => {
    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    const next = `${input.value.slice(0, start)}${operator}${input.value.slice(end)}`;
    const cursor = start + operator.length;
    handleCountChange(
      input.dataset.cashCurrency === "USD" ? "USD" : "CRC",
      Number(input.dataset.cashDenom || 0),
      next,
    );
    window.requestAnimationFrame(() => {
      input.setSelectionRange(cursor, cursor);
    });
  };

  const incrementCount = (currency: "CRC" | "USD", denom: number) => {
    if (currency === "CRC") {
      setCrcCounts((prev) => {
        const curr = parseBillCountInput(prev[denom] || "0");
        return { ...prev, [denom]: String(curr + 1) };
      });
    } else {
      setUsdCounts((prev) => {
        const curr = parseBillCountInput(prev[denom] || "0");
        return { ...prev, [denom]: String(curr + 1) };
      });
    }
  };

  const decrementCount = (currency: "CRC" | "USD", denom: number) => {
    if (currency === "CRC") {
      setCrcCounts((prev) => {
        const curr = parseBillCountInput(prev[denom] || "0");
        const next = Math.max(0, curr - 1);
        return { ...prev, [denom]: String(next) };
      });
    } else {
      setUsdCounts((prev) => {
        const curr = parseBillCountInput(prev[denom] || "0");
        const next = Math.max(0, curr - 1);
        return { ...prev, [denom]: String(next) };
      });
    }
  };

  const focusAdjacentCashInput = (
    current: HTMLInputElement,
    direction: 1 | -1,
  ) => {
    const root = modalRef.current;
    if (!root) return;

    const cashInputs = Array.from(
      root.querySelectorAll<HTMLInputElement>(
        'input[data-cash-count-input="true"]',
      ),
    );
    const currentIndex = cashInputs.indexOf(current);
    if (currentIndex === -1) return;

    const next = cashInputs[currentIndex + direction];
    if (next) {
      next.focus();
      next.select();
      return;
    }

    if (direction === 1) {
      managerFieldRef.current?.focus();
    }
  };

  const handleCountKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>,
    currency: "CRC" | "USD",
    denom: number,
  ) => {
    if (
      event.shiftKey &&
      (event.key === "+" ||
        event.key === "_" ||
        event.code === "Equal" ||
        event.code === "Minus" ||
        event.code === "NumpadAdd" ||
        event.code === "NumpadSubtract")
    ) {
      event.preventDefault();
      insertCountFormulaOperator(
        event.currentTarget,
        event.code === "Minus" || event.code === "NumpadSubtract" ? "-" : "+",
      );
      return;
    }

    const keyAction = getBillCountKeyAction(event);
    if (keyAction === "type") return;
    if (keyAction === "increment") {
      event.preventDefault();
      incrementCount(currency, denom);
      return;
    }
    if (keyAction === "decrement") {
      event.preventDefault();
      decrementCount(currency, denom);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      commitCount(currency, denom);
      focusAdjacentCashInput(event.currentTarget, -1);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      commitCount(currency, denom);
      focusAdjacentCashInput(event.currentTarget, 1);
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      incrementCount(currency, denom);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      decrementCount(currency, denom);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      commitCount(currency, denom);
      focusAdjacentCashInput(event.currentTarget, event.shiftKey ? -1 : 1);
    }
  };

  const buildBreakdown = (
    counts: CountState,
    denominations: readonly number[],
  ) => {
    return denominations.reduce<Record<number, number>>((acc, denom) => {
      acc[denom] = normalizeCount(counts[denom]);
      return acc;
    }, {});
  };

  const submitClosingValues = async (values: DailyClosingFormValues) => {
    setSubmitting(true);
    try {
      const savedRecord = await onConfirm(values);
      if (savedRecord && verificationActive && values.turno === "N") {
        clearTurnoDSystemValues(values.closingDate);
      }
      return savedRecord;
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = () => {
    const trimmedManager = displayedManager.trim();
    if (submitDisabled) return;
    if (verificationActive && selectedTurno === "D") {
      writeTucanTurnoDValue(closingDateISO, tucanNum);
      writeTiemposTurnoDValue(closingDateISO, tiemposNum);
    }

    const values: DailyClosingFormValues = {
      closingDate: closingDateISO,
      manager: trimmedManager,
      notes,
      singleClosingReason: singleClosingReason.trim(),
      noMovements: false,
      noMovementsReason: "",
      totalCRC,
      totalUSD,
      breakdownCRC: buildBreakdown(crcCounts, CRC_DENOMINATIONS),
      breakdownUSD: buildBreakdown(usdCounts, USD_DENOMINATIONS),
      ...(selectedTurno ? { turno: selectedTurno } : {}),
      ...(selectedSinTurno ? { sinTurno: true } : {}),
      r08: r08Num,
      t11: t11Num,
      tucanCumulative: tucanNum,
      tiemposCumulative: tiemposNum,
    };

    if (hasDifferences) {
      setPendingSubmitValues(values);
      setConfirmDiffOpen(true);
      return;
    }

    void submitClosingValues(values);
  };

  const handleConfirmDifferences = async () => {
    if (!pendingSubmitValues) {
      setConfirmDiffOpen(false);
      return;
    }
    const savedRecord = await submitClosingValues(pendingSubmitValues);
    if (savedRecord) {
      setConfirmDiffOpen(false);
      setPendingSubmitValues(null);
    }
  };

  const handleCancelDifferences = () => {
    setConfirmDiffOpen(false);
    setPendingSubmitValues(null);
  };

  const handleClearCounts = () => {
    setCrcCounts(buildInitialCounts(CRC_DENOMINATIONS));
    setUsdCounts(buildInitialCounts(USD_DENOMINATIONS));
  };
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
    >
      <div
        className="w-full max-w-full sm:max-w-4xl rounded-xl border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] shadow-lg max-h-[95vh] overflow-hidden flex flex-col"
        onClick={(event) => event.stopPropagation()}
        ref={modalRef}
      >
        <div className="flex items-center justify-between gap-4 p-5 pb-0">
          <div className="flex-1" />
          <h3 className="text-lg font-semibold text-center">
            Cierre diario del fondo
          </h3>
          <div className="flex-1" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div className="flex flex-col gap-6">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Fecha de cierre
                </label>
                <div
                  className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 flex items-center text-sm text-[var(--foreground)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                >
                  {closingDateFormatter.format(new Date(closingDateISO))}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                  Encargado
                </label>
                {employees.length > 0 ? (
                  <select
                    value={displayedManager}
                    onChange={(event) => setManager(event.target.value)}
                    className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                    disabled={loadingEmployees || managerReadonly}
                    ref={(el) => {
                      managerFieldRef.current = el;
                    }}
                  >
                    <option value="">Seleccionar encargado</option>
                    {employees.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={displayedManager}
                    onChange={(event) => setManager(event.target.value)}
                    className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                    placeholder="Nombre del encargado"
                    readOnly={managerReadonly}
                    ref={(el) => {
                      managerFieldRef.current = el;
                    }}
                  />
                )}
              </div>
            </div>
            <div className="text-xs text-center text-[var(--muted-foreground)]">
              Usa{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                ↑
              </kbd>{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                ↓
              </kbd>{" "}
              para navegar entre casillas y{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                ←
              </kbd>{" "}
              <kbd className="mx-0.5 rounded border border-[var(--input-border)] bg-[var(--muted)]/30 px-1.5 py-0.5 font-mono text-[10px]">
                →
              </kbd>{" "}
              para sumar/restar
            </div>
            <div className="grid gap-4 grid-cols-2 md:grid-cols-2">
              <section>
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                  Efectivo (colones)
                </h4>
                <div className="space-y-2">
                  {CRC_DENOMINATIONS.map((denom) => {
                    const quantity = normalizeCount(crcCounts[denom]);
                    const lineTotal = denom * quantity;
                    return (
                      <div key={denom} className="flex items-center gap-3">
                        <label className="w-20 text-xs text-[var(--muted-foreground)]">
                          {denom.toLocaleString("es-CR")}
                        </label>
                        <div className="relative">
                          <input
                            value={crcCounts[denom] ?? ""}
                            onChange={(event) =>
                              handleCountChange(
                                "CRC",
                                denom,
                                event.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleCountKeyDown(e, "CRC", denom)
                            }
                            onBlur={() => commitCount("CRC", denom)}
                            className="w-24 h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 pr-8 text-sm text-center text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                            style={{
                              backgroundColor: "var(--card-bg)",
                              color: "var(--foreground)",
                            }}
                            inputMode="text"
                            aria-label={`Cantidad ${denom} colones`}
                            data-cash-count-input="true"
                            data-cash-currency="CRC"
                            data-cash-denom={denom}
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center select-none">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => incrementCount("CRC", denom)}
                              className="w-5 h-4 leading-[10px] rounded-t bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                              aria-label={`Aumentar ${denom}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => decrementCount("CRC", denom)}
                              className="w-5 h-4 leading-[10px] rounded-b bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                              aria-label={`Disminuir ${denom}`}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 text-right text-xs text-[var(--muted-foreground)]">
                          {formatCurrency("CRC", lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                  Total: {formatCurrency("CRC", totalCRC)}
                </div>
                <div
                  className={`mt-2 text-sm font-semibold ${diffCRC < 0 ? "border-red-500/30 bg-red-500/10 text-red-300" : diffCRC > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800/60 text-slate-300"} rounded border px-2.5 py-1`}
                >
                  Saldo registrado: {formatCurrency("CRC", currentBalanceCRC)} ·
                  Diferencia: {differenceLabel("CRC", diffCRC)}
                </div>
              </section>
              <section className="md:border-l md:border-[var(--input-border)] md:pl-6">
                <h4 className="text-sm font-semibold text-[var(--foreground)] mb-3">
                  Efectivo (dólares)
                </h4>
                <div className="space-y-2">
                  {USD_DENOMINATIONS.map((denom) => {
                    const quantity = normalizeCount(usdCounts[denom]);
                    const lineTotal = denom * quantity;
                    return (
                      <div key={denom} className="flex items-center gap-3">
                        <label className="w-20 text-xs text-[var(--muted-foreground)]">
                          {denom}
                        </label>
                        <div className="relative">
                          <input
                            value={usdCounts[denom] ?? ""}
                            onChange={(event) =>
                              handleCountChange(
                                "USD",
                                denom,
                                event.target.value,
                              )
                            }
                            onKeyDown={(e) =>
                              handleCountKeyDown(e, "USD", denom)
                            }
                            onBlur={() => commitCount("USD", denom)}
                            className="w-24 h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] p-2 pr-8 text-sm text-center text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                            style={{
                              backgroundColor: "var(--card-bg)",
                              color: "var(--foreground)",
                            }}
                            inputMode="text"
                            aria-label={`Cantidad ${denom} dólares`}
                            data-cash-count-input="true"
                            data-cash-currency="USD"
                            data-cash-denom={denom}
                          />
                          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex flex-col items-center select-none">
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => incrementCount("USD", denom)}
                              className="w-5 h-4 leading-[10px] rounded-t bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                              aria-label={`Aumentar ${denom}`}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => decrementCount("USD", denom)}
                              className="w-5 h-4 leading-[10px] rounded-b bg-transparent text-[var(--muted-foreground)] transition-colors hover:text-[var(--foreground)] hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                              aria-label={`Disminuir ${denom}`}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                        <div className="flex-1 text-right text-xs text-[var(--muted-foreground)]">
                          {formatCurrency("USD", lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 text-sm font-semibold text-[var(--foreground)]">
                  Total: {formatCurrency("USD", totalUSD)}
                </div>
                <div
                  className={`mt-2 text-sm font-semibold ${diffUSD < 0 ? "border-red-500/30 bg-red-500/10 text-red-300" : diffUSD > 0 ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-slate-600 bg-slate-800/60 text-slate-300"} rounded border px-2.5 py-1`}
                >
                  Saldo registrado: {formatCurrency("USD", currentBalanceUSD)} ·
                  Diferencia: {differenceLabel("USD", diffUSD)}
                </div>
              </section>
            </div>
            {verificationActive && (
              <section className="rounded-lg border border-[var(--input-border)] p-4">
                <h4 className="mb-3 text-sm font-semibold">Verificacion Contica / Tucan / Tiempos</h4>
                <div className={`mb-4 rounded border px-3 py-3 ${reconciliationToneClass}`}>
                  <div className="flex items-start gap-2">
                    {reconciliationTone === "success" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                    ) : reconciliationTone === "warning" ? (
                      <Clock3 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.8} />
                    )}
                    <div>
                      <div className="text-sm font-semibold uppercase tracking-wide">{reconciliationHeadline}</div>
                      <div className="mt-1 text-xs">{reconciliationSummaryText}</div>
                      <div className="mt-2 text-xs font-semibold">Accion: {reconciliationActionText}</div>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                <div className="hidden grid-cols-3 gap-3 text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] md:grid"><span>Contica</span><span>Reporte acumulado</span><span>Diferencia turno</span></div>
                {[
                  ["R08", r08, setR08, "Tucán", tucanCumulative, setTucanCumulative, conticaTucanDiff],
                  ["T11", t11, setT11, "Tiempos", tiemposCumulative, setTiemposCumulative, conticaTiemposDiff],
                ].map(([conticaLabel, conticaValue, setContica, externalLabel, externalValue, setExternal, difference]) => (
                  <div key={conticaLabel as string} className="grid gap-3 md:grid-cols-3">
                    <label className="text-xs text-[var(--muted-foreground)]">
                      <span className="md:hidden">Contica · </span>
                      {conticaLabel as string}
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted-foreground)]">
                          ₡
                        </span>
                        <input
                          type="text"
                          value={formatMoneyInput(conticaValue as string)}
                          onChange={(event) =>
                            (setContica as React.Dispatch<React.SetStateAction<string>>)(
                              normalizeMoneyInput(event.target.value),
                            )
                          }
                          inputMode="decimal"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="h-10 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 pl-7 text-sm text-[var(--foreground)]"
                        />
                      </div>
                    </label>
                    <label className="text-xs text-[var(--muted-foreground)]">
                      <span className="md:hidden">Acumulado · </span>
                      {externalLabel as string}
                      <div className="relative mt-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--muted-foreground)]">
                          ₡
                        </span>
                        <input
                          type="text"
                          value={formatMoneyInput(externalValue as string)}
                          onChange={(event) =>
                            (setExternal as React.Dispatch<React.SetStateAction<string>>)(
                              normalizeMoneyInput(event.target.value),
                            )
                          }
                          inputMode="decimal"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck={false}
                          className="h-10 w-full rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 pl-7 text-sm text-[var(--foreground)]"
                        />
                      </div>
                    </label>
                    <label className="text-xs text-[var(--muted-foreground)]">
                      <span className="md:hidden">Diferencia · </span>
                      Diferencia
                      <input
                        value={(() => {
                          const amount = difference as number;
                          const formattedAmount = formatCRCAmount(Math.abs(amount));
                          return amount > 0
                            ? `+${formattedAmount}`
                            : amount < 0
                              ? `-${formattedAmount}`
                              : formattedAmount;
                        })()}
                        readOnly
                        aria-label={`Diferencia ${conticaLabel as string}`}
                        className="mt-1 h-10 w-full cursor-default rounded border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm font-semibold text-[var(--foreground)]"
                      />
                    </label>
                  </div>
                ))}
                {tucanBelowTurnoD && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                    Tucan del turno N no puede ser menor al turno D
                  </div>
                )}
                {tiemposBelowTurnoD && (
                  <div className="rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300">
                    Tiempos del turno N no puede ser menor al turno D
                  </div>
                )}
              </div>
              {reconciliationPreview && (
                <div className="mt-4 space-y-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    {[
                      {
                        key: "tucan",
                        title: "Tucan",
                        report: reconciliationPreview.calculated.tucanForShift,
                        contica: reconciliationPreview.contica.r08,
                        code: "R08",
                        status: buildVerificationStatus("Tucan", reconciliationPreview.calculated.tucanDifference),
                      },
                      {
                        key: "tiempos",
                        title: "Tiempos",
                        report: reconciliationPreview.calculated.tiemposForShift,
                        contica: reconciliationPreview.contica.t11,
                        code: "T11",
                        status: buildVerificationStatus(
                          "Tiempos",
                          reconciliationPreview.calculated.tiemposDifference,
                          reconciliationPreview.tiemposStatus,
                        ),
                      },
                    ].map((item) => (
                      <div key={item.key} className="rounded border border-[var(--input-border)] bg-[var(--background)] p-3">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                          <BarChart3 className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.7} />
                          {item.title}
                        </div>
                        <div className="grid gap-2 text-xs text-[var(--muted-foreground)]">
                          <div className="flex items-center justify-between gap-3">
                            <span>Reporte</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(item.report)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span>Contica ({item.code})</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(item.contica)}</span>
                          </div>
                          <div className={`rounded border px-2.5 py-2 ${item.status.className}`}>
                            <div className="font-semibold">Estado: {item.status.label}</div>
                            <div className="mt-1">{item.status.text}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="rounded border border-[var(--input-border)] bg-[var(--background)] p-3">
                    <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                      <RefreshCw className="h-4 w-4 text-[var(--accent)]" strokeWidth={1.7} />
                      Compensacion
                    </div>
                    {reconciliationPreview.calculated.previousTiemposPending !== 0 ||
                    reconciliationPreview.calculated.compensatedTiemposAmount !== 0 ||
                    reconciliationPreview.calculated.tiemposPendingAfterClosing !== 0 ? (
                      <div className="grid gap-2 text-xs text-[var(--muted-foreground)] md:grid-cols-3">
                        <span>Pendiente anterior: {formatReconciliationDifference(reconciliationPreview.calculated.previousTiemposPending)}</span>
                        <span>Compensado: {formatCRCAmount(reconciliationPreview.calculated.compensatedTiemposAmount)}</span>
                        <span>{compensationResultLabel}: {formatReconciliationDifference(compensationResultValue)}</span>
                      </div>
                    ) : (
                      <div className="text-xs text-emerald-200">No existen pendientes entre turnos.</div>
                    )}
                  </div>

                  <details className="rounded border border-[var(--input-border)] bg-[var(--background)] p-3 text-xs text-[var(--muted-foreground)]">
                    <summary className="cursor-pointer select-none font-semibold text-[var(--foreground)]">
                      Ver detalle tecnico
                    </summary>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div className="rounded border border-[var(--input-border)]/60 bg-[var(--card-bg)]/40 p-3">
                        <div className="mb-2 font-semibold text-[var(--foreground)]">Tucan</div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between gap-3">
                            <span>Vendido en el turno</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.calculated.tucanForShift)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Total reportado por Tucan</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.externalSnapshots.tucanCumulative)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Turno actual R08</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.contica.r08)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Diferencia con R08</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatReconciliationDifference(reconciliationPreview.calculated.tucanDifference)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>R08 acumulado</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.calculated.cumulativeR08)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="rounded border border-[var(--input-border)]/60 bg-[var(--card-bg)]/40 p-3">
                        <div className="mb-2 font-semibold text-[var(--foreground)]">Tiempos</div>
                        <div className="space-y-1.5">
                          <div className="flex justify-between gap-3">
                            <span>Vendido en el turno</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.calculated.tiemposForShift)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Total reportado por Tiempos</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.externalSnapshots.tiemposCumulative)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Turno actual T11</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.contica.t11)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>Diferencia antes de ajustes</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatReconciliationDifference(reconciliationPreview.calculated.tiemposRawDifference)}</span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span>T11 acumulado</span>
                            <span className="font-semibold text-[var(--foreground)]">{formatCRCAmount(reconciliationPreview.calculated.cumulativeT11)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </details>
                </div>
              )}
              </section>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
              Observaciones
            </label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-[96px] rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
              style={{
                backgroundColor: "var(--card-bg)",
                color: "var(--foreground)",
              }}
              maxLength={400}
              placeholder="Notas adicionales del cierre"
            />
          </div>

          {requireSingleClosingReason && !selectedSinTurno && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Motivo cierre único
              </label>
              <textarea
                value={singleClosingReason}
                onChange={(event) => setSingleClosingReason(event.target.value)}
                className="min-h-[96px] rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-amber-400/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/30 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                minLength={SINGLE_CLOSING_REASON_MIN_LENGTH}
                maxLength={400}
                placeholder="Describe el motivo del cierre único"
              />
            </div>
          )}
          {requireTurnoSelection && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
                Turno
              </label>
              <select
                value={turnoSelection}
                onChange={(event) => {
                  const next = event.target.value as
                    | DailyClosingTurnoSelection
                    | "";
                  setTurnoSelection(next);
                  onTurnoChange?.(
                    next === "D" || next === "N" ? next : undefined,
                  );
                }}
                className="h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
              >
                <option value="">Seleccionar turno</option>
                <option value="D">Turno D</option>
                <option value="N">Turno N</option>
                <option value="none">Sin turno</option>
              </select>
            </div>
          )}
        </div>

        <div className="px-5 pb-5 pt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--input-border)]">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClearCounts}
              className={secondaryButtonClass}
            >
              Limpiar conteo
            </button>
            {onShowHistory && (
              <button
                type="button"
                onClick={() => onShowHistory()}
                className={secondaryButtonClass}
              >
                Ver historial
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitDisabled}
                className={primaryButtonClass}
              >
                {submitting ? (
                  <RefreshCw className="h-4 w-4 animate-spin" strokeWidth={1.8} />
                ) : (
                  <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
                )}
                {submitting ? "Guardando..." : editId ? "Actualizar cierre" : "Guardar cierre"}
              </button>
              {submitDisabled && submitDisabledReason ? (
                <div
                  className="pointer-events-none absolute bottom-full right-0 mb-2 w-72 rounded border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                  role="tooltip"
                >
                  {submitDisabledReason}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmDiffOpen}
        title="Confirmar cierre con diferencias"
        message={differencesConfirmMessage}
        confirmText={
          editId ? "Actualizar de todos modos" : "Guardar de todos modos"
        }
        cancelText="Revisar"
        actionType="change"
        loading={submitting}
        confirmDisabled={submitting}
        onConfirm={handleConfirmDifferences}
        onCancel={handleCancelDifferences}
      />
    </div>
  );
};

export default DailyClosingModal;
