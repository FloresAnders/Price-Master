import { DailyClosingsService } from "@/services/daily-closings";
import type { DailyClosingRecord, DailyClosingsDocument } from "@/services/daily-closings";
import type { MovementAccountKey, MovementCurrencyKey } from "@/services/movimientos-fondos";
import type { AppliedCreditNote } from "@/services/facturas";
import type { FondoEntry, FondoMovementType } from "../types";
import {
  AUTO_ADJUSTMENT_CLOSING_TYPE,
  AUTO_ADJUSTMENT_OPENING_TYPE,
  AUTO_ADJUSTMENT_PROVIDER_CODE,
  AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY,
  ACCOUNT_KEY_BY_NAMESPACE,
  CIERRE_FONDO_VENTAS_PROVIDER_NAME,
  DAILY_CLOSINGS_STORAGE_PREFIX,
  FONDO_EGRESO_TYPES,
  FONDO_GASTO_TYPES,
  FONDO_INGRESO_TYPES,
  FONDO_TYPE_OPTIONS,
  INGRESO_DESDE_FONDO_VENTAS_NAME,
  MOVEMENT_ACCOUNT_KEYS,
} from "../constants";

export const stripUndefinedDeep = <T,>(value: T): T => {
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

export const normalizeMovementLabel = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

export type LastCreatedCooldownPayload = {
  at: number;
  kind?: "INGRESO_DESDE_FONDO_VENTAS" | "CIERRE_FONDO_VENTAS";
  prevAt?: number;
};

export const parseLastCreatedCooldown = (
  raw: string | null,
): LastCreatedCooldownPayload | null => {
  if (!raw) return null;

  const legacy = Number(raw);
  if (Number.isFinite(legacy) && legacy > 0) return { at: legacy };

  try {
    const parsed = JSON.parse(raw) as any;
    if (!parsed || typeof parsed !== "object") return null;
    const at = Number(parsed.at);
    if (!Number.isFinite(at) || at <= 0) return null;
    const payload: LastCreatedCooldownPayload = { at };
    if (
      parsed.kind === "INGRESO_DESDE_FONDO_VENTAS" ||
      parsed.kind === "CIERRE_FONDO_VENTAS"
    ) {
      payload.kind = parsed.kind;
    }
    const prevAt = Number(parsed.prevAt);
    if (Number.isFinite(prevAt) && prevAt > 0) payload.prevAt = prevAt;
    return payload;
  } catch {
    return null;
  }
};

export const getEffectiveLastCreatedAtMs = (
  payload: LastCreatedCooldownPayload | null,
): number => {
  if (!payload) return 0;
  if (
    payload.kind === "INGRESO_DESDE_FONDO_VENTAS" ||
    payload.kind === "CIERRE_FONDO_VENTAS"
  )
    return payload.prevAt ?? 0;
  return payload.at;
};

export type ClosingGuardKind = "FONDO_GENERAL" | "FONDO_VENTAS";

export const isAutoAdjustmentProvider = (code: unknown): boolean =>
  typeof code === "string" &&
  (code === AUTO_ADJUSTMENT_PROVIDER_CODE ||
    code === AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY);

export const isIngresoDesdeFondoVentasMovement = (
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

export const isCierreFondoVentasMovement = (
  movement: Partial<FondoEntry>,
  providerDisplayName?: string,
) => {
  const providerCode = normalizeMovementLabel(movement.providerCode);
  const providerName = normalizeMovementLabel(providerDisplayName);
  const target = normalizeMovementLabel(CIERRE_FONDO_VENTAS_PROVIDER_NAME);

  return providerCode === target || providerName === target;
};

export const getMovementTypeKey = (value: unknown): string =>
  typeof value === "string" ? value.trim().toUpperCase() : "";

export const includesMovementType = (
  types: readonly string[],
  value: unknown,
): boolean => {
  const target = getMovementTypeKey(value);
  if (!target) return false;
  return types.some((type) => getMovementTypeKey(type) === target);
};

export const getCanonicalFondoMovementType = (
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

export const isGeneralClosingProviderName = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const upper = value.trim().toUpperCase();
  return (
    upper === AUTO_ADJUSTMENT_PROVIDER_CODE ||
    upper === AUTO_ADJUSTMENT_PROVIDER_CODE_LEGACY
  );
};

export const hasGeneralClosingAdjustmentNotes = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const upper = value.toUpperCase();
  return upper.includes("AJUSTE APLICADO AL SALDO ACTUAL");
};

export const hasGeneralClosingNoDiffNotes = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const upper = value.toUpperCase();
  return upper.includes("SIN DIFERENCIAS");
};

