"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import {
  UserPlus,
  Plus,
  Pencil,
  Trash2,
  X,
  Banknote,
  Clock,
  Layers,
  Tag,
  FileText,
  UserCircle,
  ArrowUpDown,
  EyeIcon,
  ArrowUpRight,
  ArrowDownRight,
  Lock,
  LockOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  CheckCircle,
  Info,
  RotateCcw,
  Mail,
  MessageSquare,
  XCircle,
  Loader2,
} from "lucide-react";
import { useAuth } from "../../../hooks/useAuth";
import { useProviders } from "../../../hooks/useProviders";
import useToast from "../../../hooks/useToast";
import type { UserPermissions, Empresas, User } from "../../../types/firestore";
import { getDefaultPermissions } from "../../../utils/permissions";
import ConfirmModal from "../../../components/ui/ConfirmModal";
import DailyClosingHistoryModal from "../../../components/modals/DailyClosingHistoryModal";
import { EmpresasService } from "../../../services/empresas";
import { UsersService } from "../../../services/users";
import { ProvidersService } from "../../../services/providers";
import { FondoMovementTypesService } from "../../../services/fondo-movement-types";
import { SchedulesService } from "../../../services/schedules";
import {
  resolveManagerFromControlHorario,
  getControlHorarioShiftTiming,
  getCostaRicaDateKeyAndMinute,
  type ShiftCode,
} from "@/utils/controlHorarioManager";
import { generateMovementNotificationEmail } from "../../../services/email-templates/notificacion-movimiento";
import { generateEgresoProviderCreatedEmail } from "../../../services/email-templates/proveedor-egreso-creado";
import {
  FacturasService,
  type AppliedCreditNote,
  type FacturaMovement,
} from "../../../services/facturas";
import {
  findLatestMovementByInvoiceNumber,
  sendDuplicateInvoiceAlertEmail,
} from "../../../services/duplicate-invoice-alert";
import { AuditHistoryModal } from "./audit-history-modal";
import {
  MovimientosFondosService,
  MovementAccountKey,
  MovementCurrencyKey,
  MovementStorage,
  MovementStorageState,
} from "../../../services/movimientos-fondos";
import {
  ReportesMovimientosService,
  ReporteMovimientosDetailItem,
  type ReporteMovimientoCurrency,
} from "../../../services/reportes-movimientos";
import {
  DailyClosingsService,
  DailyClosingRecord,
  DailyClosingsDocument,
} from "../../../services/daily-closings";
import { buildDailyClosingEmailTemplate } from "../../../services/email-templates/daily-closing";
import AgregarMovimiento from "./AgregarMovimiento";
import DailyClosingModal, { DailyClosingFormValues } from "./DailyClosingModal";
import FacturaPaymentModal from "./FacturaPaymentModal";
import { useActorOwnership } from "../../../hooks/useActorOwnership";

const stripUndefinedDeep = <T,>(value: T): T => {
  if (value === undefined) return value;

  if (Array.isArray(value)) {
    return value
      .map((item) => stripUndefinedDeep(item))
      .filter((item) => item !== undefined) as T;
  }

  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, val]) => {
      const cleaned = stripUndefinedDeep(val);
      if (cleaned !== undefined) output[key] = cleaned;
    });
    return output as T;
  }

  return value;
};
import { db } from "@/config/firebase";
import { findBestStringMatch } from "../../../utils/stringSimilarity";
import {
  dateKeyToISODate,
  dateToKey,
  isoDateToDateKey,
} from "../../../utils/dateKey";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type WriteBatch,
  type QueryDocumentSnapshot,
  type DocumentData,
  waitForPendingWrites,
} from "firebase/firestore";

// Límite máximo de ediciones permitidas por movimiento
const MAX_AUDIT_EDITS = 5;

// Estos se inicializarán dinámicamente desde la base de datos
export let FONDO_INGRESO_TYPES: readonly string[] = [];
export let FONDO_GASTO_TYPES: readonly string[] = [];
export let FONDO_EGRESO_TYPES: readonly string[] = [];
export let FONDO_TYPE_OPTIONS: readonly string[] = [];

export type FondoMovementType = string;

const AUTO_ADJUSTMENT_PROVIDER_CODE = "CIERRE DE FONDO GENERAL";
const AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY = "AJUSTE FONDO GENERAL"; // Para compatibilidad con datos antiguos
const AUTO_ADJUSTMENT_MANAGER = "SISTEMA";
const AUTO_ADJUSTMENT_CLOSING_TYPE = "AJUSTE CIERRE";

const CIERRE_FONDO_VENTAS_PROVIDER_NAME = "CIERRE FONDO VENTAS";
const INGRESO_DESDE_FONDO_VENTAS_NAME = "INGRESO DESDE FONDO VENTAS";

const normalizeMovementLabel = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

type LastCreatedCooldownPayload = {
  at: number;
  kind?: "INGRESO_DESDE_FONDO_VENTAS";
  prevAt?: number;
};

const parseLastCreatedCooldown = (
  raw: string | null,
): LastCreatedCooldownPayload | null => {
  if (!raw) return null;

  // Legacy: milliseconds as a plain string
  const legacy = Number(raw);
  if (Number.isFinite(legacy) && legacy > 0) return { at: legacy };

  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== "object") return null;
    const at = Number(parsed.at);
    if (!Number.isFinite(at) || at <= 0) return null;
    const payload: LastCreatedCooldownPayload = { at };
    if (parsed.kind === "INGRESO_DESDE_FONDO_VENTAS") {
      payload.kind = "INGRESO_DESDE_FONDO_VENTAS";
    }
    const prevAt = Number(parsed.prevAt);
    if (Number.isFinite(prevAt) && prevAt > 0) payload.prevAt = prevAt;
    return payload;
  } catch {
    return null;
  }
};

const getEffectiveLastCreatedAtMs = (
  payload: LastCreatedCooldownPayload | null,
): number => {
  if (!payload) return 0;
  if (payload.kind === "INGRESO_DESDE_FONDO_VENTAS") return payload.prevAt ?? 0;
  return payload.at;
};

type ClosingGuardKind = "FONDO_GENERAL" | "FONDO_VENTAS";

// Helper para verificar si un proveedor es un cierre/ajuste automático
const isAutoAdjustmentProvider = (code: unknown): boolean =>
  typeof code === "string" &&
  (code === AUTO_ADJUSTMENT_PROVIDER_CODE ||
    code === AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY);

const isIngresoDesdeFondoVentasMovement = (
  movement: Partial<FondoEntry>,
  providerDisplayName?: string,
) => {
  const providerCode = normalizeMovementLabel(movement.providerCode);
  const providerName = normalizeMovementLabel(providerDisplayName);
  const type = normalizeMovementLabel(movement.paymentType);
  const notes = normalizeMovementLabel(movement.notes);
  const target = normalizeMovementLabel(INGRESO_DESDE_FONDO_VENTAS_NAME);

  return (
    providerCode === target ||
    providerName === target ||
    type === target ||
    notes.includes(target)
  );
};

const getMovementTypeKey = (value: unknown): string =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

const includesMovementType = (
  types: readonly string[],
  value: unknown,
): boolean => {
  const target = getMovementTypeKey(value);
  if (!target) return false;
  return types.some((type) => getMovementTypeKey(type) === target);
};

const getCanonicalFondoMovementType = (
  value: unknown,
): FondoMovementType | null => {
  const target = getMovementTypeKey(value);
  if (!target) return null;
  const match = FONDO_TYPE_OPTIONS.find(
    (type) => getMovementTypeKey(type) === target,
  );
  return (match ?? null) as FondoMovementType | null;
};

export const isFondoMovementType = (
  value: string,
): value is FondoMovementType => getCanonicalFondoMovementType(value) !== null;

export const isIngresoType = (type: FondoMovementType) =>
  includesMovementType(FONDO_INGRESO_TYPES, type);
export const isGastoType = (type: FondoMovementType) =>
  includesMovementType(FONDO_GASTO_TYPES, type);
export const isEgresoType = (type: FondoMovementType) =>
  includesMovementType(FONDO_EGRESO_TYPES, type);

// Formatea en Titulo Caso cada palabra
export const formatMovementType = (
  type: FondoMovementType | string | null | undefined,
) => {
  if (typeof type !== "string") return "";
  if (type === "INFORMATIVO") return "";

  return type
    .toLowerCase()
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
};

const isGeneralClosingProviderName = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const upper = value.trim().toUpperCase();
  return (
    upper === AUTO_ADJUSTMENT_PROVIDER_CODE ||
    upper === AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY
  );
};

const hasGeneralClosingAdjustmentNotes = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const upper = value.toUpperCase();
  return upper.includes("AJUSTE APLICADO AL SALDO ACTUAL");
};

const hasGeneralClosingNoDiffNotes = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const upper = value.toUpperCase();
  return upper.includes("SIN DIFERENCIAS");
};

const isInventoryPurchasePaymentType = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toUpperCase();
  return (
    normalized === "COMPRA INVENTARIO" || normalized === "COMPRA DE INVENTARIO"
  );
};

const isInventoryPurchaseProviderType = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return isInventoryPurchasePaymentType(value);
};

const getCanonicalClosingPaymentType = (
  movement: Partial<FondoEntry>,
): FondoMovementType => {
  const providerCode = String(movement.providerCode || "").trim();
  const notes = movement.notes;
  const isGeneralClosingAdjustment =
    isAutoAdjustmentProvider(providerCode) ||
    isGeneralClosingProviderName(providerCode) ||
    hasGeneralClosingAdjustmentNotes(notes);

  if (!isGeneralClosingAdjustment) {
    return normalizeStoredType(movement.paymentType);
  }

  return hasGeneralClosingNoDiffNotes(notes)
    ? ("INFORMATIVO" as FondoMovementType)
    : (AUTO_ADJUSTMENT_CLOSING_TYPE as FondoMovementType);
};

// Normaliza valores historicos guardados en localStorage a las nuevas categorias
const normalizeStoredType = (value: unknown): FondoMovementType => {
  if (typeof value === "string") {
    const upper = value.toUpperCase().trim();
    const canonicalType = getCanonicalFondoMovementType(value);
    if (canonicalType) return canonicalType;
    // Compatibilidad con valores antiguos
    if (upper === "INGRESO") return "VENTAS";
    if (upper === "EGRESO") return "COMPRA INVENTARIO";
    if (upper === "COMPRA") return "COMPRA INVENTARIO";
    if (upper === "MANTENIMIENTO") return "MANTENIMIENTO INSTALACIONES";
    if (upper === "REPARACION EQUIPO") return "MANTENIMIENTO INSTALACIONES";
    if (upper === "SALARIO" || upper === "SALARIOS") return "SALARIOS";
    if (upper === "GASTO") return "GASTOS VARIOS";
  }
  return "COMPRA INVENTARIO";
};

export type FondoEntry = {
  id: string;
  providerCode: string;
  invoiceNumber: string;
  // Tipo de factura: contado (FCO) o crédito (FCR)
  invoiceDocType?: "FCO" | "FCR";
  paymentType: FondoMovementType;
  amount?: number;
  originalAmount?: number;
  amountDue?: number;
  balanceDue?: number;
  amountEgreso: number;
  amountIngreso: number;
  amountPayment?: number;
  appliedCreditNotes?: AppliedCreditNote[];
  manager: string;
  manager2?: string;
  notes: string;
  createdAt: string;
  updateAt?: string;
  invoiceCreatedAt?: string;
  // OLAP optimization: company name embedded in movement doc
  empresa?: string;
  accountId?: MovementAccountKey;
  currency?: "CRC" | "USD";
  breakdown?: Record<number, number>;
  // Para cierres: saldos al momento del cierre (persistidos en el movimiento)
  closingBalanceCRC?: number;
  closingBalanceUSD?: number;
  // audit fields: when an edit is recorded, we create an audit movement
  isAudit?: boolean;
  originalEntryId?: string;
  auditDetails?: string;
};

type PendingCreditNoteOption = {
  id: string;
  invoiceNumber: string;
  amount: number;
  balanceDue: number;
  paidAmount: number;
  currency: "CRC" | "USD";
};

const movementSkeletonRows = Array.from({ length: 8 }, (_, index) => index);

function FondoMovementsSkeleton({
  compact = false,
}: {
  compact?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/80 text-white shadow-sm">
      {!compact && (
        <div className="flex flex-col gap-3 border-b border-[var(--input-border)] bg-[var(--muted)]/10 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 animate-pulse rounded bg-cyan-100/10" />
            <div className="h-9 w-28 animate-pulse rounded bg-cyan-100/10" />
          </div>
          <div className="flex items-center gap-2">
            <div className="h-9 w-36 animate-pulse rounded bg-cyan-100/10" />
            <div className="h-9 w-24 animate-pulse rounded bg-cyan-100/10" />
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs sm:text-sm">
          <thead className="bg-cyan-950/35 text-xs uppercase tracking-wide text-cyan-50/80">
            <tr>
              {["Hora", "Motivo", "Tipo", "N° factura", "Monto", "Encargado", ""].map(
                (label) => (
                  <th
                    key={label || "acciones"}
                    className="px-3 py-2 text-left font-semibold"
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            <tr className="bg-cyan-500/5">
              <td colSpan={7} className="px-3 py-2">
                <div className="h-4 w-40 animate-pulse rounded bg-cyan-100/10" />
              </td>
            </tr>
            {movementSkeletonRows.map((row) => (
              <tr
                key={row}
                className="[&>td]:border-b [&>td]:border-cyan-900/35"
              >
                <td className="px-3 py-3">
                  <div className="h-4 w-28 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="space-y-2">
                    <div className="h-4 w-36 animate-pulse rounded bg-cyan-100/10" />
                    <div className="h-3 w-48 animate-pulse rounded bg-cyan-100/5" />
                  </div>
                </td>
                <td className="px-3 py-3">
                  <div className="h-6 w-28 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-4 w-16 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="ml-auto h-6 w-24 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="h-4 w-32 animate-pulse rounded bg-cyan-100/10" />
                </td>
                <td className="px-3 py-3">
                  <div className="ml-auto h-8 w-20 animate-pulse rounded bg-cyan-100/10" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const normalizeInvoiceDocType = (value: unknown): "FCO" | "FCR" | "NC" => {
  if (value === "FCR") return "FCR";
  if (value === "NC") return "NC";
  return "FCO";
};

const resolveEffectiveEgresoAmount = (
  entry: Partial<FondoEntry> | null | undefined,
): number => {
  if (!entry) return 0;
  const egreso = Math.max(0, Math.trunc(Number(entry.amountEgreso) || 0));
  const hasPayment = (entry as any).amountPayment !== undefined;
  const payment = Math.max(
    0,
    Math.trunc(Number((entry as any).amountPayment) || 0),
  );
  return egreso > 0 && hasPayment ? payment : egreso;
};

const isPaidFcrMovement = (entry: Partial<FondoEntry>): boolean => {
  if (normalizeInvoiceDocType(entry.invoiceDocType) !== "FCR") return false;
  const hasManager2 =
    typeof entry.manager2 === "string" && entry.manager2.trim().length > 0;
  const hasUpdateAt =
    typeof entry.updateAt === "string" && entry.updateAt.trim().length > 0;
  return hasManager2 || hasUpdateAt;
};

const shouldDeleteFacturasMirror = (entry: Partial<FondoEntry>): boolean => {
  const id = String(entry.id || "").trim();
  if (!id) return false;
  return Boolean(entry.invoiceNumber || entry.providerCode);
};

const getPrimaryMovementDateISO = (entry: Partial<FondoEntry>): string => {
  if (isPaidFcrMovement(entry)) {
    const fromUpdate = String(entry.updateAt || "").trim();
    if (fromUpdate) return fromUpdate;
  }
  return String(entry.createdAt || "").trim();
};

const getPrimaryMovementTime = (entry: Partial<FondoEntry>): number => {
  const timestamp = Date.parse(getPrimaryMovementDateISO(entry));
  if (!Number.isNaN(timestamp)) return timestamp;

  const createdTimestamp = Date.parse(String(entry.createdAt || ""));
  return Number.isNaN(createdTimestamp) ? 0 : createdTimestamp;
};

const getPrimaryMovementManager = (entry: Partial<FondoEntry>): string => {
  if (isPaidFcrMovement(entry)) {
    const fromManager2 = String(entry.manager2 || "").trim();
    if (fromManager2) return fromManager2;
  }
  return String(entry.manager || "").trim();
};

const getFcrPaymentInvoiceId = (entry: Partial<FondoEntry>): string | null => {
  const paymentId = String(entry.id || "").trim();
  const prefix = "fcr-pago-";
  if (!paymentId.startsWith(prefix)) return null;

  const rest = paymentId.slice(prefix.length);
  const invoiceIdMatch = rest.match(/^(FAC-\d+-[A-Z0-9]+)-/);
  return invoiceIdMatch ? invoiceIdMatch[1] : null;
};

const getFcrPaymentAmount = (entry: Partial<FondoEntry>): number =>
  Math.max(
    0,
    Math.trunc(
      Number(
        (entry as any).amountEgreso ??
          (entry as any).amountPayment ??
          (entry as any).amount ??
          0,
      ) || 0,
    ),
  );

const roundCreditNotePaymentAmount = (
  amount: number,
  currency: MovementCurrencyKey,
  accountKey?: string,
): number => {
  const normalized = Math.max(0, Math.trunc(Number(amount) || 0));
  if (currency !== "CRC") return normalized;
  if (accountKey && accountKey !== "FondoGeneral") return normalized;
  return Math.floor(normalized / 1000) * 1000;
};

/**
 * Simplifica un registro de auditoría guardando solo los campos que cambiaron.
 * @param before Estado anterior del movimiento
 * @param after Estado nuevo del movimiento
 * @returns Objeto con solo los campos modificados
 */
const getChangedFields = (
  before: any,
  after: any,
): { before: Record<string, any>; after: Record<string, any> } => {
  const changed: { before: Record<string, any>; after: Record<string, any> } = {
    before: {},
    after: {},
  };

  // Campos relevantes a comparar
  const fieldsToCheck = [
    "providerCode",
    "invoiceNumber",
    "invoiceDocType",
    "paymentType",
    "amountEgreso",
    "amountIngreso",
    "amountPayment",
    "appliedCreditNotes",
    "manager",
    "manager2",
    "notes",
    "currency",
  ];

  fieldsToCheck.forEach((field) => {
    const beforeVal = before[field];
    const afterVal = after[field];

    // Solo guardar si el campo realmente cambió
    if (beforeVal !== afterVal) {
      changed.before[field] = beforeVal;
      changed.after[field] = afterVal;
    }
  });

  return changed;
};

/**
 * Comprime el historial de auditoría para evitar que auditDetails crezca demasiado.
 * Mantiene máximo 5 registros: el primero (creación), el último (más reciente) y 3 intermedios espaciados.
 * @param history Array completo del historial de auditoría
 * @returns Array comprimido del historial
 */
const compressAuditHistory = (history: any[]): any[] => {
  if (!Array.isArray(history) || history.length <= 5) {
    return history;
  }

  const compressed: any[] = [];
  const first = history[0];
  const last = history[history.length - 1];

  // Siempre mantener el primero
  compressed.push(first);

  // Si hay más de 5 registros, seleccionar 3 intermedios espaciados uniformemente
  if (history.length > 5) {
    const middleCount = 3;
    const step = Math.floor((history.length - 2) / (middleCount + 1));

    for (let i = 1; i <= middleCount; i++) {
      const index = step * i;
      if (index < history.length - 1 && index > 0) {
        compressed.push(history[index]);
      }
    }
  } else {
    // Si hay entre 2 y 5, mantener todos los intermedios
    for (let i = 1; i < history.length - 1; i++) {
      compressed.push(history[i]);
    }
  }

  // Siempre mantener el último
  if (history.length > 1) {
    compressed.push(last);
  }

  return compressed;
};

const FONDO_KEY_SUFFIX = "_fondos_v1";
const buildStorageKey = (namespace: string, suffix: string) =>
  `${namespace}${suffix}`;

const DAILY_CLOSINGS_STORAGE_PREFIX = "fg_daily_closings";

const buildDailyClosingStorageKey = (
  company: string,
  account: MovementAccountKey,
) => {
  const normalizedCompany = company.trim().toLowerCase();
  return `${DAILY_CLOSINGS_STORAGE_PREFIX}_${
    normalizedCompany || "default"
  }_${account}`;
};

const sanitizeMoneyNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.trunc(parsed);
};

const formatToastWaitTime = (remainingSec: number): string => {
  const sec = Math.max(1, Math.ceil(Number(remainingSec) || 0));
  // Requirement: if time is more than 60 seconds, format using minutes.
  if (sec <= 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (seconds === 0) return `${minutes}min`;
  return `${minutes}min ${seconds}s`;
};

const sanitizeBreakdown = (input: unknown): Record<number, number> => {
  if (!input || typeof input !== "object") return {};
  return Object.entries(input as Record<string, unknown>).reduce<
    Record<number, number>
  >((acc, [key, rawValue]) => {
    const denom = Number(key);
    if (!Number.isFinite(denom)) return acc;
    const count = sanitizeMoneyNumber(rawValue);
    if (count > 0) acc[Math.trunc(denom)] = count;
    return acc;
  }, {});
};

type AdjustmentResolutionRemoval = NonNullable<
  NonNullable<DailyClosingRecord["adjustmentResolution"]>["removedAdjustments"]
>[number];

const sanitizeAdjustmentResolution = (
  input: unknown,
): DailyClosingRecord["adjustmentResolution"] | undefined => {
  if (!input || typeof input !== "object") return undefined;
  const candidate = input as Record<string, unknown>;
  const resolution: DailyClosingRecord["adjustmentResolution"] = {};

  if (Array.isArray(candidate.removedAdjustments)) {
    const removed = (candidate.removedAdjustments as unknown[])
      .map((item): AdjustmentResolutionRemoval | undefined => {
        if (!item || typeof item !== "object") return undefined;
        const raw = item as Record<string, unknown>;
        const cleaned: Partial<AdjustmentResolutionRemoval> = {};
        if (typeof raw.id === "string" && raw.id.trim().length > 0)
          cleaned.id = raw.id.trim();
        if (raw.currency === "USD") cleaned.currency = "USD";
        else if (raw.currency === "CRC") cleaned.currency = "CRC";
        if (raw.amount !== undefined)
          cleaned.amount = sanitizeMoneyNumber(raw.amount);
        if (raw.amountIngreso !== undefined)
          cleaned.amountIngreso = sanitizeMoneyNumber(raw.amountIngreso);
        if (raw.amountEgreso !== undefined)
          cleaned.amountEgreso = sanitizeMoneyNumber(raw.amountEgreso);
        if (typeof raw.manager === "string" && raw.manager.trim().length > 0)
          cleaned.manager = raw.manager.trim();
        if (
          typeof raw.createdAt === "string" &&
          raw.createdAt.trim().length > 0
        )
          cleaned.createdAt = raw.createdAt.trim();
        return Object.keys(cleaned).length > 0
          ? (cleaned as AdjustmentResolutionRemoval)
          : undefined;
      })
      .filter((item): item is AdjustmentResolutionRemoval => Boolean(item));
    if (removed.length > 0) {
      resolution.removedAdjustments = removed;
    }
  }

  if (typeof candidate.note === "string") {
    const trimmed = candidate.note.trim();
    if (trimmed.length > 0) {
      resolution.note = trimmed;
    }
  }

  if (candidate.postAdjustmentBalanceCRC !== undefined) {
    resolution.postAdjustmentBalanceCRC = sanitizeMoneyNumber(
      candidate.postAdjustmentBalanceCRC,
    );
  }

  if (candidate.postAdjustmentBalanceUSD !== undefined) {
    resolution.postAdjustmentBalanceUSD = sanitizeMoneyNumber(
      candidate.postAdjustmentBalanceUSD,
    );
  }

  return Object.keys(resolution).length > 0 ? resolution : undefined;
};

const sanitizeDailyClosings = (raw: unknown): DailyClosingRecord[] => {
  if (!Array.isArray(raw)) return [];
  const sanitized = raw.reduce<DailyClosingRecord[]>((acc, candidate) => {
    if (!candidate || typeof candidate !== "object") return acc;
    const record = candidate as Partial<DailyClosingRecord>;
    const id =
      typeof record.id === "string" && record.id.trim().length > 0
        ? record.id
        : `${Date.now()}_${acc.length}`;
    const manager = typeof record.manager === "string" ? record.manager : "";
    const closingDate =
      typeof record.closingDate === "string"
        ? record.closingDate
        : new Date().toISOString();
    const createdAt =
      typeof record.createdAt === "string" ? record.createdAt : closingDate;
    const adjustmentResolution = sanitizeAdjustmentResolution(
      record.adjustmentResolution,
    );
    acc.push({
      id,
      createdAt,
      closingDate,
      manager,
      totalCRC: sanitizeMoneyNumber(record.totalCRC),
      totalUSD: sanitizeMoneyNumber(record.totalUSD),
      recordedBalanceCRC: sanitizeMoneyNumber(record.recordedBalanceCRC),
      recordedBalanceUSD: sanitizeMoneyNumber(record.recordedBalanceUSD),
      diffCRC: sanitizeMoneyNumber(record.diffCRC),
      diffUSD: sanitizeMoneyNumber(record.diffUSD),
      notes: typeof record.notes === "string" ? record.notes : "",
      breakdownCRC: sanitizeBreakdown(record.breakdownCRC),
      breakdownUSD: sanitizeBreakdown(record.breakdownUSD),
      ...(adjustmentResolution ? { adjustmentResolution } : {}),
    });
    return acc;
  }, []);
  return sanitized.slice(0, DailyClosingsService.MAX_RECORDS);
};

const dailyClosingSortValue = (record: DailyClosingRecord): number => {
  const createdAtTimestamp = Date.parse(record.createdAt);
  if (!Number.isNaN(createdAtTimestamp)) return createdAtTimestamp;
  const closingAtTimestamp = Date.parse(record.closingDate);
  if (!Number.isNaN(closingAtTimestamp)) return closingAtTimestamp;
  return 0;
};

const mergeDailyClosingRecords = (
  existing: DailyClosingRecord[],
  incoming: DailyClosingRecord[],
): DailyClosingRecord[] => {
  if (
    incoming.length === 0 &&
    existing.length <= DailyClosingsService.MAX_RECORDS
  ) {
    return existing;
  }
  const map = new Map<string, DailyClosingRecord>();
  existing.forEach((record) => map.set(record.id, record));
  incoming.forEach((record) => map.set(record.id, record));
  const sorted = Array.from(map.values()).sort(
    (a, b) => dailyClosingSortValue(b) - dailyClosingSortValue(a),
  );
  return sorted.slice(0, DailyClosingsService.MAX_RECORDS);
};

const flattenDailyClosingsDocument = (
  document: DailyClosingsDocument,
): { records: DailyClosingRecord[]; loadedKeys: Set<string> } => {
  const loadedKeys = new Set<string>();
  const aggregated: DailyClosingRecord[] = [];
  Object.entries(document.closingsByDate).forEach(([dateKey, list]) => {
    if (!Array.isArray(list) || list.length === 0) return;
    loadedKeys.add(dateKey);
    list.forEach((record) => {
      aggregated.push(record);
    });
  });
  aggregated.sort(
    (a, b) => dailyClosingSortValue(b) - dailyClosingSortValue(a),
  );
  return {
    records: aggregated.slice(0, DailyClosingsService.MAX_RECORDS),
    loadedKeys,
  };
};

const NAMESPACE_PERMISSIONS: Record<string, keyof UserPermissions> = {
  fg: "fondogeneral",
  bcr: "fondogeneralBCR",
  bn: "fondogeneralBN",
  bac: "fondogeneralBAC",
  cn: "cajaNegra",
};

const NAMESPACE_DESCRIPTIONS: Record<string, string> = {
  fg: "el Fondo General",
  bcr: "la cuenta BCR",
  bn: "la cuenta BN",
  bac: "la cuenta BAC",
  cn: "la Caja Negra",
};

const ACCOUNT_KEY_BY_NAMESPACE: Record<string, MovementAccountKey> = {
  fg: "FondoGeneral",
  bcr: "BCR",
  bn: "BN",
  bac: "BAC",
  cn: "CajaNegra",
};

const MOVEMENT_ACCOUNT_KEYS: MovementAccountKey[] = [
  "FondoGeneral",
  "BCR",
  "BN",
  "BAC",
  "CajaNegra",
];

const isMovementAccountKey = (value: unknown): value is MovementAccountKey =>
  typeof value === "string" &&
  MOVEMENT_ACCOUNT_KEYS.includes(value as MovementAccountKey);

const getAccountKeyFromNamespace = (namespace: string): MovementAccountKey =>
  ACCOUNT_KEY_BY_NAMESPACE[namespace] || "FondoGeneral";

const coerceIdentifier = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return undefined;
};

const coerceInvoice = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value))
    return String(Math.trunc(value));
  return "";
};

const coerceNotes = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
};

const coerceTruncNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : undefined;
  }
  return undefined;
};

const resolveCreatedAt = (value: unknown): string | undefined => {
  if (!value) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
  }
  if (typeof value === "object") {
    const maybeTimestamp = value as { toDate?: () => Date };
    if (typeof maybeTimestamp?.toDate === "function") {
      try {
        const date = maybeTimestamp.toDate();
        return date instanceof Date && !Number.isNaN(date.getTime())
          ? date.toISOString()
          : undefined;
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
};

const dateKeyFromDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const sanitizeFondoEntries = (
  rawEntries: unknown,
  forcedCurrency?: MovementCurrencyKey,
  forcedAccount?: MovementAccountKey,
): FondoEntry[] => {
  if (!Array.isArray(rawEntries)) return [];

  return rawEntries.reduce<FondoEntry[]>((acc, raw) => {
    const entry = raw as Partial<FondoEntry>;

    const id = coerceIdentifier(entry.id);
    const providerCode = coerceIdentifier(entry.providerCode);
    const invoiceNumber = coerceInvoice(entry.invoiceNumber);
    const notes = coerceNotes(entry.notes);
    const isGeneralClosingAdjustment =
      isAutoAdjustmentProvider(providerCode) ||
      isGeneralClosingProviderName(providerCode) ||
      hasGeneralClosingAdjustmentNotes(notes);

    let paymentType = normalizeStoredType(entry.paymentType);
    if (isGeneralClosingAdjustment) {
      paymentType = getCanonicalClosingPaymentType({
        providerCode,
        notes,
        paymentType: entry.paymentType,
      });
    }
    const manager = coerceIdentifier(entry.manager);
    const createdAt = resolveCreatedAt(entry.createdAt);
    const invoiceCreatedAt = resolveCreatedAt((entry as any).invoiceCreatedAt);
    const manager2 = coerceIdentifier((entry as any).manager2);
    const updateAt = resolveCreatedAt((entry as any).updateAt);

    const closingBalanceCRC = coerceTruncNumber(
      (entry as any).closingBalanceCRC,
    );
    const closingBalanceUSD = coerceTruncNumber(
      (entry as any).closingBalanceUSD,
    );

    if (!id || !providerCode || !manager || !createdAt) return acc;

    const rawEgreso =
      typeof entry.amountEgreso === "number"
        ? entry.amountEgreso
        : Number(entry.amountEgreso) || 0;
    const rawIngreso =
      typeof entry.amountIngreso === "number"
        ? entry.amountIngreso
        : Number(entry.amountIngreso) || 0;

    const amountEgreso = Math.trunc(rawEgreso);
    const amountIngreso = Math.trunc(rawIngreso);

    const amount = coerceTruncNumber(entry.amount);
    const originalAmount = coerceTruncNumber((entry as any).originalAmount);
    const amountDue = coerceTruncNumber((entry as any).amountDue);
    const balanceDue = coerceTruncNumber((entry as any).balanceDue);
    const rawAmountPayment = (entry as any).amountPayment;
    const amountPayment =
      rawAmountPayment !== undefined
        ? Math.max(0, Math.trunc(Number(rawAmountPayment) || 0))
        : undefined;
    const appliedCreditNotes = Array.isArray((entry as any).appliedCreditNotes)
      ? ((entry as any).appliedCreditNotes as any[])
          .map((note) => {
            const id = String(note?.id || "").trim();
            const appliedAmount = Math.max(
              0,
              Math.trunc(Number(note?.appliedAmount) || 0),
            );
            if (!id || appliedAmount <= 0) return null;
            return {
              id,
              invoiceNumber: String(note?.invoiceNumber || "").trim(),
              amount: Math.max(0, Math.trunc(Number(note?.amount) || 0)),
              appliedAmount,
              currency: note?.currency === "USD" ? "USD" : "CRC",
            } as AppliedCreditNote;
          })
          .filter((note): note is AppliedCreditNote => Boolean(note))
      : undefined;

    const currency: MovementCurrencyKey =
      forcedCurrency ?? (entry.currency === "USD" ? "USD" : "CRC");
    const accountId =
      forcedAccount ??
      (isMovementAccountKey(entry.accountId) ? entry.accountId : undefined);

    // Si los tipos aún no están cargados (arrays vacíos), preservar los montos originales
    const typesLoaded =
      FONDO_INGRESO_TYPES.length > 0 ||
      FONDO_GASTO_TYPES.length > 0 ||
      FONDO_EGRESO_TYPES.length > 0;
    const isKnownType =
      isIngresoType(paymentType) ||
      isGastoType(paymentType) ||
      isEgresoType(paymentType);

    acc.push({
      id,
      providerCode,
      invoiceNumber,
      invoiceDocType: normalizeInvoiceDocType((entry as any).invoiceDocType) as "FCO" | "FCR",
      paymentType,
      currency,
      accountId,
      empresa:
        typeof (entry as any).empresa === "string"
          ? (entry as any).empresa
          : undefined,
      amount,
      originalAmount,
      amountDue,
      balanceDue,
      // Preserve original amounts when types are unknown to avoid zeroing valid movements.
      amountEgreso: typesLoaded
        ? isKnownType
          ? isEgresoType(paymentType) || isGastoType(paymentType)
            ? amountEgreso
            : 0
          : amountEgreso
        : amountEgreso,
      amountIngreso: typesLoaded
        ? isKnownType
          ? isIngresoType(paymentType)
            ? amountIngreso
            : 0
          : amountIngreso
        : amountIngreso,
      amountPayment,
      appliedCreditNotes:
        appliedCreditNotes && appliedCreditNotes.length > 0
          ? appliedCreditNotes
          : undefined,
      manager,
      manager2,
      notes,
      createdAt,
      updateAt,
      invoiceCreatedAt,
      closingBalanceCRC,
      closingBalanceUSD,
      isAudit: !!entry.isAudit,
      originalEntryId:
        typeof entry.originalEntryId === "string"
          ? entry.originalEntryId
          : undefined,
      auditDetails:
        typeof entry.auditDetails === "string" ? entry.auditDetails : undefined,
    });

    return acc;
  }, []);
};

const AccessRestrictedMessage = ({ description }: { description: string }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">
      Acceso restringido
    </h3>
    <p className="text-[var(--muted-foreground)]">{description}</p>
    <p className="text-sm text-[var(--muted-foreground)] mt-2">
      Contacta a un administrador para obtener acceso.
    </p>
  </div>
);

// Clave compartida para sincronizar la selección de empresa entre ProviderSection y FondoSection
const SHARED_COMPANY_STORAGE_KEY = "fg_selected_company_shared";

export function ProviderSection({ id }: { id?: string }) {
  const { user, loading: authLoading } = useAuth();
  const assignedCompany = user?.ownercompanie?.trim() ?? "";
  const { ownerIds: actorOwnerIds } = useActorOwnership(user);
  const allowedOwnerIds = useMemo(() => {
    const set = new Set<string>();
    actorOwnerIds.forEach((id) => {
      const normalized =
        typeof id === "string" ? id.trim() : String(id || "").trim();
      if (normalized) set.add(normalized);
    });
    if (user?.ownerId) {
      const normalized = String(user.ownerId).trim();
      if (normalized) set.add(normalized);
    }
    return set;
  }, [actorOwnerIds, user?.ownerId]);
  const allowedOwnerIdsKey = useMemo(
    () => Array.from(allowedOwnerIds).sort().join("|"),
    [allowedOwnerIds],
  );
  const isAdminUser = user?.role === "admin";
  const isSuperAdminUser = user?.role === "superadmin";
  const canSelectCompany = isAdminUser || isSuperAdminUser;
  const [resolvedCompany, setResolvedCompany] = useState(() => assignedCompany);
  const [adminCompany, setAdminCompany] = useState(() => {
    if (typeof window === "undefined") return assignedCompany;
    try {
      const stored = localStorage.getItem(SHARED_COMPANY_STORAGE_KEY);
      return stored || assignedCompany;
    } catch {
      return assignedCompany;
    }
  });
  const company = canSelectCompany
    ? adminCompany
    : resolvedCompany || assignedCompany;
  const {
    providers,
    loading: providersLoading,
    error,
    addProvider,
    removeProvider,
    updateProvider,
  } = useProviders(company);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const canManageFondoGeneral = Boolean(permissions.fondogeneral);
  const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
  const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
  const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(
    null,
  );
  const providerTypesOwnerId = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const firstAllowedOwner = Array.from(allowedOwnerIds)[0] || "";
    if (firstAllowedOwner) return String(firstAllowedOwner).trim();

    if (canSelectCompany) {
      const normalizedCompany = normalizeCompanyKey(adminCompany);
      if (normalizedCompany.length > 0) {
        const match = ownerCompanies.find((emp) => {
          const candidates = [emp.name, emp.ubicacion, emp.id]
            .map(normalizeCompanyKey)
            .filter(Boolean);
          return candidates.includes(normalizedCompany);
        });
        const ownerId =
          typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
        if (ownerId) return ownerId;
      }

      const fallbackOwnerId =
        ownerCompanies
          .find(
            (emp) =>
              typeof emp.ownerId === "string" && emp.ownerId.trim().length > 0,
          )
          ?.ownerId?.trim() || "";
      if (fallbackOwnerId) return fallbackOwnerId;
    }

    const directOwnerId =
      typeof user?.ownerId === "string" ? user.ownerId.trim() : "";
    if (directOwnerId) return directOwnerId;

    return typeof user?.id === "string" ? user.id.trim() : "";
  }, [
    adminCompany,
    allowedOwnerIds,
    canSelectCompany,
    ownerCompanies,
    user?.id,
    user?.ownerId,
  ]);
  const activeOwnerId = providerTypesOwnerId;

  const sortedOwnerCompanies = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    // Dedupe by the same value key used in the <option value>
    const valueKey = (emp: Empresas) =>
      normalize(emp?.name || emp?.ubicacion || emp?.id || "");

    const score = (emp: Empresas) =>
      (normalize(emp?.id) ? 2 : 0) +
      (normalize(emp?.name) ? 1 : 0) +
      (normalize(emp?.ubicacion) ? 1 : 0);

    const byKey = new Map<string, Empresas>();
    ownerCompanies.forEach((emp) => {
      const key = valueKey(emp);
      if (!key) return;
      const existing = byKey.get(key);
      if (!existing || score(emp) > score(existing)) {
        byKey.set(key, emp);
      }
    });

    const deduped = Array.from(byKey.values());

    // If there is a named company for an ubicacion, hide the ubicacion-only entry.
    const ubicacionesWithNamed = new Set<string>();
    deduped.forEach((emp) => {
      const name = normalize(emp?.name);
      const ubicacion = normalize(emp?.ubicacion);
      if (name && ubicacion) ubicacionesWithNamed.add(ubicacion);
    });

    const cleaned = deduped.filter((emp) => {
      const name = normalize(emp?.name);
      const ubicacion = normalize(emp?.ubicacion);
      if (!name && ubicacion && ubicacionesWithNamed.has(ubicacion))
        return false;
      return true;
    });

    return cleaned.sort((a, b) =>
      (a.name || a.ubicacion || "").localeCompare(
        b.name || b.ubicacion || "",
        "es",
        {
          sensitivity: "base",
        },
      ),
    );
  }, [ownerCompanies]);

  useEffect(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const getEmpresaCompanyKey = (emp: Empresas) =>
      String(emp?.name || emp?.ubicacion || emp?.id || "").trim();
    const normalizedAssignedCompany = normalizeCompanyKey(assignedCompany);

    if (authLoading || !user) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (!canSelectCompany && !normalizedAssignedCompany) {
      setOwnerCompanies([]);
      setResolvedCompany("");
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (isAdminUser && allowedOwnerIds.size === 0) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(
        "No se pudo determinar el ownerId asociado a tu cuenta.",
      );
      return;
    }

    let isMounted = true;
    setOwnerCompaniesLoading(true);
    setOwnerCompaniesError(null);

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isMounted) return;
        const filtered = isAdminUser
          ? empresas.filter((emp) => {
              const owner = (emp.ownerId || "").trim();
              if (!owner) return false;
              return allowedOwnerIds.has(owner);
            })
          : canSelectCompany
            ? empresas
            : empresas.filter((emp) => {
                const candidates = [emp.name, emp.ubicacion, emp.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(normalizedAssignedCompany);
              });
        setOwnerCompanies(filtered);
        if (canSelectCompany) {
          setAdminCompany((current) => {
            const normalizedCurrent = normalizeCompanyKey(current);
            if (normalizedCurrent.length > 0) {
              const exists = filtered.some((emp) => {
                const candidates = [emp.name, emp.ubicacion, emp.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(normalizedCurrent);
              });
              if (exists) return current;
            }
            const fallback = filtered[0];
            return fallback ? getEmpresaCompanyKey(fallback) : "";
          });
        }
        if (!canSelectCompany) {
          const fallback = filtered[0];
          setResolvedCompany(
            fallback ? getEmpresaCompanyKey(fallback) : assignedCompany,
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setOwnerCompanies([]);
        setOwnerCompaniesError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las empresas disponibles.",
        );
      })
      .finally(() => {
        if (isMounted) setOwnerCompaniesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    allowedOwnerIds,
    allowedOwnerIdsKey,
    assignedCompany,
    authLoading,
    canSelectCompany,
    isAdminUser,
    user,
  ]);

  const [providerName, setProviderName] = useState("");
  const [providerType, setProviderType] = useState<FondoMovementType | "">("");
  const [providerAgentName, setProviderAgentName] = useState("");
  const [providerAgentPhone, setProviderAgentPhone] = useState("");
  const [showProviderAgentFields, setShowProviderAgentFields] = useState(false);
  const [editingProviderCode, setEditingProviderCode] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [providerTypeError, setProviderTypeError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [deletingCode, setDeletingCode] = useState<string | null>(null);
  const [providerDrawerOpen, setProviderDrawerOpen] = useState(false);
  const [addNotification, setAddNotification] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string>("");
  const [adminUsers, setAdminUsers] = useState<User[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);

  type ProviderVisitDay = "D" | "L" | "M" | "MI" | "J" | "V" | "S";
  type ProviderVisitFrequency = "SEMANAL" | "QUINCENAL" | "MENSUAL" | "22 DIAS";
  type ProviderAgentConfig = {
    name: string;
    phone: string;
  };
  type ProviderVisitConfig = {
    createOrderDays: ProviderVisitDay[];
    receiveOrderDays: ProviderVisitDay[];
    frequency: ProviderVisitFrequency;
    startDateKey?: number;
  };

  const VISIT_DAY_ORDER = useMemo<ProviderVisitDay[]>(
    () => ["D", "L", "M", "MI", "J", "V", "S"],
    [],
  );
  const VISIT_DAY_TITLES = useMemo<Record<ProviderVisitDay, string>>(
    () => ({
      D: "Domingo",
      L: "Lunes",
      M: "Martes",
      MI: "Miércoles",
      J: "Jueves",
      V: "Viernes",
      S: "Sábado",
    }),
    [],
  );
  const VISIT_FREQUENCY_OPTIONS = useMemo<
    Array<{ value: ProviderVisitFrequency; label: string }>
  >(
    () => [
      { value: "SEMANAL", label: "Semanal" },
      { value: "QUINCENAL", label: "Quincenal" },
      { value: "22 DIAS", label: "22 días" },
      { value: "MENSUAL", label: "Mensual" },
    ],
    [],
  );

  const [addVisit, setAddVisit] = useState(false);
  const [visitCreateDays, setVisitCreateDays] = useState<ProviderVisitDay[]>(
    [],
  );
  const [visitReceiveDays, setVisitReceiveDays] = useState<ProviderVisitDay[]>(
    [],
  );
  const [visitFrequency, setVisitFrequency] = useState<
    ProviderVisitFrequency | ""
  >("");
  const [visitStartDateISO, setVisitStartDateISO] = useState<string>("");

  const formatProviderPhone = useCallback((value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 4) return digits;
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }, []);

  const resetProviderFormState = useCallback(() => {
    setFormError(null);
    setProviderTypeError("");
    setProviderName("");
    setProviderType("");
    setEditingProviderCode(null);
    setAddNotification(false);
    setSelectedAdminId("");
    setProviderAgentName("");
    setProviderAgentPhone("");
    setShowProviderAgentFields(false);
    setAddVisit(false);
    setVisitCreateDays([]);
    setVisitReceiveDays([]);
    setVisitFrequency("");
    setVisitStartDateISO("");
  }, []);

  const getProviderAgent = useCallback((): ProviderAgentConfig | undefined => {
    const name = providerAgentName.trim();
    const phone = formatProviderPhone(providerAgentPhone).trim();
    if (!name && !phone) return undefined;
    return { name, phone };
  }, [formatProviderPhone, providerAgentName, providerAgentPhone]);

  const isCompraInventarioProvider =
    typeof providerType === "string" &&
    providerType.trim().toUpperCase() === "COMPRA INVENTARIO";

  const sortVisitDays = useCallback(
    (days: ProviderVisitDay[]) => {
      return [...days].sort(
        (a, b) => VISIT_DAY_ORDER.indexOf(a) - VISIT_DAY_ORDER.indexOf(b),
      );
    },
    [VISIT_DAY_ORDER],
  );

  const toggleVisitDay = useCallback(
    (
      day: ProviderVisitDay,
      setter: React.Dispatch<React.SetStateAction<ProviderVisitDay[]>>,
    ) => {
      setter((prev) => {
        const exists = prev.includes(day);
        const next = exists ? prev.filter((d) => d !== day) : [...prev, day];
        return sortVisitDays(next);
      });
    },
    [sortVisitDays],
  );

  useEffect(() => {
    if (!isCompraInventarioProvider) {
      setAddVisit(false);
      setVisitCreateDays([]);
      setVisitReceiveDays([]);
      setVisitFrequency("");
      setVisitStartDateISO("");
    }
  }, [isCompraInventarioProvider]);

  useEffect(() => {
    // Si no es semanal, permitir configurar fecha inicial.
    // Para semanal, limpiar la fecha inicial.
    if (!addVisit) return;
    if (!visitFrequency) {
      setVisitStartDateISO("");
      return;
    }
    if (visitFrequency === "SEMANAL") {
      if (visitStartDateISO) setVisitStartDateISO("");
      return;
    }
    // Si se selecciona frecuencia no semanal y aún no hay fecha, sugerir hoy.
    if (!visitStartDateISO) {
      setVisitStartDateISO(dateKeyToISODate(dateToKey(new Date())));
    }
  }, [addVisit, visitFrequency, visitStartDateISO]);

  // Estado para tipos de movimientos dinámicos
  const [fondoTypesLoaded, setFondoTypesLoaded] = useState(false);
  const [ingresoTypes, setIngresoTypes] = useState<string[]>([]);
  const [gastoTypes, setGastoTypes] = useState<string[]>([]);
  const [egresoTypes, setEgresoTypes] = useState<string[]>([]);

  // Helper para determinar la categoría basándose en los tipos del owner
  const getCategoryForType = (
    type?: string,
  ): "Ingreso" | "Gasto" | "Egreso" | undefined => {
    if (!type || typeof type !== "string") return undefined;
    if (includesMovementType(ingresoTypes, type)) return "Ingreso";
    if (includesMovementType(gastoTypes, type)) return "Gasto";
    if (includesMovementType(egresoTypes, type)) return "Egreso";
    return undefined;
  };

  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    code: string;
    name: string;
  }>({
    open: false,
    code: "",
    name: "",
  });

  const pendingProviderSaveRef = useRef<null | {
    mode: "create" | "update";
    code?: string;
    name: string;
    providerType?: FondoMovementType;
    correonotifi?: string;
    agent?: ProviderAgentConfig;
    visit?: ProviderVisitConfig;
  }>(null);

  // Cache para evitar consultas repetidas (se mantiene en memoria por sesión)
  const schedulesMonthCacheRef = useRef<
    Map<
      string,
      {
        at: number;
        promise: Promise<
          Awaited<
            ReturnType<typeof SchedulesService.getSchedulesByLocationYearMonth>
          >
        >;
      }
    >
  >(new Map());
  const ownerAdminEmailCacheRef = useRef<
    Map<string, { at: number; promise: Promise<string> }>
  >(new Map());

  const SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  const OWNER_ADMIN_CACHE_TTL_MS = 10 * 60 * 1000; // 10 min

  const getMonthlySchedulesCached = useCallback(
    async (locationValue: string, year: number, month0: number) => {
      const key = `${locationValue}__${year}__${month0}`;
      const now = Date.now();
      const cached = schedulesMonthCacheRef.current.get(key);
      if (cached && now - cached.at < SCHEDULES_CACHE_TTL_MS) {
        return cached.promise;
      }
      const promise = SchedulesService.getSchedulesByLocationYearMonth(
        locationValue,
        year,
        month0,
      );
      schedulesMonthCacheRef.current.set(key, { at: now, promise });
      return promise;
    },
    [],
  );

  const getOwnerPrimaryAdminEmailCached = useCallback(
    async (ownerId: string): Promise<string> => {
      const normalized = (ownerId || "").trim();
      if (!normalized) return "";
      const now = Date.now();
      const cached = ownerAdminEmailCacheRef.current.get(normalized);
      if (cached && now - cached.at < OWNER_ADMIN_CACHE_TTL_MS) {
        return cached.promise;
      }
      const promise = (async () => {
        const admin = await UsersService.getPrimaryAdminByOwner(normalized);
        return typeof admin?.email === "string" ? admin.email.trim() : "";
      })();
      ownerAdminEmailCacheRef.current.set(normalized, { at: now, promise });
      return promise;
    },
    [],
  );
  const [similarConfirmOpen, setSimilarConfirmOpen] = useState(false);
  const [similarConfirmMessage, setSimilarConfirmMessage] =
    useState<React.ReactNode>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState<number | "all">(10);
  const [showOnlyWithEmail, setShowOnlyWithEmail] = useState(() => {
    if (typeof window === "undefined") return false;
    const saved = localStorage.getItem("provider-filter-email");
    return saved === "true";
  });
  const companySelectId = `provider-company-select-${id ?? "default"}`;
  const showCompanySelector =
    canSelectCompany &&
    (ownerCompaniesLoading ||
      sortedOwnerCompanies.length > 0 ||
      !!ownerCompaniesError);

  const filteredProviders = useMemo(() => {
    return providers.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesEmail =
        !showOnlyWithEmail ||
        (p.correonotifi && p.correonotifi.trim().length > 0);
      return matchesSearch && matchesEmail;
    });
  }, [providers, searchTerm, showOnlyWithEmail]);

  const totalPages = useMemo(() => {
    if (itemsPerPage === "all") return 1;
    return Math.ceil(filteredProviders.length / itemsPerPage);
  }, [filteredProviders.length, itemsPerPage]);

  const paginatedProviders = useMemo(() => {
    if (itemsPerPage === "all") return filteredProviders;
    return filteredProviders.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage,
    );
  }, [filteredProviders, currentPage, itemsPerPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, itemsPerPage]);

  // Guardar preferencia de filtro de correo en localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "provider-filter-email",
        showOnlyWithEmail.toString(),
      );
    }
  }, [showOnlyWithEmail]);

  // Escuchar cambios de empresa desde FondoSection (sincronización bidireccional)
  useEffect(() => {
    if (!canSelectCompany) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === SHARED_COMPANY_STORAGE_KEY &&
        event.newValue &&
        event.newValue !== adminCompany
      ) {
        setAdminCompany(event.newValue);
        // Reset form state when company changes from external source
        setProviderDrawerOpen(false);
        resetProviderFormState();
        setDeletingCode(null);
        setConfirmState({ open: false, code: "", name: "" });
        setCurrentPage(1);
        setSearchTerm("");
        setItemsPerPage(10);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [canSelectCompany, adminCompany]);

  const notificationOwnerId = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    if (!user) return "";

    // Admin/Superadmin: ownerId de la empresa seleccionada
    if (canSelectCompany) {
      const normalizedSelected = normalizeCompanyKey(adminCompany);
      if (!normalizedSelected) return "";
      const match = ownerCompanies.find((emp) => {
        const candidates = [emp?.name, emp?.ubicacion, emp?.id]
          .map(normalizeCompanyKey)
          .filter(Boolean);
        return candidates.includes(normalizedSelected);
      });
      return typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
    }

    // Otros: si tiene ownerId usarlo, si no (dueño) usar su propio id
    if (user.ownerId && user.ownerId.trim().length > 0)
      return user.ownerId.trim();
    return (user.id || "").trim();
  }, [adminCompany, canSelectCompany, ownerCompanies, user]);

  const sendEgresoProviderCreatedEmailToOwner = useCallback(
    async (
      providerName: string,
      providerType?: FondoMovementType,
    ): Promise<void> => {
      try {
        if (!providerType) return;
        if (!isEgresoType(providerType)) return;

        const resolveCreatedByFromControlHorario = async (
          createdAtISO: string,
        ): Promise<string> => {
          const fallback = (
            user?.name?.trim() ||
            user?.email?.trim() ||
            user?.id ||
            "Sistema"
          ).toString();

          const normalizedCompany = (company || "").trim();
          if (!normalizedCompany) return fallback;

          // En producción, `companieValue` en schedules puede estar guardado como `name`, `ubicacion` o `id`
          // según cómo se haya seleccionado la empresa al registrar el horario.
          // Si podemos, intentamos con varias claves para evitar mismatch.
          const companyKeysToTry = (() => {
            const set = new Set<string>();
            set.add(normalizedCompany);

            if (canSelectCompany && ownerCompanies.length > 0) {
              const normalizeCompanyKey = (value: unknown) =>
                String(value || "")
                  .trim()
                  .toLowerCase();

              const selectedKey = normalizeCompanyKey(adminCompany);
              const match = ownerCompanies.find((emp) => {
                const candidates = [emp?.name, emp?.ubicacion, emp?.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(selectedKey);
              });

              [match?.name, match?.ubicacion, match?.id]
                .map((v) =>
                  typeof v === "string" ? v.trim() : String(v || "").trim(),
                )
                .filter(Boolean)
                .forEach((v) => set.add(v));
            }

            return Array.from(set);
          })();

          const createdDate = new Date(createdAtISO);
          if (Number.isNaN(createdDate.getTime())) return fallback;
          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          }).formatToParts(createdDate);

          const getPart = (type: string) =>
            parts.find((p) => p.type === type)?.value ?? "";

          const year = Number(getPart("year"));
          const month1 = Number(getPart("month"));
          const day = Number(getPart("day"));
          const hour = Number(getPart("hour"));

          if (
            !Number.isFinite(year) ||
            !Number.isFinite(month1) ||
            !Number.isFinite(day) ||
            !Number.isFinite(hour)
          ) {
            return fallback;
          }

          // Regla: cambio de turno a las 4pm (16:00) Costa Rica.
          // Antes de las 4pm => turno "D". Desde las 4pm => turno "N".
          const shift = hour >= 16 ? "N" : "D";

          // En schedules se usa month en formato JS (0-11)
          const month0 = Math.max(0, Math.min(11, month1 - 1));

          try {
            const schedulesLists = await Promise.all(
              companyKeysToTry.map((key) =>
                getMonthlySchedulesCached(key, year, month0),
              ),
            );
            const monthSchedules = schedulesLists.flat();

            const matches = monthSchedules
              .filter((entry) => entry.day === day && entry.shift === shift)
              .map((entry) => (entry.employeeName || "").trim())
              .filter(Boolean);

            if (matches.length === 0) return fallback;

            const normalizedUserName = (user?.name || "").trim().toLowerCase();
            const direct = normalizedUserName
              ? matches.find(
                  (name) => name.toLowerCase() === normalizedUserName,
                )
              : undefined;
            if (direct) return direct;

            return matches
              .slice()
              .sort((a, b) =>
                a.localeCompare(b, "es", { sensitivity: "base" }),
              )[0];
          } catch (err) {
            console.error(
              "[PROVIDER-EGRESO-EMAIL] Error resolving createdBy from schedules:",
              err,
            );
            return fallback;
          }
        };

        const ownerId = (notificationOwnerId || "").trim();
        if (!ownerId) return;

        const toEmail = await getOwnerPrimaryAdminEmailCached(ownerId);
        if (!toEmail) return;

        const createdAt = new Date().toISOString();
        const createdBy = await resolveCreatedByFromControlHorario(createdAt);

        const emailContent = generateEgresoProviderCreatedEmail({
          company: company || "",
          providerName,
          providerType,
          createdBy,
          createdAt,
        });

        await addDoc(collection(db, "mail"), {
          to: toEmail,
          subject: emailContent.subject,
          text: emailContent.text,
          html: emailContent.html,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error(
          "[PROVIDER-EGRESO-EMAIL] Error sending owner notification:",
          err,
        );
        // La notificación es secundaria: no bloquear creación del proveedor
      }
    },
    [
      adminCompany,
      canSelectCompany,
      company,
      getMonthlySchedulesCached,
      getOwnerPrimaryAdminEmailCached,
      notificationOwnerId,
      ownerCompanies,
      user,
    ],
  );

  // Cargar admins cuando se necesite para notificaciones
  useEffect(() => {
    if (!addNotification || !user) {
      setAdminUsers([]);
      return;
    }

    let isMounted = true;
    setLoadingAdmins(true);

    const referenceOwnerId = notificationOwnerId;
    if (!referenceOwnerId) {
      setAdminUsers([]);
      setLoadingAdmins(false);
      return;
    }

    UsersService.findUsersByRole("admin")
      .then((allAdmins) => {
        if (!isMounted) return;

        // Filtrar admins que cumplan cualquiera de estas condiciones:
        // 1. Admins que tengan el mismo ownerId que el referenceOwnerId
        // 2. El admin "dueño" cuyo id sea igual al referenceOwnerId (sin ownerId o ownerId vacío)
        const filtered = allAdmins.filter((admin) => {
          const hasEmail = admin.email && admin.email.trim().length > 0;
          if (!hasEmail) return false;

          // Condición 1: Admin con el mismo ownerId
          const sameOwnerId =
            admin.ownerId && admin.ownerId.trim() === referenceOwnerId;

          // Condición 2: Admin dueño (su id es el referenceOwnerId y no tiene ownerId)
          const isOwnerAdmin =
            admin.id === referenceOwnerId &&
            (!admin.ownerId || admin.ownerId.trim().length === 0);

          return sameOwnerId || isOwnerAdmin;
        });

        setAdminUsers(filtered);
        setSelectedAdminId((prev) => prev || filtered[0]?.id || "");
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error("Error loading admin users:", err);
        setAdminUsers([]);
      })
      .finally(() => {
        if (isMounted) setLoadingAdmins(false);
      });

    return () => {
      isMounted = false;
    };
  }, [addNotification, notificationOwnerId, user]);

  // Cargar tipos de movimientos de fondo desde la base de datos (con caché y sincronización en tiempo real)
  useEffect(() => {
    let isMounted = true;

    // Función para cargar y actualizar tipos
    const loadTypes = async () => {
      try {
        const types =
          await FondoMovementTypesService.getMovementTypesByCategoriesWithCache(
            activeOwnerId,
          );

        if (!isMounted) return;

        setIngresoTypes(types.INGRESO);
        setGastoTypes(types.GASTO);
        setEgresoTypes(types.EGRESO);
        setFondoTypesLoaded(true);

        // Actualizar las variables globales para compatibilidad
        FONDO_INGRESO_TYPES = types.INGRESO;
        FONDO_GASTO_TYPES = types.GASTO;
        FONDO_EGRESO_TYPES = types.EGRESO;
        FONDO_TYPE_OPTIONS = [
          ...types.INGRESO,
          ...types.GASTO,
          ...types.EGRESO,
        ];

        // El paymentType de ajustes de cierre se normaliza al persistir.

        console.log("[FondoTypes] Loaded:", types);
      } catch (err) {
        console.error("Error loading fondo movement types:", err);
        if (isMounted) {
          setFondoTypesLoaded(true);
        }
      }
    };

    // Listener para actualizaciones en tiempo real desde el caché
    const handleFondoTypesUpdate = (event: Event) => {
      const eventOwnerId = String(
        (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId || "",
      ).trim();
      if (activeOwnerId && eventOwnerId && eventOwnerId !== activeOwnerId) {
        return;
      }
      if (!isMounted) return;

      console.log("[FondoTypes] Cache updated, reloading types...");

      // Recargar tipos cuando el caché se actualiza
      loadTypes();
    };

    // Cargar tipos iniciales (desde caché o DB)
    loadTypes();

    // Escuchar actualizaciones en tiempo real
    window.addEventListener(
      "fondoMovementTypesUpdated",
      handleFondoTypesUpdate,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "fondoMovementTypesUpdated",
        handleFondoTypesUpdate,
      );
    };
  }, [activeOwnerId]);

  const handleAdminCompanyChange = useCallback(
    (value: string) => {
      if (!canSelectCompany) return;
      setAdminCompany(value);
      try {
        localStorage.setItem(SHARED_COMPANY_STORAGE_KEY, value);
        // Disparar evento de storage manualmente para sincronizar dentro de la misma ventana
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SHARED_COMPANY_STORAGE_KEY,
            newValue: value,
            oldValue: adminCompany,
            storageArea: localStorage,
          }),
        );
      } catch (error) {
        console.error("Error saving selected company to localStorage:", error);
      }
      setProviderDrawerOpen(false);
      resetProviderFormState();
      setDeletingCode(null);
      setConfirmState({ open: false, code: "", name: "" });
      setCurrentPage(1);
      setSearchTerm("");
      setItemsPerPage(10);
    },
    [canSelectCompany, adminCompany],
  );

  // provider creation is handled from the drawer UI below

  const openRemoveModal = (code: string, name: string) => {
    if (!company) return;
    setConfirmState({ open: true, code, name });
  };

  const openEditProvider = (code: string) => {
    const prov = providers.find((p) => p.code === code);
    if (!prov) return;
    setEditingProviderCode(prov.code);
    setProviderName(prov.name ?? "");
    setProviderType((prov.type as FondoMovementType) ?? "");
    setProviderTypeError("");
    setProviderAgentName(prov.agent?.name ?? "");
    setProviderAgentPhone(formatProviderPhone(prov.agent?.phone ?? ""));
    setShowProviderAgentFields(Boolean(prov.agent));
    // Cargar datos de notificación si existen
    if (prov.correonotifi && prov.correonotifi.trim().length > 0) {
      setAddNotification(true);
      // Intentar encontrar el admin con ese correo
      const matchingAdmin = adminUsers.find(
        (admin) => admin.email === prov.correonotifi,
      );
      if (matchingAdmin?.id) {
        setSelectedAdminId(matchingAdmin.id);
      }
    } else {
      setAddNotification(false);
      setSelectedAdminId("");
    }

    if (prov.visit && (prov.type || "").toUpperCase() === "COMPRA INVENTARIO") {
      setAddVisit(true);
      setVisitCreateDays(
        (prov.visit.createOrderDays || []) as ProviderVisitDay[],
      );
      setVisitReceiveDays(
        (prov.visit.receiveOrderDays || []) as ProviderVisitDay[],
      );
      setVisitFrequency((prov.visit.frequency || "") as ProviderVisitFrequency);

      const startKey = (prov.visit as any).startDateKey;
      if (
        typeof startKey === "number" &&
        Number.isFinite(startKey) &&
        startKey > 0
      ) {
        setVisitStartDateISO(dateKeyToISODate(startKey));
      } else {
        setVisitStartDateISO("");
      }
    } else {
      setAddVisit(false);
      setVisitCreateDays([]);
      setVisitReceiveDays([]);
      setVisitFrequency("");
      setVisitStartDateISO("");
    }

    setProviderDrawerOpen(true);
  };

  const cancelRemoveModal = () => {
    if (deletingCode) return;
    setConfirmState({ open: false, code: "", name: "" });
  };

  const closeRemoveModal = () =>
    setConfirmState({ open: false, code: "", name: "" });

  const confirmRemoveProvider = async () => {
    if (!company) return;
    if (!confirmState.code || deletingCode) return;

    try {
      setFormError(null);
      setDeletingCode(confirmState.code);
      await removeProvider(confirmState.code);
      closeRemoveModal();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "No se pudo eliminar el proveedor.";
      setFormError(message);
      closeRemoveModal();
    } finally {
      setDeletingCode(null);
    }
  };

  const resolvedError = formError || error;
  const isLoading = authLoading || providersLoading;

  if (authLoading) {
    return (
      <div id={id} className="mt-10">
        <div className="p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center">
          <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!canManageFondoGeneral) {
    return (
      <div id={id} className="mt-10">
        <AccessRestrictedMessage description="No tienes permisos para administrar proveedores del Fondo General." />
      </div>
    );
  }

  if (!fondoTypesLoaded) {
    return (
      <div id={id}>
        <div className="p-8 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center space-y-3">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          </div>
          <p className="text-[var(--muted-foreground)]">
            Cargando tipos de movimientos...
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Esto solo ocurre la primera vez
          </p>
        </div>
      </div>
    );
  }

  return (
    <div id={id}>
      <div className="mb-3 sm:mb-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm sm:text-base font-medium text-[var(--muted-foreground)] flex items-center gap-2">
              <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted-foreground)]" />
              Proveedores
            </h2>
            {company && (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--input-border)] px-2.5 py-1 text-[10px] sm:text-xs text-[var(--foreground)] whitespace-nowrap">
                <span className="text-[var(--muted-foreground)]">Empresa</span>
                <span className="font-semibold text-[var(--foreground)] truncate max-w-[160px] sm:max-w-none">
                  {company}
                </span>
              </span>
            )}
          </div>
          <p className="mt-1 text-[10px] sm:text-xs text-[var(--muted-foreground)]">
            Administra proveedores del Fondo General.
          </p>
        </div>

        <div className="flex w-full flex-col sm:w-auto sm:flex-row items-stretch sm:items-end gap-2 sm:gap-3">
          {showCompanySelector && (
            <div className="flex w-full sm:w-auto flex-col gap-1">
              <label
                htmlFor={companySelectId}
                className="text-[10px] sm:text-xs text-[var(--muted-foreground)]"
              >
                Empresa
              </label>
              <select
                id={companySelectId}
                value={adminCompany}
                onChange={(event) =>
                  handleAdminCompanyChange(event.target.value)
                }
                disabled={
                  ownerCompaniesLoading || sortedOwnerCompanies.length === 0
                }
                className="w-full sm:min-w-[220px] lg:min-w-[260px] h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
              >
                {(() => {
                  const getCompanyKey = (emp: Empresas) =>
                    String(emp?.name || emp?.ubicacion || emp?.id || "").trim();
                  const getCompanyLabel = (emp: Empresas) => {
                    const name = String(emp?.name || "").trim();
                    const ubicacion = String(emp?.ubicacion || "").trim();
                    if (
                      name &&
                      ubicacion &&
                      name.toLowerCase() !== ubicacion.toLowerCase()
                    ) {
                      return `${name} (${ubicacion})`;
                    }
                    return (
                      name || ubicacion || getCompanyKey(emp) || "Sin nombre"
                    );
                  };

                  return (
                    <>
                      {ownerCompaniesLoading && (
                        <option value="">Cargando empresas...</option>
                      )}
                      {!ownerCompaniesLoading &&
                        sortedOwnerCompanies.length === 0 && (
                          <option value="">Sin empresas disponibles</option>
                        )}
                      {!ownerCompaniesLoading &&
                        sortedOwnerCompanies.length > 0 && (
                          <>
                            <option value="" disabled>
                              Selecciona una empresa
                            </option>
                            {sortedOwnerCompanies.map((emp, index) => (
                              <option
                                key={
                                  emp.id ||
                                  emp.name ||
                                  emp.ubicacion ||
                                  `admin-company-${index}`
                                }
                                value={getCompanyKey(emp)}
                                className="border-[var(--accent)] bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)] hover:border-[var(--accent-hover)] hover:shadow-md hover:shadow-sky-950/25 active:translate-y-0 active:scale-[0.99]"
                              >
                                {getCompanyLabel(emp)}
                              </option>
                            ))}
                          </>
                        )}
                    </>
                  );
                })()}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setProviderDrawerOpen(true);
              setFormError(null);
              setProviderTypeError("");
              setProviderName("");
              setProviderType("");
              setEditingProviderCode(null);
              setAddNotification(false);
              setSelectedAdminId("");

              setAddVisit(false);
              setVisitCreateDays([]);
              setVisitReceiveDays([]);
              setVisitFrequency("");
            }}
            disabled={!company || saving || providersLoading}
            className={`flex h-11 w-full items-center justify-center gap-2 rounded border px-3 text-sm font-semibold shadow-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] disabled:pointer-events-none disabled:opacity-50 ${
              !company || saving || providersLoading
                ? "cursor-not-allowed border-[var(--input-border)] bg-[var(--muted)]/30 text-[var(--muted-foreground)] opacity-70"
                : "border-[var(--accent)] bg-transparent text-[var(--foreground)] hover:-translate-y-0.5 hover:border-cyan-300/70 hover:bg-transparent hover:shadow-md hover:shadow-sky-950/25 active:translate-y-0 active:scale-[0.99]"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Agregar proveedor</span>
          </button>
        </div>
      </div>

      {!authLoading && !company && !isAdminUser && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Tu usuario no tiene una empresa asociada; no es posible registrar
          proveedores.
        </p>
      )}
      {!authLoading && !company && isAdminUser && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          Selecciona una empresa para administrar proveedores.
        </p>
      )}

      {resolvedError && (
        <div className="mb-4 text-sm text-red-500">{resolvedError}</div>
      )}

      <div>
        <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
          <h3 className="text-[10px] sm:text-xs font-medium text-[var(--muted-foreground)] uppercase tracking-wide">
            Lista de proveedores
          </h3>
        </div>
        {!isLoading && (
          <div className="mb-3 sm:mb-4 space-y-2 sm:space-y-3">
            <div className="flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--foreground)]/70" />
                <input
                  type="text"
                  placeholder="Buscar por nombre, código o correo…"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-10 sm:h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] pl-10 pr-4 text-sm text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <label
                  htmlFor="filter-with-email"
                  title="Muestra solo proveedores con correo de notificación"
                  className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 cursor-pointer select-none transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-within:ring-2 focus-within:ring-[var(--accent)]/40 focus-within:ring-offset-1 focus-within:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                >
                  <input
                    type="checkbox"
                    id="filter-with-email"
                    checked={showOnlyWithEmail}
                    onChange={(e) => {
                      setShowOnlyWithEmail(e.target.checked);
                      setCurrentPage(1);
                    }}
                    className="mt-0.5 sm:mt-0 h-4 w-4 cursor-pointer rounded border-[var(--input-border)] text-[var(--accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
                  />
                  <span className="text-xs sm:text-sm text-[var(--foreground)] whitespace-nowrap">
                    Solo con correo
                  </span>
                  <span className="sm:hidden text-[10px] text-[var(--muted-foreground)] leading-tight">
                    Solo proveedores con correo de notificación.
                  </span>
                </label>
                <div className="hidden sm:block text-[10px] sm:text-xs text-[var(--muted-foreground)] leading-tight">
                  Filtra por correo de notificación.
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="items-per-page"
                  className="text-xs sm:text-sm text-[var(--muted-foreground)] whitespace-nowrap"
                >
                  Mostrar
                </label>
                <select
                  id="items-per-page"
                  value={
                    itemsPerPage === "all" ? "all" : itemsPerPage.toString()
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    setItemsPerPage(value === "all" ? "all" : parseInt(value));
                    setCurrentPage(1);
                  }}
                  className="w-full sm:w-auto h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    color: "var(--foreground)",
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="5">5</option>
                  <option value="10">10</option>
                  <option value="15">15</option>
                  <option value="20">20</option>
                </select>
              </div>

              {itemsPerPage !== "all" && totalPages > 1 && (
                <div className="flex items-center gap-2 justify-center sm:justify-end">
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.max(prev - 1, 1))
                    }
                    disabled={currentPage === 1}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[var(--foreground)] text-xs sm:text-sm whitespace-nowrap px-1">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    onClick={() =>
                      setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                    }
                    disabled={currentPage === totalPages}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] disabled:opacity-50"
                    style={{
                      backgroundColor: "var(--card-bg)",
                      color: "var(--foreground)",
                    }}
                    aria-label="Página siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
        {isLoading ? (
          <p className="text-xs sm:text-sm text-[var(--muted-foreground)] py-4 text-center">
            Cargando proveedores...
          </p>
        ) : (
          <div>
            <ul className="space-y-1.5 sm:space-y-2">
              {filteredProviders.length === 0 && (
                <li className="text-xs sm:text-sm text-[var(--muted-foreground)] py-4 text-center">
                  {searchTerm
                    ? "No se encontraron proveedores."
                    : "Aun no hay proveedores."}
                </li>
              )}
              {paginatedProviders.map((p) => (
                <li
                  key={p.code}
                  className="group overflow-hidden rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/35 hover:bg-[var(--card-bg)]/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row">
                    <div className="flex-1 min-w-0 px-3 sm:px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm sm:text-base text-[var(--foreground)] font-semibold truncate">
                              {p.name}
                            </span>
                            {p.correonotifi?.trim() && (
                              <span
                                title={`Correo: ${p.correonotifi}`}
                                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5 text-[10px] text-[var(--foreground)]"
                              >
                                <Mail className="w-3.5 h-3.5 text-[var(--accent)]" />
                                <span className="truncate">Con correo</span>
                              </span>
                            )}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-xs text-[var(--muted-foreground)]">
                            <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                              Código:{" "}
                              <span className="ml-1 text-[var(--foreground)]">
                                {p.code}
                              </span>
                            </span>
                            <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                              Empresa:{" "}
                              <span className="ml-1 text-[var(--foreground)]">
                                {p.company}
                              </span>
                            </span>
                            {p.type && (
                              <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                                Tipo:{" "}
                                <span className="ml-1 text-[var(--foreground)]">
                                  {p.type}
                                </span>
                              </span>
                            )}
                            {p.category && (
                              <span className="inline-flex items-center rounded-full border border-[var(--input-border)] bg-[var(--card-bg)]/35 px-2 py-0.5">
                                {p.category}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 px-2.5 py-2 sm:px-3 sm:py-3 border-t sm:border-t-0 sm:border-l border-[var(--input-border)] bg-black/10">
                      <button
                        type="button"
                        className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50 p-2.5 sm:p-2 rounded-md hover:bg-white/5 transition-colors"
                        onClick={() => openEditProvider(p.code)}
                        disabled={saving || deletingCode !== null}
                        title="Editar proveedor"
                        aria-label="Editar proveedor"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      <div className="w-px h-7 bg-[var(--input-border)]" />

                      <button
                        type="button"
                        className="text-red-500 hover:text-red-400 disabled:opacity-50 p-2.5 sm:p-2 rounded-md border border-red-500/30 bg-red-500/10 hover:bg-red-500/15 transition-colors"
                        onClick={() => openRemoveModal(p.code, p.name)}
                        disabled={
                          deletingCode === p.code ||
                          saving ||
                          deletingCode !== null
                        }
                        title="Eliminar (requiere confirmación)"
                        aria-label="Eliminar proveedor"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmState.open}
        title="Eliminar proveedor"
        message={`Quieres eliminar el proveedor "${
          confirmState.name || confirmState.code
        }"? Esta accion no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        actionType="delete"
        loading={deletingCode !== null && deletingCode === confirmState.code}
        onConfirm={confirmRemoveProvider}
        onCancel={cancelRemoveModal}
      />

      <ConfirmModal
        open={similarConfirmOpen}
        title="Nombre demasiado similar"
        message={similarConfirmMessage}
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        loading={saving}
        onConfirm={async () => {
          const pending = pendingProviderSaveRef.current;
          if (!pending) {
            setSimilarConfirmOpen(false);
            return;
          }

          try {
            setSaving(true);
            setFormError(null);
            const agent = getProviderAgent();

            if (pending.mode === "update" && pending.code) {
              await updateProvider(
                pending.code,
                pending.name,
                pending.providerType,
                pending.correonotifi,
                agent,
                pending.visit,
                getCategoryForType(pending.providerType),
              );
            } else {
              await addProvider(
                pending.name,
                pending.providerType,
                pending.correonotifi,
                agent,
                pending.visit,
                getCategoryForType(pending.providerType),
              );

              await sendEgresoProviderCreatedEmailToOwner(
                pending.name,
                pending.providerType,
              );
            }

            pendingProviderSaveRef.current = null;
            resetProviderFormState();

            setProviderDrawerOpen(false);
            setSimilarConfirmOpen(false);
          } catch (err) {
            const message =
              err instanceof Error
                ? err.message
                : "No se pudo guardar el proveedor.";
            setFormError(message);
          } finally {
            setSaving(false);
          }
        }}
        onCancel={() => {
          pendingProviderSaveRef.current = null;
          setSimilarConfirmOpen(false);
        }}
      />

      <Drawer
        anchor="right"
        open={providerDrawerOpen}
        onClose={() => {
          setProviderDrawerOpen(false);
          resetProviderFormState();
        }}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 460 },
            maxWidth: "100vw",
            bgcolor: "#0d1117",
            color: "#ffffff",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 3,
              py: 2,
            }}
          >
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
              {editingProviderCode ? "Editar proveedor" : "Agregar proveedor"}
            </Typography>
            <IconButton
              aria-label="Cerrar"
              onClick={() => {
                setProviderDrawerOpen(false);
                resetProviderFormState();
              }}
              sx={{ color: "var(--foreground)" }}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
            {company && (
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                Empresa asignada:{" "}
                <span className="font-medium text-[var(--foreground)]">
                  {company}
                </span>
              </p>
            )}
            {resolvedError && (
              <div className="mb-4 text-sm text-red-500">{resolvedError}</div>
            )}

            <div className="flex flex-col gap-3">
              <input
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                placeholder="Nombre del proveedor"
                value={providerName}
                onChange={(e) => setProviderName(e.target.value.toUpperCase())}
                disabled={!company || saving || deletingCode !== null}
                autoFocus
              />
              <select
                value={providerType}
                onChange={(e) => {
                  const nextType = e.target.value as FondoMovementType | "";
                  setProviderType(nextType);
                  setProviderTypeError("");

                  const normalized = String(nextType || "")
                    .trim()
                    .toUpperCase();

                  if (normalized === "COMPRA INVENTARIO") {
                    // Al seleccionar COMPRA INVENTARIO, activar visita automáticamente.
                    setAddVisit(true);
                  } else {
                    // Si se cambia a otro tipo, limpiar configuración de visita.
                    setAddVisit(false);
                    setVisitCreateDays([]);
                    setVisitReceiveDays([]);
                    setVisitFrequency("");
                  }
                }}
                className={`w-full h-11 rounded-lg border bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] ${
                  providerTypeError
                    ? "border-red-500"
                    : "border-[var(--input-border)]"
                }`}
                style={{
                  backgroundColor: "var(--card-bg)",
                  color: "var(--foreground)",
                }}
                disabled={!company || saving}
              >
                <option value="">Seleccione un tipo</option>
                <optgroup label="Ingresos">
                  {ingresoTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatMovementType(opt)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Gastos">
                  {gastoTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatMovementType(opt)}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Egresos">
                  {egresoTypes.map((opt) => (
                    <option key={opt} value={opt}>
                      {formatMovementType(opt)}
                    </option>
                  ))}
                </optgroup>
              </select>
              {providerTypeError && (
                <p className="text-xs text-red-500">{providerTypeError}</p>
              )}

              {/* Checkbox para agregar notificación */}
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  id="add-notification-checkbox"
                  checked={addNotification}
                  onChange={(e) => {
                    setAddNotification(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedAdminId("");
                    }
                  }}
                  disabled={!company || saving}
                  className="w-4 h-4 cursor-pointer"
                />
                <label
                  htmlFor="add-notification-checkbox"
                  className="text-sm text-[var(--foreground)] cursor-pointer"
                >
                  Agregar Notificación
                </label>
              </div>

              {/* Selector de admin para notificación */}
              {addNotification && (
                <div className="mt-2">
                  {loadingAdmins ? (
                    <div className="text-xs text-[var(--muted-foreground)] p-2">
                      Cargando administradores...
                    </div>
                  ) : adminUsers.length === 0 ? (
                    <div className="text-xs text-red-500 p-2">
                      {isSuperAdminUser
                        ? "No hay administradores disponibles con correo electrónico para la empresa seleccionada."
                        : "No hay administradores disponibles con correo electrónico en tu organización."}
                    </div>
                  ) : (
                    <>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                        Seleccionar administrador para notificaciones:
                      </label>
                      <select
                        value={selectedAdminId}
                        onChange={(e) => setSelectedAdminId(e.target.value)}
                        className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          color: "var(--foreground)",
                        }}
                        disabled={!company || saving}
                      >
                        <option value="">Seleccione un administrador</option>
                        {adminUsers.map((admin) => (
                          <option key={admin.id} value={admin.id || ""}>
                            {admin.name || admin.email} ({admin.email})
                          </option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}

              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowProviderAgentFields((current) => {
                      const next = !current;
                      if (!next) {
                        setProviderAgentName("");
                        setProviderAgentPhone("");
                      }
                      return next;
                    });
                  }}
                  disabled={!company || saving}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-xs text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/20 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <MessageSquare className="w-3.5 h-3.5 text-[var(--accent)]" />
                  <span>
                    {showProviderAgentFields ? "Ocultar agente" : "Agregar agente"}
                  </span>
                </button>

                {showProviderAgentFields && (
                  <div className="mt-3 space-y-3 rounded border border-[var(--input-border)] bg-[var(--input-bg)] p-3">
                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                        Nombre del agente
                      </label>
                      <input
                        type="text"
                        value={providerAgentName}
                        onChange={(e) => setProviderAgentName(e.target.value)}
                        placeholder="Nombre del agente"
                        className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          color: "var(--foreground)",
                        }}
                        disabled={!company || saving}
                      />
                    </div>

                    <div>
                      <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                        Número de teléfono
                      </label>
                      <input
                        type="tel"
                        inputMode="tel"
                        value={providerAgentPhone}
                        onChange={(e) =>
                          setProviderAgentPhone(
                            formatProviderPhone(e.target.value),
                          )
                        }
                        placeholder="8888-8888"
                        maxLength={9}
                        className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                        style={{
                          backgroundColor: "var(--card-bg)",
                          color: "var(--foreground)",
                        }}
                        disabled={!company || saving}
                      />
                    </div>
                  </div>
                )}
              </div>

              {isCompraInventarioProvider && (
                <div className="mt-2 rounded border border-[var(--input-border)] p-3 bg-[var(--input-bg)]">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="add-visit-checkbox"
                      checked={addVisit}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setAddVisit(checked);
                        if (!checked) {
                          setVisitCreateDays([]);
                          setVisitReceiveDays([]);
                          setVisitFrequency("");
                          setVisitStartDateISO("");
                        }
                      }}
                      disabled={!company || saving}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label
                      htmlFor="add-visit-checkbox"
                      className="text-sm text-[var(--foreground)] cursor-pointer"
                    >
                      Agregar visita
                    </label>
                  </div>

                  {addVisit && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="text-xs text-[var(--muted-foreground)] mb-1">
                          Día de realizar pedido
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {VISIT_DAY_ORDER.map((day) => {
                            const selected = visitCreateDays.includes(day);
                            return (
                              <button
                                key={`visit-create-${day}`}
                                type="button"
                                onClick={() =>
                                  toggleVisitDay(day, setVisitCreateDays)
                                }
                                title={VISIT_DAY_TITLES[day]}
                                className={`px-2 py-1 rounded border text-xs transition-colors ${
                                  selected
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                    : "bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--input-border)]"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <div className="text-xs text-[var(--muted-foreground)] mb-1">
                          Día de recibir pedido
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {VISIT_DAY_ORDER.map((day) => {
                            const selected = visitReceiveDays.includes(day);
                            return (
                              <button
                                key={`visit-receive-${day}`}
                                type="button"
                                onClick={() =>
                                  toggleVisitDay(day, setVisitReceiveDays)
                                }
                                title={VISIT_DAY_TITLES[day]}
                                className={`px-2 py-1 rounded border text-xs transition-colors ${
                                  selected
                                    ? "bg-[var(--accent)] text-white border-[var(--accent)]"
                                    : "bg-[var(--input-bg)] text-[var(--foreground)] border-[var(--input-border)]"
                                }`}
                              >
                                {day}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                          Frecuencia
                        </label>
                        <select
                          value={visitFrequency}
                          onChange={(e) =>
                            setVisitFrequency(
                              e.target.value as ProviderVisitFrequency | "",
                            )
                          }
                          className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                          style={{
                            backgroundColor: "var(--card-bg)",
                            color: "var(--foreground)",
                          }}
                          disabled={!company || saving}
                        >
                          <option value="">Seleccione una frecuencia</option>
                          {VISIT_FREQUENCY_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {visitFrequency && visitFrequency !== "SEMANAL" ? (
                        <div>
                          <label className="text-xs text-[var(--muted-foreground)] mb-1 block">
                            Fecha inicial
                          </label>
                          <input
                            type="date"
                            value={visitStartDateISO}
                            onChange={(e) =>
                              setVisitStartDateISO(e.target.value)
                            }
                            className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 hover:bg-[var(--muted)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)]"
                            style={{
                              backgroundColor: "var(--card-bg)",
                              color: "var(--foreground)",
                            }}
                            disabled={!company || saving}
                          />
                          <div className="mt-1 text-[10px] text-[var(--muted-foreground)]">
                            Define desde qué semana empieza el ciclo
                            (quincenal/22 días/mensual).
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => {
                  setProviderDrawerOpen(false);
                  resetProviderFormState();
                }}
                className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)]"
                disabled={saving}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const name = providerName.trim().toUpperCase();
                  const agent = getProviderAgent();
                  if (!name) {
                    setFormError("Nombre requerido.");
                    return;
                  }
                  if (!company) {
                    setFormError("Tu usuario no tiene una empresa asignada.");
                    return;
                  }

                  if (!providerType) {
                    setProviderTypeError("Debe seleccionar un tipo.");
                    return;
                  }
                  if (providersLoading) {
                    setFormError("Espera a que carguen los proveedores.");
                    return;
                  }

                  // Validar que si se marcó notificación, se haya seleccionado un admin
                  if (addNotification && !selectedAdminId) {
                    setFormError(
                      "Debe seleccionar un administrador para las notificaciones.",
                    );
                    return;
                  }

                  // Obtener el correo del admin seleccionado
                  let correonotifi: string | undefined = undefined;
                  if (addNotification && selectedAdminId) {
                    const selectedAdmin = adminUsers.find(
                      (admin) => admin.id === selectedAdminId,
                    );
                    if (selectedAdmin?.email) {
                      correonotifi = selectedAdmin.email;
                    }
                  }

                  let visit: ProviderVisitConfig | undefined = undefined;
                  if (isCompraInventarioProvider && addVisit) {
                    if (visitCreateDays.length === 0) {
                      setFormError(
                        "Debe seleccionar al menos un día para crear pedido.",
                      );
                      return;
                    }
                    if (visitReceiveDays.length === 0) {
                      setFormError(
                        "Debe seleccionar al menos un día para recibir pedido.",
                      );
                      return;
                    }
                    if (!visitFrequency) {
                      setFormError(
                        "Debe seleccionar una frecuencia de visita.",
                      );
                      return;
                    }

                    let startDateKey: number | undefined = undefined;
                    if (visitFrequency !== "SEMANAL") {
                      const key = isoDateToDateKey(visitStartDateISO);
                      if (!key) {
                        setFormError(
                          "Debe seleccionar una fecha inicial válida.",
                        );
                        return;
                      }
                      startDateKey = key;
                    }

                    visit = {
                      createOrderDays: visitCreateDays,
                      receiveOrderDays: visitReceiveDays,
                      frequency: visitFrequency as ProviderVisitFrequency,
                      ...(typeof startDateKey === "number"
                        ? { startDateKey }
                        : {}),
                    };
                  }

                  try {
                    setFormError(null);
                    setProviderTypeError("");

                    const normalizedProviderType = providerType || undefined;

                    if (editingProviderCode) {
                      const otherProviders = providers.filter(
                        (p) => p.code !== editingProviderCode,
                      );
                      if (
                        otherProviders.some(
                          (p) => p.name.toUpperCase() === name,
                        )
                      ) {
                        setFormError(`El proveedor "${name}" ya existe.`);
                        return;
                      }

                      const { best, score } = findBestStringMatch(
                        name,
                        otherProviders.map((p) => p.name),
                      );
                      if (best && score >= 0.9) {
                        const similarProvider = otherProviders.find(
                          (p) => p.name === best,
                        );
                        const similarTypeLabel = similarProvider?.type
                          ? formatMovementType(similarProvider.type)
                          : "";
                        pendingProviderSaveRef.current = {
                          mode: "update",
                          code: editingProviderCode,
                          name,
                          providerType: normalizedProviderType,
                          correonotifi,
                          agent,
                          visit,
                        };
                        setSimilarConfirmMessage(
                          <div className="w-full flex flex-col items-center text-center">
                            <p className="text-center">
                              Detectamos un nombre demasiado similar.
                            </p>

                            <div className="mt-3 space-y-2">
                              <div className="flex items-start justify-center gap-2 w-full">
                                <UserPlus className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Nuevo proveedor
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{name}&apos;
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-start justify-center gap-2 w-full">
                                <Layers className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Proveedor existente
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{best}&apos;
                                  </div>
                                </div>
                              </div>

                              {similarTypeLabel && (
                                <div className="flex items-start justify-center gap-2 w-full">
                                  <Tag className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                  <div className="min-w-0 flex flex-col items-center">
                                    <div className="text-xs text-[var(--muted-foreground)]">
                                      Tipo del existente
                                    </div>
                                    <div className="break-words">
                                      {similarTypeLabel}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-[var(--muted-foreground)] pt-1 text-center">
                                Similitud: {Math.round(score * 100)}%
                              </div>
                            </div>

                            <p className="mt-4 text-center">
                              ¿Deseas continuar y guardarlo de todas formas?
                            </p>
                          </div>,
                        );
                        setSimilarConfirmOpen(true);
                        return;
                      }

                      setSaving(true);
                      await updateProvider(
                        editingProviderCode,
                        name,
                        normalizedProviderType,
                        correonotifi,
                        agent,
                        visit,
                      );
                    } else {
                      if (
                        providers.some((p) => p.name.toUpperCase() === name)
                      ) {
                        setFormError(`El proveedor "${name}" ya existe.`);
                        return;
                      }

                      const { best, score } = findBestStringMatch(
                        name,
                        providers.map((p) => p.name),
                      );
                      if (best && score >= 0.9) {
                        const similarProvider = providers.find(
                          (p) => p.name === best,
                        );
                        const similarTypeLabel = similarProvider?.type
                          ? formatMovementType(similarProvider.type)
                          : "";
                        pendingProviderSaveRef.current = {
                          mode: "create",
                          name,
                          providerType: normalizedProviderType,
                          correonotifi,
                          agent,
                          visit,
                        };
                        setSimilarConfirmMessage(
                          <div className="w-full flex flex-col items-center text-center">
                            <p className="text-center">
                              Detectamos un nombre demasiado similar.
                            </p>

                            <div className="mt-3 space-y-2">
                              <div className="flex items-start justify-center gap-2 w-full">
                                <UserPlus className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Nuevo proveedor
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{name}&apos;
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-start justify-center gap-2 w-full">
                                <Layers className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                <div className="min-w-0 flex flex-col items-center">
                                  <div className="text-xs text-[var(--muted-foreground)]">
                                    Proveedor existente
                                  </div>
                                  <div className="font-semibold break-words">
                                    &apos;{best}&apos;
                                  </div>
                                </div>
                              </div>

                              {similarTypeLabel && (
                                <div className="flex items-start justify-center gap-2 w-full">
                                  <Tag className="w-4 h-4 text-[var(--muted-foreground)] mt-0.5" />
                                  <div className="min-w-0 flex flex-col items-center">
                                    <div className="text-xs text-[var(--muted-foreground)]">
                                      Tipo del existente
                                    </div>
                                    <div className="break-words">
                                      {similarTypeLabel}
                                    </div>
                                  </div>
                                </div>
                              )}

                              <div className="text-xs text-[var(--muted-foreground)] pt-1 text-center">
                                Similitud: {Math.round(score * 100)}%
                              </div>
                            </div>

                            <p className="mt-4 text-center">
                              ¿Deseas continuar y guardarlo de todas formas?
                            </p>
                          </div>,
                        );
                        setSimilarConfirmOpen(true);
                        return;
                      }

                      setSaving(true);
                      await addProvider(
                        name,
                        normalizedProviderType,
                        correonotifi,
                        agent,
                        visit,
                        getCategoryForType(normalizedProviderType),
                      );

                      await sendEgresoProviderCreatedEmailToOwner(
                        name,
                        normalizedProviderType,
                      );
                    }
                    resetProviderFormState();
                    setProviderDrawerOpen(false);
                  } catch (err) {
                    const message =
                      err instanceof Error
                        ? err.message
                        : "No se pudo guardar el proveedor.";
                    setFormError(message);
                  } finally {
                    setSaving(false);
                  }
                }}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                disabled={!company || saving || deletingCode !== null}
              >
                {saving
                  ? editingProviderCode
                    ? "Actualizando..."
                    : "Guardando..."
                  : editingProviderCode
                    ? "Actualizar"
                    : "Guardar"}
              </button>
            </div>
          </Box>
        </Box>
      </Drawer>
    </div>
  );
}

export function FondoSection({
  id,
  mode = "all",
  namespace = "fg",
  companySelectorPlacement = "content",
  onCompanySelectorChange,
}: {
  id?: string;
  mode?: "all" | "ingreso" | "egreso";
  namespace?: string;
  companySelectorPlacement?: "content" | "external";
  onCompanySelectorChange?: (node: React.ReactNode | null) => void;
}) {
  const [quickRange, setQuickRange] = React.useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const assignedCompany = user?.ownercompanie?.trim() ?? "";
  const { ownerIds: actorOwnerIds, primaryOwnerId } = useActorOwnership(user);
  const allowedOwnerIds = useMemo(() => {
    const set = new Set<string>();
    actorOwnerIds.forEach((id) => {
      const normalized =
        typeof id === "string" ? id.trim() : String(id || "").trim();
      if (normalized) set.add(normalized);
    });
    if (user?.ownerId) {
      const normalized = String(user.ownerId).trim();
      if (normalized) set.add(normalized);
    }
    return set;
  }, [actorOwnerIds, user?.ownerId]);
  const allowedOwnerIdsKey = useMemo(
    () => Array.from(allowedOwnerIds).sort().join("|"),
    [allowedOwnerIds],
  );
  const resolvedOwnerId = useMemo(() => {
    const normalizedPrimary = (primaryOwnerId || "").trim();
    if (normalizedPrimary) return normalizedPrimary;
    const [firstAllowed] = Array.from(allowedOwnerIds);
    if (firstAllowed) return firstAllowed;
    return "";
  }, [allowedOwnerIds, primaryOwnerId]);
  const isAdminUser = user?.role === "admin";
  const isSuperAdminUser = user?.role === "superadmin";
  const isRegularUser = user?.role === "user";
  const [superAdminTotalsOpen, setSuperAdminTotalsOpen] = useState(false);
  const canSelectCompany = isAdminUser || isSuperAdminUser;
  const [resolvedCompany, setResolvedCompany] = useState(() => assignedCompany);
  const [adminCompany, setAdminCompany] = useState(() => {
    if (typeof window === "undefined") return assignedCompany;
    try {
      const stored = localStorage.getItem(SHARED_COMPANY_STORAGE_KEY);
      return stored || assignedCompany;
    } catch {
      return assignedCompany;
    }
  });
  const company = canSelectCompany
    ? adminCompany
    : resolvedCompany || assignedCompany;
  const {
    providers,
    loading: providersLoading,
    error: providersError,
  } = useProviders(company);
  const { showToast } = useToast();
  const [ownerAdminEmail, setOwnerAdminEmail] = useState<string | null>(null);
  const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
  const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
  const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(
    null,
  );

  const sortedOwnerCompanies = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const valueKey = (emp: Empresas) =>
      normalize(emp?.name || emp?.ubicacion || emp?.id || "");

    const score = (emp: Empresas) =>
      (normalize(emp?.id) ? 2 : 0) +
      (normalize(emp?.name) ? 1 : 0) +
      (normalize(emp?.ubicacion) ? 1 : 0);

    const byKey = new Map<string, Empresas>();
    ownerCompanies.forEach((emp) => {
      const key = valueKey(emp);
      if (!key) return;
      const existing = byKey.get(key);
      if (!existing || score(emp) > score(existing)) {
        byKey.set(key, emp);
      }
    });

    const deduped = Array.from(byKey.values());

    const ubicacionesWithNamed = new Set<string>();
    deduped.forEach((emp) => {
      const name = normalize(emp?.name);
      const ubicacion = normalize(emp?.ubicacion);
      if (name && ubicacion) ubicacionesWithNamed.add(ubicacion);
    });

    const cleaned = deduped.filter((emp) => {
      const name = normalize(emp?.name);
      const ubicacion = normalize(emp?.ubicacion);
      if (!name && ubicacion && ubicacionesWithNamed.has(ubicacion))
        return false;
      return true;
    });

    return cleaned.sort((a, b) =>
      (a.name || a.ubicacion || "").localeCompare(
        b.name || b.ubicacion || "",
        "es",
        {
          sensitivity: "base",
        },
      ),
    );
  }, [ownerCompanies]);

  useEffect(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();
    const getEmpresaCompanyKey = (emp: Empresas) =>
      String(emp?.name || emp?.ubicacion || emp?.id || "").trim();
    const normalizedAssignedCompany = normalizeCompanyKey(assignedCompany);

    if (authLoading || !user) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (!canSelectCompany && !normalizedAssignedCompany) {
      setOwnerCompanies([]);
      setResolvedCompany("");
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(null);
      return;
    }

    if (isAdminUser && allowedOwnerIds.size === 0) {
      setOwnerCompanies([]);
      setOwnerCompaniesLoading(false);
      setOwnerCompaniesError(
        "No se pudo determinar el ownerId asociado a tu cuenta.",
      );
      return;
    }

    let isMounted = true;
    setOwnerCompaniesLoading(true);
    setOwnerCompaniesError(null);

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isMounted) return;
        const filtered = isAdminUser
          ? empresas.filter((emp) => {
              const owner = (emp.ownerId || "").trim();
              if (!owner) return false;
              return allowedOwnerIds.has(owner);
            })
          : canSelectCompany
            ? empresas
            : empresas.filter((emp) => {
                const candidates = [emp.name, emp.ubicacion, emp.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(normalizedAssignedCompany);
              });
        setOwnerCompanies(filtered);
        if (canSelectCompany) {
          setAdminCompany((current) => {
            const normalizedCurrent = normalizeCompanyKey(current);
            if (normalizedCurrent.length > 0) {
              const exists = filtered.some((emp) => {
                const candidates = [emp.name, emp.ubicacion, emp.id]
                  .map(normalizeCompanyKey)
                  .filter(Boolean);
                return candidates.includes(normalizedCurrent);
              });
              if (exists) return current;
            }

            const fallback = filtered[0];
            return fallback ? getEmpresaCompanyKey(fallback) : "";
          });
        }
        if (!canSelectCompany) {
          const fallback = filtered[0];
          setResolvedCompany(
            fallback ? getEmpresaCompanyKey(fallback) : assignedCompany,
          );
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setOwnerCompanies([]);
        setOwnerCompaniesError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar las empresas disponibles.",
        );
      })
      .finally(() => {
        if (isMounted) setOwnerCompaniesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [
    allowedOwnerIds,
    allowedOwnerIdsKey,
    assignedCompany,
    authLoading,
    canSelectCompany,
    isAdminUser,
    user,
  ]);

  const activeOwnerId = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    if (canSelectCompany) {
      const normalizedCompany = normalizeCompanyKey(adminCompany);
      if (normalizedCompany.length > 0) {
        const match = ownerCompanies.find((emp) => {
          const candidates = [emp.name, emp.ubicacion, emp.id]
            .map(normalizeCompanyKey)
            .filter(Boolean);
          return candidates.includes(normalizedCompany);
        });
        const ownerId =
          typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
        if (ownerId) return ownerId;
      }

      const fallbackAdminOwner =
        typeof ownerCompanies[0]?.ownerId === "string"
          ? ownerCompanies[0].ownerId.trim()
          : "";
      if (fallbackAdminOwner) return fallbackAdminOwner;
    }

    const normalizedAssignedCompany = normalizeCompanyKey(company);
    if (normalizedAssignedCompany.length > 0 && ownerCompanies.length > 0) {
      const match = ownerCompanies.find((emp) => {
        const candidates = [emp.name, emp.ubicacion, emp.id]
          .map(normalizeCompanyKey)
          .filter(Boolean);
        return candidates.includes(normalizedAssignedCompany);
      });
      const ownerId =
        typeof match?.ownerId === "string" ? match.ownerId.trim() : "";
      if (ownerId) return ownerId;
    }

    return resolvedOwnerId;
  }, [
    adminCompany,
    canSelectCompany,
    company,
    ownerCompanies,
    resolvedOwnerId,
  ]);

  useEffect(() => {
    let cancelled = false;

    if (!activeOwnerId) {
      setOwnerAdminEmail(null);
      return () => {
        cancelled = true;
      };
    }

    setOwnerAdminEmail(null);

    const loadAdminEmail = async () => {
      try {
        const admin = await UsersService.getPrimaryAdminByOwner(activeOwnerId);
        if (cancelled) return;
        const email =
          typeof admin?.email === "string" ? admin.email.trim() : "";
        setOwnerAdminEmail(email.length > 0 ? email : null);
      } catch (error) {
        if (cancelled) return;
        console.error(
          "Error loading owner admin email for daily closing notifications:",
          error,
        );
        setOwnerAdminEmail(null);
      }
    };

    void loadAdminEmail();

    return () => {
      cancelled = true;
    };
  }, [activeOwnerId]);
  const permissions =
    user?.permissions || getDefaultPermissions(user?.role || "user");
  const hasGeneralAccess = Boolean(permissions.fondogeneral);
  const requiredPermissionKey =
    NAMESPACE_PERMISSIONS[namespace] || "fondogeneral";
  const hasSpecificAccess = Boolean(permissions[requiredPermissionKey]);
  const canAccessSection =
    namespace === "fg"
      ? hasGeneralAccess
      : hasGeneralAccess && hasSpecificAccess;
  const namespaceDescription =
    NAMESPACE_DESCRIPTIONS[namespace] || "esta sección del Fondo General";
  const accountKey = useMemo(
    () => getAccountKeyFromNamespace(namespace),
    [namespace],
  );

  // Caja Negra: proveedores fijos y detecci�n

  // Caja Negra: proveedores fijos y detecci�n
  const isCajaNegra = accountKey === "CajaNegra";
  const cajaNegraProviders: Array<{
    code: string;
    name: string;
    type?: FondoMovementType;
    category?: "Ingreso" | "Gasto" | "Egreso";
    correonotifi?: string;
  }> = useMemo(
    () => [
      {
        code: "0000",
        name: "INGRESO DESDE FG",
        category: "Ingreso",
        type: "OTROS",
      },
      {
        code: "0001",
        name: "RETIRO",
        category: "Egreso",
        type: "OTROS",
      },
      {
        code: "0002",
        name: "SALIDA A FONDO GENERAL",
        category: "Egreso",
        type: "OTROS",
      },
    ],
    [],
  );

  const movementProviders: Array<{
    code: string;
    name: string;
    type?: FondoMovementType;
    category?: "Ingreso" | "Gasto" | "Egreso";
    correonotifi?: string;
  }> = isCajaNegra
    ? cajaNegraProviders
    : (providers as Array<{
        code: string;
        name: string;
        type?: FondoMovementType;
        category?: "Ingreso" | "Gasto" | "Egreso";
        correonotifi?: string;
      }>);
  const movementProvidersLoading = isCajaNegra ? false : providersLoading;

  const fgSchedulesMonthCacheRef = useRef<
    Map<
      string,
      {
        at: number;
        promise: Promise<
          Awaited<
            ReturnType<typeof SchedulesService.getSchedulesByLocationYearMonth>
          >
        >;
      }
    >
  >(new Map());
  const FG_SCHEDULES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min
  const getFGMonthlySchedulesCached = useCallback(
    async (locationValue: string, year: number, month0: number) => {
      const key = `${locationValue}__${year}__${month0}`;
      const now = Date.now();
      const cached = fgSchedulesMonthCacheRef.current.get(key);
      if (cached && now - cached.at < FG_SCHEDULES_CACHE_TTL_MS) {
        return cached.promise;
      }
      const promise = SchedulesService.getSchedulesByLocationYearMonth(
        locationValue,
        year,
        month0,
      );
      fgSchedulesMonthCacheRef.current.set(key, { at: now, promise });
      return promise;
    },
    [],
  );

  const activeEmpresaForCompany = useMemo(() => {
    const normalizeCompanyKey = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase();

    const normalizedSelected = normalizeCompanyKey(company);
    if (!normalizedSelected) return null;

    const matches = ownerCompanies.filter((emp) => {
      const candidates = [emp?.name, emp?.ubicacion, emp?.id]
        .map(normalizeCompanyKey)
        .filter(Boolean);
      return candidates.includes(normalizedSelected);
    });

    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];

    const score = (emp: Empresas) => {
      const name = normalizeCompanyKey(emp?.name);
      const ubicacion = normalizeCompanyKey(emp?.ubicacion);
      const id = normalizeCompanyKey(emp?.id);
      const exact =
        normalizedSelected === name ||
        normalizedSelected === ubicacion ||
        normalizedSelected === id
          ? 3
          : 0;
      const hasOpen = String(emp?.horarioApertura || "").trim() ? 2 : 0;
      const hasClose = String(emp?.horarioCierre || "").trim() ? 2 : 0;
      const hasEmployees =
        Array.isArray(emp?.empleados) && emp.empleados.length > 0 ? 1 : 0;
      return exact + hasOpen + hasClose + hasEmployees;
    };

    let best = matches[0];
    let bestScore = score(best);
    for (let i = 1; i < matches.length; i++) {
      const cur = matches[i];
      const curScore = score(cur);
      if (curScore > bestScore) {
        best = cur;
        bestScore = curScore;
      }
    }

    return best;
  }, [company, ownerCompanies]);

  const [missingShiftModalOpen, setMissingShiftModalOpen] = useState(false);
  const [missingShiftExpectedShift, setMissingShiftExpectedShift] =
    useState<ShiftCode>("D");
  const [missingShiftDateKey, setMissingShiftDateKey] = useState("");

  const isDelifoodCompany = useMemo(() => {
    const normalize = (value: unknown) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");

    const normalizedCompany = normalize(company);
    const normalizedEmpresaName = normalize(activeEmpresaForCompany?.name);

    return normalizedCompany === "delifood" || normalizedEmpresaName === "delifood";
  }, [activeEmpresaForCompany?.name, company]);

  const [fondoTypesLoaded, setFondoTypesLoaded] = useState(false);
  const [ingresoTypes, setIngresoTypes] = useState<string[]>([]);
  const [gastoTypes, setGastoTypes] = useState<string[]>([]);
  const [egresoTypes, setEgresoTypes] = useState<string[]>([]);

  const [fondoEntries, setFondoEntries] = useState<FondoEntry[]>([]);
  const [companyEmployees, setCompanyEmployees] = useState<string[]>([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [superAdminUsers, setSuperAdminUsers] = useState<User[]>([]);
  const [superAdminUsersLoading, setSuperAdminUsersLoading] = useState(false);

  const [selectedProvider, setSelectedProvider] = useState("");
  const [selectedProviderPendingNcCount, setSelectedProviderPendingNcCount] =
    useState(0);
  const [
    selectedProviderPendingCreditNotes,
    setSelectedProviderPendingCreditNotes,
  ] = useState<PendingCreditNoteOption[]>([]);
  const [selectedAppliedCreditNoteIds, setSelectedAppliedCreditNoteIds] =
    useState<string[]>([]);
  const [selectedPendingCreditInvoiceIds, setSelectedPendingCreditInvoiceIds] =
    useState<string[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const defaultPaymentType: FondoEntry["paymentType"] =
    mode === "ingreso"
      ? FONDO_INGRESO_TYPES[0]
      : mode === "egreso"
        ? FONDO_EGRESO_TYPES[0]
        : "COMPRA INVENTARIO";
  const [paymentType, setPaymentType] =
    useState<FondoEntry["paymentType"]>(defaultPaymentType);
  const [egreso, setEgreso] = useState("");
  const [ingreso, setIngreso] = useState("");
  const [manager, setManager] = useState("");
  const [manager2, setManager2] = useState("");
  const [notes, setNotes] = useState("");
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [initialAmount, setInitialAmount] = useState("0");
  const [initialAmountUSD, setInitialAmountUSD] = useState("0");
  // Snapshot de balances persistidos. NO depende de `fondoEntries` para evitar
  // que filtros (rango de fecha) alteren el currentBalance.
  const [ledgerSnapshot, setLedgerSnapshot] = useState<{
    initialCRC: number;
    currentCRC: number;
    initialUSD: number;
    currentUSD: number;
  }>(() => ({
    initialCRC: 0,
    currentCRC: 0,
    initialUSD: 0,
    currentUSD: 0,
  }));
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [movementAutoCloseLocked, setMovementAutoCloseLocked] = useState(false);
  const [movementCurrency, setMovementCurrency] = useState<"CRC" | "USD">(
    "CRC",
  );
  const [invoiceDocType, setInvoiceDocType] = useState<"FCO" | "FCR">("FCO");
  const [providerError, setProviderError] = useState("");
  const [invoiceError, setInvoiceError] = useState("");
  const [amountError, setAmountError] = useState("");
  const [managerError, setManagerError] = useState("");
  const [manager2Error, setManager2Error] = useState("");
  const [managerLockedByShift, setManagerLockedByShift] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!company || !selectedProvider) {
      setSelectedProviderPendingNcCount(0);
      setSelectedProviderPendingCreditNotes([]);
      setSelectedAppliedCreditNoteIds([]);
      return () => {
        cancelled = true;
      };
    }

    setSelectedProviderPendingNcCount(0);
    setSelectedProviderPendingCreditNotes([]);
    setSelectedAppliedCreditNoteIds([]);

    FacturasService.listMovementsByEmpresa(company, { limit: 800 })
      .then((items) => {
        if (cancelled) return;
        let pendingNotesCount = 0;
        const pendingNotes = items.reduce<PendingCreditNoteOption[]>(
          (acc, movement) => {
            if (movement.providerCode !== selectedProvider) return acc;
            if (
              String(movement.invoiceDocType || "")
                .trim()
                .toUpperCase() !== "NC"
            ) {
              return acc;
            }
            if (
              ["PAGADA", "REBAJADA"].includes(
                String(movement.paymentStatus || "PENDIENTE").toUpperCase(),
              )
            ) {
              return acc;
            }

            pendingNotesCount += 1;

            const balanceDue = Math.max(
              0,
              Math.trunc(Number(movement.balanceDue) || 0),
            );
            const amount = Math.max(
              0,
              Math.trunc(Number(movement.amount) || 0),
            );
            const paidAmount = Math.max(
              0,
              Math.trunc(Number(movement.paidAmount) || 0),
            );
            const pendingBalance =
              balanceDue > 0 ? balanceDue : Math.max(0, amount - paidAmount);

            if (pendingBalance > 0 || amount === 0) {
              acc.push({
                id: movement.id,
                invoiceNumber: movement.invoiceNumber,
                amount,
                balanceDue: pendingBalance,
                paidAmount,
                currency: movement.currency === "USD" ? "USD" : "CRC",
              });
            }
            return acc;
          },
          [],
        );

        setSelectedProviderPendingCreditNotes(pendingNotes);
        setSelectedProviderPendingNcCount(pendingNotesCount);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("[FONDO] Error checking pending credit notes:", error);
          setSelectedProviderPendingNcCount(0);
          setSelectedProviderPendingCreditNotes([]);
          setSelectedAppliedCreditNoteIds([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company, selectedProvider]);
  const [dailyClosingModalOpen, setDailyClosingModalOpen] = useState(false);
  const [editingDailyClosingId, setEditingDailyClosingId] = useState<
    string | null
  >(null);
  const [dailyClosingInitialValues, setDailyClosingInitialValues] =
    useState<DailyClosingFormValues | null>(null);
  const [dailyClosings, setDailyClosings] = useState<DailyClosingRecord[]>([]);
  const [dailyClosingsHydrated, setDailyClosingsHydrated] = useState(false);
  const [dailyClosingsRefreshing, setDailyClosingsRefreshing] = useState(false);
  const [dailyClosingHistoryOpen, setDailyClosingHistoryOpen] = useState(false);
  const [dailyClosingHistoryRange, setDailyClosingHistoryRange] =
    useState<string>("today");
  const [pendingClosingCreditInvoices, setPendingClosingCreditInvoices] =
    useState<FacturaMovement[]>([]);
  const [
    showPendingClosingCreditInvoices,
    setShowPendingClosingCreditInvoices,
  ] = useState(false);
  const [closingPaymentModalOpen, setClosingPaymentModalOpen] = useState(false);
  const [closingPaymentTarget, setClosingPaymentTarget] =
    useState<FacturaMovement | null>(null);
  const [closingPaymentAmount, setClosingPaymentAmount] = useState("");
  const [closingPaymentNotes, setClosingPaymentNotes] = useState("");
  const [closingPaymentManager2, setClosingPaymentManager2] = useState("");
  const [closingPaymentCreditNoteIds, setClosingPaymentCreditNoteIds] =
    useState<string[]>([]);
  const [closingPaymentSubmitting, setClosingPaymentSubmitting] =
    useState(false);
  const [expandedClosings, setExpandedClosings] = useState<Set<string>>(
    new Set(),
  );
  const [expandedFcrInfoRows, setExpandedFcrInfoRows] = useState<Set<string>>(
    new Set(),
  );
  const [expandedAppliedCreditNotesRows, setExpandedAppliedCreditNotesRows] =
    useState<Set<string>>(new Set());
  const [manualCreditNoteOpen, setManualCreditNoteOpen] = useState(false);
  const [manualCreditNoteTarget, setManualCreditNoteTarget] =
    useState<FondoEntry | null>(null);
  const [manualCreditNoteInvoiceNumber, setManualCreditNoteInvoiceNumber] =
    useState("");
  const [manualCreditNoteAmount, setManualCreditNoteAmount] = useState("");
  const [manualCreditNoteObservation, setManualCreditNoteObservation] =
    useState("");
  const [manualCreditNoteSaving, setManualCreditNoteSaving] = useState(false);
  const [manualCreditNoteError, setManualCreditNoteError] = useState("");
  const [manualCreditNoteDraft, setManualCreditNoteDraft] = useState<{
    invoiceNumber: string;
    amount: number;
    observation?: string;
  } | null>(null);
  const [pendingCierreDeCaja, setPendingCierreDeCaja] = useState(false);
  const [pendingCierreModalOpen, setPendingCierreModalOpen] = useState(false);
  const [pendingZeroAmountCreditNotes, setPendingZeroAmountCreditNotes] =
    useState<FacturaMovement[]>([]);
  const [
    pendingZeroAmountCreditNoteModalOpen,
    setPendingZeroAmountCreditNoteModalOpen,
  ] = useState(false);
  const [negativeBalanceModal, setNegativeBalanceModal] = useState<{
    open: boolean;
    amount: number;
    currency: "CRC" | "USD";
    resultingNegativeAmount: number;
  }>({ open: false, amount: 0, currency: "CRC", resultingNegativeAmount: 0 });

  const dailyClosingsRequestCountRef = useRef(0);
  const dailyClosingHistoryRequestIdRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  const loadedDailyClosingKeysRef = useRef<Set<string>>(new Set());
  const loadingDailyClosingKeysRef = useRef<Set<string>>(new Set());
  const lastEditSaveTimestampRef = useRef<number>(0);
  const editingInProgressRef = useRef<boolean>(false);
  const dailyClosingSubmitInProgressRef = useRef<boolean>(false);
  const lastDailyClosingSavedAtRef = useRef<number>(0);
  const movementSubmitInProgressRef = useRef<boolean>(false);
  const lastMovementDedupeRef = useRef<{
    at: number;
    fingerprint: string;
  } | null>(null);
  const lastMovementCreatedAtRef = useRef<number>(0);
  const deleteLatestClosingInProgressRef = useRef<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    if (!company) {
      setPendingClosingCreditInvoices([]);
      setPendingZeroAmountCreditNotes([]);
      return () => {
        cancelled = true;
      };
    }

    FacturasService.listMovementsByEmpresa(company, { limit: 800 })
      .then((movements) => {
        if (cancelled) return;
        const pending = movements
          .filter((movement) => {
            if (normalizeInvoiceDocType(movement.invoiceDocType) !== "FCR") {
              return false;
            }
            const totalAmount = Math.max(
              0,
              Math.trunc(
                Number(movement.originalAmount ?? movement.amount) || 0,
              ),
            );
            const paidAmount = Math.max(
              0,
              Math.trunc(Number(movement.paidAmount) || 0),
            );
            const balanceDue = Math.max(
              0,
              Math.trunc(
                Number(movement.balanceDue ?? totalAmount - paidAmount) || 0,
              ),
            );
            return (
              balanceDue > 0 &&
              !["PAGADA", "REBAJADA"].includes(
                String(movement.paymentStatus || "").toUpperCase(),
              )
            );
          })
          .sort((a, b) => {
            const aDate = new Date(a.createdAt || 0).getTime();
            const bDate = new Date(b.createdAt || 0).getTime();
            return bDate - aDate;
          });
        setPendingClosingCreditInvoices(pending);
        const pendingZeroNotes = movements.filter((movement) => {
          if (normalizeInvoiceDocType(movement.invoiceDocType) !== "NC") {
            return false;
          }
          if (Math.max(0, Math.trunc(Number(movement.amount) || 0)) !== 0) {
            return false;
          }
          return !["PAGADA", "REBAJADA"].includes(
            String(movement.paymentStatus || "PENDIENTE").toUpperCase(),
          );
        });
        setPendingZeroAmountCreditNotes(pendingZeroNotes);
      })
      .catch((error) => {
        console.error("[FONDO] Error loading pending credit invoices:", error);
        if (!cancelled) {
          setPendingClosingCreditInvoices([]);
          setPendingZeroAmountCreditNotes([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [company]);

  const zxq_plm = (() => {
    const a9f = (() => {
      const k = [2, 5, 10];
      return k.reduce((x, y) => x * y, 1);
    })();

    const b1r = (() => {
      const p = Math.pow(10, 3);
      const q = parseInt("1");
      return p * q;
    })();

    const c7t = (() => {
      return (b1r * a9f) / 100;
    })();

    const d2m = (() => {
      const arr = Array.from({ length: 6 }, (_, i) => i + 5);
      const sum = arr.reduce((u, v) => u + v, 0);
      return c7t * (sum / 0.75);
    })();

    return Array.from({ length: 1 })
      .map(() => d2m)
      .reduce((acc, val) => acc + val, 0);
  })();

  const r7n_vyx = (() => {
    const j3k = (() => {
      const x = Math.pow(10, 3);
      const y = parseInt("1");
      return x * y;
    })();

    const h8p = j3k;

    const w0s = (() => {
      const list = Array.from({ length: 6 }, (_, i) => i + 5);
      const total = list.reduce((a, b) => a + b, 0);
      return h8p * (total / 0.75);
    })();

    return (() => w0s)();
  })();

  const k91_xad = (() => {
    const v2c = Math.pow(10, 3);

    const zFunc = (n: number): number => (n <= 1 ? v2c : zFunc(n - 1) + v2c);

    return zFunc(60);
  })();

  const m3p_zz0 = (() => {
    const u8n = (() => {
      const arr = [2, 5, 10];
      return arr.reduce((a, b) => a * b, 1);
    })();

    const y5d = Math.pow(10, 3) * parseInt("1");

    const i4x = (y5d * u8n) / 100;

    const o9l = (() => {
      const seq = Array.from({ length: 6 }, (_, i) => i + 5);
      const s = seq.reduce((a, b) => a + b, 0);
      return i4x * (s / 0.75);
    })();

    const calc = (n: number, val: number) =>
      Array.from({ length: n })
        .map(() => val)
        .reduce((a, b) => a + b, 0);

    const res = calc(30, o9l);

    return ((z: number) => z)(res);
  })();

  const buildClosingGuardDocId = useCallback(
    (normalizedCompany: string, kind: ClosingGuardKind) => {
      // Ensure a Firestore-safe doc id (avoid '/').
      // Include kind so Fondo Ventas and Fondo General are distinct locks.
      const companyPart = encodeURIComponent(
        normalizedCompany.trim().toLowerCase(),
      );
      return `${companyPart}__${kind}`;
    },
    [],
  );

  const acquireClosingGuard = useCallback(
    async (
      normalizedCompany: string,
      kind: ClosingGuardKind,
    ): Promise<
      | { ok: true; token: string; docId: string }
      | {
          ok: false;
          remainingSec: number;
          lockedKind?: ClosingGuardKind;
          lockedBy?: string;
        }
    > => {
      const docId = buildClosingGuardDocId(normalizedCompany, kind);
      const lockRef = doc(db, "closingGuards", docId);
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      try {
        const result = await runTransaction(db, async (tx) => {
          const snap = await tx.get(lockRef);
          const nowMs = Date.now();
          const current = snap.exists() ? (snap.data() as any) : null;
          const lockedUntilMs = Number(current?.lockedUntilMs || 0);
          const lockedKind =
            (current?.kind as ClosingGuardKind | undefined) ?? undefined;
          const lockedBy =
            typeof current?.by === "string" ? current.by : undefined;
          const lockedToken =
            typeof current?.token === "string" ? current.token : undefined;

          if (lockedUntilMs > nowMs && lockedToken && lockedToken.length > 0) {
            const remainingSec = Math.max(
              1,
              Math.ceil((lockedUntilMs - nowMs) / 1000),
            );
            return { ok: false as const, remainingSec, lockedKind, lockedBy };
          }

          tx.set(
            lockRef,
            {
              token,
              kind,
              lockedUntilMs: nowMs + m3p_zz0,
              by: (user?.email || user?.id || "").toString(),
              startedAt: serverTimestamp(),
            },
            { merge: true },
          );
          return { ok: true as const };
        });

        if (!result.ok) return result;
        return { ok: true, token, docId };
      } catch (err) {
        console.error("[CLOSING-GUARD] Error acquiring closing guard:", err);
        // Fail-open to avoid blocking all closings if Firestore is unreachable.
        // Client-side cooldowns still reduce duplicates in this scenario.
        return { ok: true, token, docId };
      }
    },
    [buildClosingGuardDocId, m3p_zz0, user],
  );

  // Touch/update the guard without enforcing it.
  // Used so that when an admin/superadmin creates a closing, regular users are still blocked
  // for the lock window, but admins are never prevented from creating a new closing.
  const touchClosingGuard = useCallback(
    async (
      normalizedCompany: string,
      kind: ClosingGuardKind,
    ): Promise<void> => {
      const docId = buildClosingGuardDocId(normalizedCompany, kind);
      const lockRef = doc(db, "closingGuards", docId);
      const token = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

      try {
        await runTransaction(db, async (tx) => {
          const nowMs = Date.now();
          tx.set(
            lockRef,
            {
              token,
              kind,
              lockedUntilMs: nowMs + m3p_zz0,
              by: (user?.email || user?.id || "").toString(),
              startedAt: serverTimestamp(),
            },
            { merge: true },
          );
        });
      } catch (err) {
        console.error("[CLOSING-GUARD] Error touching closing guard:", err);
      }
    },
    [buildClosingGuardDocId, m3p_zz0, user],
  );

  const releaseClosingGuard = useCallback(
    async (
      normalizedCompany: string,
      guard: { token: string; docId: string },
    ) => {
      const lockRef = doc(db, "closingGuards", guard.docId);
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(lockRef);
          if (!snap.exists()) return;
          const current = snap.data() as any;
          if (current?.token !== guard.token) return;
          tx.set(
            lockRef,
            {
              token: "",
              lockedUntilMs: 0,
              releasedAt: serverTimestamp(),
            },
            { merge: true },
          );
        });
      } catch (err) {
        console.error("[CLOSING-GUARD] Error releasing closing guard:", err);
      }
    },
    [],
  );

  // Force-clear any existing lock (ignores current token) so remaining time becomes 0 immediately.
  // Used after deleting closings so users can re-create them right away.
  const forceClearClosingGuards = useCallback(
    async (normalizedCompany: string, context: string) => {
      try {
        const fgDocId = buildClosingGuardDocId(
          normalizedCompany,
          "FONDO_GENERAL",
        );
        const fvDocId = buildClosingGuardDocId(
          normalizedCompany,
          "FONDO_VENTAS",
        );
        const fgRef = doc(db, "closingGuards", fgDocId);
        const fvRef = doc(db, "closingGuards", fvDocId);
        const by = (user?.email || user?.id || "").toString();

        await runTransaction(db, async (tx) => {
          tx.set(
            fgRef,
            {
              kind: "FONDO_GENERAL",
              token: "",
              lockedUntilMs: 0,
              clearedAt: serverTimestamp(),
              clearedBy: by,
              clearedContext: context,
            },
            { merge: true },
          );
          tx.set(
            fvRef,
            {
              kind: "FONDO_VENTAS",
              token: "",
              lockedUntilMs: 0,
              clearedAt: serverTimestamp(),
              clearedBy: by,
              clearedContext: context,
            },
            { merge: true },
          );
        });
      } catch (err) {
        console.error(
          "[CLOSING-GUARD] Error force-clearing closing guards:",
          err,
        );
      }
    },
    [buildClosingGuardDocId, user],
  );

  const [pageSize, setPageSize] = useState<"daily" | number | "all">(() => {
    if (typeof window !== "undefined") {
      try {
        const remember = localStorage.getItem("fondogeneral-rememberFilters");
        if (remember === "true") {
          const saved = localStorage.getItem("fondogeneral-pageSize");
          if (saved === null) return "daily";
          if (saved === "daily" || saved === "all") return saved as any;
          const n = Number.parseInt(saved, 10);
          if (!Number.isNaN(n) && n > 0) return n;
        }
      } catch {
        // ignore storage errors
      }
    }
    return "daily";
  });
  const [pageIndex, setPageIndex] = useState(0);
  const [currentDailyKey, setCurrentDailyKey] = useState(() =>
    dateKeyFromDate(new Date()),
  );
  const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

  const beginDailyClosingsRequest = useCallback(() => {
    dailyClosingsRequestCountRef.current += 1;
    setDailyClosingsRefreshing(true);
  }, []);

  const finishDailyClosingsRequest = useCallback(() => {
    dailyClosingsRequestCountRef.current = Math.max(
      0,
      dailyClosingsRequestCountRef.current - 1,
    );
    if (!isComponentMountedRef.current) return;
    if (dailyClosingsRequestCountRef.current === 0) {
      setDailyClosingsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);
  const [entriesHydrated, setEntriesHydrated] = useState(false);
  const [hydratedCompany, setHydratedCompany] = useState("");
  const [hydratedAccountKey, setHydratedAccountKey] =
    useState<MovementAccountKey>(accountKey);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const movementsLoadingCountRef = useRef(0);
  const beginMovementsLoading = useCallback(() => {
    movementsLoadingCountRef.current += 1;
    setMovementsLoading(true);
  }, []);
  const endMovementsLoading = useCallback(() => {
    movementsLoadingCountRef.current = Math.max(
      0,
      movementsLoadingCountRef.current - 1,
    );
    if (!isComponentMountedRef.current) return;
    if (movementsLoadingCountRef.current === 0) {
      setMovementsLoading(false);
    }
  }, []);
  const [currencyEnabled, setCurrencyEnabled] = useState<
    Record<MovementCurrencyKey, boolean>
  >({
    CRC: true,
    USD: true,
  });
  const [companyData, setCompanyData] = useState<Empresas | null>(null);
  const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<{
    open: boolean;
    entry: FondoEntry | null;
  }>({
    open: false,
    entry: null,
  });
  const [confirmOpenCreateMovement, setConfirmOpenCreateMovement] =
    useState(false);

  // Modal: primer movimiento después del último cierre de Fondo General
  const [confirmPhysicalCountOpen, setConfirmPhysicalCountOpen] =
    useState(false);
  const [physicalCountWasDone, setPhysicalCountWasDone] = useState(false);
  // Estado para indicar que se está guardando un movimiento y prevenir múltiples envíos
  const [isSaving, setIsSaving] = useState(false);
  const enabledBalanceCurrencies = useMemo(
    () =>
      (["CRC", "USD"] as MovementCurrencyKey[]).filter(
        (currency) => currencyEnabled[currency],
      ),
    [currencyEnabled],
  );

  // Marca en localStorage para confirmar conteo físico antes del primer movimiento
  // después del cierre de hoy. IMPORTANTE: debe leerse en tiempo real (no memoizada)
  // porque localStorage puede cambiar sin alterar dependencias de React.
  // Legacy keys (previous formats)
  const buildLegacyPhysicalCountStorageKey = useCallback(() => {
    if (accountKey !== "FondoGeneral") return null;
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) return null;
    // Legacy format (no date, with accountKey)
    return `fondogeneral-lastClosing:${normalizedCompany}:${accountKey}`;
  }, [company, accountKey]);

  // New key: one per company (feature only applies to FondoGeneral)
  const buildPhysicalCountStorageKey = useCallback(() => {
    if (accountKey !== "FondoGeneral") return null;
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) return null;
    return `fondogeneral-lastClosing:${normalizedCompany}`;
  }, [company, accountKey]);

  const cleanupPhysicalCountLegacyKeys = useCallback(() => {
    if (typeof window === "undefined") return;
    if (accountKey !== "FondoGeneral") return;
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) return;

    // Remove per-day keys: fondogeneral-lastClosing:<company>:FondoGeneral:<YYYY-MM-DD>
    const dateScopedPrefix = `fondogeneral-lastClosing:${normalizedCompany}:FondoGeneral:`;
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k && k.startsWith(dateScopedPrefix)) {
          localStorage.removeItem(k);
        }
      }
    } catch {
      // ignore
    }

    // Also remove legacy key (no date, with accountKey)
    try {
      const legacyKey = buildLegacyPhysicalCountStorageKey();
      if (legacyKey) localStorage.removeItem(legacyKey);
    } catch {
      // ignore
    }
  }, [accountKey, company, buildLegacyPhysicalCountStorageKey]);

  const shouldPromptPhysicalCount = useCallback((): boolean => {
    if (accountKey !== "FondoGeneral") return false;
    if (typeof window === "undefined") return false;

    const newKey = buildPhysicalCountStorageKey();
    if (!newKey) return false;

    const normalizeBoolean = (raw: string | null): boolean | null => {
      if (raw === "true") return true;
      if (raw === "false") return false;
      if (raw === null) return null;
      return null;
    };

    const tryMigrateLegacyValue = (raw: string | null): boolean => {
      const asBool = normalizeBoolean(raw);
      if (asBool === true) return true;
      if (asBool === false || raw === null) return false;

      // Compatibilidad con el formato anterior: JSON { dateKey, id, at }
      try {
        const parsed = JSON.parse(raw) as any;
        // Si hay un JSON, asumir que hubo cierre => pedir confirmación.
        // En el esquema anterior esto era por día; ahora lo volvemos global.
        return Boolean(parsed);
      } catch {
        return false;
      }
    };

    try {
      // New format: value "true"/"false" (global per company)
      const rawNew = localStorage.getItem(newKey);
      const boolNew = normalizeBoolean(rawNew);
      if (boolNew !== null) return boolNew;

      // If for some reason JSON was stored in the new key, treat it as pending.
      if (tryMigrateLegacyValue(rawNew)) {
        localStorage.setItem(newKey, "true");
        return true;
      }

      // Migrate legacy key (no date, with accountKey)
      const legacyKey = buildLegacyPhysicalCountStorageKey();
      const rawLegacy = legacyKey ? localStorage.getItem(legacyKey) : null;
      const legacyPending = tryMigrateLegacyValue(rawLegacy);

      // Migrate date-scoped keys (older format): if any is true, make it global.
      const normalizedCompany = (company || "").trim();
      const dateScopedPrefix = `fondogeneral-lastClosing:${normalizedCompany}:FondoGeneral:`;
      let dateScopedPending = false;
      if (normalizedCompany.length > 0) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (!k || !k.startsWith(dateScopedPrefix)) continue;
          const v = localStorage.getItem(k);
          if (normalizeBoolean(v) === true || tryMigrateLegacyValue(v)) {
            dateScopedPending = true;
            break;
          }
        }
      }

      const pending = legacyPending || dateScopedPending;
      if (pending) {
        localStorage.setItem(newKey, "true");
      }

      // Cleanup old keys to enforce the new single-key scheme
      cleanupPhysicalCountLegacyKeys();

      return pending;
    } catch {
      return false;
    }
  }, [
    accountKey,
    buildPhysicalCountStorageKey,
    buildLegacyPhysicalCountStorageKey,
    cleanupPhysicalCountLegacyKeys,
    company,
  ]);
  const closingsStorageKey = useMemo(() => {
    if (accountKey !== "FondoGeneral") return null;
    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) return null;
    return buildDailyClosingStorageKey(normalizedCompany, accountKey);
  }, [company, accountKey]);
  // Audit modal state: show full before/after history when an edited entry is clicked
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const [auditModalData, setAuditModalData] = useState<{
    history?: any[];
  } | null>(null);
  // sortAsc: when true we show oldest first (so newest appears at the bottom).
  // Default (new UX): show most recent movement at the TOP.
  const [sortAsc, setSortAsc] = useState(() => {
    if (typeof window !== "undefined") {
      // Migration note:
      // Older builds wrote the default value to localStorage even if the user never toggled.
      // We only respect the saved value if the user explicitly interacted with the toggle.
      const touched = localStorage.getItem("fondogeneral-sortAscTouched");
      const saved = localStorage.getItem("fondogeneral-sortAsc");
      if (touched === "true" && saved !== null) return JSON.parse(saved);
      return false;
    }
    return false;
  });

  // Date range filters (YYYY-MM-DD). Only query the remote range when BOTH are set.
  const [fromFilter, setFromFilter] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fondogeneral-fromFilter");
      return saved ? saved : null;
    }
    return null;
  });
  const [toFilter, setToFilter] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fondogeneral-toFilter");
      return saved ? saved : null;
    }
    return null;
  });
  const storageSnapshotRef = useRef<MovementStorage<FondoEntry> | null>(null);

  // Keep latest accountKey without re-triggering full remote reloads on tab switch.
  const accountKeyRef = useRef<MovementAccountKey>(accountKey);
  useEffect(() => {
    accountKeyRef.current = accountKey;
  }, [accountKey]);

  const applyLedgerStateFromStorage = useCallback(
    (state?: MovementStorageState | null) => {
      if (!state) return;

      const parseBalance = (value: unknown) => {
        const parsed = typeof value === "number" ? value : Number(value);
        return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
      };

      const resolveSettings = (currency: MovementCurrencyKey) => {
        const accountBalance = state.balancesByAccount?.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === currency,
        );
        return {
          enabled: accountBalance?.enabled ?? true,
          initialBalance: parseBalance(accountBalance?.initialBalance ?? 0),
          currentBalance: parseBalance(accountBalance?.currentBalance ?? 0),
        };
      };

      const crcSettings = resolveSettings("CRC");
      const usdSettings = resolveSettings("USD");

      setCurrencyEnabled({
        CRC: crcSettings.enabled,
        USD: usdSettings.enabled,
      });

      setInitialAmount(crcSettings.initialBalance.toString());
      setInitialAmountUSD(usdSettings.initialBalance.toString());

      setLedgerSnapshot({
        initialCRC: crcSettings.initialBalance,
        currentCRC: crcSettings.currentBalance,
        initialUSD: usdSettings.initialBalance,
        currentUSD: usdSettings.currentBalance,
      });
    },
    [accountKey],
  );

  // Cache v2 movements per companyKey to avoid re-reading the whole subcollection when switching tabs.
  // Also stores a Firestore cursor so we can load more pages only when needed.
  const v2MovementsCacheRef = useRef<
    Record<
      string,
      {
        loaded: boolean;
        movements: FondoEntry[];
        cursor: QueryDocumentSnapshot<DocumentData> | null;
        exhausted: boolean;
        loading: boolean;
        queryKey?: string;
        startIso?: string;
        endIsoExclusive?: string;
      }
    >
  >({});

  const buildV2MovementsCacheKey = useCallback(
    (docKey: string, targetAccountKey: MovementAccountKey) =>
      `${docKey}::${targetAccountKey}`,
    [],
  );

  const buildLocalDayIsoRange = useCallback((isoDateKey: string) => {
    const [yStr, mStr, dStr] = String(isoDateKey || "").split("-");
    const y = Number(yStr);
    const m = Number(mStr);
    const d = Number(dStr);

    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
      const now = new Date();
      const start = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate(),
        0,
        0,
        0,
        0,
      );
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      return {
        startIso: start.toISOString(),
        endIsoExclusive: end.toISOString(),
      };
    }

    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return {
      startIso: start.toISOString(),
      endIsoExclusive: end.toISOString(),
    };
  }, []);

  const resolveActiveMovementsQuery = useCallback((): {
    queryKey: string;
    startIso: string;
    endIsoExclusive: string;
  } => {
    if (fromFilter && toFilter) {
      const fromKey = fromFilter.trim();
      const toKey = toFilter.trim();
      const startKey = fromKey > toKey ? toKey : fromKey;
      const endKey = fromKey > toKey ? fromKey : toKey;
      const startRange = buildLocalDayIsoRange(startKey);
      const endRange = buildLocalDayIsoRange(endKey);
      return {
        queryKey: `range:${startKey}..${endKey}`,
        startIso: startRange.startIso,
        endIsoExclusive: endRange.endIsoExclusive,
      };
    }

    const dayKey = pageSize === "daily" ? currentDailyKey : todayKey;
    const range = buildLocalDayIsoRange(dayKey);
    return {
      queryKey: `day:${dayKey}`,
      startIso: range.startIso,
      endIsoExclusive: range.endIsoExclusive,
    };
  }, [
    fromFilter,
    toFilter,
    pageSize,
    currentDailyKey,
    todayKey,
    buildLocalDayIsoRange,
  ]);

  const resolveV2DocKey = useCallback(() => {
    const normalizedCompany = (company || "").trim();
    const companyKey =
      MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
    const legacyOwnerKey = resolvedOwnerId
      ? MovimientosFondosService.buildLegacyOwnerMovementsKey(resolvedOwnerId)
      : null;

    const targetAccountKey = accountKeyRef.current;
    const companyCacheKey = buildV2MovementsCacheKey(
      companyKey,
      targetAccountKey,
    );
    const legacyCacheKey = legacyOwnerKey
      ? buildV2MovementsCacheKey(legacyOwnerKey, targetAccountKey)
      : null;

    if (v2MovementsCacheRef.current[companyCacheKey]?.loaded) return companyKey;
    if (
      legacyOwnerKey &&
      legacyCacheKey &&
      v2MovementsCacheRef.current[legacyCacheKey]?.loaded
    )
      return legacyOwnerKey;

    return companyKey || legacyOwnerKey || "";
  }, [company, resolvedOwnerId, buildV2MovementsCacheKey]);

  const rebuildEntriesFromV2Cache = useCallback(
    (docKey: string, targetAccountKey: MovementAccountKey) => {
      const cacheKey = buildV2MovementsCacheKey(docKey, targetAccountKey);
      const cached = v2MovementsCacheRef.current[cacheKey];
      if (!cached?.loaded) return;

      const scopedEntries = cached.movements.filter((rawEntry) => {
        const candidate = rawEntry as Partial<FondoEntry>;
        const movementAccount = isMovementAccountKey(candidate.accountId)
          ? candidate.accountId
          : targetAccountKey;
        return movementAccount === targetAccountKey;
      });

      const entries = sanitizeFondoEntries(
        scopedEntries,
        undefined,
        targetAccountKey,
      ).sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setFondoEntries(entries);

      const state = storageSnapshotRef.current?.state;
      if (state) {
        applyLedgerStateFromStorage(state);
      }
    },
    [applyLedgerStateFromStorage, buildV2MovementsCacheKey],
  );

  const ensureV2MovementsLoaded = useCallback(
    async (docKey: string, options?: { append?: boolean }) => {
      if (!docKey) return;

      const targetAccountKey = accountKeyRef.current;
      const cacheKey = buildV2MovementsCacheKey(docKey, targetAccountKey);
      const { queryKey, startIso, endIsoExclusive } =
        resolveActiveMovementsQuery();

      const cached = v2MovementsCacheRef.current[cacheKey] ?? {
        loaded: false,
        movements: [] as FondoEntry[],
        cursor: null as QueryDocumentSnapshot<DocumentData> | null,
        exhausted: false,
        loading: false,
        queryKey: undefined as string | undefined,
        startIso: undefined as string | undefined,
        endIsoExclusive: undefined as string | undefined,
      };

      if (cached.loading) return;

      const queryUnchanged =
        cached.loaded &&
        cached.queryKey === queryKey &&
        cached.startIso === startIso &&
        cached.endIsoExclusive === endIsoExclusive;

      const append = Boolean(options?.append);
      // If query params changed, we must reset regardless of append intent.
      if (queryUnchanged && !append) {
        rebuildEntriesFromV2Cache(docKey, targetAccountKey);
        return;
      }

      const computeRemoteBatchSize = () => {
        // Hard cap for daily mode per requirement.
        if (pageSize === "daily") return 100;
        // Never do unbounded reads; treat "all" as a capped batch.
        if (pageSize === "all") return 100;
        if (typeof pageSize === "number") {
          // Fetch a bit more than one UI page to reduce roundtrips, but keep it bounded.
          return Math.max(1, Math.min(100, Math.trunc(pageSize) * 3));
        }
        return 100;
      };

      const remoteBatchSize = computeRemoteBatchSize();

      console.log("[FG-QUERY] MovimientosFondos v2 query", {
        docKey,
        accountKey: targetAccountKey,
        queryKey,
        createdAt: {
          gte: startIso,
          lt: endIsoExclusive,
        },
        orderBy: "createdAt desc",
        pageSize: remoteBatchSize,
        append,
        ui: {
          pageSizeMode: pageSize,
          currentDailyKey,
          todayKey,
          fromFilter,
          toFilter,
        },
      });

      const shouldReset = !queryUnchanged || !append;
      const nextCache = {
        ...cached,
        loaded: false,
        movements: shouldReset ? ([] as FondoEntry[]) : cached.movements,
        cursor: shouldReset
          ? (null as QueryDocumentSnapshot<DocumentData> | null)
          : cached.cursor,
        exhausted: shouldReset ? false : cached.exhausted,
        loading: true,
        queryKey,
        startIso,
        endIsoExclusive,
      };

      v2MovementsCacheRef.current[cacheKey] = nextCache;
      beginMovementsLoading();

      try {
        const pageResult =
          await MovimientosFondosService.listMovementsPageByCreatedAtRange(
            docKey,
            {
              startIso,
              endIsoExclusive,
              pageSize: remoteBatchSize,
              cursor: shouldReset ? null : nextCache.cursor,
              accountId: targetAccountKey,
            },
          );

        const mergedMovements = shouldReset
          ? (pageResult.items as FondoEntry[])
          : [...nextCache.movements, ...(pageResult.items as FondoEntry[])];

        v2MovementsCacheRef.current[cacheKey] = {
          ...nextCache,
          loaded: true,
          movements: mergedMovements,
          cursor: pageResult.cursor,
          exhausted: pageResult.exhausted,
          loading: false,
        };
      } finally {
        const latest = v2MovementsCacheRef.current[cacheKey];
        if (latest) {
          v2MovementsCacheRef.current[cacheKey] = {
            ...latest,
            loading: false,
          };
        }
        endMovementsLoading();
      }

      rebuildEntriesFromV2Cache(docKey, targetAccountKey);
    },
    [
      rebuildEntriesFromV2Cache,
      beginMovementsLoading,
      endMovementsLoading,
      resolveActiveMovementsQuery,
      buildV2MovementsCacheKey,
      pageSize,
      currentDailyKey,
      todayKey,
      fromFilter,
      toFilter,
    ],
  );

  // When using numeric pagination, load more remote pages only if needed.
  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey();
    if (!docKey) return;
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
    const cached = v2MovementsCacheRef.current[cacheKey];
    if (!cached?.loaded || cached.loading || cached.exhausted) return;

    if (pageSize === "daily") return;

    if (pageSize === "all") {
      // "Todos" should keep fetching batches until the active range is exhausted.
      void ensureV2MovementsLoaded(docKey, { append: true });
      return;
    }

    if (typeof pageSize !== "number" || pageSize <= 0) return;

    const needed = (pageIndex + 1) * pageSize;
    if (cached.movements.length >= needed) return;

    // Append one more batch when user navigates past what we have.
    void ensureV2MovementsLoaded(docKey, { append: true });
  }, [
    entriesHydrated,
    pageSize,
    pageIndex,
    fondoEntries.length,
    accountKey,
    buildV2MovementsCacheKey,
    resolveV2DocKey,
    ensureV2MovementsLoaded,
  ]);

  useEffect(() => {
    localStorage.setItem("fondogeneral-sortAsc", JSON.stringify(sortAsc));
  }, [sortAsc]);

  // Calendar / day-filtering states (Desde / Hasta)
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

  // Advanced filters
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

  // Column widths for resizable columns (simple px based)
  const [columnWidths, setColumnWidths] = useState<Record<string, string>>({
    hora: "110px",
    motivo: "260px",
    tipo: "160px",
    factura: "70px",
    monto: "140px",
    encargado: "120px",
    editar: "120px",
  });
  const resizingRef = React.useRef<{
    key: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const filtersDropdownRef = React.useRef<HTMLDivElement | null>(null);
  // refs to detect outside clicks for the from/to calendar popovers
  const fromCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const toCalendarRef = React.useRef<HTMLDivElement | null>(null);
  const fromButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const toButtonRef = React.useRef<HTMLButtonElement | null>(null);

  const startResizing = (event: React.MouseEvent, key: string) => {
    event.preventDefault();
    const startWidth = parseInt(columnWidths[key] || "100", 10) || 100;
    resizingRef.current = { key, startX: event.clientX, startWidth };
  };

  // Cargar tipos de movimientos de fondo desde la base de datos (con caché y sincronización en tiempo real)
  useEffect(() => {
    let isMounted = true;

    // Función para cargar y actualizar tipos
    const loadTypes = async () => {
      try {
        const types =
          await FondoMovementTypesService.getMovementTypesByCategoriesWithCache(
            activeOwnerId,
          );

        if (!isMounted) return;

        setIngresoTypes(types.INGRESO);
        setGastoTypes(types.GASTO);
        setEgresoTypes(types.EGRESO);
        setFondoTypesLoaded(true);

        // Actualizar las variables globales para compatibilidad
        FONDO_INGRESO_TYPES = types.INGRESO;
        FONDO_GASTO_TYPES = types.GASTO;
        FONDO_EGRESO_TYPES = types.EGRESO;
        FONDO_TYPE_OPTIONS = [
          ...types.INGRESO,
          ...types.GASTO,
          ...types.EGRESO,
        ];

        // El paymentType de ajustes de cierre se normaliza al persistir.

        console.log("[FondoTypes] Loaded:", types);
      } catch (err) {
        console.error("Error loading fondo movement types:", err);
        if (isMounted) {
          setFondoTypesLoaded(true);
        }
      }
    };

    // Listener para actualizaciones en tiempo real desde el caché
    const handleFondoTypesUpdate = (event: Event) => {
      const eventOwnerId = String(
        (event as CustomEvent<{ ownerId?: string }>).detail?.ownerId || "",
      ).trim();
      if (activeOwnerId && eventOwnerId && eventOwnerId !== activeOwnerId) {
        return;
      }
      if (!isMounted) return;

      console.log("[FondoTypes] Cache updated, reloading types...");

      // Recargar tipos cuando el caché se actualiza
      loadTypes();
    };

    // Cargar tipos iniciales (desde caché o DB)
    loadTypes();

    // Escuchar actualizaciones en tiempo real
    window.addEventListener(
      "fondoMovementTypesUpdated",
      handleFondoTypesUpdate,
    );

    return () => {
      isMounted = false;
      window.removeEventListener(
        "fondoMovementTypesUpdated",
        handleFondoTypesUpdate,
      );
    };
  }, [activeOwnerId]);

  // Sincronizar filtro de proveedor con selección
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

  // Sincronizar filtro de tipo con selección
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

  // When rememberFilters is enabled, load pageSize from storage (if present)
  useEffect(() => {
    if (!rememberFilters) return;
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("fondogeneral-pageSize");
    if (saved === null) return;
    if (saved === "daily" || saved === "all") {
      setPageSize(saved as any);
      return;
    }
    const n = Number.parseInt(saved, 10);
    if (!Number.isNaN(n) && n > 0) setPageSize(n);
  }, [rememberFilters]);

  useEffect(() => {
    setCurrencyEnabled({ CRC: true, USD: true });
    setMovementCurrency("CRC");
    setInitialAmount("0");
    setInitialAmountUSD("0");
    storageSnapshotRef.current = null;
  }, [company, accountKey]);

  useEffect(() => {
    if (currencyEnabled[movementCurrency]) return;
    if (currencyEnabled.CRC) {
      setMovementCurrency("CRC");
      return;
    }
    if (currencyEnabled.USD) {
      setMovementCurrency("USD");
    }
  }, [currencyEnabled, movementCurrency]);

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

  // Close calendars when clicking outside them (but don't close when clicking the toggle buttons)
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

  const isIngreso = isIngresoType(paymentType);
  const isEgreso = isEgresoType(paymentType) || isGastoType(paymentType);

  useEffect(() => {
    let isActive = true;

    // Only needed when a superadmin is editing a movement, to allow selecting ANY user.
    if (!isSuperAdminUser || !editingEntryId) {
      setSuperAdminUsers([]);
      setSuperAdminUsersLoading(false);
      return () => {
        isActive = false;
      };
    }

    setSuperAdminUsersLoading(true);
    UsersService.getUsersOrderedByName()
      .then((users) => {
        if (!isActive) return;
        setSuperAdminUsers(Array.isArray(users) ? users : []);
      })
      .catch((err) => {
        console.error(
          "Error loading users for superadmin manager selector:",
          err,
        );
        if (!isActive) return;
        setSuperAdminUsers([]);
      })
      .finally(() => {
        if (isActive) setSuperAdminUsersLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [isSuperAdminUser, editingEntryId]);

  // Superadmin: when creating a movement, auto-assign the manager to themselves.
  useEffect(() => {
    if (!isSuperAdminUser) return;
    if (!movementModalOpen) return;
    if (editingEntryId) return;

    const fallback = (user?.email || "").trim();
    const name = (user?.name || "").trim() || fallback;
    if (!name) return;

    if (manager !== name) {
      setManager(name);
      setManagerError("");
    }
  }, [
    isSuperAdminUser,
    movementModalOpen,
    editingEntryId,
    user?.name,
    user?.email,
    manager,
  ]);

  const employeeOptions = useMemo(() => {
    // Superadmin + editing: allow selecting ANY user.
    if (isSuperAdminUser && editingEntryId) {
      const unique = new Set<string>();
      const push = (value: unknown) => {
        const name = String(value || "").trim();
        if (name) unique.add(name);
      };

      superAdminUsers.forEach((u) => push(u?.name));
      // Ensure self is always selectable even if name doesn't exist in DB
      push(user?.name);
      push(user?.email);
      // Keep current value visible/selectable even if it's not a known user
      push(manager);

      return Array.from(unique).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      );
    }

    const employees = companyEmployees
      .map((name) => (typeof name === "string" ? name.trim() : ""))
      .filter(Boolean);

    // Si el usuario actual es admin, agregarlo a la lista de empleados
    if (user?.role === "admin" && user?.name) {
      const adminName = user.name.trim();
      if (!employees.includes(adminName)) {
        return [adminName, ...employees];
      }
    }

    // Superadmin (create): include self so the manager can be auto-assigned.
    if (isSuperAdminUser) {
      const name = (user?.name || "").trim() || (user?.email || "").trim();
      if (name && !employees.includes(name)) {
        return [name, ...employees];
      }
    }

    return employees;
  }, [
    companyEmployees,
    user,
    isSuperAdminUser,
    editingEntryId,
    superAdminUsers,
    manager,
  ]);

  const editingEntry = useMemo(
    () =>
      editingEntryId
        ? (fondoEntries.find((entry) => entry.id === editingEntryId) ?? null)
        : null,
    [editingEntryId, fondoEntries],
  );
  const isEditingPaidFcrMovement = useMemo(
    () => (editingEntry ? isPaidFcrMovement(editingEntry) : false),
    [editingEntry],
  );
  const editingProviderCode = editingEntry?.providerCode ?? null;

  useEffect(() => {
    const normalizedCompany = (company || "").trim();
    const normalizedCompanyLower = normalizedCompany.toLowerCase();

    // NO cargar movimientos si los tipos aún no están listos
    if (normalizedCompany.length === 0 || !fondoTypesLoaded) {
      setEntriesHydrated(false);
      setHydratedCompany("");
      setFondoEntries([]);
      storageSnapshotRef.current = null;
      return;
    }

    setEntriesHydrated(false);
    setHydratedCompany("");
    setFondoEntries([]);
    storageSnapshotRef.current = null;
    let isMounted = true;

    const matchesSelectedCompany = (
      storage?: MovementStorage<FondoEntry> | null,
    ) => {
      if (!storage) return false;
      const storedCompany = (storage.company || "").trim();
      if (storedCompany.length === 0) return true;
      return storedCompany.toLowerCase() === normalizedCompanyLower;
    };

    const loadEntries = async () => {
      beginMovementsLoading();
      try {
        const legacyOwnerKey = resolvedOwnerId
          ? MovimientosFondosService.buildLegacyOwnerMovementsKey(
              resolvedOwnerId,
            )
          : null;
        type StorageEntriesResult = {
          entries: FondoEntry[];
          storage: MovementStorage<FondoEntry>;
        };

        const buildEntriesFromStorage = (
          rawStorage: unknown,
          movementsOverride?: unknown[] | null,
          targetAccountKey: MovementAccountKey = accountKeyRef.current,
        ): StorageEntriesResult | null => {
          if (!rawStorage) return null;
          try {
            const storage =
              MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
                rawStorage,
                normalizedCompany,
              );
            const movements = Array.isArray(movementsOverride)
              ? (movementsOverride as unknown[])
              : (storage.operations?.movements ?? []);
            const scopedEntries = movements.filter((rawEntry) => {
              const candidate = rawEntry as Partial<FondoEntry>;
              const movementAccount = isMovementAccountKey(candidate.accountId)
                ? candidate.accountId
                : targetAccountKey;
              return movementAccount === targetAccountKey;
            });
            const entries = sanitizeFondoEntries(
              scopedEntries,
              undefined,
              targetAccountKey,
            ).sort(
              (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
            );
            return { entries, storage };
          } catch (err) {
            console.error("Error parsing stored fondo entries:", err);
            return null;
          }
        };

        const buildEntriesFromRaw = (
          rawData: string | null,
        ): StorageEntriesResult | null => {
          if (!rawData) return null;
          try {
            const parsed = JSON.parse(rawData);
            return buildEntriesFromStorage(parsed);
          } catch (err) {
            console.error("Error parsing stored fondo entries:", err);
            return null;
          }
        };

        const loadRemoteEntries = async (
          docKey: string,
        ): Promise<{
          result: StorageEntriesResult | null;
          status: "success" | "not-found" | "error";
        }> => {
          if (!docKey) return { result: null, status: "error" };
          try {
            const remoteStorage =
              await MovimientosFondosService.getDocument<FondoEntry>(docKey);
            if (!remoteStorage) {
              return { result: null, status: "not-found" };
            }

            // Prefer V2 movements subcollection to avoid document overwrites/truncation.
            let v2Movements: FondoEntry[] = [];
            try {
              const targetAccountKey = accountKeyRef.current;
              const cacheKey = buildV2MovementsCacheKey(
                docKey,
                targetAccountKey,
              );
              const cached = v2MovementsCacheRef.current[cacheKey];
              if (cached?.loaded) {
                v2Movements = Array.isArray(cached.movements)
                  ? cached.movements
                  : [];
              } else {
                // Default remote load: only the active day/range (today unless both Desde/Hasta are set).
                await ensureV2MovementsLoaded(docKey);
                const next = v2MovementsCacheRef.current[cacheKey];
                v2Movements = Array.isArray(next?.movements)
                  ? (next!.movements as FondoEntry[])
                  : [];
              }
            } catch (listErr) {
              console.error(
                `[FG-V2] Error listing v2 movements (${docKey}):`,
                listErr,
              );
            }

            // One-time migration: if v2 is empty but legacy array has movements.
            try {
              const legacyMovements = (remoteStorage.operations?.movements ??
                []) as FondoEntry[];
              if (
                v2Movements.length === 0 &&
                Array.isArray(legacyMovements) &&
                legacyMovements.length > 0
              ) {
                const hasAny =
                  await MovimientosFondosService.hasAnyV2Movements(docKey);
                if (!hasAny) {
                  console.warn(
                    `[FG-V2] Migrating legacy movements to v2 (${docKey})`,
                    { legacyCount: legacyMovements.length },
                  );
                  const { migrated } =
                    await MovimientosFondosService.migrateLegacyMovementsToV2<FondoEntry>(
                      docKey,
                      legacyMovements,
                    );
                  console.warn(`[FG-V2] Migration completed (${docKey})`, {
                    migrated,
                  });

                  // Clear legacy movements from main document to prevent future truncation/overwrites.
                  const cleaned =
                    MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
                      remoteStorage,
                      normalizedCompany,
                    );
                  cleaned.operations = { movements: [] };
                  await MovimientosFondosService.saveDocument(docKey, cleaned);

                  // After migration, load only the active day/range.
                  await ensureV2MovementsLoaded(docKey);
                  const cacheKey = buildV2MovementsCacheKey(
                    docKey,
                    accountKeyRef.current,
                  );
                  const next = v2MovementsCacheRef.current[cacheKey];
                  v2Movements = Array.isArray(next?.movements)
                    ? (next!.movements as FondoEntry[])
                    : [];
                }
              }
            } catch (migrateErr) {
              console.error(
                `[FG-V2] Error migrating legacy movements (${docKey}):`,
                migrateErr,
              );
            }

            return {
              result: buildEntriesFromStorage(
                remoteStorage,
                v2Movements,
                accountKeyRef.current,
              ),
              status: "success",
            };
          } catch (err) {
            console.error(
              `Error reading fondo entries from Firestore (${docKey}):`,
              err,
            );
            return { result: null, status: "error" };
          }
        };

        const companyKey =
          MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
        let resolvedEntries: FondoEntry[] | null = null;
        let resolvedState: MovementStorageState | null = null;
        let hasResolvedSource = false;
        let remoteConfirmedNotFound = false;
        let remoteAnyError = false;

        const assignResult = (result: StorageEntriesResult | null) => {
          if (!result) return false;
          if (!matchesSelectedCompany(result.storage)) return false;
          resolvedEntries = result.entries;
          resolvedState = result.storage?.state ?? null;
          // Keep snapshot lean: movements are stored in v2 subcollection.
          storageSnapshotRef.current = {
            ...result.storage,
            operations: { movements: [] },
          };
          hasResolvedSource = true;
          return true;
        };

        const tryRemoteKey = async (docKey: string | null) => {
          if (!docKey || hasResolvedSource) return;
          const { result, status } = await loadRemoteEntries(docKey);
          if (status === "error") {
            remoteAnyError = true;
            return;
          }
          if (status === "not-found") {
            remoteConfirmedNotFound = true;
            return;
          }
          if (status === "success" && result) {
            assignResult(result);
          }
        };

        await tryRemoteKey(companyKey);

        if (
          !hasResolvedSource &&
          legacyOwnerKey &&
          legacyOwnerKey !== companyKey
        ) {
          await tryRemoteKey(legacyOwnerKey);
        }

        if (!hasResolvedSource && remoteConfirmedNotFound && !remoteAnyError) {
          const emptyStorage =
            MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            );
          storageSnapshotRef.current = emptyStorage;
          resolvedEntries = [];
          resolvedState = emptyStorage.state;
          hasResolvedSource = true;
          localStorage.removeItem(companyKey);
          if (legacyOwnerKey && legacyOwnerKey !== companyKey) {
            localStorage.removeItem(legacyOwnerKey);
          }
          const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
          localStorage.removeItem(legacyKey);
        }

        if (!hasResolvedSource) {
          assignResult(buildEntriesFromRaw(localStorage.getItem(companyKey)));
        }

        if (
          !hasResolvedSource &&
          legacyOwnerKey &&
          legacyOwnerKey !== companyKey
        ) {
          assignResult(
            buildEntriesFromRaw(localStorage.getItem(legacyOwnerKey)),
          );
        }

        if (!hasResolvedSource) {
          const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
          const legacyRaw = localStorage.getItem(legacyKey);
          if (legacyRaw) {
            try {
              const legacyParsed = JSON.parse(legacyRaw);
              const parsedEntries = sanitizeFondoEntries(
                legacyParsed,
                undefined,
                accountKeyRef.current,
              );
              if (parsedEntries.length > 0) {
                resolvedEntries = parsedEntries;
                const fallbackStorage =
                  MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
                    normalizedCompany,
                  );
                fallbackStorage.operations.movements = parsedEntries.map(
                  (entry) => ({
                    ...entry,
                    accountId: accountKeyRef.current,
                  }),
                );
                storageSnapshotRef.current = fallbackStorage;
              }
            } catch (err) {
              console.error("Error parsing legacy fondo entries:", err);
            }
          }
        }

        if (isMounted) {
          setFondoEntries(resolvedEntries ?? []);
          if (resolvedState) {
            applyLedgerStateFromStorage(resolvedState);
          }
        }
      } catch (err) {
        console.error("Error reading fondo entries:", err);
        if (isMounted) {
          setFondoEntries([]);
        }
      } finally {
        if (isMounted) {
          setHydratedCompany(normalizedCompany);
          setHydratedAccountKey(accountKeyRef.current);
          setEntriesHydrated(true);
          endMovementsLoading();
        }
      }
    };

    void loadEntries();

    return () => {
      isMounted = false;
    };
  }, [
    namespace,
    resolvedOwnerId,
    company,
    fondoTypesLoaded,
    applyLedgerStateFromStorage,
    beginMovementsLoading,
    endMovementsLoading,
  ]);

  // When switching tabs, do not reload from Firestore: just filter cached v2 movements in-memory.
  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey();
    if (!docKey) return;
    const cacheKey = buildV2MovementsCacheKey(docKey, accountKey);
    const cached = v2MovementsCacheRef.current[cacheKey];
    if (!cached?.loaded) return;

    const scopedEntries = cached.movements.filter((rawEntry) => {
      const candidate = rawEntry as Partial<FondoEntry>;
      const movementAccount = isMovementAccountKey(candidate.accountId)
        ? candidate.accountId
        : accountKey;
      return movementAccount === accountKey;
    });

    const entries = sanitizeFondoEntries(
      scopedEntries,
      undefined,
      accountKey,
    ).sort((a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a));
    setFondoEntries(entries);

    const state = storageSnapshotRef.current?.state;
    if (state) {
      applyLedgerStateFromStorage(state);
    }

    setHydratedAccountKey(accountKey);
  }, [
    accountKey,
    entriesHydrated,
    applyLedgerStateFromStorage,
    buildV2MovementsCacheKey,
    resolveV2DocKey,
  ]);

  // On-demand v2 loading: keep Firestore reads constrained to the active day/range.
  useEffect(() => {
    if (!entriesHydrated) return;
    const docKey = resolveV2DocKey();
    if (!docKey) return;

    // Only query the remote range when BOTH Desde/Hasta are set.
    if ((fromFilter && !toFilter) || (!fromFilter && toFilter)) return;

    void ensureV2MovementsLoaded(docKey);
  }, [
    entriesHydrated,
    pageSize,
    fromFilter,
    toFilter,
    currentDailyKey,
    resolveV2DocKey,
    ensureV2MovementsLoaded,
  ]);

  useEffect(() => {
    if (
      !entriesHydrated ||
      providers.length === 0 ||
      fondoEntries.length === 0
    ) {
      return;
    }

    const sortedEntries = [...fondoEntries].sort(
      (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
    );
    // Determine if there is a pending "CIERRE FONDO VENTAS" that has not
    // been superseded by an auto-adjustment (CIERRE DE FONDO GENERAL) or by a
    // confirmed daily closing record. We consider the most recent cierre entry
    // and compare it with the latest daily closing saved for the company.
    let hasPendingCierreDeCaja = false;
    let cierreEntryTs = 0;
    for (const entry of sortedEntries) {
      // If we find an auto-adjustment (CIERRE DE FONDO GENERAL) newer than any
      // cierre entry, there is no pending cierre.
      if (isAutoAdjustmentProvider(entry.providerCode)) {
        cierreEntryTs = 0;
        break;
      }
      // Buscar el nombre del proveedor por su código
      const providerData = providers.find((p) => p.code === entry.providerCode);
      if (
        providerData?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME
      ) {
        const parsed = Date.parse(String(entry.createdAt || ""));
        cierreEntryTs = Number.isFinite(parsed) ? parsed : 0;
        break;
      }
    }

    if (cierreEntryTs > 0) {
      // If we have daily closings loaded, compare timestamps: if the latest
      // daily closing is at or after the cierre entry, consider it confirmed
      // (not pending). Otherwise keep as pending.
      let latestDailyClosingTs = 0;
      if (Array.isArray(dailyClosings) && dailyClosings.length > 0) {
        for (const record of dailyClosings) {
          const ts = Date.parse(record.createdAt || record.closingDate || "");
          if (Number.isFinite(ts) && ts > latestDailyClosingTs)
            latestDailyClosingTs = ts;
        }
      }
      hasPendingCierreDeCaja = cierreEntryTs > latestDailyClosingTs;
    } else {
      hasPendingCierreDeCaja = false;
    }

    setPendingCierreDeCaja(hasPendingCierreDeCaja);
    console.log(
      "[CIERRE-DEBUG] Estado pendingCierreDeCaja después de cargar:",
      hasPendingCierreDeCaja,
      {
        cierreEntryTs,
        latestDailyClosingTs: Array.isArray(dailyClosings)
          ? Math.max(
              ...dailyClosings.map(
                (r) => Date.parse(r.createdAt || r.closingDate || "") || 0,
              ),
            )
          : 0,
      },
    );
  }, [
    entriesHydrated,
    providers,
    fondoEntries,
    dailyClosings,
    dailyClosingsHydrated,
  ]);

  useEffect(() => {
    if (!selectedProvider) return;
    const exists = movementProviders.some((p) => p.code === selectedProvider);
    const isEditingSameProvider =
      editingEntryId && editingProviderCode === selectedProvider;
    if (!exists && !isEditingSameProvider) {
      setSelectedProvider("");
    }
  }, [
    movementProviders,
    selectedProvider,
    editingEntryId,
    editingProviderCode,
  ]);

  useEffect(() => {
    // Reset cached results when switching company/account.
    loadedDailyClosingKeysRef.current = new Set();
    loadingDailyClosingKeysRef.current = new Set();
    dailyClosingsRequestCountRef.current = 0;
    dailyClosingHistoryRequestIdRef.current += 1;
    setDailyClosingsRefreshing(false);
    setDailyClosingsHydrated(false);
    setDailyClosings([]);
  }, [company, accountKey]);

  const resolveDailyClosingRangeBounds = useCallback(
    (range: string): { fromTs: number; toTs: number } | null => {
      if (!range || range === "todo") return null;
      const now = new Date();
      let from: Date | null = null;
      let to: Date | null = null;

      if (range === "today") {
        const t = new Date(now);
        from = t;
        to = t;
      } else if (range === "yesterday") {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        from = y;
        to = y;
      } else if (range === "thisweek") {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d);
        start.setDate(diff);
        from = start;
        to = new Date(now);
      } else if (range === "lastweek") {
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
        const start = new Date(d);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        from = start;
        to = end;
      } else if (range === "lastmonth") {
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
      } else if (range === "month") {
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      } else if (range === "last30") {
        const end = new Date(now);
        const start = new Date(now);
        start.setDate(start.getDate() - 29);
        from = start;
        to = end;
      }

      if (!from || !to) return null;
      const fromTs = new Date(
        from.getFullYear(),
        from.getMonth(),
        from.getDate(),
        0,
        0,
        0,
        0,
      ).getTime();
      const toTs = new Date(
        to.getFullYear(),
        to.getMonth(),
        to.getDate(),
        23,
        59,
        59,
        999,
      ).getTime();
      return { fromTs, toTs };
    },
    [],
  );

  const loadDailyClosingsForHistoryRange = useCallback(
    async (range: string) => {
      if (accountKey !== "FondoGeneral") {
        setDailyClosings([]);
        setDailyClosingsHydrated(true);
        return;
      }

      const normalizedCompany = (company || "").trim();
      if (normalizedCompany.length === 0) {
        setDailyClosings([]);
        setDailyClosingsHydrated(true);
        return;
      }

      const resolvedRange = range && range.length > 0 ? range : "today";

      dailyClosingHistoryRequestIdRef.current += 1;
      const requestId = dailyClosingHistoryRequestIdRef.current;
      setDailyClosingsHydrated(false);
      beginDailyClosingsRequest();

      try {
        const bounds = resolveDailyClosingRangeBounds(resolvedRange);
        const document =
          await DailyClosingsService.getDocument(normalizedCompany);
        if (!isComponentMountedRef.current) return;
        if (requestId !== dailyClosingHistoryRequestIdRef.current) return;

        const base = document
          ? DailyClosingsService.extractAllClosings(document)
          : [];

        if (closingsStorageKey) {
          try {
            localStorage.setItem(closingsStorageKey, JSON.stringify(base));
          } catch (storageErr) {
            console.error("Error storing daily closings:", storageErr);
          }
        }
        const filtered = bounds
          ? base.filter((record) => {
              const ts = Date.parse(record?.closingDate ?? "");
              if (Number.isNaN(ts)) return true;
              if (ts < bounds.fromTs) return false;
              if (ts > bounds.toTs) return false;
              return true;
            })
          : base;
        setDailyClosings(filtered);
      } catch (err) {
        console.error("Error reading daily closings from Firestore:", err);
        if (!isComponentMountedRef.current) return;
        if (requestId !== dailyClosingHistoryRequestIdRef.current) return;

        try {
          if (closingsStorageKey) {
            const stored = localStorage.getItem(closingsStorageKey);
            if (stored) {
              const parsed = JSON.parse(stored) as unknown;
              const all = sanitizeDailyClosings(parsed);
              const bounds = resolveDailyClosingRangeBounds(resolvedRange);
              const filtered = bounds
                ? all.filter((record) => {
                    const ts = Date.parse(record?.closingDate ?? "");
                    if (Number.isNaN(ts)) return true;
                    if (ts < bounds.fromTs) return false;
                    if (ts > bounds.toTs) return false;
                    return true;
                  })
                : all;
              setDailyClosings(filtered);
            } else {
              setDailyClosings([]);
            }
          } else {
            setDailyClosings([]);
          }
        } catch (storageErr) {
          console.error("Error reading stored daily closings:", storageErr);
          setDailyClosings([]);
        }
      } finally {
        if (
          isComponentMountedRef.current &&
          requestId === dailyClosingHistoryRequestIdRef.current
        ) {
          setDailyClosingsHydrated(true);
        }
        finishDailyClosingsRequest();
      }
    },
    [
      accountKey,
      company,
      closingsStorageKey,
      beginDailyClosingsRequest,
      finishDailyClosingsRequest,
      resolveDailyClosingRangeBounds,
    ],
  );

  useEffect(() => {
    // Lazy-load: only query when the history modal is open.
    if (!dailyClosingHistoryOpen) return;
    void loadDailyClosingsForHistoryRange(dailyClosingHistoryRange);
  }, [
    dailyClosingHistoryOpen,
    dailyClosingHistoryRange,
    loadDailyClosingsForHistoryRange,
  ]);

  useEffect(() => {
    let isActive = true;
    setCompanyEmployees([]);

    if (!company) {
      setEmployeesLoading(false);
      return () => {
        isActive = false;
      };
    }

    // Solo cargar empleados de la empresa si estamos en fondogeneral (fg) o cajanegra (cn)
    // Para otros fondos (BCR, BN, BAC), no cargar empleados
    if (namespace !== "fg" && namespace !== "cn") {
      setEmployeesLoading(false);
      return () => {
        isActive = false;
      };
    }

    setEmployeesLoading(true);
    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        const names =
          match?.empleados?.map((emp) => emp.Empleado).filter(Boolean) ?? [];
        setCompanyEmployees(names as string[]);
      })
      .catch((err) => {
        console.error("Error loading company employees:", err);
        if (isActive) setCompanyEmployees([]);
      })
      .finally(() => {
        if (isActive) setEmployeesLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [company, namespace]);

  // Load company data to check ownerId for delete permissions
  useEffect(() => {
    let isActive = true;
    setCompanyData(null);

    if (!company) {
      return () => {
        isActive = false;
      };
    }

    EmpresasService.getAllEmpresas()
      .then((empresas) => {
        if (!isActive) return;
        const match = empresas.find(
          (emp) => emp.name?.toLowerCase() === company.toLowerCase(),
        );
        if (match) {
          setCompanyData(match);
        }
      })
      .catch((err) => {
        console.error("Error loading company data:", err);
        if (isActive) setCompanyData(null);
      });

    return () => {
      isActive = false;
    };
  }, [company]);

  useEffect(() => {
    // Keep legacy validation for non-superadmin actors.
    // Superadmin may select users outside the company employee list when editing.
    if (isSuperAdminUser) return;
    if (manager && !employeeOptions.includes(manager)) {
      setManager("");
    }
  }, [manager, employeeOptions, isSuperAdminUser]);

  useEffect(() => {
    if (isIngreso) {
      setEgreso("");
    } else {
      setIngreso("");
    }
  }, [paymentType, isIngreso]);

  useEffect(() => {
    if (invoiceDocType !== "FCO" || !isEgreso) {
      setSelectedAppliedCreditNoteIds([]);
    }
  }, [invoiceDocType, isEgreso]);


  const resetFondoForm = useCallback(() => {
    setSelectedProvider("");
    setInvoiceNumber("");
    setInvoiceDocType("FCO");
    setEgreso("");
    setIngreso("");
    setManager("");
    setManager2("");
    setSelectedAppliedCreditNoteIds([]);
    setSelectedPendingCreditInvoiceIds([]);
    setManualCreditNoteDraft(null);
    setManualCreditNoteOpen(false);
    setManualCreditNoteTarget(null);
    setManualCreditNoteInvoiceNumber("");
    setManualCreditNoteAmount("");
    setManualCreditNoteObservation("");
    setManualCreditNoteError("");
    setPaymentType("COMPRA INVENTARIO");
    setNotes("");
    setEditingEntryId(null);
    // Clear all validation errors
    setProviderError("");
    setInvoiceError("");
    setAmountError("");
    setManagerError("");
    setManager2Error("");
    editingInProgressRef.current = false;
  }, []);

  const normalizeMoneyInput = (value: string) => value.replace(/[^0-9]/g, "");

  /**
   * Envía un correo de notificación cuando se crea o edita un movimiento,
   * solo si el proveedor tiene configurado un correo de notificación.
   */
  const sendMovementNotification = useCallback(
    async (
      entry: FondoEntry,
      operationType: "create" | "edit",
    ): Promise<void> => {
      try {
        // Buscar el proveedor para obtener su correonotifi
        const provider = providers.find((p) => p.code === entry.providerCode);

        // Si el proveedor no tiene correonotifi, no enviar correo
        if (
          !provider?.correonotifi ||
          provider.correonotifi.trim().length === 0
        ) {
          return;
        }

        // Obtener el nombre del proveedor
        const providerName = provider.name || entry.providerCode;

        // Calcular el monto y tipo
        const amount =
          entry.amountEgreso > 0 ? entry.amountEgreso : entry.amountIngreso;
        const amountType: "Egreso" | "Ingreso" =
          entry.amountEgreso > 0 ? "Egreso" : "Ingreso";
        const currency = (entry.currency as "CRC" | "USD") || "CRC";

        // Generar el contenido del correo usando la plantilla
        const emailContent = generateMovementNotificationEmail({
          company: company || "",
          providerName,
          providerCode: entry.providerCode,
          paymentType: entry.paymentType,
          invoiceNumber: entry.invoiceNumber,
          amount,
          amountType,
          currency,
          manager: entry.manager,
          notes: entry.notes,
          createdAt: entry.createdAt,
          operationType,
        });

        // Crear documento en la colección 'mail' para que la extensión Firebase Trigger Email lo procese
        try {
          const docRef = await addDoc(collection(db, "mail"), {
            to: provider.correonotifi,
            subject: emailContent.subject,
            text: emailContent.text,
            html: emailContent.html,
            createdAt: serverTimestamp(),
          });
          console.log(
            `[MAIL-DOC] Documento creado en 'mail' para movimiento: ${docRef.id}`,
          );
          showToast("Correo de notificación enviado correctamente", "success");
        } catch (err) {
          console.error(
            '[MAIL-DOC] Error creando documento en "mail" para movimiento:',
            err,
          );
          showToast("Error al enviar correo de notificación", "error");
        }
      } catch (err) {
        console.error(
          "[EMAIL-NOTIFICATION] Error preparing notification:",
          err,
        );
        // No lanzar error, la notificación es secundaria
      }
    },
    [company, providers, showToast],
  );

  /**
   * Función auxiliar para persistir movimientos a Firestore de forma inmediata.
   * Retorna true si se guardó correctamente, false si hubo error.
   */
  const persistMovementToFirestore = useCallback(
    async (
      updatedEntries: FondoEntry[],
      operationType: "create" | "edit" | "delete",
      change?: {
        upsert?: FondoEntry;
        deleteId?: string;
        before?: FondoEntry | null;
      },
      extraWrites?: (batch: WriteBatch) => void,
    ): Promise<{
      ok: boolean;
      confirmed: boolean;
      ledgerSnapshot?: {
        initialCRC: number;
        currentCRC: number;
        initialUSD: number;
        currentUSD: number;
      };
    }> => {
      const normalizedCompany = (company || "").trim();
      if (normalizedCompany.length === 0) {
        console.error("[PERSIST-IMMEDIATE] No company specified");
        return { ok: false, confirmed: false };
      }

      const companyKey =
        MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);

      try {
        const baseStorage = storageSnapshotRef.current
          ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
              storageSnapshotRef.current,
              normalizedCompany,
            )
          : MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            );

        baseStorage.company = normalizedCompany;

        // V2: movements live in a subcollection. Never persist the array to the main document.
        baseStorage.operations = { movements: [] };

        // IMPORTANTE:
        // Con filtros de rango (Desde/Hasta) en v2, `updatedEntries` puede NO contener
        // todos los movimientos históricos. Por eso NO podemos recalcular currentBalance
        // sumando `updatedEntries`. En su lugar, actualizamos balances por delta:
        // - create: + (ingreso-egreso)
        // - delete: - (ingreso-egreso)
        // - edit:   + (after - before)

        const parseBalance = (value: unknown) => {
          const parsed = typeof value === "number" ? value : Number(value);
          return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
        };

        const normalizeCurrency = (value: unknown): MovementCurrencyKey =>
          value === "USD" ? "USD" : "CRC";

        const movementDelta = (
          entry: Partial<FondoEntry> | null | undefined,
        ): { currency: MovementCurrencyKey; delta: number } | null => {
          if (!entry) return null;
          const currency = normalizeCurrency(entry.currency);
          const ingreso = parseBalance((entry as any).amountIngreso ?? 0);
          const egreso = resolveEffectiveEgresoAmount(entry);
          return { currency, delta: ingreso - egreso };
        };

        const normalizedInitialCRC =
          initialAmount.trim().length > 0 ? initialAmount.trim() : "0";
        const normalizedInitialUSD =
          initialAmountUSD.trim().length > 0 ? initialAmountUSD.trim() : "0";
        const parsedInitialCRC = Number(normalizedInitialCRC) || 0;
        const parsedInitialUSD = Number(normalizedInitialUSD) || 0;

        const stateSnapshot =
          baseStorage.state ??
          MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
            normalizedCompany,
          ).state;

        const existingCRC = stateSnapshot.balancesByAccount.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === "CRC",
        );
        const existingUSD = stateSnapshot.balancesByAccount.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === "USD",
        );

        const prevInitialCRC = existingCRC
          ? parseBalance(existingCRC.initialBalance ?? 0)
          : parseBalance(ledgerSnapshot.initialCRC);
        const prevInitialUSD = existingUSD
          ? parseBalance(existingUSD.initialBalance ?? 0)
          : parseBalance(ledgerSnapshot.initialUSD);
        const prevCurrentCRC = existingCRC
          ? parseBalance(existingCRC.currentBalance ?? prevInitialCRC)
          : parseBalance(ledgerSnapshot.currentCRC);
        const prevCurrentUSD = existingUSD
          ? parseBalance(existingUSD.currentBalance ?? prevInitialUSD)
          : parseBalance(ledgerSnapshot.currentUSD);

        const deltas: Record<MovementCurrencyKey, number> = { CRC: 0, USD: 0 };

        const resolveBeforeFallback = (): FondoEntry | null => {
          const targetId =
            operationType === "delete"
              ? change?.deleteId
              : operationType === "edit"
                ? change?.upsert?.id
                : null;
          if (!targetId) return null;
          const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
          const cached = v2MovementsCacheRef.current[cacheKey];
          return cached?.movements?.find((m) => m.id === targetId) ?? null;
        };

        const beforeEntry = change?.before ?? resolveBeforeFallback();
        const afterEntry = change?.upsert;

        if (operationType === "create") {
          const d = movementDelta(afterEntry);
          if (d) deltas[d.currency] += d.delta;
        } else if (operationType === "delete") {
          const d = movementDelta(beforeEntry);
          if (d) deltas[d.currency] -= d.delta;
        } else if (operationType === "edit") {
          const before = movementDelta(beforeEntry);
          if (before) deltas[before.currency] -= before.delta;
          const after = movementDelta(afterEntry);
          if (after) deltas[after.currency] += after.delta;
        }

        const nextCurrentCRC =
          prevCurrentCRC + (parsedInitialCRC - prevInitialCRC) + deltas.CRC;
        const nextCurrentUSD =
          prevCurrentUSD + (parsedInitialUSD - prevInitialUSD) + deltas.USD;
        const nextAccountBalances = stateSnapshot.balancesByAccount.filter(
          (balance) => balance.accountId !== accountKey,
        );
        nextAccountBalances.push(
          {
            accountId: accountKey,
            currency: "CRC",
            enabled: currencyEnabled.CRC,
            initialBalance: parsedInitialCRC,
            currentBalance: nextCurrentCRC,
          },
          {
            accountId: accountKey,
            currency: "USD",
            enabled: currencyEnabled.USD,
            initialBalance: parsedInitialUSD,
            currentBalance: nextCurrentUSD,
          },
        );
        stateSnapshot.balancesByAccount = nextAccountBalances;
        stateSnapshot.updatedAt = new Date().toISOString();

        // Preservar lockedUntil del snapshot actual si existe
        if (storageSnapshotRef.current?.state?.lockedUntil) {
          stateSnapshot.lockedUntil =
            storageSnapshotRef.current.state.lockedUntil;
        }
        baseStorage.state = stateSnapshot;

        // Guardar en Firestore (ledger + movimiento) de forma ATÓMICA
        console.log(
          `[PERSIST-IMMEDIATE] Guardando ${operationType} a Firestore...`,
          {
            company: normalizedCompany,
            accountKey,
            entriesCount: updatedEntries.length,
          },
        );

        let cacheUpdater: (() => void) | null = null;
        let movementChange:
          | {
              type: "upsert";
              movement: FondoEntry & { id: string };
              accountId?: MovementAccountKey;
            }
          | {
              type: "delete";
              movementId: string;
              accountId?: MovementAccountKey;
            }
          | { type: "none" } = { type: "none" };

        if (operationType === "delete") {
          const deleteId = change?.deleteId;
          if (!deleteId) {
            throw new Error(
              "[PERSIST-IMMEDIATE] delete requires change.deleteId",
            );
          }
          movementChange = {
            type: "delete",
            movementId: deleteId,
            accountId: accountKey,
          };
          cacheUpdater = () => {
            const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
            const cached = v2MovementsCacheRef.current[cacheKey];
            if (cached?.loaded) {
              v2MovementsCacheRef.current[cacheKey] = {
                ...cached,
                loaded: true,
                movements: cached.movements.filter((m) => m.id !== deleteId),
              };
            }
          };
        } else {
          const movement = change?.upsert;
          if (!movement) {
            throw new Error(
              "[PERSIST-IMMEDIATE] create/edit requires change.upsert",
            );
          }
          const normalizedCurrency: MovementCurrencyKey =
            movement.currency === "USD" ? "USD" : "CRC";
          const canonicalPaymentType = getCanonicalClosingPaymentType(movement);
          const storedMovement: FondoEntry = {
            ...(movement as FondoEntry),
            paymentType: canonicalPaymentType,
            accountId: accountKey,
            currency: normalizedCurrency,
            empresa: normalizedCompany,
          };
          movementChange = {
            type: "upsert",
            movement: storedMovement,
            accountId: accountKey,
          };
          cacheUpdater = () => {
            const cacheKey = buildV2MovementsCacheKey(companyKey, accountKey);
            const cached = v2MovementsCacheRef.current[cacheKey];
            if (cached?.loaded) {
              const next = [
                storedMovement,
                ...cached.movements.filter((m) => m.id !== storedMovement.id),
              ];
              v2MovementsCacheRef.current[cacheKey] = {
                ...cached,
                loaded: true,
                movements: next,
              };
            }
          };
        }

        const shouldDeleteFacturaMirror =
          operationType === "delete" &&
          beforeEntry &&
          shouldDeleteFacturasMirror(beforeEntry);

        const mergedExtraWrites =
          extraWrites || shouldDeleteFacturaMirror
            ? (batch: WriteBatch) => {
                extraWrites?.(batch);
                if (shouldDeleteFacturaMirror) {
                  const deletedId = String(beforeEntry?.id || "");
                  batch.delete(
                    FacturasService.buildMovementRef(
                      normalizedCompany,
                      deletedId,
                    ),
                  );
                  batch.delete(
                    FacturasService.buildMovementRef(
                      normalizedCompany,
                      `${deletedId}-NC`,
                    ),
                  );
                }
              }
            : undefined;

        await MovimientosFondosService.commitLedgerAndMovement(
          companyKey,
          baseStorage,
          movementChange,
          mergedExtraWrites,
        );

        if (cacheUpdater) {
          try {
            cacheUpdater();
          } catch (cacheErr) {
            console.warn(
              "[PERSIST-IMMEDIATE] cache update failed after commit:",
              cacheErr,
            );
          }
        }

        // Guardar snapshot liviano en localStorage DESPUÉS del commit.
        // Esto evita que un fallo de Firestore deje un snapshot local inconsistente.
        try {
          localStorage.setItem(companyKey, JSON.stringify(baseStorage));
        } catch (storageError) {
          console.warn(
            "[PERSIST-IMMEDIATE] localStorage write failed:",
            storageError,
          );
        }

        // setDoc puede resolver con escritura local; esperamos un poco por confirmación del backend
        // para evitar casos de "se guardó" cuando el usuario estaba offline/intermitente.
        let confirmed = false;
        try {
          const timeoutMs = 8000;
          await Promise.race([
            waitForPendingWrites(db).then(() => {
              confirmed = true;
            }),
            new Promise<void>((_, reject) => {
              setTimeout(
                () => reject(new Error("waitForPendingWrites timeout")),
                timeoutMs,
              );
            }),
          ]);
        } catch (pendingErr) {
          console.warn(
            `[PERSIST-IMMEDIATE] ⚠️ ${operationType} guardado localmente pero sin confirmación del servidor aún`,
            pendingErr,
          );
        }

        console.log(
          `[PERSIST-IMMEDIATE] ✅ ${operationType} guardado (confirmed=${confirmed})`,
        );

        // Actualizar snapshot después de guardar
        storageSnapshotRef.current = baseStorage;

        return {
          ok: true,
          confirmed,
          ledgerSnapshot: {
            initialCRC: parsedInitialCRC,
            currentCRC: nextCurrentCRC,
            initialUSD: parsedInitialUSD,
            currentUSD: nextCurrentUSD,
          },
        };
      } catch (err) {
        console.error(
          `[PERSIST-IMMEDIATE] ❌ Error guardando ${operationType} a Firestore:`,
          err,
        );
        return { ok: false, confirmed: false };
      }
    },
    [
      company,
      accountKey,
      initialAmount,
      initialAmountUSD,
      currencyEnabled,
      ledgerSnapshot,
    ],
  );

  const latestDailyClosing = useMemo(() => {
    if (!dailyClosings || dailyClosings.length === 0) return null;
    const sorted = dailyClosings
      .slice()
      .sort((a, b) => dailyClosingSortValue(b) - dailyClosingSortValue(a));
    return sorted[0] ?? null;
  }, [dailyClosings]);

  const latestDailyClosingLabel = useMemo(() => {
    if (!latestDailyClosing) return "";
    try {
      const localDailyClosingDateFormatter = new Intl.DateTimeFormat("es-CR", {
        dateStyle: "long",
      });
      const localDateTimeFormatter = new Intl.DateTimeFormat("es-CR", {
        dateStyle: "short",
        timeStyle: "short",
      });
      const closingDate = new Date(latestDailyClosing.closingDate);
      const closingLabel = Number.isNaN(closingDate.getTime())
        ? String(latestDailyClosing.closingDate)
        : localDailyClosingDateFormatter.format(closingDate);
      const createdAtDate = new Date(latestDailyClosing.createdAt);
      const createdLabel = Number.isNaN(createdAtDate.getTime())
        ? String(latestDailyClosing.createdAt)
        : localDateTimeFormatter.format(createdAtDate);
      return `${closingLabel} (registrado: ${createdLabel})`;
    } catch {
      return String(
        latestDailyClosing.closingDate || latestDailyClosing.createdAt || "",
      );
    }
  }, [latestDailyClosing]);

  const handleDeleteLatestDailyClosing = useCallback(
    async (reason: string): Promise<void> => {
      if (!isSuperAdminUser) {
        throw new Error("No autorizado");
      }

      const normalizedCompany = (company || "").trim();
      if (!normalizedCompany) {
        throw new Error("No se pudo identificar la empresa");
      }

      if (accountKey !== "FondoGeneral") {
        throw new Error("Esta acción solo aplica al Fondo General");
      }

      const trimmedReason = String(reason || "").trim();
      if (!trimmedReason) {
        throw new Error("Debe indicar un motivo");
      }

      if (deleteLatestClosingInProgressRef.current) {
        throw new Error("Ya hay una eliminación en progreso");
      }
      deleteLatestClosingInProgressRef.current = true;

      try {
        // Fuente de verdad: documento en Firestore
        const closingsDoc =
          await DailyClosingsService.getDocument(normalizedCompany);
        if (!closingsDoc) {
          throw new Error(
            "No se encontró historial de cierres para esta empresa",
          );
        }

        const sorted = DailyClosingsService.extractAllClosings(closingsDoc);
        const latest = sorted[0];
        if (!latest) {
          throw new Error("No hay cierres para eliminar");
        }
        const latestAfter = sorted[1] ?? null;

        const companyKey =
          MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);

        // Buscar ajustes vinculados al cierre (aunque no estén cargados en el rango actual)
        const related =
          await MovimientosFondosService.listMovementsByOriginalEntryId<FondoEntry>(
            companyKey,
            latest.id,
            { limitCount: 50 },
          );

        const relatedAdjustments = (related || []).filter((m) =>
          isAutoAdjustmentProvider((m as any)?.providerCode),
        );

        const lockedUntilBefore =
          storageSnapshotRef.current?.state?.lockedUntil ?? null;
        const lockedUntilAfter = latestAfter?.createdAt ?? null;

        // 1) Eliminar el cierre y guardar respaldo en cierresEliminados (respaldo primero)
        await DailyClosingsService.deleteLatestClosing(normalizedCompany, {
          expectedClosingId: latest.id,
          reason: trimmedReason,
          deletedBy: {
            uid: (user as any)?.id,
            email: user?.email,
            name: user?.name,
            role: user?.role,
          },
          relatedAdjustments,
          lockedUntilBefore,
          lockedUntilAfter,
        });

        setDailyClosings((prev) => prev.filter((d) => d.id !== latest.id));
        setExpandedClosings((prev) => {
          const next = new Set(prev);
          next.delete(latest.id);
          return next;
        });

        // 2) Eliminar movimientos de ajuste para revertir el saldo
        let latestLedgerSnapshot: {
          initialCRC: number;
          currentCRC: number;
          initialUSD: number;
          currentUSD: number;
        } | null = null;

        for (const adj of relatedAdjustments) {
          const before =
            fondoEntries.find((e) => e.id === adj.id) ?? (adj as any);
          const saved = await persistMovementToFirestore(
            fondoEntries,
            "delete",
            {
              deleteId: adj.id,
              before,
            },
          );
          if (!saved.ok) {
            throw new Error(
              "El cierre fue eliminado, pero no se pudo borrar un ajuste al saldo asociado. Revise los movimientos.",
            );
          }
          if (saved.ledgerSnapshot) {
            latestLedgerSnapshot = saved.ledgerSnapshot;
          }
        }

        if (relatedAdjustments.length > 0) {
          const ids = new Set(relatedAdjustments.map((a) => a.id));
          setFondoEntries((prev) => prev.filter((e) => !ids.has(e.id)));
          if (latestLedgerSnapshot) {
            setLedgerSnapshot(latestLedgerSnapshot);
          }
        }

        // 3) Ajustar lockedUntil al cierre anterior (o removerlo si ya no hay cierres)
        const baseLedger = storageSnapshotRef.current
          ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
              storageSnapshotRef.current,
              normalizedCompany,
            )
          : ((await MovimientosFondosService.getDocument<FondoEntry>(
              companyKey,
            )) ??
            MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            ));

        baseLedger.company = normalizedCompany;
        baseLedger.operations = { movements: [] };
        if (!baseLedger.state) {
          baseLedger.state =
            MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            ).state;
        }
        if (lockedUntilAfter) {
          baseLedger.state.lockedUntil = lockedUntilAfter;
        } else {
          delete (baseLedger.state as any).lockedUntil;
        }
        baseLedger.state.updatedAt = new Date().toISOString();

        await MovimientosFondosService.saveDocument(companyKey, baseLedger);
        storageSnapshotRef.current = baseLedger;
        try {
          localStorage.setItem(companyKey, JSON.stringify(baseLedger));
        } catch {
          // ignore storage errors
        }

        // Si acabamos de eliminar el último cierre, no tiene sentido pedir confirmación de conteo físico
        // para el “primer movimiento después del cierre”.
        try {
          const key = buildPhysicalCountStorageKey();
          if (key) localStorage.setItem(key, "false");
          cleanupPhysicalCountLegacyKeys();
        } catch {
          // ignore
        }
        setPendingCierreDeCaja(false);

        // Reset cross-device lock + local cooldowns so user can re-do either closing immediately.
        await forceClearClosingGuards(
          normalizedCompany,
          "delete_latest_fondo_general",
        );
        try {
          lastDailyClosingSavedAtRef.current = 0;
          lastMovementCreatedAtRef.current = 0;
          lastMovementDedupeRef.current = null;
          if (typeof window !== "undefined") {
            const dailyKey = `fondogeneral-lastDailyClosingSavedAt:${normalizedCompany}`;
            const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${accountKey}`;
            const dedupeKey = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${accountKey}`;
            localStorage.removeItem(dailyKey);
            localStorage.removeItem(createdKey);
            localStorage.removeItem(dedupeKey);
          }
        } catch {
          // ignore
        }

        showToast("Último cierre eliminado", "success", 4000);
      } finally {
        deleteLatestClosingInProgressRef.current = false;
      }
    },
    [
      isSuperAdminUser,
      company,
      accountKey,
      user,
      fondoEntries,
      persistMovementToFirestore,
      isAutoAdjustmentProvider,
      buildPhysicalCountStorageKey,
      cleanupPhysicalCountLegacyKeys,
      forceClearClosingGuards,
      showToast,
    ],
  );

  const persistCreatedMovement = useCallback(
    async (
      entry: FondoEntry,
      updatedEntries: FondoEntry[],
    ): Promise<boolean> => {
      // PRIMERO persistir a Firestore, LUEGO actualizar UI
      const saved = await persistMovementToFirestore(updatedEntries, "create", {
        upsert: entry,
      });

      if (!saved.ok) {
        showToast(
          "Error al guardar el movimiento. Por favor, intente de nuevo.",
          "error",
          5000,
        );
        editingInProgressRef.current = false;
        return false;
      }

      // Mark a dedupe window after a successful save (prevents instant duplicates)
      try {
        const normalizedCompany = (company || "").trim();
        if (normalizedCompany.length > 0) {
          const savedAtMs = Date.now();
          const fingerprintParts = [
            `provider=${entry.providerCode || ""}`,
            `invoice=${entry.invoiceNumber || ""}`,
            `invoiceDocType=${normalizeInvoiceDocType((entry as any).invoiceDocType)}`,
            `type=${entry.paymentType || ""}`,
            `egreso=${Math.trunc(entry.amountEgreso || 0)}`,
            `payment=${Math.trunc(entry.amountPayment || 0)}`,
            `ingreso=${Math.trunc(entry.amountIngreso || 0)}`,
            `manager=${(entry.manager || "").trim()}`,
            `currency=${(entry as any).currency || "CRC"}`,
            `notes=${(entry.notes || "").trim()}`,
          ];
          const fingerprint = fingerprintParts.join("|");
          const payload = { at: savedAtMs, fingerprint };
          lastMovementDedupeRef.current = payload;
          // NOTE: "INGRESO DESDE FONDO VENTAS" no debe activar el cooldown de 1 minuto
          // para el siguiente movimiento. Detectar también por nombre visible del proveedor.
          const provider = providers.find((p) => p.code === entry.providerCode);
          const providerDisplayName = provider?.name || entry.providerCode;
          const isIngresoDesdeFV = isIngresoDesdeFondoVentasMovement(
            entry,
            providerDisplayName,
          );
          // Do NOT mark created cooldown for Caja Negra movements
          const shouldMarkCreatedCooldown = !isIngresoDesdeFV && !isCajaNegra;
          if (shouldMarkCreatedCooldown)
            lastMovementCreatedAtRef.current = savedAtMs;
          if (typeof window !== "undefined") {
            const key = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${accountKey}`;
            const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${accountKey}`;
            try {
              localStorage.setItem(key, JSON.stringify(payload));
              if (shouldMarkCreatedCooldown) {
                localStorage.setItem(
                  createdKey,
                  JSON.stringify({ at: savedAtMs }),
                );
              } else if (!isCajaNegra) {
                // Only write the special ignore-payload for INGRESO_DESDE_FONDO_VENTAS
                const previous = parseLastCreatedCooldown(
                  localStorage.getItem(createdKey),
                );
                const prevAt = getEffectiveLastCreatedAtMs(previous);
                const ignorePayload: LastCreatedCooldownPayload = {
                  at: savedAtMs,
                  kind: "INGRESO_DESDE_FONDO_VENTAS",
                  ...(prevAt > 0 ? { prevAt } : {}),
                };
                localStorage.setItem(createdKey, JSON.stringify(ignorePayload));
              }
            } catch {
              // ignore storage errors
            }
          }
        }
      } catch {
        // ignore
      }

      // Limpiar flag de edición en progreso
      editingInProgressRef.current = false;

      // Solo actualizar la UI si el guardado fue exitoso
      setFondoEntries(updatedEntries);
      if (saved.ledgerSnapshot) {
        setLedgerSnapshot(saved.ledgerSnapshot);
      }
      if (saved.confirmed) {
        showToast("Movimiento guardado correctamente", "success", 3000);
      } else {
        showToast(
          "Movimiento guardado localmente; pendiente de sincronización (revisa tu conexión).",
          "warning",
          6000,
        );
      }

      // Enviar notificación por correo si el proveedor tiene correonotifi
      sendMovementNotification(entry, "create").catch((err) => {
        console.error(
          "[NOTIFICATION] Error en notificación de movimiento:",
          err,
        );
      });

      // Si hubo un cierre pendiente (marca en localStorage), al crear un movimiento manual se borra.
      if (
        accountKey === "FondoGeneral" &&
        !isAutoAdjustmentProvider(entry.providerCode)
      ) {
        try {
          const key = buildPhysicalCountStorageKey();
          if (key) localStorage.setItem(key, "false");
          cleanupPhysicalCountLegacyKeys();
        } catch {
          // ignore storage errors
        }
      }

      const selectedProviderData = providers.find(
        (p) => p.code === entry.providerCode,
      );
      if (
        selectedProviderData?.name?.toUpperCase() ===
        CIERRE_FONDO_VENTAS_PROVIDER_NAME
      ) {
        setPendingCierreDeCaja(true);
      }
      resetFondoForm();
      if (!movementAutoCloseLocked) {
        setMovementModalOpen(false);
      }

      return true;
    },
    [
      persistMovementToFirestore,
      showToast,
      sendMovementNotification,
      providers,
      accountKey,
      company,
      buildPhysicalCountStorageKey,
      cleanupPhysicalCountLegacyKeys,
      resetFondoForm,
      movementAutoCloseLocked,
      setFondoEntries,
      setLedgerSnapshot,
    ],
  );

  const cancelOpenCreateMovement = useCallback(() => {
    setConfirmOpenCreateMovement(false);
  }, []);

  const resolveShiftManagerForNow = useCallback(
    async (nowISO: string) => {
      const empresa = activeEmpresaForCompany;
      const normalizedCompany = (company || "").trim();
      if (!empresa || !normalizedCompany) return null;

      const companyKeysToTry = (() => {
        const set = new Set<string>();
        set.add(normalizedCompany);
        [empresa?.name, empresa?.ubicacion, empresa?.id]
          .map((v) => (typeof v === "string" ? v.trim() : String(v || "").trim()))
          .filter(Boolean)
          .forEach((v) => set.add(v));
        return Array.from(set);
      })();

      const ymParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date(nowISO));
      const year = Number(ymParts.find((p) => p.type === "year")?.value);
      const month1 = Number(ymParts.find((p) => p.type === "month")?.value);
      const month0 = Math.max(0, Math.min(11, month1 - 1));
      if (!Number.isFinite(year) || !Number.isFinite(month1)) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) => getFGMonthlySchedulesCached(key, year, month0)),
      );
      const monthSchedules = schedulesLists.flat();
      return resolveManagerFromControlHorario({ nowISO, empresa, monthSchedules });
    },
    [activeEmpresaForCompany, company, getFGMonthlySchedulesCached],
  );

  const resolveShiftTimingForNow = useCallback(
    async (nowISO: string) => {
      const empresa = activeEmpresaForCompany;
      const normalizedCompany = (company || "").trim();
      if (!empresa || !normalizedCompany) return null;

      const companyKeysToTry = (() => {
        const set = new Set<string>();
        set.add(normalizedCompany);
        [empresa?.name, empresa?.ubicacion, empresa?.id]
          .map((v) => (typeof v === "string" ? v.trim() : String(v || "").trim()))
          .filter(Boolean)
          .forEach((v) => set.add(v));
        return Array.from(set);
      })();

      const ymParts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Costa_Rica",
        year: "numeric",
        month: "2-digit",
      }).formatToParts(new Date(nowISO));
      const year = Number(ymParts.find((p) => p.type === "year")?.value);
      const month1 = Number(ymParts.find((p) => p.type === "month")?.value);
      const month0 = Math.max(0, Math.min(11, month1 - 1));
      if (!Number.isFinite(year) || !Number.isFinite(month1)) return null;

      const schedulesLists = await Promise.all(
        companyKeysToTry.map((key) => getFGMonthlySchedulesCached(key, year, month0)),
      );
      const monthSchedules = schedulesLists.flat();
      return getControlHorarioShiftTiming({ nowISO, empresa, monthSchedules });
    },
    [activeEmpresaForCompany, company, getFGMonthlySchedulesCached],
  );

  useEffect(() => {
    const shouldAuto =
      isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      movementModalOpen;

    if (!shouldAuto) {
      setManagerLockedByShift(false);
      return;
    }

    let cancelled = false;
    const tick = async () => {
      try {
        const nowISO = new Date().toISOString();
        const resolution = await resolveShiftManagerForNow(nowISO);
        if (cancelled || !resolution) return;

        if (resolution.mode === "manual") {
          setManagerLockedByShift(false);
          return;
        }

        if (resolution.mode === "missing") {
          setManagerLockedByShift(false);
          return;
        }

        setManagerLockedByShift(true);
        if (resolution.mode === "auto") {
          setManager(resolution.manager);
          setManagerError("");
        }
      } catch (err) {
        console.error("[FG] Error auto-locking manager by shift:", err);
      }
    };

    void tick();
    const interval = window.setInterval(tick, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    accountKey,
    isRegularUser,
    movementModalOpen,
    namespace,
    resolveShiftManagerForNow,
  ]);

  const handleSubmitFondo = async () => {
    if (!company) return;
    if (isSaving || movementSubmitInProgressRef.current) return; // Prevenir múltiples envíos

    let hasErrors = false;
    const nowISO = new Date().toISOString();
    let effectiveManager = manager;

    const effectiveInvoiceNumber =
      isCajaNegra && !editingEntryId ? getTodayInvoiceMMDD() : invoiceNumber;

    if (!selectedProvider) {
      setProviderError("Selecciona un proveedor");
      hasErrors = true;
    } else {
      setProviderError("");
    }

    const providerExists = selectedProviderExists;
    if (
      !providerExists &&
      !(editingEntryId && editingEntry?.providerCode === selectedProvider)
    ) {
      setProviderError("Proveedor no válido");
      hasErrors = true;
    }

    if (!/^[0-9]{1,4}$/.test(effectiveInvoiceNumber)) {
      setInvoiceError("Ingresa un número de factura válido (1-4 dígitos)");
      hasErrors = true;
    } else {
      setInvoiceError("");
    }

    const shouldAutoManagerFromControlHorario =
      isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      !editingEntryId &&
      !isDelifoodCompany;

    if (shouldAutoManagerFromControlHorario) {
      try {
        const empresa = activeEmpresaForCompany;
        if (empresa) {
          const normalizedCompany = (company || "").trim();
          const companyKeysToTry = (() => {
            const set = new Set<string>();
            if (normalizedCompany) set.add(normalizedCompany);
            [empresa?.name, empresa?.ubicacion, empresa?.id]
              .map((v) =>
                typeof v === "string" ? v.trim() : String(v || "").trim(),
              )
              .filter(Boolean)
              .forEach((v) => set.add(v));
            return Array.from(set);
          })();

          const parts = new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Costa_Rica",
            year: "numeric",
            month: "2-digit",
          }).formatToParts(new Date(nowISO));
          const year = Number(parts.find((p) => p.type === "year")?.value);
          const month1 = Number(parts.find((p) => p.type === "month")?.value);
          const month0 = Math.max(0, Math.min(11, month1 - 1));

          if (Number.isFinite(year) && Number.isFinite(month1)) {
            const schedulesLists = await Promise.all(
              companyKeysToTry.map((key) =>
                getFGMonthlySchedulesCached(key, year, month0),
              ),
            );
            const monthSchedules = schedulesLists.flat();
            const resolution = resolveManagerFromControlHorario({
              nowISO,
              empresa,
              monthSchedules,
            });

            if (resolution.mode === "missing") {
              setMissingShiftExpectedShift(resolution.expectedShift);
              setMissingShiftDateKey(resolution.dateKey);
              setMissingShiftModalOpen(true);
              return;
            }

            if (resolution.mode === "auto") {
              effectiveManager = resolution.manager;
              setManager(resolution.manager);
              setManagerError("");
            }
          }
        }
      } catch (err) {
        console.error("[FG] Error resolving manager from control horario:", err);
      }
    }

    const trimmedManager2 = manager2.trim();
    if (isEditingPaidFcrMovement) {
      setManagerError("");
      if (!trimmedManager2) {
        setManager2Error("Selecciona quien pagó la factura");
        hasErrors = true;
      } else {
        setManager2Error("");
      }
    } else if (!effectiveManager) {
      setManagerError("Selecciona un encargado");
      hasErrors = true;
    } else {
      setManagerError("");
      setManager2Error("");
    }
    const egresoValue = isEgreso ? Number.parseInt(egreso, 10) : 0;
    const ingresoValue = isIngreso ? Number.parseInt(ingreso, 10) : 0;
    const trimmedNotes = notes.trim();
    const movementSelectedProviderData = movementProviders.find(
      (p) => p.code === selectedProvider,
    );
    const shouldMirrorMovementToFacturas = !isCajaNegra && isInventoryPurchaseProviderType(
      movementSelectedProviderData?.type,
    );

    if (isEgreso && (Number.isNaN(egresoValue) || egresoValue <= 0)) {
      setAmountError("Ingresa un monto válido para egreso");
      hasErrors = true;
    } else if (isIngreso && (Number.isNaN(ingresoValue) || ingresoValue <= 0)) {
      setAmountError("Ingresa un monto válido para ingreso");
      hasErrors = true;
    } else {
      setAmountError("");
    }

    if (hasErrors) return;

    const selectedZeroAmountNC = selectedAppliedCreditNoteIds.some((id) =>
      selectedProviderPendingCreditNotes.some(
        (note) => note.id === id && note.amount === 0,
      ),
    );
    if (selectedZeroAmountNC) {
      setPendingZeroAmountCreditNoteModalOpen(true);
      return;
    }

    if (isEgreso && (Number.isNaN(egresoValue) || egresoValue <= 0)) return;
    if (isIngreso && (Number.isNaN(ingresoValue) || ingresoValue <= 0)) return;

    const effectiveInvoiceDocType = normalizeInvoiceDocType(invoiceDocType) as "FCO" | "FCR";
    if (!editingEntryId && effectiveInvoiceDocType === "FCR") {
      setInvoiceError(
        "Las facturas a crédito se crean desde Facturas de crédito y notas de crédito.",
      );
      return;
    }

    if (effectiveInvoiceDocType === "FCR" && !shouldMirrorMovementToFacturas) {
      setInvoiceError(
        'Solo los proveedores de tipo "COMPRA INVENTARIO" pueden generar facturas.',
      );
      return;
    }

    const buildAppliedCreditNotes = (
      invoiceAmount: number,
    ): { notes: AppliedCreditNote[]; total: number; amountPayment: number } => {
      if (!isEgreso || editingEntryId || effectiveInvoiceDocType !== "FCO") {
        return { notes: [], total: 0, amountPayment: invoiceAmount };
      }

      const selectedIds = new Set(selectedAppliedCreditNoteIds);
      let remaining = Math.max(0, Math.trunc(invoiceAmount));
      let total = 0;
      const notes: AppliedCreditNote[] = [];

      selectedProviderPendingCreditNotes.forEach((note) => {
        if (remaining <= 0 || !selectedIds.has(note.id)) return;
        if (note.currency !== movementCurrency) return;
        const appliedAmount = Math.min(
          remaining,
          Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
        );
        if (appliedAmount <= 0) return;
        total += appliedAmount;
        remaining -= appliedAmount;
        notes.push({
          id: note.id,
          invoiceNumber: note.invoiceNumber,
          amount: note.amount,
          appliedAmount,
          currency: note.currency,
        });
      });

      return {
        notes,
        total,
        amountPayment: roundCreditNotePaymentAmount(
          Math.max(0, Math.trunc(invoiceAmount) - total),
          movementCurrency,
          accountKey,
        ),
      };
    };
    const selectedCreditNotesRequestedTotal =
      isEgreso && effectiveInvoiceDocType === "FCO"
        ? selectedProviderPendingCreditNotes.reduce((sum, note) => {
            if (!selectedAppliedCreditNoteIds.includes(note.id)) return sum;
            if (note.currency !== movementCurrency) return sum;
            return sum + Math.max(0, Math.trunc(note.balanceDue));
          }, 0)
        : 0;
    if (
      isEgreso &&
      effectiveInvoiceDocType === "FCO" &&
      selectedCreditNotesRequestedTotal > egresoValue
    ) {
      showToast(
        "Las notas de credito seleccionadas superan el saldo disponible. Desmarca alguna para continuar.",
        "error",
        5000,
      );
      return;
    }
    const creditNoteApplication = buildAppliedCreditNotes(egresoValue);
    const manualCreditNoteAppliedAmount =
      isEgreso && effectiveInvoiceDocType === "FCO" && manualCreditNoteDraft
        ? Math.min(
            manualCreditNoteDraft.amount,
            Math.max(0, egresoValue - creditNoteApplication.total),
          )
        : 0;
    const totalCreditNotesAppliedAmount =
      creditNoteApplication.total + manualCreditNoteAppliedAmount;
    const roundedInvoicePaymentAmount = roundCreditNotePaymentAmount(
      Math.max(0, egresoValue - totalCreditNotesAppliedAmount),
      movementCurrency,
      accountKey,
    );
    const selectedCreditInvoiceIdSet = new Set(selectedPendingCreditInvoiceIds);
    const selectedCreditInvoicesTotal = isEgreso
      ? selectedProviderPendingCreditInvoices.reduce((sum, invoice) => {
          if (!selectedCreditInvoiceIdSet.has(invoice.id)) return sum;
          if (invoice.currency !== movementCurrency) return sum;
          return sum + Math.max(0, Math.trunc(invoice.balanceDue));
        }, 0)
      : 0;
    const egresoBalanceImpact =
      isEgreso && effectiveInvoiceDocType === "FCO"
        ? roundedInvoicePaymentAmount + selectedCreditInvoicesTotal
        : egresoValue;

    // Validar que no quede saldo negativo en la moneda del movimiento.
    // Nota: este límite de “saldo insuficiente” solo aplica para usuarios regulares.
    // Admin/Superadmin pueden registrar egresos que dejen saldo negativo.
    // En edición se revierte primero el impacto del movimiento original.
    if (
      isEgreso &&
      effectiveInvoiceDocType !== "FCR" &&
      !isAdminUser &&
      !isSuperAdminUser
    ) {
      const currentBalance =
        movementCurrency === "USD"
          ? ledgerSnapshot.currentUSD
          : ledgerSnapshot.currentCRC;

      let effectiveBalance = currentBalance;
      if (editingEntryId) {
        const originalEntry = fondoEntries.find((e) => e.id === editingEntryId);
        if (originalEntry) {
          const originalCurrency: MovementCurrencyKey =
            originalEntry.currency === "USD" ? "USD" : "CRC";
          if (originalCurrency === movementCurrency) {
            effectiveBalance += resolveEffectiveEgresoAmount(originalEntry);
            effectiveBalance -= Math.trunc(
              Number(originalEntry.amountIngreso) || 0,
            );
          }
        }
      }
      const resultingBalance = effectiveBalance - egresoBalanceImpact;
      console.log(
        `Validando saldo negativo: effectiveBalance=${effectiveBalance}, egresoValue=${egresoBalanceImpact}, resultingBalance=${resultingBalance}`,
      );

      if (resultingBalance < 0) {
        setNegativeBalanceModal({
          open: true,
          amount: egresoBalanceImpact,
          currency: movementCurrency,
          resultingNegativeAmount: resultingBalance,
        });
        return;
      }
    }

    const paddedInvoice = effectiveInvoiceNumber.padStart(4, "0");

    // Dedupe window only for NEW movements (edits remain allowed)
    if (!editingEntryId) {
      try {
        const normalizedCompany = (company || "").trim();
        if (normalizedCompany.length > 0) {
          // Enforce minimum interval between ANY new movements
          const nowMs = Date.now();
          const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${accountKey}`;
          let lastCreatedAtMs = lastMovementCreatedAtRef.current;
          if (typeof window !== "undefined") {
            try {
              const payload = parseLastCreatedCooldown(
                localStorage.getItem(createdKey),
              );
              const effectiveAt = getEffectiveLastCreatedAtMs(payload);
              if (effectiveAt > 0) {
                lastCreatedAtMs = Math.max(lastCreatedAtMs, effectiveAt);
              }
            } catch {
              // ignore
            }
          }

          // Admins/Superadmins are exempt from the 1-minute cooldown.
          // Additionally, if the NEW movement is "INGRESO DESDE FONDO VENTAS",
          // it should NOT be blocked by a prior movement's cooldown.
          const providerForSelected = movementProviders.find(
            (p) => p.code === selectedProvider,
          );
          const providerDisplayForSelected =
            providerForSelected?.name || selectedProvider;
          const newIsIngresoDesdeFV = isIngresoDesdeFondoVentasMovement(
            {
              providerCode: selectedProvider,
              paymentType,
              notes: trimmedNotes,
            },
            providerDisplayForSelected,
          );

          if (!newIsIngresoDesdeFV) {
            if (
              !isAdminUser &&
              !isSuperAdminUser &&
              !isCajaNegra &&
              lastCreatedAtMs > 0 &&
              nowMs - lastCreatedAtMs < k91_xad
            ) {
              const remainingMs = k91_xad - (nowMs - lastCreatedAtMs);
              const remainingSec = Math.ceil(remainingMs / 1000);
              showToast(
                `Espere ${formatToastWaitTime(remainingSec)} para agregar otro movimiento.`,
                "warning",
                5000,
              );
              return;
            }
          }

          const fingerprintParts = [
            `provider=${selectedProvider || ""}`,
            `invoice=${paddedInvoice || ""}`,
            `invoiceDocType=${normalizeInvoiceDocType(invoiceDocType)}`,
            `type=${paymentType || ""}`,
            `egreso=${Math.trunc(isEgreso ? egresoValue : 0)}`,
            `payment=${Math.trunc(
              isEgreso && effectiveInvoiceDocType === "FCO"
                ? creditNoteApplication.amountPayment
                : 0,
            )}`,
            `creditInvoices=${Math.trunc(selectedCreditInvoicesTotal)}`,
            `ingreso=${Math.trunc(isIngreso ? ingresoValue : 0)}`,
            `manager=${(manager || "").trim()}`,
            `currency=${movementCurrency || "CRC"}`,
            `notes=${trimmedNotes}`,
          ];
          const fingerprint = fingerprintParts.join("|");
          const key = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${accountKey}`;

          let last = lastMovementDedupeRef.current;
          if (!last && typeof window !== "undefined") {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw) as any;
                if (
                  parsed &&
                  typeof parsed.at === "number" &&
                  typeof parsed.fingerprint === "string"
                ) {
                  last = { at: parsed.at, fingerprint: parsed.fingerprint };
                }
              }
            } catch {
              // ignore
            }
          }

          if (
            last &&
            last.fingerprint === fingerprint &&
            nowMs - last.at < r7n_vyx &&
            !isCajaNegra
          ) {
            const remainingMs = r7n_vyx - (nowMs - last.at);
            const remainingSec = Math.ceil(remainingMs / 1000);
            showToast(
              `Movimiento duplicado detectado. Espere ${formatToastWaitTime(
                remainingSec,
              )} para volver a guardarlo.`,
              "warning",
              5000,
            );
            return;
          }

          // lock immediately to avoid double-click duplicates before state updates
          movementSubmitInProgressRef.current = true;
        }
      } catch {
        // If dedupe fails for any reason, still lock to prevent double-submit
        movementSubmitInProgressRef.current = true;
      }
    }

    setIsSaving(true);

    try {
      if (editingEntryId) {
        // Update the existing entry in-place so balances remain correct.
        const original = fondoEntries.find((e) => e.id === editingEntryId);
        if (!original) {
          setIsSaving(false);
          return;
        }

        const isEditingPaidFcr = isPaidFcrMovement(original);
        const originalManager2 = String(original.manager2 || "").trim();
        const effectiveManager = isEditingPaidFcr ? original.manager : manager;
        const effectiveManager2 = isEditingPaidFcr
          ? trimmedManager2
          : originalManager2;

        const changes: string[] = [];
        if (selectedProvider !== original.providerCode)
          changes.push(
            `Proveedor: ${original.providerCode} → ${selectedProvider}`,
          );
        if (paddedInvoice !== original.invoiceNumber)
          changes.push(
            `N° factura: ${original.invoiceNumber} → ${paddedInvoice}`,
          );
        if (paymentType !== original.paymentType)
          changes.push(`Tipo: ${original.paymentType} → ${paymentType}`);
        const originalAmount = isEgresoType(original.paymentType)
          ? original.amountEgreso
          : original.amountIngreso;
        const newAmount = isEgreso ? egresoValue : ingresoValue;
        if (Number.isFinite(originalAmount) && originalAmount !== newAmount)
          changes.push(`Monto: ${originalAmount} → ${newAmount}`);
        if (!isEditingPaidFcr && manager !== original.manager)
          changes.push(`Encargado: ${original.manager} → ${manager}`);
        if (isEditingPaidFcr && effectiveManager2 !== originalManager2)
          changes.push(
            `Encargado pago: ${originalManager2 || "(vacío)"} → ${effectiveManager2 || "(vacío)"}`,
          );
        if (trimmedNotes !== (original.notes ?? ""))
          changes.push(`Notas: "${original.notes}" → "${trimmedNotes}"`);

        // Preparar el movimiento editado ANTES de persistir
        let updatedEntry: FondoEntry | null = null;
        const updatedEntries = fondoEntries.map((e) => {
          if (e.id !== editingEntryId) return e;
          // append to existing history if present
          let history: any[] = [];
          try {
            const existing = e.auditDetails
              ? (JSON.parse(e.auditDetails) as any)
              : null;
            if (existing && Array.isArray(existing.history))
              history = existing.history.slice();
            else if (existing && existing.before && existing.after)
              history = [
                {
                  at: existing.at ?? e.createdAt,
                  before: existing.before,
                  after: existing.after,
                },
              ];
          } catch {
            history = [];
          }

          // Validar límite máximo de ediciones
          if (history.length >= MAX_AUDIT_EDITS) {
            showToast(
              `No se pueden realizar más de ${MAX_AUDIT_EDITS} ediciones en un mismo movimiento`,
              "error",
            );
            return e; // No permitir más ediciones
          }

          const previousAppliedNotes = Array.isArray(e.appliedCreditNotes)
            ? e.appliedCreditNotes
            : [];
          let remainingAppliedBase = isEgreso ? egresoValue : 0;
          const nextAppliedCreditNotes = previousAppliedNotes.reduce<
            AppliedCreditNote[]
          >((acc, note) => {
            if (remainingAppliedBase <= 0) return acc;
            const appliedAmount = Math.min(
              remainingAppliedBase,
              Math.max(0, Math.trunc(Number(note.appliedAmount) || 0)),
            );
            if (appliedAmount > 0) {
              acc.push({ ...note, appliedAmount });
              remainingAppliedBase -= appliedAmount;
            }
            return acc;
          }, []);
          const nextAppliedTotal = nextAppliedCreditNotes.reduce(
            (sum, note) => sum + Math.max(0, Math.trunc(note.appliedAmount)),
            0,
          );
          const nextAmountPayment =
            isEgreso && nextAppliedCreditNotes.length > 0
              ? Math.max(0, egresoValue - nextAppliedTotal)
              : undefined;

          // Crear registro simplificado con solo los campos que cambiaron
          const changedFields = getChangedFields(
            {
              providerCode: e.providerCode,
              invoiceNumber: e.invoiceNumber,
              invoiceDocType: normalizeInvoiceDocType(
                (e as any).invoiceDocType,
              ),
              paymentType: e.paymentType,
              amountEgreso: e.amountEgreso,
              amountIngreso: e.amountIngreso,
              amountPayment: e.amountPayment,
              appliedCreditNotes: e.appliedCreditNotes,
              manager: e.manager,
              manager2: e.manager2,
              notes: e.notes,
              currency: e.currency,
            },
            {
              providerCode: selectedProvider,
              invoiceNumber: paddedInvoice,
              invoiceDocType: normalizeInvoiceDocType(invoiceDocType),
              paymentType,
              amountEgreso: isEgreso ? egresoValue : 0,
              amountIngreso: isEgreso ? 0 : ingresoValue,
              amountPayment: nextAmountPayment,
              appliedCreditNotes: nextAppliedCreditNotes,
              manager: effectiveManager,
              manager2: effectiveManager2,
              notes: trimmedNotes,
              currency: movementCurrency,
            },
          );
          const newRecord = { at: new Date().toISOString(), ...changedFields };
          history.push(newRecord);
          // Comprimir historial para evitar QuotaExceededError
          const compressedHistory = compressAuditHistory(history);
          // keep original createdAt so chronological order and balances are preserved
          const baseAmountDue = Math.max(0, Math.trunc(Number(e.amountDue ?? e.balanceDue) || 0));
          const basePaymentAmount = Math.max(0, Math.trunc(Number(e.amountEgreso) || 0));
          const newPaymentAmount = isEgreso ? egresoValue : 0;
          const nextAmountDue = isEditingPaidFcr
            ? Math.max(0, baseAmountDue - (newPaymentAmount - basePaymentAmount))
            : baseAmountDue;
          updatedEntry = {
            ...e,
            providerCode: selectedProvider,
            invoiceNumber: paddedInvoice,
            invoiceDocType: normalizeInvoiceDocType(invoiceDocType),
            accountId: accountKey,
            empresa: company,
            paymentType,
            amountEgreso: isEgreso ? egresoValue : 0,
            amountIngreso: isEgreso ? 0 : ingresoValue,
            amountPayment: nextAmountPayment,
            amountDue: nextAmountDue,
            balanceDue: nextAmountDue,
            appliedCreditNotes:
              nextAppliedCreditNotes.length > 0
                ? nextAppliedCreditNotes
                : undefined,
            manager: effectiveManager,
            manager2: effectiveManager2 || undefined,
            notes: trimmedNotes,
            // mark as edited/audited and preserve originalEntryId (point to initial id)
            isAudit: true,
            originalEntryId: e.originalEntryId ?? e.id,
            auditDetails: JSON.stringify({ history: compressedHistory }),
            currency: movementCurrency,
          } as FondoEntry;
          return updatedEntry;
        });

        // PRIMERO persistir a Firestore, LUEGO actualizar UI
        const saved = await persistMovementToFirestore(updatedEntries, "edit", {
          upsert: updatedEntry ?? undefined,
          before: original,
        });

        if (!saved.ok) {
          showToast(
            "Error al guardar el movimiento. Por favor, intente de nuevo.",
            "error",
            5000,
          );
          setIsSaving(false);
          editingInProgressRef.current = false;
          return;
        }

        // Registrar timestamp de la última edición guardada
        lastEditSaveTimestampRef.current = Date.now();
        editingInProgressRef.current = false;

        // Solo actualizar la UI si el guardado fue exitoso
        setFondoEntries(updatedEntries);
        if (saved.ledgerSnapshot) {
          setLedgerSnapshot(saved.ledgerSnapshot);
        }

        // Mantener una copia en Facturas (best-effort)
        if (updatedEntry) {
          const facturaEntry = updatedEntry as FondoEntry;
          const normalizedCompany = (company || "").trim();
          if (isPaidFcrMovement(facturaEntry) && !isCajaNegra) {
            // Actualizar la factura original al editar un abono
            const paymentId = String(facturaEntry.id || "");
            const prefix = "fcr-pago-";
            if (paymentId.startsWith(prefix) && normalizedCompany.length > 0) {
              const rest = paymentId.slice(prefix.length);
              const invoiceIdMatch = rest.match(/^(FAC-\d+-[A-Z0-9]+)-/);
              if (invoiceIdMatch) {
                const invoiceId = invoiceIdMatch[1];
                const invoiceRef = FacturasService.buildMovementRef(normalizedCompany, invoiceId);
                try {
                  const invoiceSnap = await getDoc(invoiceRef);
                  if (invoiceSnap.exists()) {
                    const invoiceData = invoiceSnap.data() as FacturaMovement;
                    const oldPaymentAmount = Math.max(0, Math.trunc(Number(original.amountEgreso) || 0));
                    const newPaymentAmount = Math.max(0, Math.trunc(Number(facturaEntry.amountEgreso) || 0));
                    const diff = newPaymentAmount - oldPaymentAmount;
                    if (diff !== 0) {
                      const totalAmount = Math.max(0, Math.trunc(Number(invoiceData.originalAmount ?? invoiceData.amount) || 0));
                      const currentPaid = Math.max(0, Math.trunc(Number(invoiceData.paidAmount) || 0));
                      const nextPaid = Math.min(totalAmount, Math.max(0, currentPaid + diff));
                      const nextBalance = Math.max(0, totalAmount - nextPaid);
                      const nextStatus = nextBalance === 0 ? "PAGADA" : nextPaid > 0 ? "PARCIAL" : "PENDIENTE";
                      await FacturasService.upsertMovement(normalizedCompany, {
                        ...(invoiceData as any),
                        id: invoiceId,
                        empresa: normalizedCompany,
                        paidAmount: nextPaid,
                        balanceDue: nextBalance,
                        paymentStatus: nextStatus,
                      } as FacturaMovement);
                    }
                  }
                } catch { /* fallo al leer factura */ }
              }
            }
          } else {
            if (normalizedCompany.length > 0) {
              if (shouldMirrorMovementToFacturas) {
                const facturaAmount = Math.abs(
                  (facturaEntry.amountIngreso || 0) -
                    (facturaEntry.amountEgreso || 0),
                );
                const facturaCopy: FacturaMovement = {
                  id: String(facturaEntry.id),
                  empresa: normalizedCompany,
                  accountId: accountKey,
                  amount: facturaAmount,
                  providerCode: facturaEntry.providerCode,
                  invoiceNumber: facturaEntry.invoiceNumber,
                  invoiceDocType: normalizeInvoiceDocType(
                    (facturaEntry as any).invoiceDocType,
                  ),
                  paymentType: facturaEntry.paymentType,
                  amountEgreso: facturaEntry.amountEgreso,
                  amountIngreso: facturaEntry.amountIngreso,
                  amountPayment: facturaEntry.amountPayment,
                  appliedCreditNotes: facturaEntry.appliedCreditNotes,
                  manager: facturaEntry.manager,
                  manager2: facturaEntry.manager2,
                  notes: facturaEntry.notes,
                  createdAt: facturaEntry.createdAt,
                  currency: facturaEntry.currency === "USD" ? "USD" : "CRC",
                };
                void FacturasService.upsertMovement(
                  normalizedCompany,
                  facturaCopy,
                );
              }
            }
          }
        }
        if (saved.confirmed) {
          showToast("Movimiento editado correctamente", "success", 3000);
        } else {
          showToast(
            "Edición guardada localmente; pendiente de sincronización (revisa tu conexión).",
            "warning",
            6000,
          );
        }

        // Enviar notificación por correo si el proveedor tiene correonotifi
        const editedEntry = updatedEntries.find((e) => e.id === editingEntryId);
        if (editedEntry) {
          sendMovementNotification(editedEntry, "edit").catch((err) => {
            console.error(
              "[NOTIFICATION] Error en notificación de movimiento editado:",
              err,
            );
          });
        }

        try {
          // compute simple before/after CRC balances to help debug balance update issues
          const sumBalance = (entries: FondoEntry[]) => {
            let ingresosCRC = 0;
            let egresosCRC = 0;
            entries.forEach((en) => {
              const cur = (en.currency as "CRC" | "USD") || "CRC";
              if (cur === "CRC") {
                ingresosCRC += en.amountIngreso || 0;
                egresosCRC += resolveEffectiveEgresoAmount(en);
              }
            });
            return (Number(initialAmount) || 0) + ingresosCRC - egresosCRC;
          };
          const beforeBalance = sumBalance(fondoEntries);
          const afterBalance = sumBalance(updatedEntries);
          console.info("[FG-DEBUG] Edited movement saved", editingEntryId, {
            prevCount: fondoEntries.length,
            nextCount: updatedEntries.length,
            beforeBalanceCRC: beforeBalance,
            afterBalanceCRC: afterBalance,
          });
        } catch {
          console.info(
            "[FG-DEBUG] Edited movement saved (error computing debug balances)",
            editingEntryId,
          );
        }

        resetFondoForm();
        if (!movementAutoCloseLocked) {
          setMovementModalOpen(false);
        }
        setIsSaving(false);
        return;
      }

      // CREAR nuevo movimiento
      // If this is a CIERRE FONDO VENTAS movement, prevent concurrent Fondo General closings (and vice versa)
      let closingGuard: { token: string; docId: string } | null = null;
      try {
        const normalizedCompany = (company || "").trim();
        const requiresDuplicateInvoiceCheck =
          shouldMirrorMovementToFacturas &&
          isInventoryPurchasePaymentType(paymentType);
        const previousInvoiceMovement = requiresDuplicateInvoiceCheck
          ? await findLatestMovementByInvoiceNumber(
              normalizedCompany,
              paddedInvoice,
              selectedProvider,
            )
          : null;

        if (previousInvoiceMovement) {
          console.log(
            "[INVOICE-DUPLICATE] Coincidencia detectada antes de guardar COMPRA DE INVENTARIO.",
            {
              company: normalizedCompany,
              invoiceNumber: paddedInvoice,
              previousMovementId: previousInvoiceMovement.id,
            },
          );
        }

        const selectedProviderData = providers.find(
          (p) => p.code === selectedProvider,
        );
        const isCierreVentas =
          selectedProviderData?.name?.toUpperCase() ===
          CIERRE_FONDO_VENTAS_PROVIDER_NAME;
        // Enforce cross-device guard ONLY for regular users.
        // Admin/superadmin are allowed to create a closing even during the lock window.
        if (normalizedCompany.length > 0 && isCierreVentas && isRegularUser) {
          const acquired = await acquireClosingGuard(
            normalizedCompany,
            "FONDO_VENTAS",
          );
          if (!acquired.ok) {
            const kindLabel =
              acquired.lockedKind === "FONDO_GENERAL"
                ? "Fondo General"
                : acquired.lockedKind === "FONDO_VENTAS"
                  ? "Fondo Ventas"
                  : "otro cierre";
            showToast(
              `Otro cierre (${kindLabel}) se está registrando. Intente en ${formatToastWaitTime(
                acquired.remainingSec,
              )}.`,
              "warning",
              6000,
            );
            return;
          }
          closingGuard = { token: acquired.token, docId: acquired.docId };
        }

        const now = new Date();
        const iso = now.toISOString();
        // Use local time for the document id to avoid UTC surprises when searching by hour.
        const yyyy = now.getFullYear();
        const MM = String(now.getMonth() + 1).padStart(2, "0");
        const DD = String(now.getDate()).padStart(2, "0");
        const HH = String(now.getHours()).padStart(2, "0");
        const mm = String(now.getMinutes()).padStart(2, "0");
        const ss = String(now.getSeconds()).padStart(2, "0");
        const mmm = String(now.getMilliseconds()).padStart(3, "0");
        const dateKey = `${yyyy}_${MM}_${DD}`; // YYYY_MM_DD (local)
        const timeKey = `${HH}_${mm}_${ss}_${mmm}`; // HH_MM_SS_mmm (local, URL-safe)
        const movementId = `${dateKey}-${timeKey}_${accountKey}`;
        const manualCreditNoteApplied =
          isEgreso &&
          effectiveInvoiceDocType === "FCO" &&
          manualCreditNoteDraft &&
          manualCreditNoteAppliedAmount > 0
            ? [
                {
                  id: `manual-nc-${movementId}`,
                  invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                  amount: manualCreditNoteDraft.amount,
                  appliedAmount: manualCreditNoteAppliedAmount,
                  currency: movementCurrency,
                  observation: manualCreditNoteDraft.observation,
                } as AppliedCreditNote,
              ]
            : [];
        const appliedCreditNotes = [
          ...creditNoteApplication.notes,
          ...manualCreditNoteApplied,
        ];
        const totalAppliedCreditNotes =
          creditNoteApplication.total +
          manualCreditNoteApplied.reduce(
            (sum, note) => sum + Math.max(0, Math.trunc(note.appliedAmount)),
            0,
          );
        const entry: FondoEntry = {
          id: movementId,
          empresa: company,
          accountId: accountKey,
          providerCode: selectedProvider,
          invoiceNumber: paddedInvoice,
          invoiceDocType: effectiveInvoiceDocType,
          paymentType,
          amountEgreso: isEgreso ? egresoValue : 0,
          amountIngreso: isIngreso ? ingresoValue : 0,
          amountPayment:
            isEgreso && effectiveInvoiceDocType === "FCO"
              ? roundCreditNotePaymentAmount(
                  Math.max(0, egresoValue - totalAppliedCreditNotes),
                  movementCurrency,
                  accountKey,
                )
              : undefined,
          appliedCreditNotes:
             appliedCreditNotes.length > 0 ? appliedCreditNotes : undefined,
          manager: effectiveManager,
          notes: trimmedNotes,
          createdAt: iso,
          currency: movementCurrency,
        };

        // Crédito (FCR): se registra solo en Facturas y NO afecta el Fondo.
        if (effectiveInvoiceDocType === "FCR") {
          if (!shouldMirrorMovementToFacturas) {
            showToast(
              'Solo los proveedores de tipo "COMPRA INVENTARIO" pueden generar facturas.',
              "error",
              5000,
            );
            return;
          }
          const normalizedCompany = (company || "").trim();
          if (normalizedCompany.length === 0) {
            showToast(
              "No se pudo registrar la factura: falta empresa.",
              "error",
              5000,
            );
            return;
          }

          if (shouldMirrorMovementToFacturas) {
            const facturaCopy: FacturaMovement = {
              id: entry.id,
              empresa: normalizedCompany,
              accountId: accountKey,
              amount: Math.abs(
                (entry.amountIngreso || 0) - (entry.amountEgreso || 0),
              ),
              providerCode: entry.providerCode,
              invoiceNumber: entry.invoiceNumber,
              invoiceDocType: "FCR",
              paymentType: entry.paymentType,
              amountEgreso: entry.amountEgreso,
              amountIngreso: entry.amountIngreso,
              manager: entry.manager,
              notes: entry.notes,
              createdAt: entry.createdAt,
              currency: entry.currency === "USD" ? "USD" : "CRC",
            };

            await FacturasService.upsertMovement(
              normalizedCompany,
              facturaCopy,
            );
          }

          try {
            await ProvidersService.incrementMovementCount(
              normalizedCompany,
              selectedProvider,
            );
          } catch (err) {
            console.warn(
              "[FG] Could not increment provider movement count (FCR):",
              err,
            );
          }

          // Notificación por correo (mismo comportamiento)
          sendMovementNotification(entry, "create").catch((err) => {
            console.error(
              "[NOTIFICATION] Error en notificación de movimiento (FCR):",
              err,
            );
          });

          showToast("Factura a crédito registrada", "success", 3000);
          resetFondoForm();
          if (!movementAutoCloseLocked) {
            setMovementModalOpen(false);
          }
          return;
        }

        // Preparar la lista actualizada ANTES de persistir
        const updatedEntries = [entry, ...fondoEntries];
        const createdOk = await persistCreatedMovement(entry, updatedEntries);

        if (createdOk && previousInvoiceMovement) {
          void sendDuplicateInvoiceAlertEmail({
            company,
            ownerAdminEmail,
            activeOwnerId,
            userEmail: user?.email,
            currentEntry: entry,
            previousEntry: previousInvoiceMovement,
            resolveProviderName: (providerCode: string) =>
              providers.find((p) => p.code === providerCode)?.name ||
              providerCode,
          });
        }

        if (createdOk) {
          try {
            if (normalizedCompany.length > 0) {
              await ProvidersService.incrementMovementCount(
                normalizedCompany,
                selectedProvider,
              );
            }
          } catch (err) {
            console.warn(
              "[FG] Could not increment provider movement count:",
              err,
            );
          }

          if (normalizedCompany.length > 0 && manualCreditNoteDraft) {
            try {
              if (shouldMirrorMovementToFacturas) {
                const manualCreditNoteMovement: FacturaMovement = {
                  id: `${entry.id}-NC`,
                  empresa: normalizedCompany,
                  accountId: accountKey,
                  amount: manualCreditNoteDraft.amount,
                  amountEgreso: 0,
                  amountIngreso: manualCreditNoteDraft.amount,
                  amountPayment: manualCreditNoteDraft.amount,
                  balanceDue: 0,
                  createdAt: entry.createdAt,
                  currency: movementCurrency,
                  invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                  manager,
                  manager2: manager2 || undefined,
                  notes: manualCreditNoteDraft.observation ?? "",
                  invoiceDocType: "NC",
                  paymentType,
                  providerCode: selectedProvider,
                  paidAmount: manualCreditNoteDraft.amount,
                  paymentStatus: "PAGADA",
                };
                await FacturasService.upsertMovement(
                  normalizedCompany,
                  manualCreditNoteMovement,
                );
              }
            } catch (err) {
              console.warn("[FG] Could not upsert manual NC in Facturas:", err);
            }
          }

          if (
            normalizedCompany.length > 0 &&
            entry.appliedCreditNotes &&
            entry.appliedCreditNotes.length > 0
          ) {
            try {
              const batch = writeBatch(db);
              entry.appliedCreditNotes.forEach((note) => {
                const pendingNote = selectedProviderPendingCreditNotes.find(
                  (item) => item.id === note.id,
                );
                if (!pendingNote) return;
                const nextPaidAmount = Math.min(
                  pendingNote.amount,
                  pendingNote.paidAmount + note.appliedAmount,
                );
                const nextBalanceDue = Math.max(
                  0,
                  pendingNote.amount - nextPaidAmount,
                );
                batch.set(
                  FacturasService.buildMovementRef(normalizedCompany, note.id),
                  {
                    paidAmount: nextPaidAmount,
                    balanceDue: nextBalanceDue,
                    paymentStatus: nextBalanceDue === 0 ? "REBAJADA" : "PARCIAL",
                    updateAt: entry.createdAt,
                  },
                  { merge: true },
                );
              });
              await batch.commit();
              setSelectedProviderPendingCreditNotes((prev) =>
                prev
                  .map((note) => {
                    const applied = entry.appliedCreditNotes?.find(
                      (item) => item.id === note.id,
                    );
                    if (!applied) return note;
                    const paidAmount = Math.min(
                      note.amount,
                      note.paidAmount + applied.appliedAmount,
                    );
                    return {
                      ...note,
                      paidAmount,
                      balanceDue: Math.max(0, note.amount - paidAmount),
                    };
                  })
                  .filter((note) => note.balanceDue > 0),
              );
              setSelectedAppliedCreditNoteIds([]);
            } catch (err) {
              console.warn("[FG] Could not update applied credit notes:", err);
            }
          }

          if (
            normalizedCompany.length > 0 &&
            selectedPendingCreditInvoiceIds.length > 0
          ) {
            try {
              if (accountKey === "CajaNegra") {
                showToast(
                  "Desde Caja Negra no se debe gestionar facturas a crédito.",
                  "error",
                  4500,
                );
                setSelectedPendingCreditInvoiceIds([]);
              } else {
                const selectedIds = new Set(selectedPendingCreditInvoiceIds);
                const invoicesToPay = pendingClosingCreditInvoices.filter(
                  (invoice) =>
                    selectedIds.has(invoice.id) &&
                    invoice.providerCode === selectedProvider &&
                    invoice.currency === movementCurrency,
                );

              if (invoicesToPay.length > 0) {
                const docId =
                  MovimientosFondosService.buildCompanyMovementsKey(
                    normalizedCompany,
                  );

                let baseStorage = null;
                try {
                  baseStorage = await MovimientosFondosService.getDocument(docId);
                } catch {
                  baseStorage = null;
                }

                const ledger =
                  baseStorage ??
                  MovimientosFondosService.createEmptyMovementStorage(
                    normalizedCompany,
                  );
                ledger.company = normalizedCompany;
                ledger.operations = { movements: [] };

                const state =
                  ledger.state ??
                  MovimientosFondosService.createEmptyMovementStorage(
                    normalizedCompany,
                  ).state;
                const acctKey = accountKey;
                const currency = movementCurrency as MovementCurrencyKey;
                const nowISO = entry.createdAt;
                let totalPaymentApplied = 0;

                const batch = writeBatch(db);

                const paymentMovements: Array<Record<string, unknown>> = [];

                invoicesToPay.forEach((invoice) => {
                  const totalAmount = Math.max(
                    0,
                    Math.trunc(
                      Number(invoice.originalAmount ?? invoice.amount) || 0,
                    ),
                  );
                  const paidAmount = Math.max(
                    0,
                    Math.trunc(Number(invoice.paidAmount) || 0),
                  );
                  const balance = Math.max(
                    0,
                    Math.trunc(
                      Number(invoice.balanceDue ?? totalAmount - paidAmount) ||
                        0,
                    ),
                  );
                  if (balance <= 0) return;

                  const nextPaidAmount = Math.min(
                    totalAmount,
                    paidAmount + balance,
                  );
                  const nextBalanceDue = Math.max(0, totalAmount - nextPaidAmount);
                  const nextStatus =
                    nextBalanceDue === 0
                      ? "PAGADA"
                      : nextPaidAmount > 0
                        ? "PARCIAL"
                        : "PENDIENTE";

                  const updatedMovement: FacturaMovement = {
                    ...invoice,
                    accountId: acctKey,
                    amount: totalAmount,
                    originalAmount: totalAmount,
                    amountDue: nextBalanceDue,
                    amountPayment: balance,
                    paidAmount: nextPaidAmount,
                    balanceDue: nextBalanceDue,
                    paymentStatus: nextStatus,
                    updateAt: nowISO,
                  };

                  batch.set(
                    FacturasService.buildMovementRef(
                      normalizedCompany,
                      invoice.id,
                    ),
                    stripUndefinedDeep(updatedMovement),
                    { merge: true },
                  );

                  const paymentMovement =
                    MovimientosFondosService.buildInvoicePaymentMovement({
                      company: normalizedCompany,
                      invoice: updatedMovement,
                      paymentAmount: balance,
                      updateAt: nowISO,
                      manager2: manager2?.trim() || undefined,
                    });
                  paymentMovements.push(paymentMovement);

                  const paymentMovementId = String(
                    (paymentMovement as any).id || "",
                  );
                  const movRef = MovimientosFondosService.buildMovementRef(
                    docId,
                    paymentMovementId,
                    acctKey,
                  );
                  batch.set(movRef, stripUndefinedDeep(paymentMovement));

                  totalPaymentApplied += balance;
                });

                if (totalPaymentApplied > 0) {
                  let found = false;
                  state.balancesByAccount = state.balancesByAccount.map((b) => {
                    if (b.accountId === acctKey && b.currency === currency) {
                      const current =
                        typeof b.currentBalance === "number"
                          ? b.currentBalance
                          : b.initialBalance || 0;
                      const next = current - totalPaymentApplied;
                      found = true;
                      return { ...b, currentBalance: next };
                    }
                    return b;
                  });
                  if (!found) {
                    state.balancesByAccount.push({
                      accountId: acctKey,
                      currency,
                      enabled: true,
                      initialBalance: 0,
                      currentBalance: -totalPaymentApplied,
                    });
                  }
                  state.updatedAt = new Date().toISOString();
                  ledger.state = state;

                  const mainRef = doc(
                    db,
                    MovimientosFondosService.COLLECTION_NAME,
                    docId,
                  );
                  batch.set(mainRef, stripUndefinedDeep(ledger) as any);
                  await batch.commit();

                  setPendingClosingCreditInvoices((prev) =>
                    prev.filter((invoice) => !selectedIds.has(invoice.id)),
                  );
                  setSelectedPendingCreditInvoiceIds([]);

                  storageSnapshotRef.current = stripUndefinedDeep(ledger) as any;
                  try {
                    const cacheKey = buildV2MovementsCacheKey(
                      docId,
                      acctKey,
                    );
                    const cached = v2MovementsCacheRef.current[cacheKey];
                    if (cached?.loaded) {
                      const paymentEntries = paymentMovements.map((movement) => ({
                        ...(movement as unknown as FondoEntry),
                        id: String((movement as any).id || ""),
                      }));
                      v2MovementsCacheRef.current[cacheKey] = {
                        ...cached,
                        movements: [...paymentEntries, ...cached.movements],
                      };
                      rebuildEntriesFromV2Cache(docId, acctKey);
                    }
                    applyLedgerStateFromStorage(ledger.state);
                  } catch (refreshErr) {
                    console.error(
                      "[FONDO] Error refreshing UI after credit invoice payment:",
                      refreshErr,
                    );
                  }
                }
              }
              }
            } catch (err) {
              console.warn(
                "[FG] Could not update selected credit invoices:",
                err,
              );
            }
          }

          // Mantener copia en Facturas (best-effort)
          try {
            if (normalizedCompany.length > 0) {
              if (shouldMirrorMovementToFacturas) {
                const facturaCopy: FacturaMovement = {
                  id: entry.id,
                  empresa: normalizedCompany,
                  accountId: accountKey,
                  amount: Math.abs(
                    (entry.amountIngreso || 0) - (entry.amountEgreso || 0),
                  ),
                  providerCode: entry.providerCode,
                  invoiceNumber: entry.invoiceNumber,
                  invoiceDocType: "FCO",
                  paymentType: entry.paymentType,
                  amountEgreso: entry.amountEgreso,
                  amountIngreso: entry.amountIngreso,
                  amountPayment: entry.amountPayment,
                  appliedCreditNotes: entry.appliedCreditNotes,
                  manager: entry.manager,
                  notes: entry.notes,
                  createdAt: entry.createdAt,
                  currency: entry.currency === "USD" ? "USD" : "CRC",
                };
                await FacturasService.upsertMovement(
                  normalizedCompany,
                  facturaCopy,
                );
              }
            }
          } catch (err) {
            console.warn("[FG] Could not upsert Facturas copy:", err);
          }
        }

        // If an admin/superadmin created a cierre, touch the guard on success so regular users
        // are blocked for the lock window.
        if (
          createdOk &&
          normalizedCompany.length > 0 &&
          isCierreVentas &&
          !isRegularUser
        ) {
          void touchClosingGuard(normalizedCompany, "FONDO_VENTAS");
        }

        // If save failed, release guard so user can retry immediately.
        if (!createdOk && closingGuard) {
          try {
            if (normalizedCompany.length > 0) {
              void releaseClosingGuard(normalizedCompany, closingGuard);
            }
          } catch {
            // ignore
          }
        }
      } catch (err) {
        // Unexpected error: release guard to avoid blocking retries.
        try {
          const normalizedCompany = (company || "").trim();
          if (closingGuard && normalizedCompany.length > 0) {
            void releaseClosingGuard(normalizedCompany, closingGuard);
          }
        } catch {
          // ignore
        }
        throw err;
      }
    } finally {
      setIsSaving(false);
      movementSubmitInProgressRef.current = false;
    }
  };

  const startEditingEntry = (entry: FondoEntry) => {
    // Verificar si hay una edición en progreso o guardada recientemente (últimos 2 segundos)
    const now = Date.now();
    const timeSinceLastEdit = now - lastEditSaveTimestampRef.current;

    if (editingInProgressRef.current) {
      showToast(
        "Ya hay una edición en progreso. Completa o cancela la edición actual antes de editar otro movimiento.",
        "warning",
        5000,
      );
      return;
    }

    if (timeSinceLastEdit < 2000) {
      showToast(
        "Debes esperar un momento antes de editar otro movimiento.",
        "warning",
        4000,
      );
      return;
    }

    // Marcar que hay una edición en progreso
    editingInProgressRef.current = true;

    // Allow editing of entries even if previously edited; we accumulate audit history.
    setEditingEntryId(entry.id);
    setSelectedProvider(entry.providerCode);
    // Determine the correct payment type: use provider's type if exists, else entry's type
    const correctPaymentType =
      providerTypesMap.get(entry.providerCode) ?? entry.paymentType;
    setPaymentType(correctPaymentType);
    setInvoiceNumber(entry.invoiceNumber);
    setInvoiceDocType(normalizeInvoiceDocType((entry as any).invoiceDocType) as "FCO" | "FCR");
    setManager(entry.manager);
    setManager2(String((entry as any).manager2 || ""));
    setSelectedAppliedCreditNoteIds([]);
    setNotes(entry.notes ?? "");
    setMovementCurrency((entry.currency as "CRC" | "USD") ?? "CRC");
    // Set amounts based on the correct payment type, using the entry's amounts
    const isEgreso =
      isEgresoType(correctPaymentType) || isGastoType(correctPaymentType);
    if (isEgreso) {
      setEgreso(
        Math.trunc(entry.amountEgreso || entry.amountIngreso).toString(),
      );
      setIngreso("");
    } else {
      setIngreso(
        Math.trunc(entry.amountIngreso || entry.amountEgreso).toString(),
      );
      setEgreso("");
    }
    setMovementModalOpen(true);
  };

  const isMovementLocked = useCallback(
    (entry: FondoEntry): boolean => {
      // Los ajustes automáticos siempre están bloqueados
      if (isAutoAdjustmentProvider(entry.providerCode)) {
        return true;
      }

      // El bloqueo por cierres solo aplica para Fondo General
      if (accountKey !== "FondoGeneral") {
        return false;
      }

      // Si no hay snapshot o no hay lockedUntil, no hay bloqueo
      const lockedUntil = storageSnapshotRef.current?.state?.lockedUntil;

      if (!lockedUntil) {
        return false;
      }

      try {
        const movementTime = new Date(entry.createdAt).getTime();
        const lockTime = new Date(lockedUntil).getTime();

        // Bloqueado si el movimiento es anterior o igual al último cierre
        const isLocked = movementTime <= lockTime;

        return isLocked;
      } catch {
        // Si hay error parseando fechas, no bloquear
        return false;
      }
    },
    [accountKey],
  );

  const handleEditMovement = (entry: FondoEntry) => {
    // Superadmin should not edit "CIERRE FONDO VENTAS"; they should delete it.
    if (isSuperAdminUser && isCierreFondoVentasMovement(entry)) {
      showToast(
        'Este "CIERRE FONDO VENTAS" no se edita. Debe eliminarse.',
        "info",
        5000,
      );
      return;
    }

    if (isMovementLocked(entry)) {
      showToast(
        "Este movimiento está bloqueado (anterior al último cierre).",
        "info",
        5000,
      );
      return;
    }

    if (isAutoAdjustmentProvider(entry.providerCode)) {
      showToast("Los ajustes automáticos no se pueden editar.", "info", 5000);
      return;
    }

    if (
      Array.isArray(entry.appliedCreditNotes) &&
      entry.appliedCreditNotes.length > 0
    ) {
      showToast(
        "Este movimiento tiene notas de crédito aplicadas y no se puede editar.",
        "info",
        5000,
      );
      return;
    }

    // If this movement was generated from a daily closing, open the daily-closing modal
    // prefilled with that closing's values so the user edits the closing (not the generic movement).
    if (entry.originalEntryId) {
      const closingId = entry.originalEntryId;
      const record = dailyClosings.find((d) => d.id === closingId);
      if (!record) {
        // If we don't have the closing record locally, fall back to the generic editor.
        startEditingEntry(entry);
        return;
      }

      const initial: DailyClosingFormValues = {
        closingDate: record.closingDate,
        manager: record.manager,
        notes: record.notes ?? "",
        totalCRC: record.totalCRC ?? 0,
        totalUSD: record.totalUSD ?? 0,
        breakdownCRC: record.breakdownCRC ?? {},
        breakdownUSD: record.breakdownUSD ?? {},
      };
      setEditingDailyClosingId(record.id);
      setDailyClosingInitialValues(initial);
      setDailyClosingModalOpen(true);
      return;
    }

    // Default: open generic movement editor
    startEditingEntry(entry);
  };

  const cancelEditing = () => {
    closeMovementModal();
  };

  const openManualCreditNoteModal = () => {
    const currentMovementAmount = Math.max(
      0,
      Math.trunc(Number(isEgreso ? egreso : ingreso) || 0),
    );
    setManualCreditNoteTarget({
      id: "manual-credit-note-draft",
      providerCode: selectedProvider,
      invoiceNumber,
      paymentType,
      amountEgreso: isEgreso ? currentMovementAmount : 0,
      amountIngreso: isEgreso ? 0 : currentMovementAmount,
      manager,
      manager2: manager2 || undefined,
      notes,
      createdAt: new Date().toISOString(),
      currency: movementCurrency,
      accountId: accountKey,
      empresa: company,
      invoiceDocType: invoiceDocType === "FCR" ? "FCR" : "FCO",
    });
    setManualCreditNoteInvoiceNumber(
      manualCreditNoteDraft?.invoiceNumber ?? "",
    );
    setManualCreditNoteAmount(
      manualCreditNoteDraft ? String(manualCreditNoteDraft.amount) : "",
    );
    setManualCreditNoteObservation(manualCreditNoteDraft?.observation ?? "");
    setManualCreditNoteError("");
    setManualCreditNoteOpen(true);
  };

  const closeManualCreditNoteModal = () => {
    if (manualCreditNoteSaving) return;
    setManualCreditNoteOpen(false);
    setManualCreditNoteTarget(null);
    setManualCreditNoteInvoiceNumber("");
    setManualCreditNoteAmount("");
    setManualCreditNoteObservation("");
    setManualCreditNoteError("");
  };

  const handleSaveManualCreditNote = async () => {
    const target = manualCreditNoteTarget;
    if (!target) return;

    const normalizedCompany = (company || "").trim();
    if (!normalizedCompany) {
      setManualCreditNoteError("No se pudo determinar la empresa.");
      return;
    }

    const invoiceNumberValue = String(manualCreditNoteInvoiceNumber || "")
      .trim()
      .toUpperCase();
    if (!/^[0-9]{1,4}$/.test(invoiceNumberValue)) {
      setManualCreditNoteError(
        "Ingresa un número de factura válido (1-4 dígitos).",
      );
      return;
    }

    const amountValue = Math.max(
      0,
      Math.trunc(Number(manualCreditNoteAmount) || 0),
    );
    if (amountValue <= 0) {
      setManualCreditNoteError("Ingresa un monto mayor a cero.");
      return;
    }

    const observationValue = String(manualCreditNoteObservation || "").trim();

    const targetCurrency = (target.currency as "CRC" | "USD") || "CRC";
    const targetBaseAmount = Math.max(
      0,
      Math.trunc(Number(target.amountEgreso || target.amountIngreso) || 0),
    );

    if (amountValue > targetBaseAmount) {
      setManualCreditNoteError(
        `El monto supera el saldo disponible para aplicar (${formatByCurrency(
          targetCurrency,
          targetBaseAmount,
        )}).`,
      );
      return;
    }

    setManualCreditNoteSaving(true);
    setManualCreditNoteError("");
    try {
      setManualCreditNoteDraft({
        invoiceNumber: invoiceNumberValue,
        amount: amountValue,
        observation: observationValue || undefined,
      });
      // Marcar la NC manual como seleccionada para que aparezca inmediatamente
      setSelectedAppliedCreditNoteIds((prev) =>
        prev && prev.includes("manual-nc-draft")
          ? prev
          : [...(prev || []), "manual-nc-draft"],
      );
      showToast("Nota de crédito manual lista para guardar", "success", 3000);
      closeManualCreditNoteModal();
    } catch (error) {
      console.error("[FG] Error saving manual credit note:", error);
      if (!manualCreditNoteError) {
        setManualCreditNoteError("No se pudo guardar la nota de crédito.");
      }
    } finally {
      setManualCreditNoteSaving(false);
    }
  };

  // Check if current user is the principal admin (owner) of the company
  const isPrincipalAdmin = useMemo(() => {
    if (!user?.id || !companyData?.ownerId) return false;
    return String(user.id) === String(companyData.ownerId);
  }, [user, companyData]);

  const cierreFondoVentasProviderCode = useMemo(() => {
    const found = providers.find(
      (p) =>
        (p?.name || "").toString().toUpperCase() ===
        CIERRE_FONDO_VENTAS_PROVIDER_NAME,
    );
    return found?.code || null;
  }, [providers]);

  const latestCierreFondoVentasMovementId = useMemo(() => {
    if (!fondoEntries || fondoEntries.length === 0) return null;

    const isVentas = (e: FondoEntry) => {
      if (cierreFondoVentasProviderCode) {
        return e.providerCode === cierreFondoVentasProviderCode;
      }
      const providerName = providers
        .find((p) => p.code === e.providerCode)
        ?.name?.toUpperCase();
      return providerName === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
    };

    const matches = fondoEntries.filter(isVentas);
    if (matches.length === 0) return null;

    const toMs = (iso: unknown) => {
      try {
        const ms = new Date(String(iso || "")).getTime();
        return Number.isFinite(ms) ? ms : 0;
      } catch {
        return 0;
      }
    };

    let best = matches[0];
    let bestMs = toMs(best.createdAt);
    for (let i = 1; i < matches.length; i++) {
      const cur = matches[i];
      const curMs = toMs(cur.createdAt);
      if (curMs > bestMs) {
        best = cur;
        bestMs = curMs;
        continue;
      }
      if (
        curMs === bestMs &&
        String(cur.id).localeCompare(String(best.id)) > 0
      ) {
        best = cur;
        bestMs = curMs;
      }
    }
    return best?.id || null;
  }, [fondoEntries, providers, cierreFondoVentasProviderCode]);

  const isCierreFondoVentasMovement = useCallback(
    (entry: FondoEntry): boolean => {
      try {
        if (cierreFondoVentasProviderCode) {
          return entry.providerCode === cierreFondoVentasProviderCode;
        }
        const providerName = providers
          .find((p) => p.code === entry.providerCode)
          ?.name?.toUpperCase();
        return providerName === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
      } catch {
        return false;
      }
    },
    [providers, cierreFondoVentasProviderCode],
  );

  const handleDeleteMovement = useCallback(
    (entry: FondoEntry) => {
      // Restricción: solo se permite borrar el ÚLTIMO "CIERRE FONDO VENTAS".
      if (isCierreFondoVentasMovement(entry)) {
        if (
          !latestCierreFondoVentasMovementId ||
          entry.id !== latestCierreFondoVentasMovementId
        ) {
          showToast(
            "Solo se permite eliminar el último cierre de Fondo Ventas.",
            "warning",
            6000,
          );
          return;
        }
      }

      // Default: only principal admin can delete movements.
      // Exception: superadmin can delete only "CIERRE FONDO VENTAS" movements.
      if (!isPrincipalAdmin) {
        const canSuperDeleteVentas =
          Boolean(isSuperAdminUser) && isCierreFondoVentasMovement(entry);
        if (!canSuperDeleteVentas) {
          showToast(
            "Solo el administrador principal puede eliminar movimientos",
            "error",
          );
          return;
        }
      }

      if (isMovementLocked(entry)) {
        showToast(
          "Este movimiento está bloqueado (anterior al último cierre) y no puede eliminarse.",
          "error",
        );
        return;
      }

      if (isAutoAdjustmentProvider(entry.providerCode)) {
        showToast("Los ajustes automáticos no se pueden eliminar.", "error");
        return;
      }

      setConfirmDeleteEntry({ open: true, entry });
    },
    [
      isPrincipalAdmin,
      isSuperAdminUser,
      isCierreFondoVentasMovement,
      latestCierreFondoVentasMovementId,
      isMovementLocked,
      showToast,
    ],
  );

  const confirmDeleteMovement = useCallback(async () => {
    const entry = confirmDeleteEntry.entry;
    if (!entry) return;

    if (isSaving) return; // Prevenir múltiples envíos
    setIsSaving(true);

    try {
      // Restricción: solo se permite borrar el ÚLTIMO "CIERRE FONDO VENTAS".
      if (isCierreFondoVentasMovement(entry)) {
        if (
          !latestCierreFondoVentasMovementId ||
          entry.id !== latestCierreFondoVentasMovementId
        ) {
          showToast(
            "Solo se permite eliminar el último cierre de Fondo Ventas.",
            "warning",
            6000,
          );
          setConfirmDeleteEntry({ open: false, entry: null });
          return;
        }
      }

      // Permission guard (in case state was manipulated).
      if (!isPrincipalAdmin) {
        const canSuperDeleteVentas =
          Boolean(isSuperAdminUser) && isCierreFondoVentasMovement(entry);
        if (!canSuperDeleteVentas) {
          showToast(
            "No autorizado para eliminar este movimiento",
            "error",
            5000,
          );
          setConfirmDeleteEntry({ open: false, entry: null });
          return;
        }
      }

      const normalizedCompany = (company || "").trim();
      let facturaRollbackWrites: ((batch: WriteBatch) => void) | undefined;
      if (normalizedCompany.length > 0 && isPaidFcrMovement(entry)) {
        const invoiceId = getFcrPaymentInvoiceId(entry);
        if (invoiceId) {
          const invoiceRef = FacturasService.buildMovementRef(
            normalizedCompany,
            invoiceId,
          );
          const invoiceSnap = await getDoc(invoiceRef);
          if (!invoiceSnap.exists()) {
            showToast(
              "No se encontró la factura asociada al pago eliminado.",
              "error",
              5000,
            );
            return;
          }

          const invoiceData = invoiceSnap.data() as FacturaMovement;
          const rollbackAt = new Date().toISOString();
          const paymentAmount = getFcrPaymentAmount(entry);
          const totalAmount = Math.max(
            0,
            Math.trunc(Number(invoiceData.originalAmount ?? invoiceData.amount) || 0),
          );
          const currentPaid = Math.max(
            0,
            Math.trunc(Number(invoiceData.paidAmount) || 0),
          );
          const nextPaid = Math.max(
            0,
            Math.min(totalAmount, currentPaid - paymentAmount),
          );
          const nextBalance = Math.max(0, totalAmount - nextPaid);
          const nextStatus =
            nextBalance === 0
              ? "PAGADA"
              : nextPaid > 0
                ? "PARCIAL"
                : "PENDIENTE";

          const appliedCreditNotes = Array.isArray(entry.appliedCreditNotes)
            ? entry.appliedCreditNotes
            : [];
          const noteWrites = await Promise.all(
            appliedCreditNotes.map(async (note) => {
              const noteId = String(note?.id || "").trim();
              const appliedAmount = Math.max(
                0,
                Math.trunc(Number(note?.appliedAmount) || 0),
              );
              if (!noteId || appliedAmount <= 0) return null;

              const noteRef = FacturasService.buildMovementRef(
                normalizedCompany,
                noteId,
              );
              const noteSnap = await getDoc(noteRef);
              if (!noteSnap.exists()) return null;

              const noteData = noteSnap.data() as FacturaMovement;
              const noteTotal = Math.max(
                0,
                Math.trunc(Number(noteData.originalAmount ?? noteData.amount) || 0),
              );
              const currentNotePaid = Math.max(
                0,
                Math.trunc(Number(noteData.paidAmount) || 0),
              );
              const nextNotePaid = Math.max(
                0,
                Math.min(noteTotal, currentNotePaid - appliedAmount),
              );
              const nextNoteBalance = Math.max(0, noteTotal - nextNotePaid);
              const nextNoteStatus =
                nextNotePaid <= 0
                  ? "PENDIENTE"
                  : nextNoteBalance === 0
                    ? "REBAJADA"
                    : "PARCIAL";

              return {
                noteRef,
                payload: {
                  ...noteData,
                  id: noteId,
                  empresa: normalizedCompany,
                  paidAmount: nextNotePaid,
                  balanceDue: nextNoteBalance,
                  amountDue: nextNoteBalance,
                  paymentStatus: nextNoteStatus,
                  updateAt: rollbackAt,
                } as FacturaMovement,
              };
            }),
          );

          facturaRollbackWrites = (batch) => {
            batch.set(
              invoiceRef,
              stripUndefinedDeep({
                ...invoiceData,
                id: invoiceId,
                empresa: normalizedCompany,
                paidAmount: nextPaid,
                balanceDue: nextBalance,
                amountDue: nextBalance,
                paymentStatus: nextStatus,
                updateAt: rollbackAt,
              }),
              { merge: true },
            );

            noteWrites.forEach((noteWrite) => {
              if (!noteWrite) return;
              batch.set(
                noteWrite.noteRef,
                stripUndefinedDeep(noteWrite.payload),
                { merge: true },
              );
            });
          };
        }
      }

      // Preparar la lista actualizada SIN el movimiento a eliminar
      const updatedEntries = fondoEntries.filter((e) => e.id !== entry.id);

      // PRIMERO persistir a Firestore, LUEGO actualizar UI
      const saved = await persistMovementToFirestore(updatedEntries, "delete", {
        deleteId: entry.id,
        before: entry,
      }, facturaRollbackWrites);

      if (!saved.ok) {
        showToast(
          "Error al eliminar el movimiento. Por favor, intente de nuevo.",
          "error",
          5000,
        );
        return; // NO actualizar la UI si falló el guardado
      }

      // If deleting a "CIERRE FONDO VENTAS" movement, reset lock/cooldowns so it can be recreated immediately.
      try {
        const normalizedCompany = (company || "").trim();
        const providerName = providers
          .find((p) => p.code === entry.providerCode)
          ?.name?.toUpperCase();
        const isCierreVentas =
          providerName === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
        if (normalizedCompany.length > 0 && isCierreVentas) {
          await forceClearClosingGuards(
            normalizedCompany,
            "delete_cierre_fondo_ventas",
          );

          lastDailyClosingSavedAtRef.current = 0;
          lastMovementCreatedAtRef.current = 0;
          lastMovementDedupeRef.current = null;
          if (typeof window !== "undefined") {
            const dailyKey = `fondogeneral-lastDailyClosingSavedAt:${normalizedCompany}`;
            const createdKey = `fondogeneral-lastMovementCreatedAt:${normalizedCompany}:${accountKey}`;
            const dedupeKey = `fondogeneral-lastMovementDedupe:${normalizedCompany}:${accountKey}`;
            localStorage.removeItem(dailyKey);
            localStorage.removeItem(createdKey);
            localStorage.removeItem(dedupeKey);
          }
        }
      } catch {
        // ignore
      }

      // Solo actualizar la UI si el guardado fue exitoso
      setFondoEntries(updatedEntries);
      if (saved.ledgerSnapshot) {
        setLedgerSnapshot(saved.ledgerSnapshot);
      }

      // Close modal
      setConfirmDeleteEntry({ open: false, entry: null });

      if (saved.confirmed) {
        showToast("Movimiento eliminado exitosamente", "success");
      } else {
        showToast(
          "Eliminación guardada localmente; pendiente de sincronización (revisa tu conexión).",
          "warning",
          6000,
        );
      }
    } finally {
      setIsSaving(false);
    }
  }, [
    confirmDeleteEntry,
    showToast,
    fondoEntries,
    isPrincipalAdmin,
    isSuperAdminUser,
    isCierreFondoVentasMovement,
    latestCierreFondoVentasMovementId,
    setConfirmDeleteEntry,
    company,
    providers,
    accountKey,
    forceClearClosingGuards,
    isSaving,
    persistMovementToFirestore,
    setLedgerSnapshot,
  ]);

  const cancelDeleteMovement = useCallback(() => {
    setConfirmDeleteEntry({ open: false, entry: null });
  }, []);

  const isProviderSelectDisabled =
    !company || movementProvidersLoading || movementProviders.length === 0;
  // Detectar si estamos editando un movimiento EXISTENTE de CIERRE FONDO VENTAS (bloquear cambio de proveedor)
  // Solo aplica cuando editamos, no cuando creamos un nuevo movimiento
  const isEditingCierreFondoVentas = useMemo(() => {
    if (!editingEntryId) return false;
    // Buscar el movimiento original que se está editando
    const originalEntry = fondoEntries.find((e) => e.id === editingEntryId);
    if (!originalEntry) return false;
    // Verificar si el proveedor ORIGINAL del movimiento es CIERRE FONDO VENTAS
    const originalProvider = providers.find(
      (p) => p.code === originalEntry.providerCode,
    );
    return (
      originalProvider?.name?.toUpperCase() ===
      CIERRE_FONDO_VENTAS_PROVIDER_NAME
    );
  }, [editingEntryId, fondoEntries, providers]);

  const providersMap = useMemo(() => {
    const map = new Map<string, string>();
    movementProviders.forEach((p) => map.set(p.code, p.name));
    return map;
  }, [movementProviders]);
  const providerTypesMap = useMemo(() => {
    const map = new Map<string, FondoMovementType>();
    movementProviders.forEach((p) => {
      if (p.type && isFondoMovementType(p.type)) {
        map.set(p.code, p.type);
        return;
      }

      if (p.category === "Ingreso") {
        const fallback = ingresoTypes[0];
        if (fallback) map.set(p.code, fallback);
        return;
      }

      if (p.category === "Gasto") {
        const fallback = gastoTypes[0];
        if (fallback) map.set(p.code, fallback);
        return;
      }

      if (p.category === "Egreso") {
        const fallback = egresoTypes[0];
        if (fallback) map.set(p.code, fallback);
      }
    });
    return map;
  }, [movementProviders, ingresoTypes, gastoTypes, egresoTypes]);
  const selectedProviderExists = selectedProvider
    ? movementProviders.some((p) => p.code === selectedProvider)
    : false;

  // reset page when filters change so user sees first page of filtered results
  useEffect(() => {
    setPageIndex(0);
  }, [
    filterProviderCode,
    filterPaymentType,
    filterEditedOnly,
    searchQuery,
    fromFilter,
    toFilter,
  ]);

  const invoiceValid =
    /^[0-9]{1,4}$/.test(invoiceNumber) || invoiceNumber.length === 0;
  const egresoValue = Number.parseInt(egreso, 10);
  const ingresoValue = Number.parseInt(ingreso, 10);
  const egresoValid = isEgreso
    ? !Number.isNaN(egresoValue) && egresoValue > 0
    : true;
  const ingresoValid = isIngreso
    ? !Number.isNaN(ingresoValue) && ingresoValue > 0
    : true;
  const requiredAmountProvided = isEgreso
    ? egreso.trim().length > 0
    : ingreso.trim().length > 0;

  const selectedAppliedCreditNotes = useMemo(() => {
    if (!isEgreso || editingEntryId) return [];
    const selectedIds = new Set(selectedAppliedCreditNoteIds);
    const availableNotes =
      manualCreditNoteDraft && invoiceDocType === "FCO"
        ? [
            {
              id: "manual-nc-draft",
              invoiceNumber: manualCreditNoteDraft.invoiceNumber,
              amount: manualCreditNoteDraft.amount,
              balanceDue: manualCreditNoteDraft.amount,
              currency: movementCurrency,
            },
            ...selectedProviderPendingCreditNotes,
          ]
        : selectedProviderPendingCreditNotes;

    return availableNotes.filter(
      (note) => selectedIds.has(note.id) && note.currency === movementCurrency,
    );
  }, [
    editingEntryId,
    invoiceDocType,
    isEgreso,
    manualCreditNoteDraft,
    movementCurrency,
    selectedAppliedCreditNoteIds,
    selectedProviderPendingCreditNotes,
  ]);

  const creditNotesAppliedTotal = useMemo(() => {
    let remaining = Math.max(0, Math.trunc(Number(egreso) || 0));
    let total = 0;
    selectedAppliedCreditNotes.forEach((note) => {
      if (remaining <= 0) return;
      const applied = Math.min(
        remaining,
        Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
      );
      total += applied;
      remaining -= applied;
    });
    return total;
  }, [egreso, selectedAppliedCreditNotes]);

  const computedAmountPayment = isEgreso
    ? roundCreditNotePaymentAmount(
        Math.max(0, Math.trunc(Number(egreso) || 0) - creditNotesAppliedTotal),
        movementCurrency,
        accountKey,
      )
    : undefined;

  useEffect(() => {
    setSelectedAppliedCreditNoteIds((prev) =>
      prev.filter((id) =>
        selectedProviderPendingCreditNotes.some(
          (note) => note.id === id && note.currency === movementCurrency,
        ),
      ),
    );
  }, [movementCurrency, selectedProviderPendingCreditNotes]);

  const { currentBalanceCRC, currentBalanceUSD } = useMemo(() => {
    return {
      // currentBalance debe ser el balance real persistido, no el del rango filtrado.
      // Si el usuario ajusta initialBalance, reflejamos el delta sin depender de movimientos cargados.
      currentBalanceCRC:
        ledgerSnapshot.currentCRC +
        ((Number(initialAmount) || 0) - ledgerSnapshot.initialCRC),
      currentBalanceUSD:
        ledgerSnapshot.currentUSD +
        ((Number(initialAmountUSD) || 0) - ledgerSnapshot.initialUSD),
    };
  }, [ledgerSnapshot, initialAmount, initialAmountUSD]);

  const balanceAfterByIdCRC = useMemo(() => {
    // Derivar balances desde el currentBalance real (persistido), no desde initialAmount + subset.
    // Caminamos hacia atrás: balanceAfter(entry) se obtiene restando deltas de movimientos más recientes.
    let running = Math.trunc(currentBalanceCRC);
    const orderedDesc = [...fondoEntries]
      .filter((e) => ((e.currency as any) || "CRC") === "CRC")
      .sort((a, b) => {
        const diff = getPrimaryMovementTime(b) - getPrimaryMovementTime(a);
        if (diff !== 0) return diff;
        return String(b.id).localeCompare(String(a.id));
      });
    const map = new Map<string, number>();
    orderedDesc.forEach((entry) => {
      map.set(entry.id, running);
      running -= Math.trunc(entry.amountIngreso || 0);
      running += resolveEffectiveEgresoAmount(entry);
    });
    return map;
  }, [fondoEntries, currentBalanceCRC]);

  const balanceAfterByIdUSD = useMemo(() => {
    let running = Math.trunc(currentBalanceUSD);
    const orderedDesc = [...fondoEntries]
      .filter((e) => ((e.currency as any) || "CRC") === "USD")
      .sort((a, b) => {
        const diff = getPrimaryMovementTime(b) - getPrimaryMovementTime(a);
        if (diff !== 0) return diff;
        return String(b.id).localeCompare(String(a.id));
      });
    const map = new Map<string, number>();
    orderedDesc.forEach((entry) => {
      map.set(entry.id, running);
      running -= Math.trunc(entry.amountIngreso || 0);
      running += resolveEffectiveEgresoAmount(entry);
    });
    return map;
  }, [fondoEntries, currentBalanceUSD]);

  useEffect(() => {
    if (!entriesHydrated || hydratedAccountKey !== accountKey) return;
    const normalizedCompany = (company || "").trim();
    if (
      normalizedCompany.length === 0 ||
      hydratedCompany.toLowerCase() !== normalizedCompany.toLowerCase()
    ) {
      return;
    }

    const persistEntries = async () => {
      const companyKey =
        MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
      let storageToPersist: MovementStorage<FondoEntry> | null = null;

      const normalizedInitialCRC =
        initialAmount.trim().length > 0 ? initialAmount.trim() : "0";
      const normalizedInitialUSD =
        initialAmountUSD.trim().length > 0 ? initialAmountUSD.trim() : "0";
      const hasSnapshot = Boolean(storageSnapshotRef.current);
      const metadataDiffers =
        normalizedInitialCRC !== "0" ||
        normalizedInitialUSD !== "0" ||
        !currencyEnabled.CRC ||
        !currencyEnabled.USD;

      if (!hasSnapshot && !metadataDiffers) {
        return;
      }

      try {
        const baseStorage = storageSnapshotRef.current
          ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
              storageSnapshotRef.current,
              normalizedCompany,
            )
          : MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
              normalizedCompany,
            );
        baseStorage.company = normalizedCompany;
        // V2: movements are stored in a subcollection. Never persist movements array to main doc.
        baseStorage.operations = { movements: [] };

        const stateSnapshot =
          baseStorage.state ??
          MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
            normalizedCompany,
          ).state;
        const parsedInitialCRC = Number(normalizedInitialCRC) || 0;
        const parsedInitialUSD = Number(normalizedInitialUSD) || 0;

        const parseBalance = (value: unknown) => {
          const parsed = typeof value === "number" ? value : Number(value);
          return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
        };

        const existingCRC = stateSnapshot.balancesByAccount.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === "CRC",
        );
        const existingUSD = stateSnapshot.balancesByAccount.find(
          (balance) =>
            balance.accountId === accountKey && balance.currency === "USD",
        );

        const prevInitialCRC = parseBalance(existingCRC?.initialBalance ?? 0);
        const prevInitialUSD = parseBalance(existingUSD?.initialBalance ?? 0);
        const prevCurrentCRC = parseBalance(
          existingCRC?.currentBalance ?? prevInitialCRC,
        );
        const prevCurrentUSD = parseBalance(
          existingUSD?.currentBalance ?? prevInitialUSD,
        );

        // Cambiar initialBalance ajusta currentBalance por el mismo delta.
        // No dependemos de `fondoEntries` porque pueden ser parciales por filtros.
        const nextCurrentCRC =
          prevCurrentCRC + (parsedInitialCRC - prevInitialCRC);
        const nextCurrentUSD =
          prevCurrentUSD + (parsedInitialUSD - prevInitialUSD);

        const nextCRC = {
          accountId: accountKey,
          currency: "CRC" as const,
          enabled: currencyEnabled.CRC,
          initialBalance: parsedInitialCRC,
          currentBalance: nextCurrentCRC,
        };
        const nextUSD = {
          accountId: accountKey,
          currency: "USD" as const,
          enabled: currencyEnabled.USD,
          initialBalance: parsedInitialUSD,
          currentBalance: nextCurrentUSD,
        };

        const crcChanged =
          !existingCRC ||
          existingCRC.enabled !== nextCRC.enabled ||
          existingCRC.initialBalance !== nextCRC.initialBalance ||
          existingCRC.currentBalance !== nextCRC.currentBalance;
        const usdChanged =
          !existingUSD ||
          existingUSD.enabled !== nextUSD.enabled ||
          existingUSD.initialBalance !== nextUSD.initialBalance ||
          existingUSD.currentBalance !== nextUSD.currentBalance;

        // If nothing changed for this account, do not write back to Firestore/localStorage.
        if (!crcChanged && !usdChanged) {
          return;
        }

        const nextAccountBalances = stateSnapshot.balancesByAccount.filter(
          (balance) => balance.accountId !== accountKey,
        );
        nextAccountBalances.push(nextCRC, nextUSD);
        stateSnapshot.balancesByAccount = nextAccountBalances;
        stateSnapshot.updatedAt = new Date().toISOString();
        // Preservar lockedUntil del snapshot actual si existe
        if (storageSnapshotRef.current?.state?.lockedUntil) {
          stateSnapshot.lockedUntil =
            storageSnapshotRef.current.state.lockedUntil;
        }
        baseStorage.state = stateSnapshot;

        // Sync UI snapshot
        setLedgerSnapshot({
          initialCRC: parsedInitialCRC,
          currentCRC: nextCurrentCRC,
          initialUSD: parsedInitialUSD,
          currentUSD: nextCurrentUSD,
        });

        // Guardar snapshot liviano en localStorage
        try {
          localStorage.setItem(companyKey, JSON.stringify(baseStorage));
        } catch (storageError) {
          console.warn(
            "[FG-V2] localStorage snapshot write failed:",
            storageError,
          );
        }

        const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
        localStorage.removeItem(legacyKey);

        if (resolvedOwnerId) {
          const legacyOwnerKey =
            MovimientosFondosService.buildLegacyOwnerMovementsKey(
              resolvedOwnerId,
            );
          if (legacyOwnerKey !== companyKey) {
            localStorage.removeItem(legacyOwnerKey);
          }
        }

        storageSnapshotRef.current = baseStorage;
        storageToPersist = baseStorage;
      } catch (err) {
        console.error("Error preparing fondo entries for persistence:", err);
      }

      if (!storageToPersist) return;

      try {
        await MovimientosFondosService.saveDocument(
          companyKey,
          storageToPersist,
        );
      } catch (err) {
        console.error("Error storing fondo entries to Firestore:", err);
      }
    };

    void persistEntries();
  }, [
    namespace,
    entriesHydrated,
    company,
    hydratedCompany,
    resolvedOwnerId,
    currencyEnabled,
    initialAmount,
    initialAmountUSD,
    accountKey,
    hydratedAccountKey,
    setLedgerSnapshot,
  ]);

  const isSubmitDisabled =
    !company ||
    (!editingEntryId && isProviderSelectDisabled) ||
    !invoiceValid ||
    !requiredAmountProvided ||
    !egresoValid ||
    !ingresoValid ||
    !manager ||
    employeesLoading ||
    isSaving;

  const amountFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const amountFormatterUSD = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }),
    [],
  );
  const dailyClosingDateFormatter = useMemo(
    () => new Intl.DateTimeFormat("es-CR", { dateStyle: "long" }),
    [],
  );
  const dateTimeFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("es-CR", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    [],
  );
  const formatByCurrency = (currency: "CRC" | "USD", value: number) =>
    currency === "USD"
      ? `$ ${amountFormatterUSD.format(Math.trunc(value))}`
      : `₡ ${amountFormatter.format(Math.trunc(value))}`;

  const pendingSupplierPaymentAlerts = useMemo(() => {
    const map = new Map<
      string,
      { providerCode: string; providerName: string; count: number; crc: number; usd: number }
    >();

    pendingClosingCreditInvoices.forEach((invoice) => {
      const totalAmount = Math.max(
        0,
        Math.trunc(Number(invoice.originalAmount ?? invoice.amount) || 0),
      );
      const paidAmount = Math.max(
        0,
        Math.trunc(Number(invoice.paidAmount) || 0),
      );
      const balanceAmount = Math.max(
        0,
        Math.trunc(Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0),
      );
      if (balanceAmount <= 0) return;

      const providerCode = invoice.providerCode;
      const current =
        map.get(providerCode) ??
        {
          providerCode,
          providerName: providersMap.get(providerCode) ?? providerCode,
          count: 0,
          crc: 0,
          usd: 0,
        };
      current.count += 1;
      if (invoice.currency === "USD") current.usd += balanceAmount;
      else current.crc += balanceAmount;
      map.set(providerCode, current);
    });

    return Array.from(map.values()).sort((a, b) => {
      const balanceA = a.crc + a.usd;
      const balanceB = b.crc + b.usd;
      if (balanceB !== balanceA) return balanceB - balanceA;
      return a.providerName.localeCompare(b.providerName, "es");
    });
  }, [pendingClosingCreditInvoices, providersMap]);

  const selectedProviderPendingPaymentAlert = useMemo(
    () =>
      selectedProvider
        ? pendingSupplierPaymentAlerts.find(
            (item) => item.providerCode === selectedProvider,
          ) ?? null
        : null,
    [pendingSupplierPaymentAlerts, selectedProvider],
  );

  const selectedProviderPendingCreditInvoices = useMemo(
    () =>
      selectedProvider && !isCajaNegra
        ? pendingClosingCreditInvoices
            .filter((invoice) => invoice.providerCode === selectedProvider)
            .map((invoice) => {
              const totalAmount = Math.max(
                0,
                Math.trunc(Number(invoice.originalAmount ?? invoice.amount) || 0),
              );
              const paidAmount = Math.max(
                0,
                Math.trunc(Number(invoice.paidAmount) || 0),
              );
              const balanceDue = Math.max(
                0,
                Math.trunc(
                  Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0,
                ),
              );
              return {
                id: invoice.id,
                invoiceNumber: invoice.invoiceNumber,
                amount: totalAmount,
                balanceDue,
                currency: (invoice.currency === "USD" ? "USD" : "CRC") as "CRC" | "USD",
              };
            })
            .filter((invoice) => invoice.balanceDue > 0)
        : [],
        [isCajaNegra, pendingClosingCreditInvoices, selectedProvider],
  );

  useEffect(() => {
    if (!isEgreso || editingEntryId) {
      setSelectedPendingCreditInvoiceIds([]);
      return;
    }
    setSelectedPendingCreditInvoiceIds((prev) =>
      prev.filter((id) =>
        selectedProviderPendingCreditInvoices.some(
          (invoice) =>
            invoice.id === id && invoice.currency === movementCurrency,
        ),
      ),
    );
  }, [
    editingEntryId,
    isEgreso,
    movementCurrency,
    selectedProviderPendingCreditInvoices,
  ]);

  const formatDailyClosingDiff = (currency: "CRC" | "USD", diff: number) => {
    if (diff === 0) return "Sin diferencias";
    const sign = diff > 0 ? "+" : "-";
    return `${sign} ${formatByCurrency(currency, Math.abs(diff))}`;
  };

  const getDailyClosingDiffClass = (diff: number) => {
    if (diff === 0) return "text-[var(--muted-foreground)]";
    return diff > 0 ? "text-green-500" : "text-red-500";
  };

  const buildBreakdownLines = (
    currency: "CRC" | "USD",
    breakdown?: Record<number, number>,
  ) => {
    if (!breakdown) return [] as string[];
    return Object.entries(breakdown)
      .filter(([, count]) => count > 0)
      .map(
        ([denomination, count]) =>
          `${count} x ${formatByCurrency(currency, Number(denomination))}`,
      );
  };

  const amountClass = (
    isActive: boolean,
    inputHasValue: boolean,
    isValid: boolean,
  ) => {
    if (!isActive) return "border-[var(--input-border)]";
    if (inputHasValue && !isValid) return "border-red-500";
    return "border-[var(--input-border)]";
  };

  const getTodayInvoiceDDMM = (date: Date = new Date()) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${dd}${mm}`;
  };

  const getTodayInvoiceMMDD = (date: Date = new Date()) => {
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    return `${mm}${dd}`;
  };

  const selectedProviderData = useMemo(() => {
    if (!selectedProvider) return null;
    return movementProviders.find((p) => p.code === selectedProvider) ?? null;
  }, [movementProviders, selectedProvider]);

  const isInvoiceDocTypeLockedToContado = useMemo(() => {
    // Solo aplica al crear; en edición se respeta el valor histórico.
    if (editingEntryId) return false;
    if (!selectedProvider) return false;
    // Regla de negocio: solo proveedores tipo COMPRA INVENTARIO pueden usar crédito (FCR)
    return !isInventoryPurchaseProviderType(selectedProviderData?.type);
  }, [editingEntryId, selectedProvider, selectedProviderData]);

  useEffect(() => {
    // Solo al agregar (no al editar): si el proveedor no es COMPRA INVENTARIO,
    // bloquear el tipo de factura a contado.
    if (editingEntryId) return;
    if (!isInvoiceDocTypeLockedToContado) return;
    if (invoiceDocType !== "FCO") setInvoiceDocType("FCO");
  }, [editingEntryId, invoiceDocType, isInvoiceDocTypeLockedToContado]);

  const isInvoiceAutoDateLocked = useMemo(() => {
    if (isCajaNegra) return true;
    if (!selectedProvider) return false;
    if (isAutoAdjustmentProvider(selectedProvider)) return true;
    if (selectedProvider.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME)
      return true;
    return (
      selectedProviderData?.name?.toUpperCase() ===
      CIERRE_FONDO_VENTAS_PROVIDER_NAME
    );
  }, [isCajaNegra, selectedProvider, selectedProviderData]);

  // Si el proveedor es un cierre/ajuste automático, usar DDMM como N° factura y bloquear edición.
  useEffect(() => {
    if (!isInvoiceAutoDateLocked) return;
    // Al editar un movimiento existente, no sobrescribir el N° factura guardado.
    if (editingEntryId) return;
    const today = isCajaNegra ? getTodayInvoiceMMDD() : getTodayInvoiceDDMM();
    if (invoiceNumber !== today) {
      setInvoiceNumber(today);
      setInvoiceError("");
    }
  }, [isInvoiceAutoDateLocked, editingEntryId, invoiceNumber, isCajaNegra]);

  const handleProviderChange = async (value: string) => {
    const prov = movementProviders.find((p) => p.code === value);
    const isCierreFondoVentasValue =
      !editingEntryId &&
      accountKey === "FondoGeneral" &&
      (String(value || "").trim().toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME ||
        prov?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME);

    if (isCierreFondoVentasValue) {
      try {
        const nowISO = new Date().toISOString();
        const nowTiming = await resolveShiftTimingForNow(nowISO);
        if (nowTiming?.withinHorario) {
          const normalizeMin = (min: number) => {
            if (!Number.isFinite(min)) return 0;
            const m = Math.trunc(min) % 1440;
            return m < 0 ? m + 1440 : m;
          };

          const nowMin = normalizeMin(nowTiming.currentMin);
          const shiftEndMin =
            nowTiming.expectedShift === "D"
              ? normalizeMin(nowTiming.shiftChangeMin)
              : normalizeMin(nowTiming.closeMin);
          const minutesUntilEnd = (shiftEndMin - nowMin + 1440) % 1440;
          const minutesUntilAllowed = Math.max(0, minutesUntilEnd - 15);

          // Enforzar 2 cierres por dÃ­a: uno al final de D y otro al final de N (cierre).
          // Bloquear duplicados por ventana.
          try {
            const nowKey = getCostaRicaDateKeyAndMinute(nowISO)?.dateKey;
            if (nowKey) {
              const cierresToday = fondoEntries.filter((e) =>
                isCierreFondoVentasMovement(e),
              );
              let hasDCierre = false;
              let hasNCierre = false;
              cierresToday.forEach((e) => {
                const info = getCostaRicaDateKeyAndMinute(String(e.createdAt || ""));
                if (!info) return;
                if (info.dateKey !== nowKey) return;
                const minute = normalizeMin(info.minuteOfDay);
                const isD = minute < normalizeMin(nowTiming.shiftChangeMin);
                if (isD) hasDCierre = true;
                else hasNCierre = true;
              });

              if (nowTiming.expectedShift === "D" && hasDCierre) {
                showToast(
                  'Ya existe un "CIERRE FONDO VENTAS" para el turno D de hoy.',
                  "warning",
                  5500,
                );
                return;
              }
              if (nowTiming.expectedShift === "N" && hasNCierre) {
                showToast(
                  'Ya existe un "CIERRE FONDO VENTAS" para el turno N de hoy.',
                  "warning",
                  5500,
                );
                return;
              }
            }
          } catch (dupErr) {
            console.error("[FG] Error checking duplicate cierres:", dupErr);
          }

          if (minutesUntilEnd > 15) {
            showToast(
              `El \"CIERRE FONDO VENTAS\" solo se puede registrar dentro de los Ãºltimos 15 minutos del turno. Faltan ${minutesUntilAllowed} min.`,
              "warning",
              6000,
            );
            return;
          }
        }
      } catch (err) {
        console.error(
          "[FG] Error validating cierre fondo ventas on provider select:",
          err,
        );
      }
    }

    setSelectedProvider(value);
    setProviderError(""); // Clear error when user starts typing
    const oldPaymentType = paymentType;
    let nextPaymentType: FondoEntry["paymentType"] = "COMPRA INVENTARIO";
    let shouldAutoDateInvoice = false;
    try {
      // (prov) already resolved above
      shouldAutoDateInvoice =
        isCajaNegra ||
        isAutoAdjustmentProvider(value) ||
        prov?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME;
      if (
        prov &&
        prov.type &&
        isFondoMovementType(prov.type)
      ) {
        nextPaymentType = prov.type as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (prov?.category === "Ingreso") {
        nextPaymentType = FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (prov?.category === "Gasto") {
        nextPaymentType = FONDO_GASTO_TYPES[0] as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (prov?.category === "Egreso") {
        nextPaymentType = FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"];
        setPaymentType(nextPaymentType);
      } else if (isCajaNegra) {
        const upper = (prov?.code || value).toUpperCase();
        nextPaymentType = upper.includes("INGRESO")
          ? (FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"])
          : (FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"]);
        setPaymentType(nextPaymentType);
      } else {
        // fallback to default when provider has no type or it's invalid
        nextPaymentType = "COMPRA INVENTARIO";
        setPaymentType(nextPaymentType);
      }
    } catch {
      // defensive: ensure UI remains usable on unexpected provider shapes
      nextPaymentType = "COMPRA INVENTARIO";
      setPaymentType(nextPaymentType);
    }

    if (shouldAutoDateInvoice) {
      setInvoiceNumber(
        isCajaNegra ? getTodayInvoiceMMDD() : getTodayInvoiceDDMM(),
      );
      setInvoiceError("");
    }

    // Move amount between egreso and ingreso fields if type changes
    const oldIsEgreso =
      isEgresoType(oldPaymentType) || isGastoType(oldPaymentType);
    const newIsEgreso =
      isEgresoType(nextPaymentType) || isGastoType(nextPaymentType);
    if (oldIsEgreso && !newIsEgreso && egreso.trim()) {
      setIngreso(egreso);
      setEgreso("");
    } else if (!oldIsEgreso && newIsEgreso && ingreso.trim()) {
      setEgreso(ingreso);
      setIngreso("");
    }
  };
  const handleInvoiceNumberChange = (value: string) => {
    if (isInvoiceAutoDateLocked) return;
    setInvoiceNumber(value.replace(/\D/g, "").slice(0, 4));
    setInvoiceError(""); // Clear error when user starts typing
  };
  // paymentType is derived from the selected provider; no manual change handler needed
  const handleEgresoChange = (value: string) => {
    setEgreso(normalizeMoneyInput(value));
    setAmountError(""); // Clear error when user starts typing
  };
  const handleIngresoChange = (value: string) => {
    setIngreso(normalizeMoneyInput(value));
    setAmountError(""); // Clear error when user starts typing
  };
  const handleNotesChange = (value: string) => setNotes(value);
  const handleManagerChange = (value: string) => {
    setManager(value);
    setManagerError(""); // Clear error when user starts typing
  };
  const handleManager2Change = (value: string) => {
    setManager2(value);
    setManager2Error("");
  };

  const managerOptionsLoading = Boolean(isSuperAdminUser && editingEntryId)
    ? superAdminUsersLoading
    : employeesLoading;

  const managerSelectDisabled =
    !company ||
    managerOptionsLoading ||
    employeeOptions.length === 0 ||
    (isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      !editingEntryId &&
      managerLockedByShift) ||
    // Superadmin: manager is auto-assigned when creating.
    (Boolean(isSuperAdminUser) && !editingEntryId);
  const invoiceDisabled = !company || isInvoiceAutoDateLocked;
  const egresoBorderClass = amountClass(
    isEgreso,
    egreso.trim().length > 0,
    egresoValid,
  );
  const ingresoBorderClass = amountClass(
    isIngreso,
    ingreso.trim().length > 0,
    ingresoValid,
  );

  const closeMovementModal = () => {
    setMovementModalOpen(false);
    resetFondoForm();
    setMovementAutoCloseLocked(false);
  };
  const openCreateMovementDrawer = useCallback(() => {
    resetFondoForm();
    setMovementCurrency(currencyEnabled.CRC ? "CRC" : "USD");
    if (isCajaNegra) {
      setInvoiceNumber(getTodayInvoiceMMDD());
      setInvoiceError("");
    }
    // If a provider is already selected, derive paymentType from it so the form
    // doesn't stay with the reset default ('COMPRA INVENTARIO'). This prevents
    // cases where the UI shows a provider whose configured type (e.g. 'OTROS INGRESOS')
    // is ignored because resetFondoForm set the paymentType to the default.
    if (selectedProvider) {
      try {
        const prov = movementProviders.find((p) => p.code === selectedProvider);
        if (
          prov &&
          prov.type &&
          isFondoMovementType(prov.type)
        ) {
          setPaymentType(prov.type as FondoEntry["paymentType"]);
        } else if (prov?.category === "Ingreso") {
          setPaymentType(FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"]);
        } else if (prov?.category === "Gasto") {
          setPaymentType(FONDO_GASTO_TYPES[0] as FondoEntry["paymentType"]);
        } else if (prov?.category === "Egreso") {
          setPaymentType(FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"]);
        } else if (isCajaNegra) {
          const upper = (prov?.code || selectedProvider).toUpperCase();
          setPaymentType(
            upper.includes("INGRESO")
              ? (FONDO_INGRESO_TYPES[0] as FondoEntry["paymentType"])
              : (FONDO_EGRESO_TYPES[0] as FondoEntry["paymentType"]),
          );
        } else {
          setPaymentType("COMPRA INVENTARIO");
        }
      } catch {
        setPaymentType("COMPRA INVENTARIO");
      }
    }
    // If this FondoSection instance is scoped to ingresos/egresos, force that default
    if (mode === "ingreso") setPaymentType(FONDO_INGRESO_TYPES[0]);
    if (mode === "egreso") setPaymentType(FONDO_EGRESO_TYPES[0]);
    setMovementModalOpen(true);
  }, [
    resetFondoForm,
    currencyEnabled.CRC,
    selectedProvider,
    movementProviders,
    mode,
    isCajaNegra,
    getTodayInvoiceMMDD,
  ]);

  const confirmOpenCreateMovementNow = useCallback(() => {
    setConfirmOpenCreateMovement(false);
    openCreateMovementDrawer();
  }, [openCreateMovementDrawer]);

  const handleOpenCreateMovement = async () => {
    // Confirmación solo para cuentas (BCR/BN/BAC), para evitar confusiones.
    // Skip confirmation for Caja Negra (no company/account confirmation needed)
    if (accountKey !== "FondoGeneral" && !isCajaNegra) {
      setConfirmOpenCreateMovement(true);
      return;
    }

    if (
      isRegularUser &&
      accountKey === "FondoGeneral" &&
      namespace === "fg" &&
      !isCajaNegra &&
      !isDelifoodCompany
    ) {
      try {
        const nowISO = new Date().toISOString();
        const resolution = await resolveShiftManagerForNow(nowISO);
        if (resolution?.mode === "missing") {
          setMissingShiftExpectedShift(resolution.expectedShift);
          setMissingShiftDateKey(resolution.dateKey);
          setMissingShiftModalOpen(true);
          return;
        }
      } catch (err) {
        console.error(
          "[FG] Error checking control horario before opening movement:",
          err,
        );
      }
    }

    // Si hubo un cierre pendiente (guardado en localStorage), solicitar confirmación de conteo físico.
    if (shouldPromptPhysicalCount()) {
      setPhysicalCountWasDone(false);
      setConfirmPhysicalCountOpen(true);
      return;
    }

    openCreateMovementDrawer();
  };

  const handleOpenDailyClosing = () => {
    if (accountKey !== "FondoGeneral") return;
    setEditingDailyClosingId(null);

    // Find the last "CIERRE FONDO VENTAS" movement to get the default manager
    const lastCierreVentas = [...fondoEntries]
      .filter((entry) => {
        const provider = providers.find((p) => p.code === entry.providerCode);
        return (
          provider?.name?.toUpperCase() === CIERRE_FONDO_VENTAS_PROVIDER_NAME
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

    const initialValues: DailyClosingFormValues = {
      closingDate: new Date().toISOString(),
      manager: lastCierreVentas?.manager || "",
      notes: "",
      totalCRC: currentBalanceCRC,
      totalUSD: currentBalanceUSD,
      breakdownCRC: {},
      breakdownUSD: {},
    };

    setDailyClosingInitialValues(initialValues);
    setDailyClosingModalOpen(true);
  };

  const handleCloseDailyClosing = () => {
    setDailyClosingModalOpen(false);
    setEditingDailyClosingId(null);
    setDailyClosingInitialValues(null);
    setClosingPaymentModalOpen(false);
    setClosingPaymentTarget(null);
  };

  const openClosingInvoicePaymentModal = useCallback(
    (invoice: FacturaMovement) => {
      if (isCajaNegra) {
        showToast(
          "Desde Caja Negra no se debe gestionar facturas a crédito.",
          "error",
          4500,
        );
        return;
      }
      if (pendingCierreDeCaja) {
        setPendingCierreModalOpen(true);
        return;
      }
      const totalAmount = Math.max(
        0,
        Math.trunc(Number(invoice.originalAmount ?? invoice.amount) || 0),
      );
      const paidAmount = Math.max(
        0,
        Math.trunc(Number(invoice.paidAmount) || 0),
      );
      const balanceDue = Math.max(
        0,
        Math.trunc(Number(invoice.balanceDue ?? totalAmount - paidAmount) || 0),
      );

      setSelectedProvider(invoice.providerCode);
      setClosingPaymentTarget(invoice);
      setClosingPaymentAmount(String(balanceDue || totalAmount));
      setClosingPaymentNotes(String(invoice.notes || ""));
      setClosingPaymentManager2(String(invoice.manager2 || ""));
      setClosingPaymentCreditNoteIds([]);
      setClosingPaymentModalOpen(true);
    },
    [isCajaNegra, pendingCierreDeCaja, showToast],
  );

  const closeClosingInvoicePaymentModal = useCallback(() => {
    setClosingPaymentModalOpen(false);
    setClosingPaymentTarget(null);
    setClosingPaymentAmount("");
    setClosingPaymentNotes("");
    setClosingPaymentManager2("");
    setClosingPaymentCreditNoteIds([]);
  }, []);

  const openSelectedPendingCreditInvoicePayment = useCallback(
    (invoiceId: string) => {
      const invoice = pendingClosingCreditInvoices.find(
        (item) => item.id === invoiceId,
      );
      if (invoice) openClosingInvoicePaymentModal(invoice);
    },
    [openClosingInvoicePaymentModal, pendingClosingCreditInvoices],
  );

  const handleMovementCreditInvoiceSelect = useCallback(
    (invoiceId: string) => {
      const invoice = pendingClosingCreditInvoices.find(
        (item) => item.id === invoiceId,
      );
      if (invoice) {
        openClosingInvoicePaymentModal(invoice);
        setMovementModalOpen(false);
      }
    },
    [openClosingInvoicePaymentModal, pendingClosingCreditInvoices],
  );

  const closingPaymentAvailableCreditNotes = useMemo(() => {
    if (!closingPaymentTarget) return [];
    return selectedProviderPendingCreditNotes.filter(
      (note) => note.currency === closingPaymentTarget.currency,
    );
  }, [closingPaymentTarget, selectedProviderPendingCreditNotes]);

  const closingPaymentSelectedCreditNotes = useMemo(() => {
    const selectedIds = new Set(closingPaymentCreditNoteIds);
    return closingPaymentAvailableCreditNotes.filter((note) =>
      selectedIds.has(note.id),
    );
  }, [closingPaymentAvailableCreditNotes, closingPaymentCreditNoteIds]);

  const closingPaymentCreditNotesTotal = useMemo(() => {
    if (!closingPaymentTarget) return 0;
    const totalAmount = Math.max(
      0,
      Math.trunc(
        Number(closingPaymentTarget.originalAmount ?? closingPaymentTarget.amount) ||
          0,
      ),
    );
    const paidAmount = Math.max(
      0,
      Math.trunc(Number(closingPaymentTarget.paidAmount) || 0),
    );
    let remaining = Math.max(
      0,
      Math.trunc(Number(closingPaymentTarget.balanceDue ?? totalAmount - paidAmount) || 0),
    );
    let total = 0;
    closingPaymentSelectedCreditNotes.forEach((note) => {
      if (remaining <= 0) return;
      const applied = Math.min(
        remaining,
        Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
      );
      total += applied;
      remaining -= applied;
    });
    return total;
  }, [closingPaymentSelectedCreditNotes, closingPaymentTarget]);

  const submitClosingInvoicePayment = useCallback(
    async (mode: "partial" | "full") => {
      if (!company || !closingPaymentTarget) return;

      if (isCajaNegra) {
        showToast(
          "Desde Caja Negra no se debe gestionar facturas a crédito.",
          "error",
          4500,
        );
        return;
      }

      if (pendingCierreDeCaja) {
        setPendingCierreModalOpen(true);
        return;
      }

      const totalAmount = Math.max(
        0,
        Math.trunc(
          Number(
            closingPaymentTarget.originalAmount ?? closingPaymentTarget.amount,
          ) || 0,
        ),
      );
      const paidAmount = Math.max(
        0,
        Math.trunc(Number(closingPaymentTarget.paidAmount) || 0),
      );
      const balance = Math.max(
        0,
        Math.min(
          totalAmount,
          Math.trunc(
            Number(
              closingPaymentTarget.balanceDue ?? totalAmount - paidAmount,
            ) || 0,
          ),
        ),
      );
      const enteredAmount = Math.max(
        0,
        Math.trunc(Number(closingPaymentAmount) || 0),
      );
      const selectedNoteIds = new Set(closingPaymentCreditNoteIds);
      let remainingForNotes = balance;
      const appliedCreditNotes = selectedProviderPendingCreditNotes.reduce<
        AppliedCreditNote[]
      >((acc, note) => {
        if (remainingForNotes <= 0 || !selectedNoteIds.has(note.id)) return acc;
        if (note.currency !== closingPaymentTarget.currency) return acc;
        const appliedAmount = Math.min(
          remainingForNotes,
          Math.max(0, Math.trunc(Number(note.balanceDue) || 0)),
        );
        if (appliedAmount <= 0) return acc;
        remainingForNotes -= appliedAmount;
        acc.push({
          id: note.id,
          invoiceNumber: note.invoiceNumber,
          amount: note.amount,
          appliedAmount,
          currency: note.currency,
        });
        return acc;
      }, []);
      const creditNotesAmountToApply = appliedCreditNotes.reduce(
        (sum, note) => sum + Math.max(0, Math.trunc(note.appliedAmount)),
        0,
      );
      const maxCashPaymentBeforeAdjustment = Math.max(
        0,
        balance - creditNotesAmountToApply,
      );
      const maxCashPayment = roundCreditNotePaymentAmount(
        maxCashPaymentBeforeAdjustment,
        closingPaymentTarget.currency,
        accountKey,
      );
      const paymentAmountToApply =
        mode === "full" ? maxCashPayment : enteredAmount;
      const creditNoteAdjustmentAmount =
        mode === "full"
          ? Math.max(0, maxCashPaymentBeforeAdjustment - paymentAmountToApply)
          : 0;
      const totalAppliedToInvoice =
        paymentAmountToApply +
        creditNotesAmountToApply +
        creditNoteAdjustmentAmount;

      if (paymentAmountToApply <= 0) {
        showToast("Ingrese un monto valido para el pago.", "error", 4000);
        return;
      }

      if (paymentAmountToApply > maxCashPayment) {
        showToast(
          "El monto no puede superar el saldo disponible despues de aplicar las notas de credito.",
          "error",
          4000,
        );
        return;
      }

      if (totalAppliedToInvoice <= 0) {
        showToast("No hay monto por aplicar a la factura.", "error", 4000);
        return;
      }

      if (totalAppliedToInvoice > balance) {
        showToast(
          "El total aplicado supera el saldo pendiente de la factura.",
          "error",
          4000,
        );
        return;
      }

      const nowISO = new Date().toISOString();
      const nextPaidAmount = Math.min(
        totalAmount,
        paidAmount + totalAppliedToInvoice,
      );
      const nextBalanceDue = Math.max(0, totalAmount - nextPaidAmount);
      const nextStatus =
        nextBalanceDue === 0
          ? "PAGADA"
          : nextPaidAmount > 0
            ? "PARCIAL"
            : "PENDIENTE";
      const cleanedNotes = closingPaymentNotes.trim();
      const cleanedManager2 = closingPaymentManager2.trim();
      const paymentManager2Value = cleanedManager2 || null;
      const nextAppliedCreditNotes = [
        ...(Array.isArray(closingPaymentTarget.appliedCreditNotes)
          ? closingPaymentTarget.appliedCreditNotes
          : []),
        ...appliedCreditNotes,
      ];

      const updatedMovement: FacturaMovement = {
        ...closingPaymentTarget,
        accountId: accountKey,
        amount: totalAmount,
        originalAmount: totalAmount,
        amountPayment: paymentAmountToApply,
        amountDue: nextBalanceDue,
        paidAmount: nextPaidAmount,
        balanceDue: nextBalanceDue,
        paymentStatus: nextStatus,
        notes: cleanedNotes,
        appliedCreditNotes:
          nextAppliedCreditNotes.length > 0 ? nextAppliedCreditNotes : undefined,
        updateAt: nowISO,
        ...(paymentManager2Value ? { manager2: paymentManager2Value } : {}),
      };

      const paymentMovement =
        MovimientosFondosService.buildInvoicePaymentMovement({
          company,
          invoice: updatedMovement,
          paymentAmount: paymentAmountToApply,
          updateAt: nowISO,
          manager2: paymentManager2Value || undefined,
        });
      const paymentMovementId = String((paymentMovement as any).id || "");
      const targetAccountKey = accountKey;

      setClosingPaymentSubmitting(true);
      try {
        const docId =
          MovimientosFondosService.buildCompanyMovementsKey(company);

        // Load ledger
        let baseStorage = null;
        try {
          baseStorage = await MovimientosFondosService.getDocument(docId);
        } catch {
          baseStorage = null;
        }
        const ledger =
          baseStorage ??
          MovimientosFondosService.createEmptyMovementStorage(company);
        ledger.company = company;
        ledger.operations = { movements: [] };

        const state =
          ledger.state ??
          MovimientosFondosService.createEmptyMovementStorage(company).state;
        const acctKey = targetAccountKey;
        const currency = (paymentMovement as any)
          .currency as MovementCurrencyKey;
        const amountToApply = Math.trunc(paymentAmountToApply || 0);
        let found = false;
        state.balancesByAccount = state.balancesByAccount.map((b) => {
          if (b.accountId === acctKey && b.currency === currency) {
            const current =
              typeof b.currentBalance === "number"
                ? b.currentBalance
                : b.initialBalance || 0;
            const next = current - amountToApply;
            found = true;
            return { ...b, currentBalance: next };
          }
          return b;
        });
        if (!found) {
          state.balancesByAccount.push({
            accountId: acctKey,
            currency,
            enabled: true,
            initialBalance: 0,
            currentBalance: -amountToApply,
          });
        }
        state.updatedAt = new Date().toISOString();
        ledger.state = state;

        const batch = writeBatch(db);
        batch.set(
          FacturasService.buildMovementRef(company, closingPaymentTarget.id),
          stripUndefinedDeep(updatedMovement),
          { merge: true },
        );

        if (appliedCreditNotes.length > 0) {
          appliedCreditNotes.forEach((note) => {
            const pendingNote = selectedProviderPendingCreditNotes.find(
              (item) => item.id === note.id,
            );
            const noteAmount = Math.max(
              0,
              Math.trunc(Number(pendingNote?.amount ?? note.amount) || 0),
            );
            const previousPaid = Math.max(
              0,
              Math.trunc(Number(pendingNote?.paidAmount) || 0),
            );
            const nextPaidAmount = Math.min(
              noteAmount,
              previousPaid + Math.trunc(Number(note.appliedAmount) || 0),
            );
            const nextBalanceDue = Math.max(0, noteAmount - nextPaidAmount);

            batch.set(
              FacturasService.buildMovementRef(company, note.id),
              {
                paidAmount: nextPaidAmount,
                balanceDue: nextBalanceDue,
                paymentStatus: nextBalanceDue === 0 ? "REBAJADA" : "PARCIAL",
                updateAt: nowISO,
              },
              { merge: true },
            );
          });
        }

        const mainRef = doc(
          db,
          MovimientosFondosService.COLLECTION_NAME,
          docId,
        );
        batch.set(mainRef, stripUndefinedDeep(ledger) as any);
        const movRef = MovimientosFondosService.buildMovementRef(
          docId,
          paymentMovementId,
          targetAccountKey,
        );
        batch.set(movRef, stripUndefinedDeep(paymentMovement));

        await batch.commit();
        setPendingClosingCreditInvoices((current) =>
          current.filter((movement) => movement.id !== closingPaymentTarget.id),
        );
        if (appliedCreditNotes.length > 0) {
          setSelectedProviderPendingCreditNotes((prev) =>
            prev
              .map((note) => {
                const applied = appliedCreditNotes.find(
                  (item) => item.id === note.id,
                );
                if (!applied) return note;
                const paidAmount = Math.min(
                  note.amount,
                  note.paidAmount + applied.appliedAmount,
                );
                return {
                  ...note,
                  paidAmount,
                  balanceDue: Math.max(0, note.amount - paidAmount),
                };
              })
              .filter((note) => note.balanceDue > 0),
          );
          setClosingPaymentCreditNoteIds([]);
        }
        storageSnapshotRef.current = stripUndefinedDeep(ledger) as any;
        try {
          const cacheKey = buildV2MovementsCacheKey(docId, targetAccountKey);
          const cached = v2MovementsCacheRef.current[cacheKey];
          if (cached?.loaded) {
            v2MovementsCacheRef.current[cacheKey] = {
              ...cached,
              movements: [
                {
                  ...(paymentMovement as unknown as FondoEntry),
                  id: paymentMovementId,
                },
                ...cached.movements,
              ],
            };
            rebuildEntriesFromV2Cache(docId, targetAccountKey);
          } else {
            applyLedgerStateFromStorage(ledger.state);
          }
        } catch (refreshErr) {
          console.error(
            "[FONDO] Error refreshing UI after payment:",
            refreshErr,
          );
        }
        closeClosingInvoicePaymentModal();
      } catch (error) {
        console.error("[FONDO] Error saving credit invoice payment:", error);
      } finally {
        setClosingPaymentSubmitting(false);
      }
    },
    [
      closeClosingInvoicePaymentModal,
      closingPaymentAmount,
      closingPaymentCreditNoteIds,
      closingPaymentManager2,
      closingPaymentNotes,
      closingPaymentTarget,
      company,
      accountKey,
      isCajaNegra,
      pendingCierreDeCaja,
      selectedProviderPendingCreditNotes,
      showToast,
      applyLedgerStateFromStorage,
      buildV2MovementsCacheKey,
      rebuildEntriesFromV2Cache,
    ],
  );

  const handleCancelPhysicalCount = useCallback(() => {
    setConfirmPhysicalCountOpen(false);
  }, []);

  const closePendingCierreModal = useCallback(() => {
    setPendingCierreModalOpen(false);
  }, []);

  const handleConfirmPhysicalCount = useCallback(() => {
    setConfirmPhysicalCountOpen(false);
    // Marcar como confirmado inmediatamente para no volver a solicitar el conteo
    // aunque el usuario cierre el formulario sin guardar un movimiento.
    if (typeof window !== "undefined" && accountKey === "FondoGeneral") {
      try {
        const key = buildPhysicalCountStorageKey();
        if (key) localStorage.setItem(key, "false");
        cleanupPhysicalCountLegacyKeys();
      } catch {
        // ignore
      }
    }
    openCreateMovementDrawer();
  }, [
    openCreateMovementDrawer,
    accountKey,
    buildPhysicalCountStorageKey,
    cleanupPhysicalCountLegacyKeys,
  ]);

  const handleConfirmDailyClosing = async (closing: DailyClosingFormValues) => {
    if (accountKey !== "FondoGeneral") {
      setDailyClosingModalOpen(false);
      return;
    }

    const managerName = closing.manager.trim();
    if (!managerName) {
      setDailyClosingModalOpen(false);
      return;
    }

    let closingDateValue = closing.closingDate
      ? new Date(closing.closingDate)
      : new Date();
    if (Number.isNaN(closingDateValue.getTime())) {
      closingDateValue = new Date();
    }

    const createdAtDate = new Date();
    const createdAt = createdAtDate.toISOString();
    const diffCRC =
      Math.trunc(closing.totalCRC) - Math.trunc(currentBalanceCRC);
    const diffUSD =
      Math.trunc(closing.totalUSD) - Math.trunc(currentBalanceUSD);
    const userNotes = closing.notes.trim();
    const closingDateKey = dateKeyFromDate(closingDateValue);

    const record: DailyClosingRecord = {
      id: editingDailyClosingId ?? `${Date.now()}`,
      createdAt: editingDailyClosingId
        ? (dailyClosings.find((d) => d.id === editingDailyClosingId)
            ?.createdAt ?? createdAt)
        : createdAt,
      closingDate: closingDateValue.toISOString(),
      manager: managerName,
      totalCRC: Math.trunc(closing.totalCRC),
      totalUSD: Math.trunc(closing.totalUSD),
      recordedBalanceCRC: Math.trunc(currentBalanceCRC),
      recordedBalanceUSD: Math.trunc(currentBalanceUSD),
      diffCRC,
      diffUSD,
      notes: userNotes,
      breakdownCRC: closing.breakdownCRC ?? {},
      breakdownUSD: closing.breakdownUSD ?? {},
    };

    const normalizedCompany = (company || "").trim();
    if (normalizedCompany.length === 0) {
      setDailyClosingModalOpen(false);
      showToast("Error: No se pudo identificar la empresa", "error");
      return;
    }

    // Cross-device/tabs guard: prevent Fondo General closing while another closing is being created.
    // Enforced only for regular users (edits are allowed).
    let closingGuard: { token: string; docId: string } | null = null;
    try {
      const isEditingClosing = Boolean(editingDailyClosingId);
      // Enforce guard ONLY for regular users.
      // Admin/superadmin are allowed to create a closing even during the lock window.
      if (!isEditingClosing && isRegularUser) {
        const acquired = await acquireClosingGuard(
          normalizedCompany,
          "FONDO_GENERAL",
        );
        if (!acquired.ok) {
          const kindLabel =
            acquired.lockedKind === "FONDO_GENERAL"
              ? "Fondo General"
              : acquired.lockedKind === "FONDO_VENTAS"
                ? "Fondo Ventas"
                : "otro cierre";
          showToast(
            `Otro cierre (${kindLabel}) se está registrando. Intente en ${formatToastWaitTime(
              acquired.remainingSec,
            )}.`,
            "warning",
            6000,
          );
          return;
        }
        closingGuard = { token: acquired.token, docId: acquired.docId };
      }
    } catch {
      // ignore; fall back to client-side cooldown
    }

    // Prevent duplicate daily closings created almost instantly.
    // Requirement: enforce at least 1 minute between NEW closings for role "user" (edits are allowed).
    const isEditingClosing = Boolean(editingDailyClosingId);
    const dailyClosingCooldownKey = `fondogeneral-lastDailyClosingSavedAt:${normalizedCompany}`;
    if (!isEditingClosing) {
      if (
        dailyClosingSubmitInProgressRef.current ||
        dailyClosingsRequestCountRef.current > 0
      ) {
        showToast(
          "Ya hay un cierre guardándose. Espere un momento.",
          "warning",
          4000,
        );
        return;
      }

      const nowMs = Date.now();
      let lastSavedAtMs = lastDailyClosingSavedAtRef.current;
      if (typeof window !== "undefined") {
        try {
          const stored = Number(localStorage.getItem(dailyClosingCooldownKey));
          if (Number.isFinite(stored) && stored > 0) {
            lastSavedAtMs = Math.max(lastSavedAtMs, stored);
          }
        } catch {
          // ignore storage errors
        }
      }

      // Cooldown between NEW closings only for regular users.
      if (isRegularUser) {
        if (lastSavedAtMs > 0 && nowMs - lastSavedAtMs < zxq_plm) {
          const remainingMs = zxq_plm - (nowMs - lastSavedAtMs);
          const remainingSec = Math.ceil(remainingMs / 1000);
          showToast(
            `Ya se registró un cierre hace poco. Espere ${formatToastWaitTime(
              remainingSec,
            )} para crear otro.`,
            "warning",
            5000,
          );
          return;
        }
      }

      // Lock immediately to avoid double-click / double-submit duplicates.
      dailyClosingSubmitInProgressRef.current = true;
    }

    // Save to Firestore first and wait for confirmation
    beginDailyClosingsRequest();
    try {
      await DailyClosingsService.saveClosing(normalizedCompany, record);
      console.log(
        `[CIERRE] ✅ Cierre guardado exitosamente en Firestore. ID: ${record.id}, Fecha: ${record.closingDate}`,
      );

      // If an admin/superadmin created a NEW closing, touch the guard on success so regular users
      // are blocked for the lock window.
      if (!isEditingClosing && !isRegularUser) {
        void touchClosingGuard(normalizedCompany, "FONDO_GENERAL");
      }

      // Mark cooldown only after a successful save (so retries after errors are allowed).
      if (!isEditingClosing) {
        const savedAt = Date.now();
        lastDailyClosingSavedAtRef.current = savedAt;
        if (typeof window !== "undefined") {
          try {
            localStorage.setItem(dailyClosingCooldownKey, String(savedAt));
          } catch {
            // ignore storage errors
          }
        }
      }

      // Only update local state after successful save
      setDailyClosings((prev) => mergeDailyClosingRecords(prev, [record]));
      loadedDailyClosingKeysRef.current.add(closingDateKey);
      loadingDailyClosingKeysRef.current.delete(closingDateKey);
      setDailyClosingsHydrated(true);

      // Guardar en localStorage el último cierre (para pedir confirmación en el primer movimiento después del cierre)
      if (typeof window !== "undefined") {
        try {
          const key = buildPhysicalCountStorageKey();
          if (key) localStorage.setItem(key, "true");
          cleanupPhysicalCountLegacyKeys();
        } catch {
          // ignore storage errors
        }
      }

      setPendingCierreDeCaja(false);
      setDailyClosingModalOpen(false);
    } catch (err) {
      console.error("[CIERRE] ❌ Error guardando cierre en Firestore:", err);

      // Alert email for save failures (non-blocking)
      try {
        const whenISO = new Date().toISOString();
        const where =
          "FondoSection.handleConfirmDailyClosing -> DailyClosingsService.saveClosing";
        const errorMessage =
          err instanceof Error
            ? `${err.name}: ${err.message}${err.stack ? `\n\nStack:\n${err.stack}` : ""}`
            : typeof err === "string"
              ? err
              : JSON.stringify(err);

        const subject = `[ALERTA][CIERRE] Error al guardar cierre (${normalizedCompany})`;
        const text = [
          `Dónde: ${where}`,
          `Cuándo: ${whenISO}`,
          `Empresa: ${normalizedCompany}`,
          `Usuario: ${(user?.email || "N/A").toString()}`,
          `Cierre ID: ${record.id}`,
          `Fecha cierre: ${record.closingDate}`,
          "",
          `Error: ${errorMessage}`,
        ].join("\n");

        const recipients = [
          "chavesa698@gmail.com",
          "price.master.srl@gmail.com",
        ];
        void Promise.all(
          recipients.map((to) =>
            addDoc(collection(db, "mail"), {
              to,
              subject,
              text,
              createdAt: serverTimestamp(),
            }),
          ),
        ).catch((mailErr) => {
          console.error(
            "[CIERRE] ❌ Error encolando email de alerta:",
            mailErr,
          );
        });
      } catch (mailErr) {
        console.error("[CIERRE] ❌ Error preparando email de alerta:", mailErr);
      }

      showToast(
        "Error al guardar el cierre. Por favor, intente de nuevo.",
        "error",
        5000,
      );

      // Release cross-device guard on failure so users can retry immediately.
      if (closingGuard) {
        try {
          void releaseClosingGuard(normalizedCompany, closingGuard);
        } catch {
          // ignore
        }
        closingGuard = null;
      }
      return;
    } finally {
      finishDailyClosingsRequest();
      if (!isEditingClosing) {
        dailyClosingSubmitInProgressRef.current = false;
      }
    }

    // IMPORTANT: Do NOT release the cross-device guard on success.
    // Let it expire (lockedUntilMs) so other devices/tabs can't create a close “almost at the same time”.

    const notificationRecipients = new Set<string>();
    const adminRecipient = ownerAdminEmail?.trim();
    if (adminRecipient) {
      notificationRecipients.add(adminRecipient);
    } else if (activeOwnerId) {
      console.warn("Daily closing email: missing admin recipient for owner.", {
        ownerId: activeOwnerId,
        company: normalizedCompany,
      });
    }
    const userEmail = user?.email?.trim();
    if (userEmail) notificationRecipients.add(userEmail);

    const emailTemplate = buildDailyClosingEmailTemplate({
      company: normalizedCompany,
      accountKey,
      closingDateISO: record.closingDate,
      manager: record.manager,
      totalCRC: record.totalCRC,
      totalUSD: record.totalUSD,
      recordedBalanceCRC: record.recordedBalanceCRC,
      recordedBalanceUSD: record.recordedBalanceUSD,
      diffCRC: record.diffCRC,
      diffUSD: record.diffUSD,
      notes: record.notes,
    });

    if (notificationRecipients.size === 0 && activeOwnerId) {
      console.warn(
        "Daily closing email: skipped sending notification because no recipients were resolved.",
        {
          ownerId: activeOwnerId,
          company: normalizedCompany,
        },
      );
    }

    // Crear documentos en la colección 'mail' para que la extensión Firebase Trigger Email los procese
    for (const recipient of notificationRecipients) {
      if (!recipient) continue;
      try {
        const docRef = await addDoc(collection(db, "mail"), {
          to: recipient,
          subject: emailTemplate.subject,
          text: emailTemplate.text,
          html: emailTemplate.html,
          createdAt: serverTimestamp(),
        });
        console.log(
          `[MAIL-DOC] Documento creado en 'mail' para ${recipient}, ID: ${docRef.id}`,
        );
        showToast("Correo de cierre diario enviado correctamente", "success");
      } catch (err) {
        console.error(
          `[MAIL-DOC] Error creando documento en 'mail' para ${recipient}:`,
          err,
        );
        showToast("Error al enviar correo de cierre diario", "error");
      }
    }

    // Create or update movement(s) that reflect the difference so the balance updates accordingly.
    // We create one FondoEntry per currency where diff != 0. These are regular movements (editable)
    // and will appear in the movements list so users can later edit them (and edits will be audited
    // using the existing edit flow which marks entries as 'Editado').
    try {
      const newMovements: FondoEntry[] = [];
      let latestLedgerSnapshot: {
        initialCRC: number;
        currentCRC: number;
        initialUSD: number;
        currentUSD: number;
      } | null = null;

      const closingBalanceCRC = Math.trunc(record.totalCRC ?? 0);
      const closingBalanceUSD = Math.trunc(record.totalUSD ?? 0);

      const buildCierreMovementBaseId = (when: Date) => {
        // Local time, URL-safe: 2025_12_15-02_10_38_929_CIERRE
        const yyyy = when.getFullYear();
        const MM = String(when.getMonth() + 1).padStart(2, "0");
        const DD = String(when.getDate()).padStart(2, "0");
        const HH = String(when.getHours()).padStart(2, "0");
        const mm = String(when.getMinutes()).padStart(2, "0");
        const ss = String(when.getSeconds()).padStart(2, "0");
        const mmm = String(when.getMilliseconds()).padStart(3, "0");
        const dateKey = `${yyyy}_${MM}_${DD}`;
        const timeKey = `${HH}_${mm}_${ss}_${mmm}`;
        return `${dateKey}-${timeKey}_CIERRE`;
      };

      const cierreBaseId = buildCierreMovementBaseId(createdAtDate);
      // If we're editing an existing closing, compute diffs relative to the balance
      // excluding the previous generated adjustment(s). This avoids flipping an
      // existing entry from egreso -> ingreso and double-counting.
      let adjustedDiffCRC = record.diffCRC;
      let adjustedDiffUSD = record.diffUSD;
      if (editingDailyClosingId) {
        let prevCRCContribution = 0;
        let prevUSDContribution = 0;
        fondoEntries.forEach((e) => {
          if (
            e.originalEntryId === record.id &&
            isAutoAdjustmentProvider(e.providerCode)
          ) {
            const contrib = (e.amountIngreso || 0) - (e.amountEgreso || 0);
            if ((e.currency as any) === "USD") {
              prevUSDContribution += contrib;
            } else {
              prevCRCContribution += contrib;
            }
          }
        });

        const baseBalanceCRC = currentBalanceCRC - prevCRCContribution;
        const baseBalanceUSD = currentBalanceUSD - prevUSDContribution;
        adjustedDiffCRC =
          Math.trunc(closing.totalCRC) - Math.trunc(baseBalanceCRC);
        adjustedDiffUSD =
          Math.trunc(closing.totalUSD) - Math.trunc(baseBalanceUSD);
        // update the record diffs so persistence reflects the adjusted values
        record.diffCRC = adjustedDiffCRC;
        record.diffUSD = adjustedDiffUSD;
        // When editing a closing, the recorded balance should reflect the underlying
        // account balance excluding previous automatic adjustments, so store the
        // base balance instead of the currentBalance (which contains those adjustments).
        try {
          record.recordedBalanceCRC = Math.trunc(baseBalanceCRC);
          record.recordedBalanceUSD = Math.trunc(baseBalanceUSD);
        } catch (rbErr) {
          console.error(
            "[FG-DEBUG] Error setting recordedBalance on edited closing:",
            rbErr,
          );
        }

        console.info("[FG-DEBUG] Editing closing values", {
          closingTotalCRC: closing.totalCRC,
          currentBalanceCRC,
          prevCRCContribution,
          baseBalanceCRC,
          adjustedDiffCRC,
        });
      }

      const willCreateInfo = adjustedDiffCRC === 0 && adjustedDiffUSD === 0;
      const willCreateCRC = !willCreateInfo && Boolean(adjustedDiffCRC);
      const willCreateUSD = !willCreateInfo && Boolean(adjustedDiffUSD);
      const plannedCount =
        Number(willCreateCRC) + Number(willCreateUSD) + Number(willCreateInfo);

      if (adjustedDiffCRC && adjustedDiffCRC !== 0) {
        const diff = Math.trunc(adjustedDiffCRC);
        const isPositive = diff > 0;
        const paymentType = AUTO_ADJUSTMENT_CLOSING_TYPE;
        const invoiceDDMM = getTodayInvoiceDDMM(createdAtDate);
        const entry: FondoEntry = {
          id: cierreBaseId,
          providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
          invoiceNumber: invoiceDDMM,
          paymentType,
          amountEgreso: isPositive ? 0 : Math.abs(diff),
          amountIngreso: isPositive ? diff : 0,
          manager: AUTO_ADJUSTMENT_MANAGER,
          notes: `AJUSTE APLICADO AL SALDO ACTUAL\n[ALERT_ICON]Diferencia CRC: ${
            diff >= 0 ? "+ " : "- "
          }${formatByCurrency("CRC", Math.abs(diff))}.${
            userNotes ? ` Notas: ${userNotes}` : ""
          }`,
          createdAt,
          accountId: accountKey,
          currency: "CRC",
          breakdown: closing.breakdownCRC ?? {},
          closingBalanceCRC,
          closingBalanceUSD,
        } as FondoEntry;
        newMovements.push(entry);
      }

      if (adjustedDiffUSD && adjustedDiffUSD !== 0) {
        const diff = Math.trunc(adjustedDiffUSD);
        const isPositive = diff > 0;
        const paymentType = AUTO_ADJUSTMENT_CLOSING_TYPE;
        const invoiceDDMM = getTodayInvoiceDDMM(createdAtDate);
        const entry: FondoEntry = {
          id: plannedCount > 1 ? `${cierreBaseId}_USD` : cierreBaseId,
          providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
          invoiceNumber: invoiceDDMM,
          paymentType,
          amountEgreso: isPositive ? 0 : Math.abs(diff),
          amountIngreso: isPositive ? diff : 0,
          manager: AUTO_ADJUSTMENT_MANAGER,
          notes: `AJUSTE APLICADO AL SALDO ACTUAL\n[ALERT_ICON]Diferencia USD: ${
            diff >= 0 ? "+ " : "- "
          }${formatByCurrency("USD", Math.abs(diff))}.${
            userNotes ? ` Notas: ${userNotes}` : ""
          }`,
          createdAt,
          accountId: accountKey,
          currency: "USD",
          closingBalanceCRC,
          closingBalanceUSD,
        } as FondoEntry;
        if ((entry as any).currency === "USD")
          (entry as any).breakdown = closing.breakdownUSD ?? {};
        newMovements.push(entry);
      }

      if (adjustedDiffCRC === 0 && adjustedDiffUSD === 0) {
        const invoiceDDMM = getTodayInvoiceDDMM(createdAtDate);
        const entry: FondoEntry = {
          id: cierreBaseId,
          providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
          invoiceNumber: invoiceDDMM,
          paymentType: "INFORMATIVO" as any, // Tipo especial para cierres sin diferencias
          amountEgreso: 0,
          amountIngreso: 0,
          manager: AUTO_ADJUSTMENT_MANAGER,
          notes: `[CHECK_ICON]Sin diferencias.${
            userNotes ? ` Notas: ${userNotes}` : ""
          }`,
          createdAt,
          accountId: accountKey,
          currency: "CRC",
          breakdown: closing.breakdownCRC ?? {},
          closingBalanceCRC,
          closingBalanceUSD,
        } as FondoEntry;
        newMovements.push(entry);
      }
      if (editingDailyClosingId && newMovements.length === 0) {
        // No diff now: remove previous adjustment movements linked to this closing
        console.info(
          "[FG-DEBUG] Removing previous adjustment movements for closing",
          record.id,
          { beforeCount: fondoEntries.length },
        );

        // Persistir eliminación de ajustes para que el currentBalance se revierta.
        try {
          const toRemoveNow = fondoEntries.filter(
            (e) =>
              e.originalEntryId === record.id &&
              isAutoAdjustmentProvider(e.providerCode),
          );
          for (const removed of toRemoveNow) {
            const saved = await persistMovementToFirestore(
              fondoEntries,
              "delete",
              {
                deleteId: removed.id,
                before: removed,
              },
            );
            if (saved.ok && saved.ledgerSnapshot) {
              latestLedgerSnapshot = saved.ledgerSnapshot;
            }
          }
        } catch (persistRemoveErr) {
          console.error(
            "[FG-DEBUG] Error persisting deletion of adjustment movements:",
            persistRemoveErr,
          );
        }

        setFondoEntries((prev) => {
          const toRemove = prev.filter(
            (e) =>
              e.originalEntryId === record.id &&
              isAutoAdjustmentProvider(e.providerCode),
          );
          const filtered = prev.filter(
            (e) =>
              !(
                e.originalEntryId === record.id &&
                isAutoAdjustmentProvider(e.providerCode)
              ),
          );
          console.info("[FG-DEBUG] After remove, count:", filtered.length);
          if (toRemove.length > 0) {
            try {
              const resolution = {
                removedAdjustments: toRemove.map((r) => ({
                  id: r.id,
                  currency: r.currency,
                  amount: (r.amountIngreso || 0) - (r.amountEgreso || 0),
                  amountIngreso: r.amountIngreso || 0,
                  amountEgreso: r.amountEgreso || 0,
                  manager: r.manager,
                  createdAt: r.createdAt,
                })),
                note: "Ajustes eliminados manualmente al editar el cierre",
              } as any;

              setDailyClosings((prevClosings) => {
                const updated = prevClosings.map((d) => {
                  if (d.id !== record.id) return d;
                  return {
                    ...d,
                    adjustmentResolution: resolution,
                  } as DailyClosingRecord;
                });
                try {
                  const updatedRecord = updated.find((d) => d.id === record.id);
                  if (updatedRecord && normalizedCompany.length > 0) {
                    // Fire-and-forget save for adjustment updates (non-critical)
                    void DailyClosingsService.saveClosing(
                      normalizedCompany,
                      updatedRecord,
                    )
                      .then(() => {
                        console.log(
                          `[CIERRE] ✅ Ajuste de cierre guardado exitosamente. ID: ${updatedRecord.id}`,
                        );
                      })
                      .catch((saveErr) => {
                        console.error(
                          "[CIERRE] ❌ Error saving updated daily closing with resolution:",
                          saveErr,
                        );
                      });
                  }
                } catch (saveErr) {
                  console.error(
                    "[CIERRE] ❌ Error persisting daily closing resolution:",
                    saveErr,
                  );
                }
                return updated;
              });
            } catch (err) {
              console.error(
                "Error preparing adjustment resolution summary:",
                err,
              );
            }
          }

          return filtered;
        });

        // Aplicar balances junto con la actualización de movimientos para evitar saltos visuales.
        if (latestLedgerSnapshot) {
          setLedgerSnapshot(latestLedgerSnapshot);
        }
      }

      if (newMovements.length > 0) {
        // link movements to the daily closing via originalEntryId
        newMovements.forEach((m) => (m.originalEntryId = record.id));

        // Persistir ajustes al documento principal para actualizar currentBalance.
        // En edición: actualiza/elimina por moneda; en creación: crea movimientos nuevos.
        try {
          const normalizeCurrency = (value: unknown): MovementCurrencyKey =>
            value === "USD" ? "USD" : "CRC";

          const plannedCurrencies = new Set<MovementCurrencyKey>(
            newMovements.map((m) => normalizeCurrency(m.currency)),
          );

          const existingAdjustments = editingDailyClosingId
            ? fondoEntries.filter(
                (e) =>
                  e.originalEntryId === record.id &&
                  isAutoAdjustmentProvider(e.providerCode),
              )
            : [];

          const existingByCurrency = new Map<MovementCurrencyKey, FondoEntry>();
          existingAdjustments.forEach((e) => {
            existingByCurrency.set(normalizeCurrency(e.currency), e);
          });

          // Remove previous adjustments that are no longer present (editing scenario)
          if (editingDailyClosingId) {
            for (const prevAdj of existingAdjustments) {
              const cur = normalizeCurrency(prevAdj.currency);
              if (!plannedCurrencies.has(cur)) {
                const saved = await persistMovementToFirestore(
                  fondoEntries,
                  "delete",
                  {
                    deleteId: prevAdj.id,
                    before: prevAdj,
                  },
                );
                if (saved.ok && saved.ledgerSnapshot) {
                  latestLedgerSnapshot = saved.ledgerSnapshot;
                }
              }
            }
          }

          // Upsert per currency
          for (const movement of newMovements) {
            const cur = normalizeCurrency(movement.currency);
            const existing = existingByCurrency.get(cur);

            if (editingDailyClosingId && existing) {
              const updatedForPersist: FondoEntry = {
                ...existing,
                paymentType: movement.paymentType,
                invoiceNumber: movement.invoiceNumber,
                amountEgreso: movement.amountEgreso,
                amountIngreso: movement.amountIngreso,
                notes: movement.notes,
                breakdown: movement.breakdown ?? existing.breakdown,
                createdAt: movement.createdAt,
                manager: AUTO_ADJUSTMENT_MANAGER,
                providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
                accountId: accountKey,
                currency: cur,
                originalEntryId: record.id,
                closingBalanceCRC: movement.closingBalanceCRC,
                closingBalanceUSD: movement.closingBalanceUSD,
              } as FondoEntry;

              const saved = await persistMovementToFirestore(
                fondoEntries,
                "edit",
                {
                  upsert: updatedForPersist,
                  before: existing,
                },
              );
              if (saved.ok && saved.ledgerSnapshot) {
                latestLedgerSnapshot = saved.ledgerSnapshot;
              }
            } else {
              // Creating a new adjustment movement
              const saved = await persistMovementToFirestore(
                [movement, ...fondoEntries],
                "create",
                { upsert: movement },
              );
              if (saved.ok && saved.ledgerSnapshot) {
                latestLedgerSnapshot = saved.ledgerSnapshot;
              }
            }
          }
        } catch (persistAdjErr) {
          console.error(
            "[FG-DEBUG] Error persisting daily closing adjustments to main ledger:",
            persistAdjErr,
          );
        }

        if (editingDailyClosingId) {
          // update existing related movement(s), preserve audit history
          setFondoEntries((prev) => {
            console.info(
              "[FG-DEBUG] Updating existing related adjustment movements for closing",
              record.id,
              { prevCount: prev.length, newMovements },
            );
            const updated = prev.map((e) => {
              if (
                e.originalEntryId === record.id &&
                isAutoAdjustmentProvider(e.providerCode)
              ) {
                const match = newMovements.find(
                  (nm) => nm.currency === e.currency,
                );
                if (!match) return e;
                // build audit history
                let history: any[] = [];
                try {
                  const existing = e.auditDetails
                    ? (JSON.parse(e.auditDetails) as any)
                    : null;
                  if (existing && Array.isArray(existing.history))
                    history = existing.history.slice();
                  else if (existing && existing.before && existing.after)
                    history = [
                      {
                        at: existing.at ?? e.createdAt,
                        before: existing.before,
                        after: existing.after,
                      },
                    ];
                } catch {
                  history = [];
                }
                // Crear registro simplificado con solo los campos que cambiaron
                const changedFields = getChangedFields(
                  {
                    providerCode: e.providerCode,
                    invoiceNumber: e.invoiceNumber,
                    paymentType: e.paymentType,
                    amountEgreso: e.amountEgreso,
                    amountIngreso: e.amountIngreso,
                    manager: e.manager,
                    notes: e.notes,
                    currency: e.currency,
                  },
                  {
                    providerCode: e.providerCode,
                    invoiceNumber: match.invoiceNumber,
                    paymentType: match.paymentType,
                    amountEgreso: match.amountEgreso,
                    amountIngreso: match.amountIngreso,
                    manager: AUTO_ADJUSTMENT_MANAGER,
                    notes: match.notes,
                    currency: match.currency,
                  },
                );
                const newRecord = {
                  at: new Date().toISOString(),
                  ...changedFields,
                };
                history.push(newRecord);
                // Comprimir historial para evitar QuotaExceededError
                const compressedHistory = compressAuditHistory(history);
                return {
                  ...e,
                  paymentType: match.paymentType,
                  amountEgreso: match.amountEgreso,
                  amountIngreso: match.amountIngreso,
                  breakdown: match.breakdown ?? e.breakdown,
                  notes: match.notes,
                  createdAt: match.createdAt,
                  manager: AUTO_ADJUSTMENT_MANAGER,
                  closingBalanceCRC: match.closingBalanceCRC,
                  closingBalanceUSD: match.closingBalanceUSD,
                  isAudit: true,
                  originalEntryId: e.originalEntryId ?? e.id,
                  auditDetails: JSON.stringify({ history: compressedHistory }),
                } as FondoEntry;
              }
              return e;
            });
            // If some newMovements have no existing entry, prepend them
            newMovements.forEach((nm) => {
              const exists = updated.some(
                (u) =>
                  u.originalEntryId === record.id &&
                  u.currency === nm.currency &&
                  isAutoAdjustmentProvider(u.providerCode),
              );
              if (!exists) {
                updated.unshift(nm);
              }
            });
            console.info(
              "[FG-DEBUG] Updated fondoEntries count after merge:",
              updated.length,
            );
            return updated;
          });
        } else {
          // Prepend so the most recent movement appears first (consistent with createdAt)
          console.info(
            "[FG-DEBUG] Prepending new adjustment movements",
            newMovements,
          );
          setFondoEntries((prev) => {
            const next = [...newMovements, ...prev];
            console.info(
              "[FG-DEBUG] fondoEntries count after prepend:",
              next.length,
            );
            return next;
          });

          // Persistencia: ya se hizo vía persistMovementToFirestore (incluye subcolección v2 + documento principal)
        }

        // Aplicar balances junto con la actualización de movimientos para evitar saltos visuales.
        if (latestLedgerSnapshot) {
          setLedgerSnapshot(latestLedgerSnapshot);
        }

        // Build a human-readable summary of the adjustments we just applied
        try {
          const addedParts: string[] = newMovements.map((m) => {
            const amt = (m.amountIngreso || 0) - (m.amountEgreso || 0);
            const sign = amt >= 0 ? "+" : "-";
            return `${m.currency} ${sign} ${formatByCurrency(
              m.currency as "CRC" | "USD",
              Math.abs(amt),
            )}`;
          });
          const note = `Ajustes aplicados: ${addedParts.join(" / ")}`;

          // Compute the net added contribution by currency and the previous contribution
          const totalNewCRC = newMovements.reduce(
            (s, m) =>
              s +
              (m.currency === "CRC"
                ? (m.amountIngreso || 0) - (m.amountEgreso || 0)
                : 0),
            0,
          );
          const totalNewUSD = newMovements.reduce(
            (s, m) =>
              s +
              (m.currency === "USD"
                ? (m.amountIngreso || 0) - (m.amountEgreso || 0)
                : 0),
            0,
          );

          // compute existing previous contribution linked to this closing (before we mutate fondoEntries)
          const prevCRCContributionExisting = fondoEntries.reduce(
            (s, e) =>
              s +
              (e.originalEntryId === record.id &&
              isAutoAdjustmentProvider(e.providerCode) &&
              e.currency === "CRC"
                ? (e.amountIngreso || 0) - (e.amountEgreso || 0)
                : 0),
            0,
          );
          const prevUSDContributionExisting = fondoEntries.reduce(
            (s, e) =>
              s +
              (e.originalEntryId === record.id &&
              isAutoAdjustmentProvider(e.providerCode) &&
              e.currency === "USD"
                ? (e.amountIngreso || 0) - (e.amountEgreso || 0)
                : 0),
            0,
          );

          // New recorded balance = currentBalance (which includes existing adjustments) - prevExisting + newAdded
          const postAdjustmentBalanceCRC = Math.trunc(
            currentBalanceCRC - prevCRCContributionExisting + totalNewCRC,
          );
          const postAdjustmentBalanceUSD = Math.trunc(
            currentBalanceUSD - prevUSDContributionExisting + totalNewUSD,
          );
          const hasCRCAdjustments =
            totalNewCRC !== 0 || prevCRCContributionExisting !== 0;
          const hasUSDAdjustments =
            totalNewUSD !== 0 || prevUSDContributionExisting !== 0;

          // Persist a readable note and store the balance after adjustments under adjustmentResolution
          setDailyClosings((prevClosings) => {
            const updated = prevClosings.map((d) => {
              if (d.id !== record.id) return d;
              const existingResolution = d.adjustmentResolution || {};
              const updatedResolution: DailyClosingRecord["adjustmentResolution"] =
                {
                  ...(existingResolution.removedAdjustments
                    ? {
                        removedAdjustments:
                          existingResolution.removedAdjustments,
                      }
                    : {}),
                  note,
                  ...(hasCRCAdjustments ? { postAdjustmentBalanceCRC } : {}),
                  ...(hasUSDAdjustments ? { postAdjustmentBalanceUSD } : {}),
                };
              return {
                ...d,
                adjustmentResolution: updatedResolution,
              } as DailyClosingRecord;
            });

            try {
              const updatedRecord = updated.find((d) => d.id === record.id);
              if (updatedRecord && normalizedCompany.length > 0) {
                // Fire-and-forget save for adjustment notes (non-critical)
                void DailyClosingsService.saveClosing(
                  normalizedCompany,
                  updatedRecord,
                )
                  .then(() => {
                    console.log(
                      `[CIERRE] ✅ Nota de ajuste guardada exitosamente. ID: ${updatedRecord.id}`,
                    );
                  })
                  .catch((saveErr) => {
                    console.error(
                      "[CIERRE] ❌ Error saving daily closing with adjustment note:",
                      saveErr,
                    );
                  });
              }
            } catch (saveErr) {
              console.error(
                "[CIERRE] ❌ Error persisting daily closing adjustment note:",
                saveErr,
              );
            }

            return updated;
          });
        } catch (noteErr) {
          console.error("Error building/persisting adjustment note:", noteErr);
        }
      }
    } catch (err) {
      console.error(
        "Error creating movement(s) for daily closing difference:",
        err,
      );
    }

    // Show toast: success when no diffs, warning when there are diffs
    try {
      const crcDiff = record.diffCRC ?? 0;
      const usdDiff = record.diffUSD ?? 0;
      if (crcDiff === 0 && usdDiff === 0) {
        try {
          showToast("Cierre completo — sin diferencias", "success", 4000);
        } catch {
          // swallow toast errors to avoid breaking flow
        }
      } else {
        try {
          const parts: string[] = [];
          if (crcDiff !== 0)
            parts.push(`CRC ${formatDailyClosingDiff("CRC", crcDiff)}`);
          if (usdDiff !== 0)
            parts.push(`USD ${formatDailyClosingDiff("USD", usdDiff)}`);
          const message = `Cierre con diferencias — ${parts.join(" / ")}`;
          showToast(message, "warning", 6000);
        } catch {
          // swallow toast errors
        }
      }
    } catch {
      // defensive: ignore
    }

    // Actualizar lockedUntil DESPUÉS de agregar todos los movimientos
    // para que persistEntries tenga el estado completo
    // Solo actualizar si no es edición de un cierre existente
    if (!editingDailyClosingId && storageSnapshotRef.current) {
      if (!storageSnapshotRef.current.state) {
        storageSnapshotRef.current.state =
          MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
            company,
          ).state;
      }
      // Bloquear hasta la fecha de creación del cierre
      storageSnapshotRef.current.state.lockedUntil = createdAt;

      // Persistir inmediatamente para asegurar que se guarde incluso sin movimientos
      const normalizedCompany = (company || "").trim();
      if (normalizedCompany.length > 0) {
        const companyKey =
          MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
        try {
          // Actualizar localStorage
          localStorage.setItem(
            companyKey,
            JSON.stringify(storageSnapshotRef.current),
          );

          // Actualizar Firestore
          void MovimientosFondosService.saveDocument(
            companyKey,
            storageSnapshotRef.current,
          )
            .then(() =>
              console.log(
                "[LOCK-DEBUG] Force saved to Firestore after closing",
              ),
            )
            .catch((err) => {
              console.error(
                "Error force saving lockedUntil to Firestore:",
                err,
              );
            });
        } catch (err) {
          console.error("Error force persisting lockedUntil:", err);
        }
      }
    }

    // Reset editing state after confirm
    setEditingDailyClosingId(null);
    setDailyClosingInitialValues(null);
  };

  const handleAdminCompanyChange = useCallback(
    (value: string) => {
      if (!canSelectCompany) return;
      const previousValue = adminCompany;
      setAdminCompany(value);
      try {
        localStorage.setItem(SHARED_COMPANY_STORAGE_KEY, value);
        // Disparar evento de storage manualmente para sincronizar dentro de la misma ventana
        window.dispatchEvent(
          new StorageEvent("storage", {
            key: SHARED_COMPANY_STORAGE_KEY,
            newValue: value,
            oldValue: previousValue,
            storageArea: localStorage,
          }),
        );
      } catch (error) {
        console.error("Error saving selected company to localStorage:", error);
      }
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
      // Solo resetear filtros si no está activo keepFiltersAcrossCompanies
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
    },
    [
      canSelectCompany,
      mode,
      resetFondoForm,
      adminCompany,
      keepFiltersAcrossCompanies,
    ],
  );

  // Escuchar cambios de empresa desde ProviderSection (sincronización bidireccional)
  useEffect(() => {
    if (!canSelectCompany) return;

    const handleStorageChange = (event: StorageEvent) => {
      if (
        event.key === SHARED_COMPANY_STORAGE_KEY &&
        event.newValue &&
        event.newValue !== adminCompany
      ) {
        setAdminCompany(event.newValue);
        // Reset state when company changes from external source
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
        // Solo resetear filtros si no está activo keepFiltersAcrossCompanies
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
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, [
    canSelectCompany,
    adminCompany,
    mode,
    resetFondoForm,
    keepFiltersAcrossCompanies,
  ]);

  const handleFondoKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSubmitFondo();
    }
  };

  const displayedEntries = useMemo(() => {
    const sorted = [...fondoEntries].sort(
      (a, b) => getPrimaryMovementTime(b) - getPrimaryMovementTime(a),
    );
    return sortAsc ? sorted.reverse() : sorted;
  }, [fondoEntries, sortAsc]);

  // days that have at least one movement (used to enable/disable dates in the calendar)
  const daysWithMovements = useMemo(() => {
    const s = new Set<string>();
    fondoEntries.forEach((entry) => {
      const d = new Date(getPrimaryMovementDateISO(entry));
      if (!Number.isNaN(d.getTime())) s.add(dateKeyFromDate(d));
    });
    return s;
  }, [fondoEntries]);

  // Apply all active filters to displayedEntries: date range, provider, type, manager, edited-only and free-text search
  const filteredEntries = useMemo(() => {
    let base = displayedEntries.slice();

    // date filtering (from/to)
    if (fromFilter || toFilter) {
      base = base.filter((entry) => {
        const key = dateKeyFromDate(new Date(getPrimaryMovementDateISO(entry)));
        if (fromFilter && toFilter) return key >= fromFilter && key <= toFilter;
        if (fromFilter && !toFilter) return key === fromFilter;
        if (!fromFilter && toFilter) return key === toFilter;
        return true;
      });
    }

    // restrict by tab mode (ingreso/egreso) when applicable
    if (mode === "ingreso") {
      base = base.filter((e) => isIngresoType(e.paymentType));
    } else if (mode === "egreso") {
      base = base.filter((e) => isEgresoType(e.paymentType));
    }

    // provider filter
    if (filterProviderCode && filterProviderCode !== "all") {
      base = base.filter((e) => e.providerCode === filterProviderCode);
    }

    // payment type filter
    if (filterPaymentType && filterPaymentType !== "all") {
      base = base.filter((e) => e.paymentType === filterPaymentType);
    }

    // manager filter - not enabled in UI currently

    // edited only
    if (filterEditedOnly) {
      base = base.filter((e) => !!e.isAudit);
    }

    // search across invoice, notes, provider name and manager
    const q = searchQuery.trim().toLowerCase();
    if (q.length > 0) {
      base = base.filter((e) => {
        const provName = providersMap.get(e.providerCode) ?? "";
        return (
          String(e.invoiceNumber).toLowerCase().includes(q) ||
          String(e.notes ?? "")
            .toLowerCase()
            .includes(q) ||
          provName.toLowerCase().includes(q) ||
          String(getPrimaryMovementManager(e) ?? "")
            .toLowerCase()
            .includes(q) ||
          String(e.paymentType ?? "")
            .toLowerCase()
            .includes(q)
        );
      });
    }

    return base;
  }, [
    displayedEntries,
    fromFilter,
    toFilter,
    filterProviderCode,
    filterPaymentType,
    filterEditedOnly,
    searchQuery,
    providersMap,
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
    // clamp pageIndex when entries or pageSize change
    setPageIndex((prev) => Math.min(prev, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  useEffect(() => {
    if (pageSize === "daily") {
      setPageIndex(0);
      setCurrentDailyKey(todayKey);
      return;
    }
    // whenever user changes pageSize, reset to first page
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

  // Group visible entries by day (local date). We'll render a date header row per group.
  const groupedByDay = useMemo(() => {
    const map = new Map<string, FondoEntry[]>();
    paginatedEntries.forEach((entry) => {
      const d = new Date(getPrimaryMovementDateISO(entry));
      // use local date key YYYY-MM-DD
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
    // Always show the formatted local date (no 'Hoy' / 'Ayer' labels)
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

  const closingsAreLoading =
    accountKey === "FondoGeneral" &&
    dailyClosingHistoryOpen &&
    (!dailyClosingsHydrated || dailyClosingsRefreshing);

  const isFondoMovementsLoading = useMemo(() => {
    return Boolean(company) && (!entriesHydrated || movementsLoading);
  }, [company, entriesHydrated, movementsLoading]);

  // Totals computed from the filtered entries (not only the current page)
  const isFilterActive = useMemo(() => {
    return Boolean(
      fromFilter ||
      toFilter ||
      (filterProviderCode && filterProviderCode !== "all") ||
      (filterPaymentType && filterPaymentType !== "all") ||
      filterEditedOnly ||
      (searchQuery || "").trim().length > 0,
    );
  }, [
    fromFilter,
    toFilter,
    filterProviderCode,
    filterPaymentType,
    filterEditedOnly,
    searchQuery,
  ]);

  const isSingleDayFilter = useMemo(() => {
    return Boolean(fromFilter && toFilter && fromFilter === toFilter);
  }, [fromFilter, toFilter]);

  // Keep superadmin totals collapsed by default per-day.
  useEffect(() => {
    if (!isSuperAdminUser) return;
    if (!isSingleDayFilter) {
      setSuperAdminTotalsOpen(false);
      return;
    }
    setSuperAdminTotalsOpen(false);
  }, [isSuperAdminUser, isSingleDayFilter, fromFilter]);

  const totalsByCurrency = useMemo(() => {
    const acc: Record<"CRC" | "USD", { ingreso: number; egreso: number }> = {
      CRC: { ingreso: 0, egreso: 0 },
      USD: { ingreso: 0, egreso: 0 },
    };
    for (const e of filteredEntries) {
      const cur = (e.currency as "CRC" | "USD") || "CRC";
      const ing = Math.trunc(e.amountIngreso || 0);
      const eg = Math.trunc(e.amountEgreso || 0);
      if (ing > 0) acc[cur].ingreso += ing;
      if (eg > 0) acc[cur].egreso += eg;
    }
    return acc;
  }, [filteredEntries]);

  const getCompanyKey = useCallback(
    (emp: Empresas) =>
      String(emp?.name || emp?.ubicacion || emp?.id || "").trim(),
    [],
  );

  const getCompanyLabel = useCallback(
    (emp: Empresas) => {
      const name = String(emp?.name || "").trim();
      const ubicacion = String(emp?.ubicacion || "").trim();
      const key = getCompanyKey(emp);

      if (!name && !ubicacion) return key || "Sin nombre";
      if (!ubicacion) return name || key || "Sin nombre";
      if (!name) return ubicacion || key || "Sin nombre";

      const nameLower = name.toLowerCase();
      const ubicLower = ubicacion.toLowerCase();

      if (nameLower === ubicLower) return name;

      let baseName = name;
      if (nameLower.includes(ubicLower)) {
        const escaped = ubicacion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        baseName = name
          .replace(new RegExp(escaped, "ig"), " ")
          .replace(/\s{2,}/g, " ")
          .trim();
      }

      return `${ubicacion} - ${baseName || name}`;
    },
    [getCompanyKey],
  );

  const companySelectId = `fg-company-select-${namespace}`;
  const showCompanySelector =
    canSelectCompany &&
    (ownerCompaniesLoading ||
      sortedOwnerCompanies.length > 0 ||
      !!ownerCompaniesError);
  const currentCompanyLabel = useMemo(() => {
    const selected = String(company || "").trim();
    if (!selected) return "Sin empresa seleccionada";

    const match = sortedOwnerCompanies.find(
      (emp) => getCompanyKey(emp) === selected,
    );
    return match ? getCompanyLabel(match).split(" - ")[0] : selected;
  }, [company, sortedOwnerCompanies, getCompanyKey, getCompanyLabel]);
  const companySelectorContent = useMemo(() => {
    if (!showCompanySelector) return null;

    return (
      <div className="flex w-full min-w-0 flex-col gap-3 text-sm text-[var(--foreground)] xl:flex-row xl:items-end xl:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)] ">
            Empresa actual
          </p>
          <p
            className="truncate text-sm font-semibold text-[var(--foreground)]"
            title={currentCompanyLabel}
          >
            {currentCompanyLabel}
          </p>
          {ownerCompaniesError && (
            <p className="text-xs text-red-500 mt-1">{ownerCompaniesError}</p>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <select
            id={companySelectId}
            value={company}
            onChange={(e) => handleAdminCompanyChange(e.target.value)}
            disabled={
              ownerCompaniesLoading || sortedOwnerCompanies.length === 0
            }
            className="w-full min-w-0 max-w-full truncate rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] outline-none transition-colors hover:border-[var(--accent)]/60 focus:border-[var(--accent)]"
          >
            {ownerCompaniesLoading && (
              <option value="">Cargando empresas...</option>
            )}
            {!ownerCompaniesLoading && sortedOwnerCompanies.length === 0 && (
              <option value="">Sin empresas disponibles</option>
            )}
            {!ownerCompaniesLoading && sortedOwnerCompanies.length > 0 && (
              <>
                <option value="" disabled hidden>
                  Selecciona una empresa
                </option>
                {sortedOwnerCompanies.map((emp, index) => (
                  <option
                    key={
                      emp.id || emp.name || emp.ubicacion || `company-${index}`
                    }
                    value={getCompanyKey(emp)}
                  >
                    {getCompanyLabel(emp)}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
      </div>
    );
  }, [
    showCompanySelector,
    currentCompanyLabel,
    ownerCompaniesError,
    companySelectId,
    company,
    ownerCompaniesLoading,
    sortedOwnerCompanies,
    handleAdminCompanyChange,
    getCompanyKey,
    getCompanyLabel,
  ]);

  useEffect(() => {
    if (!onCompanySelectorChange) return;
    if (companySelectorPlacement === "external") {
      onCompanySelectorChange(companySelectorContent);
      return () => onCompanySelectorChange(null);
    }
    onCompanySelectorChange(null);
  }, [
    companySelectorPlacement,
    companySelectorContent,
    onCompanySelectorChange,
  ]);

  if (authLoading) {
    return (
      <div id={id} className="mt-6">
        <div className="p-6 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center">
          <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
        </div>
      </div>
    );
  }

  if (!canAccessSection) {
    return (
      <div id={id} className="mt-6">
        <AccessRestrictedMessage
          description={`No tienes permisos para acceder a ${namespaceDescription}.`}
        />
      </div>
    );
  }

  if (!fondoTypesLoaded) {
    return (
      <div id={id} className="mt-6">
        <div className="p-8 bg-[var(--card-bg)] border border-[var(--input-border)] rounded text-center space-y-3">
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
          </div>
          <p className="text-[var(--muted-foreground)]">
            Cargando tipos de movimientos...
          </p>
          <p className="text-xs text-[var(--muted-foreground)]">
            Esto solo ocurre la primera vez
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      id={id}
      className="mt-3 sm:mt-4 lg:mt-6
      mx-auto
      flex h-full min-h-0 w-full flex-1 flex-col
      space-y-3 sm:space-y-4 lg:space-y-6
      px-0"
    >
      {companySelectorPlacement === "content" && companySelectorContent && (
        <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-3 sm:p-4">
          {companySelectorContent}
        </div>
      )}

      <section className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-2 sm:p-3 md:p-4 space-y-3 sm:space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
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
                  let hasAnyMatch = false;
                  return groups.map(({ group, types }) => {
                    const filtered = hasFilter
                      ? types.filter(
                          (t) =>
                            formatMovementType(t)
                              .toLowerCase()
                              .includes(search) ||
                            t.toLowerCase().includes(search),
                        )
                      : types;
                    if (filtered.length === 0) return null;
                    hasAnyMatch = true;
                    return (
                      <React.Fragment key={group}>
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
                      </React.Fragment>
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

          <div className="flex min-h-11 w-full items-center justify-center rounded-xl border border-cyan-700/35 bg-cyan-950/20 px-3 py-2 text-sm text-[var(--foreground)]">
            <div className="flex w-full flex-col items-center justify-center gap-2 sm:flex-row sm:justify-center">
              {/* Dropdown Vista */}
              <div
                className="relative w-full sm:w-auto"
                ref={filtersDropdownRef}
              >
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
                          onChange={(e) =>
                            setFilterEditedOnly(e.target.checked)
                          }
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

        <div className="grid grid-cols-1 gap-3 border-t border-[var(--input-border)] pt-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
          <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-[minmax(150px,180px)_minmax(150px,180px)_minmax(150px,170px)_44px] xl:items-end">
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
                      {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
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
            {accountKey === "FondoGeneral" && (
              <div className="relative group flex items-end">
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

          <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:w-auto xl:min-w-[348px]">
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
                    ⚠️ Debe agregar un movimiento de &quot;CIERRE FONDO
                    VENTAS&quot; primero
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
                    Debe realizar el &quot;Registrar cierre&quot; para seguir
                    agregando movimientos
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-yellow-500"></div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </section>

      {!authLoading && !company && (
        <p className="text-sm text-[var(--muted-foreground)] mb-4">
          {canSelectCompany
            ? "Selecciona una empresa para continuar."
            : "Tu usuario no tiene una empresa asociada; registra una empresa para continuar."}
        </p>
      )}

      {providersError && (
        <div className="mb-4 text-sm text-red-500">{providersError}</div>
      )}

      <Drawer
        anchor="right"
        open={movementModalOpen}
        onClose={closeMovementModal}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 520 },
            maxWidth: "100vw",
            bgcolor: "#0d1117",
            color: "#ffffff",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              px: 3,
              py: 2,
              position: "relative",
            }}
          >
            <Typography
              variant="h6"
              component="h3"
              sx={{ fontWeight: 600, textAlign: "center", width: "100%" }}
            >
              {editingEntry
                ? `Editar movimiento #${editingEntry.invoiceNumber}`
                : "Registrar movimiento"}
            </Typography>
            <Box
              sx={{
                position: "absolute",
                right: 12,
                display: "flex",
                alignItems: "center",
                gap: 1,
              }}
            >
              <IconButton
                aria-label={
                  movementAutoCloseLocked
                    ? "Desbloquear cierre automatico"
                    : "Bloquear cierre automatico"
                }
                onClick={() => setMovementAutoCloseLocked((prev) => !prev)}
                sx={{ color: "var(--foreground)" }}
              >
                {movementAutoCloseLocked ? (
                  <Lock className="w-4 h-4" />
                ) : (
                  <LockOpen className="w-4 h-4" />
                )}
              </IconButton>
              <IconButton
                aria-label="Cerrar registro de movimiento"
                onClick={closeMovementModal}
                sx={{ color: "var(--foreground)" }}
              >
                <X className="w-4 h-4" />
              </IconButton>
            </Box>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />
          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 2 }}>
            {editingEntry && (
              <Typography
                variant="caption"
                component="p"
                sx={{ color: "var(--muted-foreground)", mb: 2 }}
              >
                Editando movimiento #{editingEntry.invoiceNumber}. Actualiza los
                datos y presiona &quot;Actualizar&quot; o cancela para volver al
                modo de registro.
              </Typography>
            )}
            {/* Incluir borrador de NC manual en la lista de NC pendientes */}
            {(() => {
              const movementPendingCreditNotes =
                invoiceDocType === "FCO"
                  ? manualCreditNoteDraft
                    ? [
                        {
                          id: "manual-nc-draft",
                          invoiceNumber: manualCreditNoteDraft.invoiceNumber,
                          amount: manualCreditNoteDraft.amount,
                          balanceDue: manualCreditNoteDraft.amount,
                          currency: movementCurrency as "CRC" | "USD",
                        },
                        ...selectedProviderPendingCreditNotes,
                      ]
                    : selectedProviderPendingCreditNotes
                  : [];

              const selectedProviderType = selectedProvider ? (providerTypesMap.get(selectedProvider) ?? "") : "";
              const isCompraInventarioProvider = selectedProviderType.trim().toUpperCase() === "COMPRA INVENTARIO";

              return (
                <AgregarMovimiento
                  selectedProvider={selectedProvider}
                  onProviderChange={handleProviderChange}
                  providers={movementProviders}
                  providersLoading={movementProvidersLoading}
                  isProviderSelectDisabled={
                    isProviderSelectDisabled || isEditingCierreFondoVentas
                  }
                  providerDisabledTooltip={
                    isEditingCierreFondoVentas
                      ? 'No se puede cambiar el proveedor de un movimiento "CIERRE FONDO VENTAS"'
                      : undefined
                  }
                  selectedProviderExists={selectedProviderExists}
                  invoiceNumber={invoiceNumber}
                  onInvoiceNumberChange={handleInvoiceNumberChange}
                  invoiceDocType={invoiceDocType}
                  onInvoiceDocTypeChange={setInvoiceDocType}
                  allowCreditInvoiceOption={Boolean(
                    editingEntryId && invoiceDocType === "FCR",
                  )}
                  lockInvoiceDocTypeToContado={isInvoiceDocTypeLockedToContado}
                  invoiceValid={invoiceValid}
                  invoiceDisabled={invoiceDisabled}
                  paymentType={paymentType}
                  isEgreso={isEgreso}
                  egreso={egreso}
                  onEgresoChange={handleEgresoChange}
                  egresoBorderClass={egresoBorderClass}
                  ingreso={ingreso}
                  onIngresoChange={handleIngresoChange}
                  ingresoBorderClass={ingresoBorderClass}
                  notes={notes}
                  onNotesChange={handleNotesChange}
                  manager={manager}
                  onManagerChange={handleManagerChange}
                  manager2={manager2}
                  onManager2Change={handleManager2Change}
                  accountKey={accountKey}
                  showManager2={isEditingPaidFcrMovement}
                  managerSelectDisabled={
                    managerSelectDisabled || isEditingPaidFcrMovement
                  }
                  manager2SelectDisabled={
                    !company ||
                    managerOptionsLoading ||
                    employeeOptions.length === 0
                  }
                  employeeOptions={employeeOptions}
                  employeesLoading={managerOptionsLoading}
                  editingEntryId={editingEntryId}
                  onCancelEditing={cancelEditing}
                  onSubmit={handleSubmitFondo}
                  isSubmitDisabled={isSubmitDisabled}
                  isSaving={isSaving}
                  onFieldKeyDown={handleFondoKeyDown}
                  currency={movementCurrency}
                  onCurrencyChange={(c) => setMovementCurrency(c)}
                  currencyEnabled={currencyEnabled}
                  providerError={providerError}
                  invoiceError={invoiceError}
                  amountError={amountError}
                  managerError={managerError}
                  manager2Error={manager2Error}
                  pendingCreditNotesCount={selectedProviderPendingNcCount}
                  pendingCreditInvoicesCount={
                    selectedProviderPendingPaymentAlert?.count ?? 0
                  }
                  pendingCreditInvoicesBalanceLabel={
                    selectedProviderPendingPaymentAlert
                      ? [
                          selectedProviderPendingPaymentAlert.crc > 0
                            ? formatByCurrency(
                                "CRC",
                                selectedProviderPendingPaymentAlert.crc,
                              )
                            : "",
                          selectedProviderPendingPaymentAlert.usd > 0
                            ? formatByCurrency(
                                "USD",
                                selectedProviderPendingPaymentAlert.usd,
                              )
                            : "",
                        ]
                          .filter(Boolean)
                          .join(" / ")
                      : ""
                  }
                  pendingCreditInvoices={selectedProviderPendingCreditInvoices}
                  onSelectPendingCreditInvoice={handleMovementCreditInvoiceSelect}
                  pendingCreditNotes={movementPendingCreditNotes}
                  selectedCreditNoteIds={selectedAppliedCreditNoteIds}
                  onToggleCreditNote={(id) => {
                    setSelectedAppliedCreditNoteIds((prev) =>
                      prev.includes(id)
                        ? prev.filter((item) => item !== id)
                        : [...prev, id],
                    );
                  }}
                  creditNotesAppliedTotal={creditNotesAppliedTotal}
                  amountPayment={computedAmountPayment}
                  onAddManualCreditNote={openManualCreditNoteModal}
                  balanceCRC={currentBalanceCRC}
                  balanceUSD={currentBalanceUSD}
                  isCompraInventarioProvider={isCompraInventarioProvider}
                />
              );
            })()}
          </Box>
        </Box>
      </Drawer>

      <Drawer
        anchor="right"
        open={manualCreditNoteOpen}
        onClose={closeManualCreditNoteModal}
        PaperProps={{
          sx: {
            width: { xs: "100vw", sm: 460 },
            maxWidth: "100vw",
            bgcolor: "#0d1117",
            color: "#ffffff",
          },
        }}
      >
        <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              px: 3,
              py: 2,
            }}
          >
            <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
              Agregar nota de Crédito
            </Typography>
            <IconButton
              aria-label="Cerrar"
              onClick={closeManualCreditNoteModal}
              sx={{ color: "var(--foreground)" }}
              disabled={manualCreditNoteSaving}
            >
              <X className="w-4 h-4" />
            </IconButton>
          </Box>
          <Divider sx={{ borderColor: "var(--input-border)" }} />

          <Box sx={{ flex: 1, overflowY: "auto", px: 3, py: 3 }}>
            {manualCreditNoteError && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {manualCreditNoteError}
              </div>
            )}

            {manualCreditNoteTarget && (
              <div className="mb-4 rounded-lg border border-sky-500/20 bg-sky-500/10 p-3 text-sm text-[var(--foreground)]">
                <div className="grid gap-2 text-xs sm:grid-cols-2">
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Proveedor:
                    </span>{" "}
                    <span className="font-medium">
                      {providersMap.get(manualCreditNoteTarget.providerCode) ||
                        manualCreditNoteTarget.providerCode}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Encargado:
                    </span>{" "}
                    <span className="font-medium">
                      {manualCreditNoteTarget.manager || "-"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Factura origen:
                    </span>{" "}
                    <span className="font-medium">
                      #{manualCreditNoteTarget.invoiceNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[var(--muted-foreground)]">
                      Moneda:
                    </span>{" "}
                    <span className="font-medium">
                      {manualCreditNoteTarget.currency || "CRC"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[var(--muted-foreground)]">
                      Saldo disponible:
                    </span>{" "}
                    <span className="font-semibold text-sky-100">
                      {formatByCurrency(
                        (manualCreditNoteTarget.currency as "CRC" | "USD") ||
                          "CRC",
                        Math.max(
                          0,
                          Math.trunc(
                            Number(
                              manualCreditNoteTarget.amountEgreso ||
                                manualCreditNoteTarget.amountIngreso ||
                                0,
                            ) || 0,
                          ),
                        ),
                      )}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveManualCreditNote();
              }}
            >
              <input
                value={manualCreditNoteInvoiceNumber}
                onChange={(event) =>
                  setManualCreditNoteInvoiceNumber(
                    event.target.value.replace(/\D/g, "").slice(0, 4),
                  )
                }
                placeholder="Numero de factura de la NC"
                disabled={manualCreditNoteSaving}
                maxLength={4}
                inputMode="numeric"
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              />

              <input
                type="text"
                inputMode="numeric"
                value={manualCreditNoteAmount}
                onChange={(event) =>
                  setManualCreditNoteAmount(
                    event.target.value.replace(/\D/g, ""),
                  )
                }
                placeholder="Monto"
                disabled={manualCreditNoteSaving}
                className="w-full h-11 rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              />

              <textarea
                value={manualCreditNoteObservation}
                onChange={(event) =>
                  setManualCreditNoteObservation(event.target.value)
                }
                placeholder="Observacion"
                disabled={manualCreditNoteSaving}
                rows={4}
                className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)] px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:border-[var(--accent)]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40"
              />

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeManualCreditNoteModal}
                  disabled={manualCreditNoteSaving}
                  className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 px-3 py-2 text-sm text-[var(--foreground)] transition-colors hover:bg-[var(--muted)]/25 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={manualCreditNoteSaving}
                  className="rounded bg-sky-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-sky-400 disabled:opacity-50"
                >
                  {manualCreditNoteSaving ? "Guardando..." : "Guardar NC"}
                </button>
              </div>
            </form>
          </Box>
        </Box>
      </Drawer>

      {!isCajaNegra &&
        !movementProvidersLoading &&
        movementProviders.length === 0 &&
        company && (
          <p className="text-sm text-[var(--muted-foreground)] mt-3">
            Registra un proveedor para poder asociarlo a los movimientos del
            fondo.
          </p>
        )}

      {!isSuperAdminUser &&
        !managerOptionsLoading &&
        employeeOptions.length === 0 &&
        company && (
          <p className="text-sm text-[var(--muted-foreground)] mt-2">
            La empresa no tiene empleados registrados; agrega empleados para
            seleccionar un encargado.
          </p>
        )}

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
                        {fromFilter ? formatGroupLabel(fromFilter) : "—"}
                        {toFilter ? ` → ${formatGroupLabel(toFilter)}` : ""}
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
                              N° factura
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
                    {showPendingClosingCreditInvoices &&
                      pendingClosingCreditInvoices.length > 0 && (
                        <tbody>
                          <tr className="bg-amber-500/10 [&>td]:border-b [&>td]:border-cyan-900/35">
                            <td
                              colSpan={7}
                              className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100"
                            >
                              Facturas crédito pendientes
                            </td>
                          </tr>
                          {pendingClosingCreditInvoices.map((invoice) => {
                            const providerName =
                              providersMap.get(invoice.providerCode) ??
                              invoice.providerCode;
                            const totalAmount = Math.max(
                              0,
                              Math.trunc(
                                Number(
                                  invoice.originalAmount ?? invoice.amount,
                                ) || 0,
                              ),
                            );
                            const paidAmount = Math.max(
                              0,
                              Math.trunc(Number(invoice.paidAmount) || 0),
                            );
                            const balanceAmount = Math.max(
                              0,
                              Math.trunc(
                                Number(
                                  invoice.balanceDue ??
                                    totalAmount - paidAmount,
                                ) || 0,
                              ),
                            );
                            const recordedAt = new Date(invoice.createdAt);
                            const formattedInvoiceDate = Number.isNaN(
                              recordedAt.getTime(),
                            )
                              ? "Sin fecha"
                              : dateTimeFormatter.format(recordedAt);

                            return (
                              <tr
                                key={invoice.id}
                                className="transition-colors hover:bg-amber-500/10 [&>td]:border-b [&>td]:border-cyan-900/35 bg-amber-500/5"
                              >
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  {formattedInvoiceDate}
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <div className="font-semibold text-[var(--foreground)]">
                                    {providerName}
                                  </div>
                                  <div className="text-xs text-amber-100/80">
                                    {invoice.providerCode}
                                  </div>
                                  {invoice.notes && (
                                    <div className="mt-1 flex w-full items-start gap-2 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1.5">
                                      <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                                      <span className="text-xs text-[var(--muted-foreground)] break-words">{invoice.notes}</span>
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <div className="flex flex-col gap-1">
                                    <span className="inline-flex max-w-full items-center rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                                      FCR
                                    </span>
                                    <span className="text-xs text-amber-100/80">
                                      {String(
                                        invoice.paymentStatus || "PENDIENTE",
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <span className="font-medium text-[var(--foreground)]">
                                    #{invoice.invoiceNumber}
                                  </span>
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <div className="flex flex-col gap-1 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <span className="rounded px-2 py-1 text-xs font-semibold bg-amber-500/10 text-yellow-300">
                                        {formatByCurrency(
                                          invoice.currency,
                                          totalAmount,
                                        )}
                                      </span>
                                    </div>
                                    {balanceAmount > 0 ? (
                                      <span className="inline-flex items-center justify-end gap-1 rounded border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-100">
                                        <Banknote className="h-3.5 w-3.5" />
                                        Saldo:{" "}
                                        {formatByCurrency(
                                          invoice.currency,
                                          balanceAmount,
                                        )}
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center justify-end gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">
                                        <CheckCircle className="h-3.5 w-3.5" />
                                        Saldado
                                      </span>
                                    )}
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                      Pagado:{" "}
                                      {formatByCurrency(
                                        invoice.currency,
                                        paidAmount,
                                      )}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                  <div className="text-[var(--foreground)]">
                                    {invoice.manager || "-"}
                                  </div>
                                  {invoice.manager2 && (
                                    <div className="mt-1 text-xs text-[var(--muted-foreground)]">
                                      Extra: {invoice.manager2}
                                    </div>
                                  )}
                                </td>
                                <td className="px-3 py-2 align-top">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      openClosingInvoicePaymentModal(invoice);
                                    }}
                                    title="Gestionar esta factura desde Facturas de crédito y notas de crédito"
                                    className="inline-flex items-center gap-1.5 rounded border border-amber-400/35 bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-100 transition-all duration-150 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-amber-500/20"
                                  >
                                    <FileText className="w-4 h-4" />
                                    Gestionar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      )}
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
                            const normalizedIngreso = Math.trunc(
                              fe.amountIngreso || 0,
                            );
                            const normalizedEgreso = Math.trunc(
                              resolveEffectiveEgresoAmount(fe),
                            );
                            const invoiceEgresoAmount = Math.trunc(
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
                                      Math.trunc(
                                        Number(note.appliedAmount) || 0,
                                      ),
                                    ),
                                  0,
                                )
                              : 0;
                            const appliedCreditNotesAdjustment = Math.max(
                              0,
                              invoiceEgresoAmount -
                                appliedCreditNotesTotal -
                                normalizedEgreso,
                            );
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
                                  Math.trunc(currentBalanceUSD))
                                : (balanceAfterByIdCRC.get(fe.id) ??
                                  Math.trunc(currentBalanceCRC));
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
                                  Math.trunc(Number(owedFcrAmountRaw) || 0),
                                )
                              : null;

                            const originalFcrAmount = Number.isFinite(
                              Number(fe.originalAmount),
                            )
                              ? Math.max(
                                  0,
                                  Math.trunc(Number(fe.originalAmount) || 0),
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
                            const displayPaymentType =
                              (isAutoAdjustment || isGeneralClosingRow) &&
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
                                    : "—";
                                  const before = h?.before ?? {};
                                  const after = h?.after ?? {};
                                  const parts: string[] = [];

                                  // Con el nuevo formato simplificado, mostramos todos los campos presentes
                                  if (
                                    "providerCode" in before ||
                                    "providerCode" in after
                                  ) {
                                    parts.push(
                                      `Proveedor: ${before.providerCode ?? "—"} → ${
                                        after.providerCode ?? "—"
                                      }`,
                                    );
                                  }
                                  if (
                                    "invoiceNumber" in before ||
                                    "invoiceNumber" in after
                                  ) {
                                    parts.push(
                                      `Factura: ${before.invoiceNumber ?? "—"} → ${
                                        after.invoiceNumber ?? "—"
                                      }`,
                                    );
                                  }
                                  if (
                                    "paymentType" in before ||
                                    "paymentType" in after
                                  ) {
                                    parts.push(
                                      `Tipo: ${before.paymentType ?? "—"} → ${
                                        after.paymentType ?? "—"
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
                                        `Moneda: ${beforeCur} → ${afterCur}`,
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
                                      )} → ${formatByCurrency(afterCur, afterAmt)}`,
                                    );
                                  }

                                  if (
                                    "manager" in before ||
                                    "manager" in after
                                  ) {
                                    parts.push(
                                      `Encargado: ${before.manager ?? "—"} → ${
                                        after.manager ?? "—"
                                      }`,
                                    );
                                  }
                                  if ("notes" in before || "notes" in after) {
                                    parts.push(
                                      `Notas: "${before.notes ?? ""}" → "${
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
                                    {fe.notes && (
                                      <div className="mt-1 flex w-full items-start gap-2 rounded border border-[var(--input-border)] bg-[var(--muted)]/20 px-2 py-1.5">
                                        <MessageSquare className="h-3 w-3 shrink-0 mt-0.5 text-[var(--muted-foreground)]" />
                                        <div className="text-xs text-[var(--muted-foreground)] break-words min-w-0 [&>div]:w-full">
                                          {(() => {
                                            if (
                                              fe.notes.includes("[ALERT_ICON]")
                                            ) {
                                              const parts = fe.notes.split("\n");
                                              const headerText =
                                                parts.find(
                                                  (p) =>
                                                    !p.includes("[ALERT_ICON]"),
                                                ) || "";
                                              const alertLine =
                                                parts.find((p) =>
                                                  p.includes("[ALERT_ICON]"),
                                                ) || "";
                                              const noteText = alertLine.replace(
                                                "[ALERT_ICON]",
                                                "",
                                              );
                                              return (
                                                <div className="flex flex-col gap-1">
                                                  {headerText && (
                                                    <div className="text-[10px] font-semibold text-[var(--foreground)] uppercase tracking-wide">
                                                      {headerText}
                                                    </div>
                                                  )}
                                                  <div className="flex items-center gap-1.5">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 flex-shrink-0" />
                                                    {(() => {
                                                      const isPositive = /:\s*\+/.test(noteText);
                                                      const isNegative = /:\s*\-/.test(noteText);
                                                      if (isPositive || isNegative) {
                                                        const bgClass = isPositive
                                                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                                          : "border-red-500/30 bg-red-500/10 text-red-300";
                                                        return (
                                                          <span className={`rounded border ${bgClass} px-1.5 py-0.5 text-[11px] font-semibold`}>
                                                            {noteText}
                                                          </span>
                                                        );
                                                      }
                                                      return <span>{noteText}</span>;
                                                    })()}
                                                  </div>
                                                </div>
                                              );
                                            }
                                            if (
                                              fe.notes.startsWith("[CHECK_ICON]")
                                            ) {
                                              const noteText = fe.notes.replace(
                                                "[CHECK_ICON]",
                                                "",
                                              );
                                              return (
                                                <div className="flex items-center gap-1.5">
                                                  <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                                  <span>{noteText}</span>
                                                </div>
                                              );
                                            }
                                            return <span>{fe.notes}</span>;
                                          })()}
                                        </div>
                                      </div>
                                    )}
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
                                    {isAutoAdjustment ? (
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
                                                —
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
                                        —
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
                                                  0 && (
                                                  <div className="flex w-full items-center gap-0 rounded border border-orange-500/15 bg-orange-500/10 px-2 py-1">
                                                    <span className="flex items-center justify-center gap-1 text-xs text-orange-200">
                                                      <RotateCcw className="h-3 w-3 shrink-0" />
                                                      Ajuste
                                                    </span>
                                                    <span className="flex w-full items-center justify-end gap-1 pl-4 text-center text-sm font-semibold text-orange-200 whitespace-nowrap">
                                                      -
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
                                  <td className="px-3 py-2 align-top">
                                    {(!isLockedMovement || isPaidFcrEntry) && (
                                      <div className="flex items-center gap-2">
                                        {(() => {
                                          const isCierreVentasRow =
                                            isCierreFondoVentasMovement(fe);
                                          const isLatestCierreVentas =
                                            isCierreVentasRow &&
                                            Boolean(
                                              latestCierreFondoVentasMovementId,
                                            ) &&
                                            fe.id ===
                                              latestCierreFondoVentasMovementId;
                                          const canDelete =
                                            !isLockedMovement &&
                                            !isAutoAdjustment &&
                                            (isPrincipalAdmin ||
                                              (isSuperAdminUser &&
                                                isCierreVentasRow)) &&
                                            (!isCierreVentasRow ||
                                              isLatestCierreVentas);
                                          const canEdit =
                                            !isLockedMovement &&
                                            !isAutoAdjustment &&
                                            (!isSuperAdminUser ||
                                              !isCierreVentasRow);

                                          return (
                                            <>
                                              {canEdit && (
                                                <>
                                                  <button
                                                    type="button"
                                                    className="inline-flex items-center gap-1.5 rounded border border-[var(--input-border)] bg-[var(--input-bg)] px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-[var(--muted)] disabled:translate-y-0 disabled:opacity-50"
                                                    onClick={() =>
                                                      handleEditMovement(fe)
                                                    }
                                                    disabled={
                                                      editingEntryId === fe.id
                                                    }
                                                    title={
                                                      isAutoAdjustment
                                                        ? "Los ajustes automáticos no se pueden editar"
                                                        : "Editar movimiento"
                                                    }
                                                  >
                                                    <Pencil className="w-4 h-4" />
                                                    {editingEntryId === fe.id
                                                      ? "Editando"
                                                      : "Editar"}
                                                  </button>
                                                </>
                                              )}

                                              {canDelete && (
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center gap-1.5 rounded border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-medium text-red-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-red-400 hover:bg-red-500/20"
                                                  onClick={() =>
                                                    handleDeleteMovement(fe)
                                                  }
                                                  title={
                                                    isCierreVentasRow &&
                                                    isSuperAdminUser
                                                      ? 'Eliminar "CIERRE FONDO VENTAS" (superadmin)'
                                                      : isCierreVentasRow
                                                        ? "Eliminar último cierre de Fondo Ventas"
                                                        : "Eliminar movimiento"
                                                  }
                                                >
                                                  <Trash2 className="w-4 h-4" />
                                                  Eliminar
                                                </button>
                                              )}
                                              {isPaidFcrEntry && (
                                                <button
                                                  type="button"
                                                  className="inline-flex items-center justify-center rounded border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-400 transition-all duration-150 hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-500/20"
                                                  onClick={() => {
                                                    setExpandedFcrInfoRows(
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
                                                  title="Ver información de pago FCR"
                                                  aria-label="Ver información de pago FCR"
                                                  aria-expanded={
                                                    isFcrInfoExpanded
                                                  }
                                                >
                                                  <Info className="w-4 h-4" />
                                                </button>
                                              )}
                                              {hasAppliedCreditNotes &&
                                                !isPaidFcrEntry && (
                                                <button
                                                  type="button"
                                                  className={`inline-flex items-center justify-center rounded border border-sky-500/40 p-1.5 text-sky-300 transition-all duration-150 hover:-translate-y-0.5 hover:border-sky-400 hover:bg-sky-500/20 ${
                                                    isAppliedCreditNotesExpanded
                                                      ? "bg-sky-500/20"
                                                      : "bg-sky-500/10"
                                                  }`}
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
                                                  title="Ver notas de crédito aplicadas"
                                                  aria-label="Ver notas de crédito aplicadas"
                                                  aria-expanded={
                                                    isAppliedCreditNotesExpanded
                                                  }
                                                >
                                                  <Info className="w-3.5 h-3.5" />
                                                </button>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    )}
                                  </td>
                                </tr>

                                {hasAppliedCreditNotes &&
                                  isAppliedCreditNotesExpanded &&
                                  !isPaidFcrEntry && (
                                    <tr className="bg-sky-500/5 [&>td]:border-b [&>td]:border-cyan-900/35">
                                      <td colSpan={7} className="px-3 py-2">
                                        <div className="rounded-lg border border-sky-500/25 border-l-2 border-l-sky-400/60 bg-sky-500/10 p-3 text-xs text-[var(--foreground)]">
                                          <div className="mb-2 flex items-center gap-2 border-b border-sky-500/20 pb-2">
                                            <Info className="w-4 h-4 text-sky-300" />
                                            <span className="font-medium">
                                              Notas de crédito aplicadas
                                            </span>
                                          </div>
                                          <div className="divide-y divide-sky-500/15">
                                            {fe.appliedCreditNotes?.map(
                                              (note) => {
                                                const noteAmount = Math.max(
                                                  0,
                                                  Math.trunc(
                                                    Number(note.amount) || 0,
                                                  ),
                                                );
                                                const appliedAmount = Math.max(
                                                  0,
                                                  Math.trunc(
                                                    Number(
                                                      note.appliedAmount,
                                                    ) || 0,
                                                  ),
                                                );
                                                const noteLabel =
                                                  note.invoiceNumber
                                                    ? `NC #${note.invoiceNumber}`
                                                    : `NC ${note.id}`;

                                                return (
                                                  <div
                                                    key={note.id}
                                                    className="py-2"
                                                  >
                                                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                      <div>
                                                        <div className="font-semibold text-[var(--foreground)]">
                                                          {noteLabel}
                                                        </div>
                                                        <div className="text-xs text-[var(--muted-foreground)]">
                                                          Moneda:{" "}
                                                          {note.currency}
                                                        </div>
                                                      </div>
                                                      <div className="text-right">
                                                        <div className="text-[var(--muted-foreground)]">
                                                          Monto NC:{" "}
                                                          <span className="font-medium text-[var(--foreground)]">
                                                            {formatByCurrency(
                                                              note.currency,
                                                              noteAmount,
                                                            )}
                                                          </span>
                                                        </div>
                                                        <div className="flex items-center justify-end gap-1.5">
                                                          <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                          <span className="text-[var(--muted-foreground)]">
                                                            Aplicado:
                                                          </span>
                                                          <span className="font-medium text-emerald-400">
                                                            {formatByCurrency(
                                                              note.currency,
                                                              appliedAmount,
                                                            )}
                                                          </span>
                                                        </div>
                                                        {note.observation && (
                                                          <div className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                                                            Obs:{" "}
                                                            {note.observation}
                                                          </div>
                                                        )}
                                                      </div>
                                                    </div>
                                                  </div>
                                                );
                                              },
                                            )}
                                          </div>
                                          <div className="mt-2 rounded-md border border-sky-500/20 bg-sky-500/10 px-2 py-2 text-right">
                                            <span className="font-semibold text-[var(--foreground)]">
                                              Total aplicado:{" "}
                                            </span>
                                            <span className="text-base font-semibold text-emerald-400">
                                              {formatByCurrency(
                                                entryCurrency,
                                                appliedCreditNotesTotal,
                                              )}
                                            </span>
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  )}

                                {isPaidFcrEntry && isFcrInfoExpanded && (
                                  <tr className="bg-emerald-500/5 [&>td]:border-b [&>td]:border-cyan-900/35">
                                    <td colSpan={7} className="px-3 py-2">
                                      <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-[var(--foreground)]">
                                        <div className="mb-2 flex items-center gap-2 text-emerald-300">
                                          <Info className="w-4 h-4" />
                                          <span className="font-semibold">
                                            Detalle de Factura Credito pagada
                                          </span>
                                        </div>
                                        <div className="grid gap-1.5 sm:grid-cols-2">
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Encargado de pago:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {primaryManager || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Fecha de pago:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {formattedDate}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Registró factura:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {fe.manager || "-"}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Fecha registro factura:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {formattedOriginalRegisteredAt}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Monto factura original:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {originalFcrAmount === null
                                                ? "-"
                                                : formatByCurrency(
                                                    entryCurrency,
                                                    originalFcrAmount,
                                                  )}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-[var(--muted-foreground)]">
                                              Monto adeudado:
                                            </span>{" "}
                                            <span className="font-medium">
                                              {owedFcrAmount === null
                                                ? "-"
                                                : formatByCurrency(
                                                    entryCurrency,
                                                    owedFcrAmount,
                                                  )}
                                            </span>
                                          </div>
                                        </div>
                                        {hasAppliedCreditNotes && (
                                          <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                                            <div className="mb-2 flex items-center gap-2 border-b border-emerald-500/15 pb-2 text-emerald-200">
                                              <Info className="w-4 h-4" />
                                              <span className="font-semibold">
                                                Notas de credito aplicadas
                                              </span>
                                            </div>
                                            <div className="divide-y divide-emerald-500/10">
                                              {fe.appliedCreditNotes?.map(
                                                (note) => {
                                                  const noteAmount = Math.max(
                                                    0,
                                                    Math.trunc(
                                                      Number(note.amount) ||
                                                        0,
                                                    ),
                                                  );
                                                  const appliedAmount = Math.max(
                                                    0,
                                                    Math.trunc(
                                                      Number(
                                                        note.appliedAmount,
                                                      ) || 0,
                                                    ),
                                                  );
                                                  const noteLabel =
                                                    note.invoiceNumber
                                                      ? `NC #${note.invoiceNumber}`
                                                      : `NC ${note.id}`;

                                                  return (
                                                    <div
                                                      key={note.id}
                                                      className="py-2"
                                                    >
                                                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
                                                        <div>
                                                          <div className="font-semibold text-[var(--foreground)]">
                                                            {noteLabel}
                                                          </div>
                                                          <div className="text-xs text-[var(--muted-foreground)]">
                                                            Moneda: {note.currency}
                                                          </div>
                                                        </div>
                                                        <div className="text-right">
                                                          <div className="text-[var(--muted-foreground)]">
                                                            Monto NC:{" "}
                                                            <span className="font-medium text-[var(--foreground)]">
                                                              {formatByCurrency(
                                                                note.currency,
                                                                noteAmount,
                                                              )}
                                                            </span>
                                                          </div>
                                                          <div className="flex items-center justify-end gap-1.5">
                                                            <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                                            <span className="text-[var(--muted-foreground)]">
                                                              Aplicado:
                                                            </span>
                                                            <span className="font-medium text-emerald-400">
                                                              {formatByCurrency(
                                                                note.currency,
                                                                appliedAmount,
                                                              )}
                                                            </span>
                                                          </div>
                                                          {note.observation && (
                                                            <div className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
                                                              Obs: {note.observation}
                                                            </div>
                                                          )}
                                                        </div>
                                                      </div>
                                                    </div>
                                                  );
                                                },
                                              )}
                                            </div>
                                            <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-right">
                                              <span className="font-semibold text-[var(--foreground)]">
                                                Total aplicado:{" "}
                                              </span>
                                              <span className="text-base font-semibold text-emerald-300">
                                                {formatByCurrency(
                                                  entryCurrency,
                                                  appliedCreditNotesTotal,
                                                )}
                                              </span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
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
              <div className="mt-4">
                <div className="flex justify-center">
                  <div className="w-full max-w-2xl">
                    <div className="px-4 py-3 rounded min-w-[220px] fg-balance-card">
                      {isSuperAdminUser ? (
                        <button
                          type="button"
                          onClick={() => setSuperAdminTotalsOpen((p) => !p)}
                          className="w-full flex items-center justify-between gap-3"
                          aria-expanded={superAdminTotalsOpen}
                        >
                          <div className="text-center font-semibold text-sm text-[var(--muted-foreground)] flex-1">
                            Total del día
                          </div>
                          {superAdminTotalsOpen ? (
                            <ChevronUp className="w-4 h-4 text-[var(--muted-foreground)]" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-[var(--muted-foreground)]" />
                          )}
                        </button>
                      ) : (
                        <div className="mb-2 text-center font-semibold text-sm text-[var(--muted-foreground)]">
                          Total del día
                        </div>
                      )}

                      {(!isSuperAdminUser || superAdminTotalsOpen) && (
                        <div className={isSuperAdminUser ? "mt-3" : ""}>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {(["CRC", "USD"] as ("CRC" | "USD")[]).map(
                              (currency) => {
                                const ingreso =
                                  totalsByCurrency[currency].ingreso;
                                const egreso =
                                  totalsByCurrency[currency].egreso;
                                const neto = ingreso - egreso;
                                return (
                                  <div
                                    key={currency}
                                    className="rounded border border-[var(--input-border)] bg-[var(--card-bg)] p-3"
                                  >
                                    <div className="text-xs uppercase tracking-wide">
                                      {currency === "CRC"
                                        ? "Colones"
                                        : "Dólares"}
                                    </div>
                                    <div className="mt-2 text-[var(--foreground)]">
                                      <div className="flex items-center gap-2">
                                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                                        <div>
                                          Entradas:{" "}
                                          <span className="font-semibold text-green-500">
                                            {formatByCurrency(
                                              currency,
                                              ingreso,
                                            )}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 mt-1">
                                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                                        <div>
                                          Salidas:{" "}
                                          <span className="font-semibold text-red-500">
                                            {formatByCurrency(currency, egreso)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="pt-2">
                                        <div>
                                          Neto:{" "}
                                          <span
                                            className={`font-semibold ${
                                              neto > 0
                                                ? "text-green-500"
                                                : neto < 0
                                                  ? "text-red-500"
                                                  : ""
                                            }`}
                                          >
                                            {formatByCurrency(currency, neto)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              },
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
        </div>

        {enabledBalanceCurrencies.length > 0 && (
          <aside className="min-w-0 xl:w-[300px]">
            <div className="xl:sticky xl:top-20">
              <div className="rounded-2xl border border-white/10 bg-[#0d1117] p-5 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/25 bg-gradient-to-br from-cyan-500/20 to-teal-500/15 shadow-[0_10px_35px_rgba(6,182,212,0.12)]">
                  <Banknote className="h-7 w-7 text-cyan-400" />
                </div>
                <p className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-white/30">
                  Saldo Actual
                </p>
                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                  {enabledBalanceCurrencies.map((currency) => {
                    const label = currency === "CRC" ? "Colones" : "Dólares";
                    const value =
                      currency === "CRC"
                        ? currentBalanceCRC
                        : currentBalanceUSD;
                    return (
                      <div
                        key={currency}
                        className="rounded-xl border border-white/10 bg-[#050816] px-4 py-4 text-center"
                      >
                        <div className="text-xs uppercase tracking-wide text-white/45">
                          {label}
                        </div>
                        <div className="mt-2 text-2xl font-semibold leading-none tracking-tight text-white">
                          {formatByCurrency(currency, value)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Registrar cierre moved next to 'Agregar movimiento' per UI changes */}
              </div>
            </div>
          </aside>
        )}
      </div>

      <AuditHistoryModal
        open={auditModalOpen}
        onClose={() => setAuditModalOpen(false)}
        auditModalData={auditModalData}
        dateTimeFormatter={dateTimeFormatter}
        formatByCurrency={formatByCurrency}
        providersMap={providersMap}
      />
      {/* daily closings block removed from inline view */}
      <DailyClosingModal
        key={`${dailyClosingModalOpen ? "open" : "closed"}-${editingDailyClosingId ?? dailyClosingInitialValues?.closingDate ?? "new"}`}
        open={dailyClosingModalOpen}
        onClose={handleCloseDailyClosing}
        onConfirm={handleConfirmDailyClosing}
        initialValues={dailyClosingInitialValues}
        editId={editingDailyClosingId}
        onShowHistory={() => {
          setDailyClosingHistoryRange("today");
          setDailyClosingHistoryOpen(true);
        }}
        employees={employeeOptions}
        loadingEmployees={employeesLoading}
        currentBalanceCRC={currentBalanceCRC}
        currentBalanceUSD={currentBalanceUSD}
        managerReadonly={!editingDailyClosingId}
      />

      <FacturaPaymentModal
        open={closingPaymentModalOpen}
        target={closingPaymentTarget}
        providerName={
          closingPaymentTarget
            ? providers.find(
                (provider) =>
                  provider.code === closingPaymentTarget.providerCode,
              )?.name || closingPaymentTarget.providerCode
            : ""
        }
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
        allowPartialPayment={false}
        onClose={closeClosingInvoicePaymentModal}
        onPaymentAmountChange={setClosingPaymentAmount}
        onPaymentNotesChange={setClosingPaymentNotes}
        onPaymentManager2Change={setClosingPaymentManager2}
        onSubmitPartial={() => void submitClosingInvoicePayment("partial")}
        onSubmitFull={() => void submitClosingInvoicePayment("full")}
        pendingCreditNotes={closingPaymentAvailableCreditNotes}
        selectedCreditNoteIds={closingPaymentCreditNoteIds}
        onToggleCreditNote={(id) => {
          setClosingPaymentCreditNoteIds((prev) =>
            prev.includes(id)
              ? prev.filter((item) => item !== id)
              : [...prev, id],
          );
        }}
        creditNotesAppliedTotal={closingPaymentCreditNotesTotal}
      />

      <ConfirmModal
        open={confirmPhysicalCountOpen}
        title="Confirmar conteo físico"
        message={
          <div className="text-left space-y-3">
            <div className="text-sm text-[var(--muted-foreground)]">
              Antes de registrar el primer movimiento después del último cierre,
              confirma que el fondo fue contado físicamente.
            </div>

            <label className="flex items-start gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 cursor-pointer"
                checked={physicalCountWasDone}
                onChange={(e) => setPhysicalCountWasDone(e.target.checked)}
                aria-label="Confirmar que el fondo fue contado físicamente"
              />
              <span className="text-sm">
                Sí, el fondo fue contado físicamente
              </span>
            </label>
          </div>
        }
        confirmText="Continuar"
        cancelText="Cancelar"
        actionType="change"
        confirmDisabled={!physicalCountWasDone}
        onConfirm={handleConfirmPhysicalCount}
        onCancel={handleCancelPhysicalCount}
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
        onConfirm={confirmOpenCreateMovementNow}
        onCancel={cancelOpenCreateMovement}
      />

      <ConfirmModal
        open={missingShiftModalOpen}
        title="Turno no asignado"
        message={`No se cuenta con un turno (${missingShiftExpectedShift}) asignado para ${missingShiftDateKey || "hoy"}. Debes asignarlo en Control Horario para continuar.`}
        confirmText="Ir a Control Horario"
        cancelText="Cancelar"
        actionType="change"
        onConfirm={() => {
          setMissingShiftModalOpen(false);
          setMovementModalOpen(false);
          window.location.hash = "#controlhorario";
        }}
        onCancel={() => setMissingShiftModalOpen(false)}
      />

      <ConfirmModal
        open={pendingCierreModalOpen}
        title="Cierre pendiente"
        message={
          "Existe un cierre pendiente. No se pueden procesar pagos hasta que el cierre sea confirmado o eliminado desde el historial de cierres."
        }
        singleButton
        singleButtonText="Entendido"
        onCancel={closePendingCierreModal}
        onConfirm={() => {}}
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
        onCancel={() => {
          setPendingZeroAmountCreditNoteModalOpen(false);
          window.location.hash = "#facturas";
        }}
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
                  <span>▼</span>
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
        onConfirm={() =>
          setNegativeBalanceModal({
            open: false,
            amount: 0,
            currency: "CRC",
            resultingNegativeAmount: 0,
          })
        }
        onCancel={() =>
          setNegativeBalanceModal({
            open: false,
            amount: 0,
            currency: "CRC",
            resultingNegativeAmount: 0,
          })
        }
      />

      <ConfirmModal
        open={confirmDeleteEntry.open}
        title="Eliminar movimiento"
        message={`¿Está seguro que desea eliminar el movimiento #${
          confirmDeleteEntry.entry?.invoiceNumber || ""
        }? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={confirmDeleteMovement}
        onCancel={cancelDeleteMovement}
        actionType="delete"
      />

      <DailyClosingHistoryModal
        open={dailyClosingHistoryOpen}
        onClose={() => setDailyClosingHistoryOpen(false)}
        closingsAreLoading={closingsAreLoading}
        dailyClosings={dailyClosings}
        quickRange={dailyClosingHistoryRange}
        onQuickRangeChange={setDailyClosingHistoryRange}
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
        canDeleteLatestClosing={
          Boolean(isSuperAdminUser) &&
          accountKey === "FondoGeneral" &&
          Boolean((company || "").trim()) &&
          dailyClosings.length > 0
        }
        latestClosingLabel={latestDailyClosingLabel}
        onDeleteLatestClosing={handleDeleteLatestDailyClosing}
      />
    </div>
  );
}

export function OtraSection({ id }: { id?: string }) {
  // Estado para el filtro rápido
  return (
    <div id={id} className="mt-10">
      <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
        <Layers className="w-5 h-5" /> Reportes
      </h2>
      <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
        <p className="text-[var(--muted-foreground)]">
          Acciones adicionales proximamente.
        </p>
      </div>
    </div>
  );
}

// Small wrappers so each tab can mount an independent fondo implementation
export function FondoIngresoSection({ id }: { id?: string }) {
  return <FondoSection id={id} mode="ingreso" />;
}

export function FondoEgresoSection({ id }: { id?: string }) {
  return <FondoSection id={id} mode="egreso" />;
}

export function FondoGeneralSection({ id }: { id?: string }) {
  return <FondoSection id={id} mode="all" />;
}