export const isInventoryPurchasePaymentType = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toUpperCase();
  return (
    normalized === "COMPRA INVENTARIO" || normalized === "COMPRA DE INVENTARIO"
  );
};

export const isInventoryPurchaseProviderType = (value: unknown): boolean => {
  if (typeof value !== "string") return false;
  return isInventoryPurchasePaymentType(value);
};

export const getCanonicalClosingPaymentType = (
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

export const normalizeStoredType = (value: unknown): FondoMovementType => {
  if (typeof value === "string") {
    const upper = value.toUpperCase().trim();
    const canonicalType = getCanonicalFondoMovementType(value);
    if (canonicalType) return canonicalType;
    if (upper === "INFORMATIVO") return "INFORMATIVO";
    if (upper === "INGRESO") return "VENTAS";
    if (upper === "EGRESO") return "COMPRA INVENTARIO";
    if (upper === "COMPRA") return "COMPRA INVENTARIO";
    if (upper === "MANTENIMIENTO") return "MANTENIMIENTO INSTALACIONES";
    if (upper === "REPARACION EQUIPO") return "MANTENIMIENTO INSTALACIONES";
    if (upper === "SALARIO" || upper === "SALARIOS") return "SALARIOS";
    if (upper === "GASTO") return "GASTOS VARIOS";
    if (upper === AUTO_ADJUSTMENT_OPENING_TYPE) return AUTO_ADJUSTMENT_OPENING_TYPE;
  }
  return "COMPRA INVENTARIO";
};

export type PendingCreditNoteOption = {
  id: string;
  invoiceNumber: string;
  amount: number;
  balanceDue: number;
  paidAmount: number;
  currency: "CRC" | "USD";
};

export const normalizeInvoiceDocType = (value: unknown): "FCO" | "FCR" | "NC" => {
  if (value === "FCR") return "FCR";
  if (value === "NC") return "NC";
  return "FCO";
};

export const formatByCurrency = (currency: "CRC" | "USD", value: number) =>
  currency === "USD"
    ? `$ ${new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(roundMoney2(value))}`
    : `₡ ${new Intl.NumberFormat("es-CR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(roundMoney2(value))}`;

export const roundMoney2 = (value: unknown): number => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
};

export const resolveEffectiveEgresoAmount = (
  entry: Partial<FondoEntry> | null | undefined,
): number => {
  if (!entry) return 0;
  const normalize = (value: unknown) => {
    return roundMoney2(value);
  };
  const egreso = Math.max(0, normalize(entry.amountEgreso));
  const hasPayment = (entry as any).amountPayment !== undefined;
  const payment = Math.max(0, normalize((entry as any).amountPayment));
  return egreso > 0 && hasPayment ? payment : egreso;
};

export const isPaidFcrMovement = (entry: Partial<FondoEntry>): boolean => {
  if (normalizeInvoiceDocType(entry.invoiceDocType) !== "FCR") return false;
  const hasManager2 =
    typeof entry.manager2 === "string" && entry.manager2.trim().length > 0;
  const hasUpdateAt =
    typeof entry.updateAt === "string" && entry.updateAt.trim().length > 0;
  return hasManager2 || hasUpdateAt;
};

export const shouldDeleteFacturasMirror = (entry: Partial<FondoEntry>): boolean => {
  const id = String(entry.id || "").trim();
  if (!id) return false;
  return Boolean(entry.invoiceNumber || entry.providerCode);
};

export const getPrimaryMovementDateISO = (entry: Partial<FondoEntry>): string => {
  if (isPaidFcrMovement(entry)) {
    const fromUpdate = String(entry.updateAt || "").trim();
    if (fromUpdate) return fromUpdate;
  }
  return String(entry.createdAt || "").trim();
};

export const getPrimaryMovementTime = (entry: Partial<FondoEntry>): number => {
  const timestamp = Date.parse(getPrimaryMovementDateISO(entry));
  if (!Number.isNaN(timestamp)) return timestamp;

  const createdTimestamp = Date.parse(String(entry.createdAt || ""));
  return Number.isNaN(createdTimestamp) ? 0 : createdTimestamp;
};

export const getPrimaryMovementManager = (entry: Partial<FondoEntry>): string => {
  if (isPaidFcrMovement(entry)) {
    const fromManager2 = String(entry.manager2 || "").trim();
    if (fromManager2) return fromManager2;
  }
  return String(entry.manager || "").trim();
};

export const getFcrPaymentInvoiceId = (entry: Partial<FondoEntry>): string | null => {
  const paymentId = String(entry.id || "").trim();
  const prefix = "fcr-pago-";
  if (!paymentId.startsWith(prefix)) return null;

  const rest = paymentId.slice(prefix.length);
  const invoiceIdMatch = rest.match(/^(FAC-\d+-[A-Z0-9]+)-/);
  return invoiceIdMatch ? invoiceIdMatch[1] : null;
};

export const getFcrPaymentAmount = (entry: Partial<FondoEntry>): number =>
  Math.max(
    0,
    roundMoney2(
      (entry as any).amountEgreso ??
        (entry as any).amountPayment ??
        (entry as any).amount ??
        0,
    ),
  );

export const roundCreditNotePaymentAmount = (
  amount: number,
  currency: MovementCurrencyKey,
  accountKey?: string,
): number => {
  const normalized = Math.max(0, roundMoney2(amount));
  if (currency !== "CRC") return normalized;
  if (accountKey && accountKey !== "FondoGeneral") return normalized;
  return Math.floor(normalized / 1000) * 1000;
};

export const getChangedFields = (
  before: any,
  after: any,
): { before: Record<string, any>; after: Record<string, any> } => {
  const changed: { before: Record<string, any>; after: Record<string, any> } = {
    before: {},
    after: {},
  };

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

    if (beforeVal !== afterVal) {
      changed.before[field] = beforeVal;
      changed.after[field] = afterVal;
    }
  });

  return changed;
};

export const compressAuditHistory = (history: any[]): any[] => {
  if (!Array.isArray(history) || history.length <= 5) {
    return history;
  }

  const compressed: any[] = [];
  const first = history[0];
  const last = history[history.length - 1];

  compressed.push(first);

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
    for (let i = 1; i < history.length - 1; i++) {
      compressed.push(history[i]);
    }
  }

  if (history.length > 1) {
    compressed.push(last);
  }

  return compressed;
};

export const buildStorageKey = (namespace: string, suffix: string) =>
  `${namespace}${suffix}`;

export const buildDailyClosingStorageKey = (
  company: string,
  account: MovementAccountKey,
) => {
  const normalizedCompany = company.trim().toLowerCase();
  return `${DAILY_CLOSINGS_STORAGE_PREFIX}_${
    normalizedCompany || "default"
  }_${account}`;
};

export const sanitizeMoneyNumber = (value: unknown) => {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return roundMoney2(parsed);
};

export const sanitizeBreakdown = (input: unknown): Record<number, number> => {
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

export type AdjustmentResolutionRemoval = NonNullable<
  NonNullable<DailyClosingRecord["adjustmentResolution"]>["removedAdjustments"]
>[number];

export const sanitizeAdjustmentResolution = (
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

export const sanitizeDailyClosings = (raw: unknown): DailyClosingRecord[] => {
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
      ...(record.singleClosingReason
        ? { singleClosingReason: String(record.singleClosingReason) }
        : {}),
      ...(record.noMovements ? { noMovements: true } : {}),
      ...(record.noMovementsReason
        ? { noMovementsReason: String(record.noMovementsReason) }
        : {}),
      ...(record.turno === "D" || record.turno === "N"
        ? { turno: record.turno }
        : {}),
      breakdownCRC: sanitizeBreakdown(record.breakdownCRC),
      breakdownUSD: sanitizeBreakdown(record.breakdownUSD),
      ...(record.reconciliation ? { reconciliation: record.reconciliation } : {}),
      ...(adjustmentResolution ? { adjustmentResolution } : {}),
    });
    return acc;
  }, []);
  return sanitized.slice(0, DailyClosingsService.MAX_RECORDS);
};

export const dailyClosingSortValue = (record: DailyClosingRecord): number => {
  const createdAtTimestamp = Date.parse(record.createdAt);
  if (!Number.isNaN(createdAtTimestamp)) return createdAtTimestamp;
  const closingAtTimestamp = Date.parse(record.closingDate);
  if (!Number.isNaN(closingAtTimestamp)) return closingAtTimestamp;
  return 0;
};

export const mergeDailyClosingRecords = (
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

export const flattenDailyClosingsDocument = (
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

export const isMovementAccountKey = (value: unknown): value is MovementAccountKey =>
  typeof value === "string" &&
  MOVEMENT_ACCOUNT_KEYS.includes(value as MovementAccountKey);

export const getAccountKeyFromNamespace = (namespace: string): MovementAccountKey =>
  ACCOUNT_KEY_BY_NAMESPACE[namespace] || "FondoGeneral";

export const coerceIdentifier = (value: unknown): string | undefined => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  return undefined;
};

export const coerceInvoice = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value))
    return String(Math.trunc(value));
  return "";
};

export const coerceNotes = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  return "";
};

export const coerceTruncNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return roundMoney2(value);
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? roundMoney2(parsed) : undefined;
  }
  return undefined;
};

export const resolveCreatedAt = (value: unknown): string | undefined => {
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

export const dateKeyFromDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;

export const formatToastWaitTime = (remainingSec: number): string => {
  const sec = Math.max(1, Math.ceil(Number(remainingSec) || 0));
  if (sec <= 60) return `${sec}s`;
  const minutes = Math.floor(sec / 60);
  const seconds = sec % 60;
  if (seconds === 0) return `${minutes}min`;
  return `${minutes}min ${seconds}s`;
};

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

    const currency: MovementCurrencyKey =
      forcedCurrency ?? (entry.currency === "USD" ? "USD" : "CRC");
    const accountId =
      forcedAccount ??
      (isMovementAccountKey(entry.accountId) ? entry.accountId : undefined);
    const normalizeEntryAmount = (value: unknown) => {
      return roundMoney2(value);
    };
    const normalizeOptionalEntryAmount = (value: unknown) => {
      if (value === undefined || value === null || value === "") return undefined;
      return normalizeEntryAmount(value);
    };

    const rawEgreso =
      typeof entry.amountEgreso === "number"
        ? entry.amountEgreso
        : Number(entry.amountEgreso) || 0;
    const rawIngreso =
      typeof entry.amountIngreso === "number"
        ? entry.amountIngreso
        : Number(entry.amountIngreso) || 0;

    const amountEgreso = normalizeEntryAmount(rawEgreso);
    const amountIngreso = normalizeEntryAmount(rawIngreso);

    const amount = normalizeOptionalEntryAmount(entry.amount);
    const originalAmount = normalizeOptionalEntryAmount((entry as any).originalAmount);
    const amountDue = normalizeOptionalEntryAmount((entry as any).amountDue);
    const balanceDue = normalizeOptionalEntryAmount((entry as any).balanceDue);
    const rawAmountPayment = (entry as any).amountPayment;
    const amountPayment =
      rawAmountPayment !== undefined
        ? Math.max(0, normalizeEntryAmount(rawAmountPayment))
        : undefined;
    const appliedCreditNotes = Array.isArray((entry as any).appliedCreditNotes)
      ? ((entry as any).appliedCreditNotes as any[])
          .map((note) => {
            const id = String(note?.id || "").trim();
            const appliedAmount = Math.max(
              0,
              normalizeEntryAmount(note?.appliedAmount),
            );
            if (!id || appliedAmount <= 0) return null;
            return {
              id,
              invoiceNumber: String(note?.invoiceNumber || "").trim(),
              amount: Math.max(0, normalizeEntryAmount(note?.amount)),
              appliedAmount,
              currency: note?.currency === "USD" ? "USD" : "CRC",
              observation:
                typeof note?.observation === "string"
                  ? note.observation.trim() || undefined
                  : undefined,
            } as AppliedCreditNote;
          })
          .filter((note): note is AppliedCreditNote => Boolean(note))
      : undefined;

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
      openingBalanceCRC: normalizeOptionalEntryAmount((entry as any).openingBalanceCRC),
      openingBalanceUSD: normalizeOptionalEntryAmount((entry as any).openingBalanceUSD),
      openingPreviousBalanceCRC: normalizeOptionalEntryAmount((entry as any).openingPreviousBalanceCRC),
      openingPreviousBalanceUSD: normalizeOptionalEntryAmount((entry as any).openingPreviousBalanceUSD),
      openingBreakdownCRC: (entry as any).openingBreakdownCRC ?? undefined,
      openingBreakdownUSD: (entry as any).openingBreakdownUSD ?? undefined,
      turno: entry.turno === "D" || entry.turno === "N" ? entry.turno : undefined,
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
