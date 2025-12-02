"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
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
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useProviders } from '../../../hooks/useProviders';
import { useEmail } from '../../../hooks/useEmail';
import useToast from '../../../hooks/useToast';
import type { UserPermissions, Empresas } from '../../../types/firestore';
import { getDefaultPermissions } from '../../../utils/permissions';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { EmpresasService } from '../../../services/empresas';
import {
    MovimientosFondosService,
    MovementAccountKey,
    MovementCurrencyKey,
    MovementStorage,
    MovementStorageState,
} from '../../../services/movimientos-fondos';
import { DailyClosingsService, DailyClosingRecord, DailyClosingsDocument } from '../../../services/daily-closings';
import { buildDailyClosingEmailTemplate } from '../../../services/email-templates/daily-closing';
import { UsersService } from '../../../services/users';
import AgregarMovimiento from './AgregarMovimiento';
import DailyClosingModal, { DailyClosingFormValues } from './DailyClosingModal';
import { useActorOwnership } from '../../../hooks/useActorOwnership';

// Límite de movimientos almacenados en localStorage para evitar QuotaExceededError
const MAX_LOCAL_MOVEMENTS = 500;
// Límite máximo de ediciones permitidas por movimiento
const MAX_AUDIT_EDITS = 5;

export const FONDO_INGRESO_TYPES = ['VENTAS', 'OTROS INGRESOS'] as const;

export const FONDO_GASTO_TYPES = [
    'SALARIOS',
    'CARGAS SOCIALES',
    'AGUINALDOS',
    'VACACIONES',
    'POLIZA RIESGOS DE TRABAJO',
    'PAGO TIMBRE Y EDUCACION',
    'PAGO IMPUESTOS A SOCIEDADES',
    'PATENTES MUNICIPALES',
    'ALQUILER LOCAL',
    'ELECTRICIDAD',
    'AGUA',
    'INTERNET',
    'MANTENIMIENTO INSTALACIONES',
    'PAPELERIA Y UTILES',
    'ASEO Y LIMPIEZA',
    'REDES SOCIALES',
    'MATERIALES DE EMPAQUE',
    'CONTROL PLAGAS',
    'MONITOREO DE ALARMAS',
    'FACTURA ELECTRONICA',
    'GASTOS VARIOS',
] as const;

const AUTO_ADJUSTMENT_MOVEMENT_TYPE_EGRESO = (FONDO_GASTO_TYPES as readonly string[]).find(
    t => t.toUpperCase() === 'GASTOS VARIOS',
) ?? FONDO_GASTO_TYPES[FONDO_GASTO_TYPES.length - 1];
const AUTO_ADJUSTMENT_MOVEMENT_TYPE_INGRESO = (FONDO_INGRESO_TYPES as readonly string[]).find(
    t => t.toUpperCase() === 'OTROS INGRESOS',
) ?? FONDO_INGRESO_TYPES[FONDO_INGRESO_TYPES.length - 1];

export const FONDO_EGRESO_TYPES = [
    'PAGO TIEMPOS',
    'PAGO BANCA',
    'COMPRA INVENTARIO',
    'COMPRA ACTIVOS',
    'PAGO IMPUESTO RENTA',
    'PAGO IMPUESTO IVA',
    'EGRESOS VARIOS',
] as const;

// Opciones visibles en el selector
export const FONDO_TYPE_OPTIONS = [...FONDO_INGRESO_TYPES, ...FONDO_GASTO_TYPES, ...FONDO_EGRESO_TYPES] as const;

export type FondoMovementType = typeof FONDO_INGRESO_TYPES[number] | typeof FONDO_GASTO_TYPES[number] | typeof FONDO_EGRESO_TYPES[number];

const AUTO_ADJUSTMENT_PROVIDER_CODE = 'AJUSTE FONDO GENERAL';
const AUTO_ADJUSTMENT_MANAGER = 'SISTEMA';

export const isFondoMovementType = (value: string): value is FondoMovementType =>
    FONDO_TYPE_OPTIONS.includes(value as FondoMovementType);

export const isIngresoType = (type: FondoMovementType) => (FONDO_INGRESO_TYPES as readonly string[]).includes(type);
export const isGastoType = (type: FondoMovementType) => (FONDO_GASTO_TYPES as readonly string[]).includes(type);
export const isEgresoType = (type: FondoMovementType) => (FONDO_EGRESO_TYPES as readonly string[]).includes(type);

// Formatea en Titulo Caso cada palabra
export const formatMovementType = (type: FondoMovementType) =>
    type
        .toLowerCase()
        .split(' ')
        .map(w => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');

// Normaliza valores historicos guardados en localStorage a las nuevas categorias
const normalizeStoredType = (value: unknown): FondoMovementType => {
    if (typeof value === 'string') {
        const upper = value.toUpperCase().trim();
        if (isFondoMovementType(upper)) return upper;
        // Compatibilidad con valores antiguos
        if (upper === 'INGRESO') return 'VENTAS';
        if (upper === 'EGRESO') return 'COMPRA INVENTARIO';
        if (upper === 'COMPRA') return 'COMPRA INVENTARIO';
        if (upper === 'MANTENIMIENTO') return 'MANTENIMIENTO INSTALACIONES';
        if (upper === 'REPARACION EQUIPO') return 'MANTENIMIENTO INSTALACIONES';
        if (upper === 'SALARIO' || upper === 'SALARIOS') return 'SALARIOS';
        if (upper === 'GASTO') return 'GASTOS VARIOS';
    }
    return 'COMPRA INVENTARIO';
};

export type FondoEntry = {
    id: string;
    providerCode: string;
    invoiceNumber: string;
    paymentType: FondoMovementType;
    amountEgreso: number;
    amountIngreso: number;
    manager: string;
    notes: string;
    createdAt: string;
    accountId?: MovementAccountKey;
    currency?: 'CRC' | 'USD';
    breakdown?: Record<number, number>;
    // audit fields: when an edit is recorded, we create an audit movement
    isAudit?: boolean;
    originalEntryId?: string;
    auditDetails?: string;
};

/**
 * Simplifica un registro de auditoría guardando solo los campos que cambiaron.
 * @param before Estado anterior del movimiento
 * @param after Estado nuevo del movimiento
 * @returns Objeto con solo los campos modificados
 */
const getChangedFields = (before: any, after: any): { before: Record<string, any>, after: Record<string, any> } => {
    const changed: { before: Record<string, any>, after: Record<string, any> } = { before: {}, after: {} };

    // Campos relevantes a comparar
    const fieldsToCheck = ['providerCode', 'invoiceNumber', 'paymentType', 'amountEgreso', 'amountIngreso', 'manager', 'notes', 'currency'];

    fieldsToCheck.forEach(field => {
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

const FONDO_KEY_SUFFIX = '_fondos_v1';
const buildStorageKey = (namespace: string, suffix: string) => `${namespace}${suffix}`;

const DAILY_CLOSINGS_STORAGE_PREFIX = 'fg_daily_closings';

const buildDailyClosingStorageKey = (company: string, account: MovementAccountKey) => {
    const normalizedCompany = company.trim().toLowerCase();
    return `${DAILY_CLOSINGS_STORAGE_PREFIX}_${normalizedCompany || 'default'}_${account}`;
};

const sanitizeMoneyNumber = (value: unknown) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.trunc(parsed);
};

const sanitizeBreakdown = (input: unknown): Record<number, number> => {
    if (!input || typeof input !== 'object') return {};
    return Object.entries(input as Record<string, unknown>).reduce<Record<number, number>>((acc, [key, rawValue]) => {
        const denom = Number(key);
        if (!Number.isFinite(denom)) return acc;
        const count = sanitizeMoneyNumber(rawValue);
        if (count > 0) acc[Math.trunc(denom)] = count;
        return acc;
    }, {});
};

type AdjustmentResolutionRemoval = NonNullable<
    NonNullable<DailyClosingRecord['adjustmentResolution']>['removedAdjustments']
>[number];

const sanitizeAdjustmentResolution = (
    input: unknown,
): DailyClosingRecord['adjustmentResolution'] | undefined => {
    if (!input || typeof input !== 'object') return undefined;
    const candidate = input as Record<string, unknown>;
    const resolution: DailyClosingRecord['adjustmentResolution'] = {};

    if (Array.isArray(candidate.removedAdjustments)) {
        const removed = (candidate.removedAdjustments as unknown[])
            .map((item): AdjustmentResolutionRemoval | undefined => {
                if (!item || typeof item !== 'object') return undefined;
                const raw = item as Record<string, unknown>;
                const cleaned: Partial<AdjustmentResolutionRemoval> = {};
                if (typeof raw.id === 'string' && raw.id.trim().length > 0) cleaned.id = raw.id.trim();
                if (raw.currency === 'USD') cleaned.currency = 'USD';
                else if (raw.currency === 'CRC') cleaned.currency = 'CRC';
                if (raw.amount !== undefined) cleaned.amount = sanitizeMoneyNumber(raw.amount);
                if (raw.amountIngreso !== undefined) cleaned.amountIngreso = sanitizeMoneyNumber(raw.amountIngreso);
                if (raw.amountEgreso !== undefined) cleaned.amountEgreso = sanitizeMoneyNumber(raw.amountEgreso);
                if (typeof raw.manager === 'string' && raw.manager.trim().length > 0) cleaned.manager = raw.manager.trim();
                if (typeof raw.createdAt === 'string' && raw.createdAt.trim().length > 0) cleaned.createdAt = raw.createdAt.trim();
                return Object.keys(cleaned).length > 0 ? (cleaned as AdjustmentResolutionRemoval) : undefined;
            })
            .filter(
                (item): item is AdjustmentResolutionRemoval =>
                    Boolean(item),
            );
        if (removed.length > 0) {
            resolution.removedAdjustments = removed;
        }
    }

    if (typeof candidate.note === 'string') {
        const trimmed = candidate.note.trim();
        if (trimmed.length > 0) {
            resolution.note = trimmed;
        }
    }

    if (candidate.postAdjustmentBalanceCRC !== undefined) {
        resolution.postAdjustmentBalanceCRC = sanitizeMoneyNumber(candidate.postAdjustmentBalanceCRC);
    }

    if (candidate.postAdjustmentBalanceUSD !== undefined) {
        resolution.postAdjustmentBalanceUSD = sanitizeMoneyNumber(candidate.postAdjustmentBalanceUSD);
    }

    return Object.keys(resolution).length > 0 ? resolution : undefined;
};

const sanitizeDailyClosings = (raw: unknown): DailyClosingRecord[] => {
    if (!Array.isArray(raw)) return [];
    const sanitized = raw.reduce<DailyClosingRecord[]>((acc, candidate) => {
        if (!candidate || typeof candidate !== 'object') return acc;
        const record = candidate as Partial<DailyClosingRecord>;
        const id = typeof record.id === 'string' && record.id.trim().length > 0 ? record.id : `${Date.now()}_${acc.length}`;
        const manager = typeof record.manager === 'string' ? record.manager : '';
        const closingDate = typeof record.closingDate === 'string' ? record.closingDate : new Date().toISOString();
        const createdAt = typeof record.createdAt === 'string' ? record.createdAt : closingDate;
        const adjustmentResolution = sanitizeAdjustmentResolution(record.adjustmentResolution);
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
            notes: typeof record.notes === 'string' ? record.notes : '',
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
    if (incoming.length === 0 && existing.length <= DailyClosingsService.MAX_RECORDS) {
        return existing;
    }
    const map = new Map<string, DailyClosingRecord>();
    existing.forEach(record => map.set(record.id, record));
    incoming.forEach(record => map.set(record.id, record));
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
        list.forEach(record => {
            aggregated.push(record);
        });
    });
    aggregated.sort((a, b) => dailyClosingSortValue(b) - dailyClosingSortValue(a));
    return {
        records: aggregated.slice(0, DailyClosingsService.MAX_RECORDS),
        loadedKeys,
    };
};

const NAMESPACE_PERMISSIONS: Record<string, keyof UserPermissions> = {
    fg: 'fondogeneral',
    bcr: 'fondogeneralBCR',
    bn: 'fondogeneralBN',
    bac: 'fondogeneralBAC',
};

const NAMESPACE_DESCRIPTIONS: Record<string, string> = {
    fg: 'el Fondo General',
    bcr: 'la cuenta BCR',
    bn: 'la cuenta BN',
    bac: 'la cuenta BAC',
};

const ACCOUNT_KEY_BY_NAMESPACE: Record<string, MovementAccountKey> = {
    fg: 'FondoGeneral',
    bcr: 'BCR',
    bn: 'BN',
    bac: 'BAC',
};

const MOVEMENT_ACCOUNT_KEYS: MovementAccountKey[] = ['FondoGeneral', 'BCR', 'BN', 'BAC'];

const isMovementAccountKey = (value: unknown): value is MovementAccountKey =>
    typeof value === 'string' && MOVEMENT_ACCOUNT_KEYS.includes(value as MovementAccountKey);

const getAccountKeyFromNamespace = (namespace: string): MovementAccountKey =>
    ACCOUNT_KEY_BY_NAMESPACE[namespace] || 'FondoGeneral';

const coerceIdentifier = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        return String(Math.trunc(value));
    }
    return undefined;
};

const coerceInvoice = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));
    return '';

};

const coerceNotes = (value: unknown): string => {
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    return '';
};

const resolveCreatedAt = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
        const date = new Date(value);
        return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
    }
    if (typeof value === 'object') {
        const maybeTimestamp = value as { toDate?: () => Date };
        if (typeof maybeTimestamp?.toDate === 'function') {
            try {
                const date = maybeTimestamp.toDate();
                return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined;
            } catch {
                return undefined;
            }
        }
    }
    return undefined;
};

const dateKeyFromDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
        const paymentType = normalizeStoredType(entry.paymentType);
        const manager = coerceIdentifier(entry.manager);
        const createdAt = resolveCreatedAt(entry.createdAt);

        if (!id || !providerCode || !manager || !createdAt) return acc;

        const rawEgreso = typeof entry.amountEgreso === 'number' ? entry.amountEgreso : Number(entry.amountEgreso) || 0;
        const rawIngreso = typeof entry.amountIngreso === 'number' ? entry.amountIngreso : Number(entry.amountIngreso) || 0;

        const amountEgreso = Math.trunc(rawEgreso);
        const amountIngreso = Math.trunc(rawIngreso);

        const currency: MovementCurrencyKey = forcedCurrency ?? (entry.currency === 'USD' ? 'USD' : 'CRC');
        const accountId = forcedAccount ?? (isMovementAccountKey(entry.accountId) ? entry.accountId : undefined);

        acc.push({
            id,
            providerCode,
            invoiceNumber,
            paymentType,
            currency,
            accountId,
            amountEgreso: isEgresoType(paymentType) || isGastoType(paymentType) ? amountEgreso : 0,
            amountIngreso: isIngresoType(paymentType) ? amountIngreso : 0,
            manager,
            notes: coerceNotes(entry.notes),
            createdAt,
            isAudit: !!entry.isAudit,
            originalEntryId: typeof entry.originalEntryId === 'string' ? entry.originalEntryId : undefined,
            auditDetails: typeof entry.auditDetails === 'string' ? entry.auditDetails : undefined,
        });

        return acc;
    }, []);
};

const AccessRestrictedMessage = ({ description }: { description: string }) => (
    <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
        <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
        <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
        <p className="text-[var(--muted-foreground)]">{description}</p>
        <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
    </div>
);

export function ProviderSection({ id }: { id?: string }) {
    const { user, loading: authLoading } = useAuth();
    const assignedCompany = user?.ownercompanie?.trim() ?? '';
    const { ownerIds: actorOwnerIds } = useActorOwnership(user);
    const allowedOwnerIds = useMemo(() => {
        const set = new Set<string>();
        actorOwnerIds.forEach(id => {
            const normalized = typeof id === 'string' ? id.trim() : String(id || '').trim();
            if (normalized) set.add(normalized);
        });
        if (user?.ownerId) {
            const normalized = String(user.ownerId).trim();
            if (normalized) set.add(normalized);
        }
        return set;
    }, [actorOwnerIds, user?.ownerId]);
    const isAdminUser = user?.role === 'admin';
    const [adminCompany, setAdminCompany] = useState(assignedCompany);
    useEffect(() => {
        setAdminCompany(assignedCompany);
    }, [assignedCompany]);
    const company = isAdminUser ? adminCompany : assignedCompany;
    const { providers, loading: providersLoading, error, addProvider, removeProvider, updateProvider } = useProviders(company);
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const canManageFondoGeneral = Boolean(permissions.fondogeneral);
    const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
    const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
    const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(null);

    const sortedOwnerCompanies = useMemo(() => {
        return ownerCompanies
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
    }, [ownerCompanies]);

    useEffect(() => {
        if (!isAdminUser) {
            setOwnerCompanies([]);
            setOwnerCompaniesLoading(false);
            setOwnerCompaniesError(null);
            return;
        }
        if (allowedOwnerIds.size === 0) {
            setOwnerCompanies([]);
            setOwnerCompaniesLoading(false);
            setOwnerCompaniesError('No se pudo determinar el ownerId asociado a tu cuenta.');
            return;
        }

        let isMounted = true;
        setOwnerCompaniesLoading(true);
        setOwnerCompaniesError(null);

        EmpresasService.getAllEmpresas()
            .then(empresas => {
                if (!isMounted) return;
                const filtered = empresas.filter(emp => {
                    const owner = (emp.ownerId || '').trim();
                    if (!owner) return false;
                    return allowedOwnerIds.has(owner);
                });
                setOwnerCompanies(filtered);
                setAdminCompany(current => {
                    const normalizedCurrent = (current || '').trim().toLowerCase();
                    if (normalizedCurrent.length > 0) {
                        const exists = filtered.some(emp => (emp.name || '').trim().toLowerCase() === normalizedCurrent);
                        if (exists) return current;
                    }
                    return filtered[0]?.name ?? '';
                });
            })
            .catch(err => {
                if (!isMounted) return;
                setOwnerCompanies([]);
                setOwnerCompaniesError(err instanceof Error ? err.message : 'No se pudieron cargar las empresas disponibles.');
            })
            .finally(() => {
                if (isMounted) setOwnerCompaniesLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [allowedOwnerIds, isAdminUser]);

    const [providerName, setProviderName] = useState('');
    const [providerType, setProviderType] = useState<FondoMovementType | ''>('');
    const [editingProviderCode, setEditingProviderCode] = useState<string | null>(null);
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingCode, setDeletingCode] = useState<string | null>(null);
    const [providerDrawerOpen, setProviderDrawerOpen] = useState(false);
    const [confirmState, setConfirmState] = useState<{ open: boolean; code: string; name: string }>({
        open: false,
        code: '',
        name: '',
    });
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState<number | 'all'>(10);
    const companySelectId = `provider-company-select-${id ?? 'default'}`;
    const showCompanySelector = isAdminUser && (ownerCompaniesLoading || sortedOwnerCompanies.length > 0 || !!ownerCompaniesError);

    const filteredProviders = useMemo(() => {
        return providers.filter(p =>
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.code.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [providers, searchTerm]);

    const totalPages = useMemo(() => {
        if (itemsPerPage === 'all') return 1;
        return Math.ceil(filteredProviders.length / itemsPerPage);
    }, [filteredProviders.length, itemsPerPage]);

    const paginatedProviders = useMemo(() => {
        if (itemsPerPage === 'all') return filteredProviders;
        return filteredProviders.slice(
            (currentPage - 1) * itemsPerPage,
            currentPage * itemsPerPage
        );
    }, [filteredProviders, currentPage, itemsPerPage]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, itemsPerPage]);

    const handleAdminCompanyChange = useCallback((value: string) => {
        if (!isAdminUser) return;
        setAdminCompany(value);
        setProviderDrawerOpen(false);
        setFormError(null);
        setProviderName('');
        setProviderType('');
        setEditingProviderCode(null);
        setDeletingCode(null);
        setConfirmState({ open: false, code: '', name: '' });
        setCurrentPage(1);
        setSearchTerm('');
        setItemsPerPage(10);
    }, [isAdminUser]);

    // provider creation is handled from the drawer UI below

    const openRemoveModal = (code: string, name: string) => {
        if (!company) return;
        setConfirmState({ open: true, code, name });
    };

    const openEditProvider = (code: string) => {
        const prov = providers.find(p => p.code === code);
        if (!prov) return;
        setEditingProviderCode(prov.code);
        setProviderName(prov.name ?? '');
        setProviderType((prov.type as FondoMovementType) ?? '');
        setProviderDrawerOpen(true);
    };

    const cancelRemoveModal = () => {
        if (deletingCode) return;
        setConfirmState({ open: false, code: '', name: '' });
    };

    const closeRemoveModal = () => setConfirmState({ open: false, code: '', name: '' });

    const confirmRemoveProvider = async () => {
        if (!company) return;
        if (!confirmState.code || deletingCode) return;

        try {
            setFormError(null);
            setDeletingCode(confirmState.code);
            await removeProvider(confirmState.code);
            closeRemoveModal();
        } catch (err) {
            const message = err instanceof Error ? err.message : 'No se pudo eliminar el proveedor.';
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

    return (
        <div id={id} className="mt-10" style={{ color: '#ffffff' }}>
            <div className="mb-4 flex items-center justify-between">
                <div className="flex flex-col items-center">
                    <h2 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-2">
                        <UserPlus className="w-5 h-5" /> Agregar proveedor
                    </h2>
                    {company && (
                        <p className="text-xs text-[var(--muted-foreground)] mt-1">
                            Empresa asignada: <span className="font-medium text-[var(--foreground)]">{company}</span>
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            setProviderDrawerOpen(true);
                            setFormError(null);
                            setProviderName('');
                            setProviderType('');
                            setEditingProviderCode(null);
                        }}
                        disabled={!company || saving || providersLoading}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar proveedor
                    </button>
                    {showCompanySelector && (
                        <select
                            id={companySelectId}
                            value={adminCompany}
                            onChange={event => handleAdminCompanyChange(event.target.value)}
                            disabled={ownerCompaniesLoading || sortedOwnerCompanies.length === 0}
                            className="min-w-[220px] px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                        >
                            {ownerCompaniesLoading && <option value="">Cargando empresas...</option>}
                            {!ownerCompaniesLoading && sortedOwnerCompanies.length === 0 && (
                                <option value="">Sin empresas disponibles</option>
                            )}
                            {!ownerCompaniesLoading && sortedOwnerCompanies.length > 0 && (
                                <>
                                    <option value="" disabled>
                                        Selecciona una empresa
                                    </option>
                                    {sortedOwnerCompanies.map((emp, index) => (
                                        <option key={emp.id || emp.name || `admin-company-${index}`} value={emp.name || ''}>
                                            {emp.name || 'Sin nombre'}
                                        </option>
                                    ))}
                                </>
                            )}
                        </select>
                    )}
                </div>
            </div>

            {!authLoading && !company && !isAdminUser && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Tu usuario no tiene una empresa asociada; no es posible registrar proveedores.
                </p>
            )}
            {!authLoading && !company && isAdminUser && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Selecciona una empresa para administrar proveedores.
                </p>
            )}

            {resolvedError && <div className="mb-4 text-sm text-red-500">{resolvedError}</div>}



            <div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Lista de Proveedores</h3>
                {!isLoading && (
                    <div className="mb-4 space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--muted-foreground)]" />
                            <input
                                type="text"
                                placeholder="Buscar proveedores..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-[var(--foreground)]"
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <label htmlFor="items-per-page" className="text-sm text-[var(--foreground)]">Mostrar:</label>
                                <select
                                    id="items-per-page"
                                    value={itemsPerPage === 'all' ? 'all' : itemsPerPage.toString()}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setItemsPerPage(value === 'all' ? 'all' : parseInt(value));
                                        setCurrentPage(1);
                                    }}
                                    className="px-3 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                                >
                                    <option value="all">Todos</option>
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="15">15</option>
                                    <option value="20">20</option>
                                </select>
                            </div>
                            {itemsPerPage !== 'all' && totalPages > 1 && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="px-3 py-1 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-[var(--foreground)] text-sm">
                                        Página {currentPage} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="px-3 py-1 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {isLoading ? (
                    <p className="text-[var(--muted-foreground)]">Cargando proveedores...</p>
                ) : (
                    <div>
                        <ul className="space-y-2">
                            {filteredProviders.length === 0 && <li className="text-[var(--muted-foreground)]">{searchTerm ? 'No se encontraron proveedores que coincidan con la búsqueda.' : 'Aun no hay proveedores.'}</li>}
                            {paginatedProviders.map(p => (
                                <li key={p.code} className="flex items-center justify-between bg-[var(--muted)] p-3 rounded">
                                    <div>
                                        <div className="text-[var(--foreground)] font-semibold">{p.name}</div>
                                        <div className="text-xs text-[var(--muted-foreground)]">Código: {p.code}</div>
                                        {p.type && (
                                            <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                                Tipo: {p.type}
                                                {p.category && <span className="ml-2 px-2 py-0.5 rounded bg-[var(--input-bg)] text-[10px]">
                                                    {p.category}
                                                </span>}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <div className="text-xs text-[var(--muted-foreground)]">Empresa: {p.company}</div>
                                        <button
                                            type="button"
                                            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] disabled:opacity-50"
                                            onClick={() => openEditProvider(p.code)}
                                            disabled={saving || deletingCode !== null}
                                            title="Editar proveedor"
                                        >
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            className="text-red-500 hover:text-red-600 disabled:opacity-50"
                                            onClick={() => openRemoveModal(p.code, p.name)}
                                            disabled={deletingCode === p.code || saving || deletingCode !== null}
                                            title="Eliminar proveedor"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
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
                message={`Quieres eliminar el proveedor "${confirmState.name || confirmState.code}"? Esta accion no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                actionType="delete"
                loading={deletingCode !== null && deletingCode === confirmState.code}
                onConfirm={confirmRemoveProvider}
                onCancel={cancelRemoveModal}
            />

            <Drawer
                anchor="right"
                open={providerDrawerOpen}
                onClose={() => {
                    setProviderDrawerOpen(false);
                    setFormError(null);
                    setProviderName('');
                    setProviderType('');
                    setEditingProviderCode(null);
                }}
                PaperProps={{
                    sx: {
                        width: { xs: '100vw', sm: 460 },
                        maxWidth: '100vw',
                        bgcolor: '#1f262a',
                        color: '#ffffff',
                    },
                }}
            >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 3, py: 2 }}>
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                            {editingProviderCode ? 'Editar proveedor' : 'Agregar proveedor'}
                        </Typography>
                        <IconButton
                            aria-label="Cerrar"
                            onClick={() => {
                                setProviderDrawerOpen(false);
                                setFormError(null);
                                setProviderName('');
                                setProviderType('');
                                setEditingProviderCode(null);
                            }}
                            sx={{ color: 'var(--foreground)' }}
                        >
                            <X className="w-4 h-4" />
                        </IconButton>
                    </Box>
                    <Divider sx={{ borderColor: 'var(--input-border)' }} />
                    <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 3 }}>
                        {company && (
                            <p className="text-xs text-[var(--muted-foreground)] mb-3">
                                Empresa asignada: <span className="font-medium text-[var(--foreground)]">{company}</span>
                            </p>
                        )}
                        {resolvedError && <div className="mb-4 text-sm text-red-500">{resolvedError}</div>}

                        <div className="flex flex-col gap-3">
                            <input
                                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                                placeholder="Nombre del proveedor"
                                value={providerName}
                                onChange={e => setProviderName(e.target.value.toUpperCase())}
                                disabled={!company || saving || deletingCode !== null}
                                autoFocus
                            />
                            <select
                                value={providerType}
                                onChange={e => setProviderType(e.target.value as FondoMovementType | '')}
                                className="w-full p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                                disabled={!company || saving}
                            >
                                <option value="">Seleccione un tipo</option>
                                <optgroup label="Ingresos">
                                    {FONDO_INGRESO_TYPES.map(opt => (
                                        <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Gastos">
                                    {FONDO_GASTO_TYPES.map(opt => (
                                        <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                                    ))}
                                </optgroup>
                                <optgroup label="Egresos">
                                    {FONDO_EGRESO_TYPES.map(opt => (
                                        <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setProviderDrawerOpen(false);
                                    setFormError(null);
                                    setProviderName('');
                                    setProviderType('');
                                    setEditingProviderCode(null);
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
                                    if (!name) {
                                        setFormError('Nombre requerido.');
                                        return;
                                    }
                                    if (!company) {
                                        setFormError('Tu usuario no tiene una empresa asignada.');
                                        return;
                                    }
                                    try {
                                        setSaving(true);
                                        setFormError(null);
                                        if (editingProviderCode) {
                                            // Actualizar proveedor existente
                                            await updateProvider(editingProviderCode, name, providerType || undefined);
                                        } else {
                                            // Crear nuevo proveedor
                                            if (providers.some(p => p.name.toUpperCase() === name)) {
                                                setFormError(`El proveedor "${name}" ya existe.`);
                                                setSaving(false);
                                                return;
                                            }
                                            await addProvider(name, providerType || undefined);
                                        }
                                        setProviderName('');
                                        setProviderType('');
                                        setEditingProviderCode(null);
                                        setProviderDrawerOpen(false);
                                    } catch (err) {
                                        const message = err instanceof Error ? err.message : 'No se pudo guardar el proveedor.';
                                        setFormError(message);
                                    } finally {
                                        setSaving(false);
                                    }
                                }}
                                className="px-4 py-2 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                                disabled={!company || saving || deletingCode !== null}
                            >
                                {saving ? (editingProviderCode ? 'Actualizando...' : 'Guardando...') : (editingProviderCode ? 'Actualizar' : 'Guardar')}
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
    mode = 'all',
    namespace = 'fg',
    companySelectorPlacement = 'content',
    onCompanySelectorChange,
}: {
    id?: string;
    mode?: 'all' | 'ingreso' | 'egreso';
    namespace?: string;
    companySelectorPlacement?: 'content' | 'external';
    onCompanySelectorChange?: (node: React.ReactNode | null) => void;
}) {
    const { user, loading: authLoading } = useAuth();
    const assignedCompany = user?.ownercompanie?.trim() ?? '';
    const { ownerIds: actorOwnerIds, primaryOwnerId } = useActorOwnership(user);
    const allowedOwnerIds = useMemo(() => {
        const set = new Set<string>();
        actorOwnerIds.forEach(id => {
            const normalized = typeof id === 'string' ? id.trim() : String(id || '').trim();
            if (normalized) set.add(normalized);
        });
        if (user?.ownerId) {
            const normalized = String(user.ownerId).trim();
            if (normalized) set.add(normalized);
        }
        return set;
    }, [actorOwnerIds, user?.ownerId]);
    const resolvedOwnerId = useMemo(() => {
        const normalizedPrimary = (primaryOwnerId || '').trim();
        if (normalizedPrimary) return normalizedPrimary;
        const [firstAllowed] = Array.from(allowedOwnerIds);
        if (firstAllowed) return firstAllowed;
        return '';
    }, [allowedOwnerIds, primaryOwnerId]);
    const isAdminUser = user?.role === 'admin';
    const [adminCompany, setAdminCompany] = useState(assignedCompany);
    useEffect(() => {
        setAdminCompany(assignedCompany);
    }, [assignedCompany]);
    const company = isAdminUser ? adminCompany : assignedCompany;
    const { providers, loading: providersLoading, error: providersError } = useProviders(company);
    const { sendEmail } = useEmail();
    const { showToast } = useToast();
    const [ownerAdminEmail, setOwnerAdminEmail] = useState<string | null>(null);
    const [ownerCompanies, setOwnerCompanies] = useState<Empresas[]>([]);
    const [ownerCompaniesLoading, setOwnerCompaniesLoading] = useState(false);
    const [ownerCompaniesError, setOwnerCompaniesError] = useState<string | null>(null);

    const sortedOwnerCompanies = useMemo(() => {
        return ownerCompanies
            .slice()
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' }));
    }, [ownerCompanies]);

    useEffect(() => {
        if (!isAdminUser) {
            setOwnerCompanies([]);
            setOwnerCompaniesLoading(false);
            setOwnerCompaniesError(null);
            return;
        }
        if (allowedOwnerIds.size === 0) {
            setOwnerCompanies([]);
            setOwnerCompaniesLoading(false);
            setOwnerCompaniesError('No se pudo determinar el ownerId asociado a tu cuenta.');
            return;
        }

        let isMounted = true;
        setOwnerCompaniesLoading(true);
        setOwnerCompaniesError(null);

        EmpresasService.getAllEmpresas()
            .then(empresas => {
                if (!isMounted) return;
                const filtered = empresas.filter(emp => {
                    const owner = (emp.ownerId || '').trim();
                    if (!owner) return false;
                    return allowedOwnerIds.has(owner);
                });
                setOwnerCompanies(filtered);
                setAdminCompany(current => {
                    const normalizedCurrent = (current || '').trim().toLowerCase();
                    if (normalizedCurrent.length > 0) {
                        const exists = filtered.some(emp => (emp.name || '').trim().toLowerCase() === normalizedCurrent);
                        if (exists) return current;
                    }
                    return filtered[0]?.name ?? '';
                });
            })
            .catch(err => {
                if (!isMounted) return;
                setOwnerCompanies([]);
                setOwnerCompaniesError(err instanceof Error ? err.message : 'No se pudieron cargar las empresas disponibles.');
            })
            .finally(() => {
                if (isMounted) setOwnerCompaniesLoading(false);
            });

        return () => {
            isMounted = false;
        };
    }, [allowedOwnerIds, isAdminUser]);

    const activeOwnerId = useMemo(() => {
        if (isAdminUser) {
            const normalizedCompany = (adminCompany || '').trim().toLowerCase();
            if (normalizedCompany.length > 0) {
                const match = ownerCompanies.find(emp => (emp.name || '').trim().toLowerCase() === normalizedCompany);
                const ownerId = typeof match?.ownerId === 'string' ? match.ownerId.trim() : '';
                if (ownerId) return ownerId;
            }
            const fallbackAdminOwner = typeof ownerCompanies[0]?.ownerId === 'string' ? ownerCompanies[0].ownerId.trim() : '';
            if (fallbackAdminOwner) return fallbackAdminOwner;
        }
        return resolvedOwnerId;
    }, [adminCompany, isAdminUser, ownerCompanies, resolvedOwnerId]);

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
                const email = typeof admin?.email === 'string' ? admin.email.trim() : '';
                setOwnerAdminEmail(email.length > 0 ? email : null);
            } catch (error) {
                if (cancelled) return;
                console.error('Error loading owner admin email for daily closing notifications:', error);
                setOwnerAdminEmail(null);
            }
        };

        void loadAdminEmail();

        return () => {
            cancelled = true;
        };
    }, [activeOwnerId]);
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);
    const requiredPermissionKey = NAMESPACE_PERMISSIONS[namespace] || 'fondogeneral';
    const hasSpecificAccess = Boolean(permissions[requiredPermissionKey]);
    const canAccessSection = namespace === 'fg' ? hasGeneralAccess : (hasGeneralAccess && hasSpecificAccess);
    const namespaceDescription = NAMESPACE_DESCRIPTIONS[namespace] || 'esta sección del Fondo General';
    const accountKey = useMemo(() => getAccountKeyFromNamespace(namespace), [namespace]);

    const [fondoEntries, setFondoEntries] = useState<FondoEntry[]>([]);
    const [companyEmployees, setCompanyEmployees] = useState<string[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);

    const [selectedProvider, setSelectedProvider] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const defaultPaymentType: FondoEntry['paymentType'] =
        mode === 'ingreso' ? FONDO_INGRESO_TYPES[0] : mode === 'egreso' ? FONDO_EGRESO_TYPES[0] : 'COMPRA INVENTARIO';
    const [paymentType, setPaymentType] = useState<FondoEntry['paymentType']>(defaultPaymentType);
    const [egreso, setEgreso] = useState('');
    const [ingreso, setIngreso] = useState('');
    const [manager, setManager] = useState('');
    const [notes, setNotes] = useState('');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [initialAmount, setInitialAmount] = useState('0');
    const [initialAmountUSD, setInitialAmountUSD] = useState('0');
    const [movementModalOpen, setMovementModalOpen] = useState(false);
    const [movementAutoCloseLocked, setMovementAutoCloseLocked] = useState(false);
    const [movementCurrency, setMovementCurrency] = useState<'CRC' | 'USD'>('CRC');
    const [dailyClosingModalOpen, setDailyClosingModalOpen] = useState(false);
    const [editingDailyClosingId, setEditingDailyClosingId] = useState<string | null>(null);
    const [dailyClosingInitialValues, setDailyClosingInitialValues] = useState<DailyClosingFormValues | null>(null);
    const [dailyClosings, setDailyClosings] = useState<DailyClosingRecord[]>([]);
    const [dailyClosingsHydrated, setDailyClosingsHydrated] = useState(false);
    const [dailyClosingsRefreshing, setDailyClosingsRefreshing] = useState(false);
    const [dailyClosingHistoryOpen, setDailyClosingHistoryOpen] = useState(false);
    const [expandedClosings, setExpandedClosings] = useState<Set<string>>(new Set());
    const dailyClosingsRequestCountRef = useRef(0);
    const isComponentMountedRef = useRef(true);
    const loadedDailyClosingKeysRef = useRef<Set<string>>(new Set());
    const loadingDailyClosingKeysRef = useRef<Set<string>>(new Set());

    const [pageSize, setPageSize] = useState<'daily' | number | 'all'>(() => {
        if (typeof window !== 'undefined') {
            try {
                const remember = localStorage.getItem('fondogeneral-rememberFilters');
                if (remember === 'true') {
                    const saved = localStorage.getItem('fondogeneral-pageSize');
                    if (saved === null) return 'daily';
                    if (saved === 'daily' || saved === 'all') return saved as any;
                    const n = Number.parseInt(saved, 10);
                    if (!Number.isNaN(n) && n > 0) return n;
                }
            } catch {
                // ignore storage errors
            }
        }
        return 'daily';
    });
    const [pageIndex, setPageIndex] = useState(0);
    const [currentDailyKey, setCurrentDailyKey] = useState(() => dateKeyFromDate(new Date()));
    const todayKey = useMemo(() => dateKeyFromDate(new Date()), []);

    const beginDailyClosingsRequest = useCallback(() => {
        dailyClosingsRequestCountRef.current += 1;
        setDailyClosingsRefreshing(true);
    }, []);

    const finishDailyClosingsRequest = useCallback(() => {
        dailyClosingsRequestCountRef.current = Math.max(0, dailyClosingsRequestCountRef.current - 1);
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
    const [hydratedCompany, setHydratedCompany] = useState('');
    const [hydratedAccountKey, setHydratedAccountKey] = useState<MovementAccountKey>(accountKey);
    const [currencyEnabled, setCurrencyEnabled] = useState<Record<MovementCurrencyKey, boolean>>({
        CRC: true,
        USD: true,
    });
    const [companyData, setCompanyData] = useState<Empresas | null>(null);
    const [confirmDeleteEntry, setConfirmDeleteEntry] = useState<{ open: boolean; entry: FondoEntry | null }>({
        open: false,
        entry: null
    });
    const enabledBalanceCurrencies = useMemo(
        () => (['CRC', 'USD'] as MovementCurrencyKey[]).filter(currency => currencyEnabled[currency]),
        [currencyEnabled],
    );
    const closingsStorageKey = useMemo(() => {
        if (accountKey !== 'FondoGeneral') return null;
        const normalizedCompany = (company || '').trim();
        if (normalizedCompany.length === 0) return null;
        return buildDailyClosingStorageKey(normalizedCompany, accountKey);
    }, [company, accountKey]);
    // Audit modal state: show full before/after history when an edited entry is clicked
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditModalData, setAuditModalData] = useState<{ history?: any[] } | null>(null);
    // sortAsc: when true we show oldest first (so newest appears at the bottom).
    // Default true per UX: the most recent movement should appear below.
    const [sortAsc, setSortAsc] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-sortAsc');
            return saved !== null ? JSON.parse(saved) : true;
        }
        return true;
    });
    const storageSnapshotRef = useRef<MovementStorage<FondoEntry> | null>(null);

    useEffect(() => {
        localStorage.setItem('fondogeneral-sortAsc', JSON.stringify(sortAsc));
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
    // fromFilter / toFilter hold YYYY-MM-DD keys when a date is selected
    const [fromFilter, setFromFilter] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-fromFilter');
            return saved !== null ? saved : null;
        }
        return null;
    });
    const [toFilter, setToFilter] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-toFilter');
            return saved !== null ? saved : null;
        }
        return null;
    });

    // Advanced filters
    const [filterProviderCode, setFilterProviderCode] = useState<string | 'all'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-filterProviderCode');
            return saved !== null ? saved : 'all';
        }
        return 'all';
    });
    const initialFilterPaymentType: FondoEntry['paymentType'] | 'all' =
        mode === 'all' ? 'all' : mode === 'ingreso' ? FONDO_INGRESO_TYPES[0] : FONDO_EGRESO_TYPES[0];
    const [filterPaymentType, setFilterPaymentType] = useState<FondoEntry['paymentType'] | 'all'>(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-filterPaymentType');
            return saved !== null ? (saved as FondoEntry['paymentType'] | 'all') : initialFilterPaymentType;
        }
        return initialFilterPaymentType;
    });
    const [filterEditedOnly, setFilterEditedOnly] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-filterEditedOnly');
            return saved !== null ? JSON.parse(saved) : false;
        }
        return false;
    });
    const [searchQuery, setSearchQuery] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-searchQuery');
            return saved !== null ? saved : '';
        }
        return '';
    });
    const [rememberFilters, setRememberFilters] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('fondogeneral-rememberFilters');
            return saved !== null ? JSON.parse(saved) : false;
        }
        return false;
    });

    const applyLedgerStateFromStorage = useCallback(
        (state?: MovementStorageState | null) => {
            if (!state) return;

            const parseBalance = (value: unknown) => {
                const parsed = typeof value === 'number' ? value : Number(value);
                return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
            };

            const resolveSettings = (currency: MovementCurrencyKey) => {
                const accountBalance = state.balancesByAccount?.find(
                    balance => balance.accountId === accountKey && balance.currency === currency,
                );
                return {
                    enabled: accountBalance?.enabled ?? true,
                    initialBalance: parseBalance(accountBalance?.initialBalance ?? 0),
                    currentBalance: parseBalance(accountBalance?.currentBalance ?? 0),
                };
            };

            const crcSettings = resolveSettings('CRC');
            const usdSettings = resolveSettings('USD');

            setCurrencyEnabled({
                CRC: crcSettings.enabled,
                USD: usdSettings.enabled,
            });

            setInitialAmount(crcSettings.initialBalance.toString());
            setInitialAmountUSD(usdSettings.initialBalance.toString());
        },
        [accountKey],
    );

    // Column widths for resizable columns (simple px based)
    const [columnWidths, setColumnWidths] = useState<Record<string, string>>({
        hora: '140px',
        motivo: '260px',
        tipo: '160px',
        factura: '90px',
        monto: '180px',
        encargado: '140px',
        editar: '120px',
    });
    const resizingRef = React.useRef<{ key: string; startX: number; startWidth: number } | null>(null);
    // refs to detect outside clicks for the from/to calendar popovers
    const fromCalendarRef = React.useRef<HTMLDivElement | null>(null);
    const toCalendarRef = React.useRef<HTMLDivElement | null>(null);
    const fromButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const toButtonRef = React.useRef<HTMLButtonElement | null>(null);

    const startResizing = (event: React.MouseEvent, key: string) => {
        event.preventDefault();
        const startWidth = parseInt(columnWidths[key] || '100', 10) || 100;
        resizingRef.current = { key, startX: event.clientX, startWidth };
    };

    // Save rememberFilters. If disabled, clear saved filters from storage.
    useEffect(() => {
        localStorage.setItem('fondogeneral-rememberFilters', JSON.stringify(rememberFilters));
        if (!rememberFilters && typeof window !== 'undefined') {
            try {
                const keysToClear = [
                    'fondogeneral-fromFilter',
                    'fondogeneral-toFilter',
                    'fondogeneral-filterProviderCode',
                    'fondogeneral-filterPaymentType',
                    'fondogeneral-filterEditedOnly',
                    'fondogeneral-searchQuery',
                    'fondogeneral-pageSize',
                ];
                for (const k of keysToClear) localStorage.removeItem(k);
            } catch {
                // ignore storage errors
            }
        }
    }, [rememberFilters]);

    // Save filters if rememberFilters is true
    useEffect(() => {
        if (rememberFilters) {
            localStorage.setItem('fondogeneral-fromFilter', fromFilter || '');
            localStorage.setItem('fondogeneral-toFilter', toFilter || '');
            localStorage.setItem('fondogeneral-filterProviderCode', filterProviderCode);
            localStorage.setItem('fondogeneral-filterPaymentType', filterPaymentType);
            localStorage.setItem('fondogeneral-filterEditedOnly', JSON.stringify(filterEditedOnly));
            localStorage.setItem('fondogeneral-searchQuery', searchQuery);
            localStorage.setItem('fondogeneral-pageSize', String(pageSize));
        }
    }, [rememberFilters, fromFilter, toFilter, filterProviderCode, filterPaymentType, filterEditedOnly, searchQuery, pageSize]);

    // When rememberFilters is enabled, load pageSize from storage (if present)
    useEffect(() => {
        if (!rememberFilters) return;
        if (typeof window === 'undefined') return;
        const saved = localStorage.getItem('fondogeneral-pageSize');
        if (saved === null) return;
        if (saved === 'daily' || saved === 'all') {
            setPageSize(saved as any);
            return;
        }
        const n = Number.parseInt(saved, 10);
        if (!Number.isNaN(n) && n > 0) setPageSize(n);
    }, [rememberFilters]);

    useEffect(() => {
        setCurrencyEnabled({ CRC: true, USD: true });
        setMovementCurrency('CRC');
        setInitialAmount('0');
        setInitialAmountUSD('0');
        storageSnapshotRef.current = null;
    }, [company, accountKey]);

    useEffect(() => {
        if (currencyEnabled[movementCurrency]) return;
        if (currencyEnabled.CRC) {
            setMovementCurrency('CRC');
            return;
        }
        if (currencyEnabled.USD) {
            setMovementCurrency('USD');
        }
    }, [currencyEnabled, movementCurrency]);

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            const r = resizingRef.current;
            if (!r) return;
            const delta = e.clientX - r.startX;
            const newW = Math.max(40, r.startWidth + delta);
            setColumnWidths(prev => ({ ...prev, [r.key]: `${newW}px` }));
        };
        const onUp = () => {
            resizingRef.current = null;
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [columnWidths]);

    // Close calendars when clicking outside them (but don't close when clicking the toggle buttons)
    useEffect(() => {
        if (!calendarFromOpen && !calendarToOpen) return;

        const handler = (e: MouseEvent) => {
            const target = e.target as Node | null;
            if (calendarFromOpen) {
                if (fromCalendarRef.current && target && fromCalendarRef.current.contains(target)) return;
                if (fromButtonRef.current && target && fromButtonRef.current.contains(target)) return;
                setCalendarFromOpen(false);
            }
            if (calendarToOpen) {
                if (toCalendarRef.current && target && toCalendarRef.current.contains(target)) return;
                if (toButtonRef.current && target && toButtonRef.current.contains(target)) return;
                setCalendarToOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [calendarFromOpen, calendarToOpen]);

    const isIngreso = isIngresoType(paymentType);
    const isEgreso = isEgresoType(paymentType) || isGastoType(paymentType);

    const employeeOptions = useMemo(() => {
        const employees = companyEmployees.filter(name => !!name && name.trim().length > 0);

        // Si el usuario actual es admin, agregarlo a la lista de empleados
        if (user?.role === 'admin' && user?.name) {
            const adminName = user.name.trim();
            if (!employees.includes(adminName)) {
                return [adminName, ...employees];
            }
        }

        return employees;
    }, [companyEmployees, user]);

    const editingEntry = useMemo(
        () => (editingEntryId ? fondoEntries.find(entry => entry.id === editingEntryId) ?? null : null),
        [editingEntryId, fondoEntries],
    );
    const editingProviderCode = editingEntry?.providerCode ?? null;

    useEffect(() => {
        const normalizedCompany = (company || '').trim();
        const normalizedCompanyLower = normalizedCompany.toLowerCase();
        if (normalizedCompany.length === 0) {
            setFondoEntries([]);
            setEntriesHydrated(true);
            setHydratedCompany('');
            setHydratedAccountKey(accountKey);
            storageSnapshotRef.current = null;
            return;
        }

        setEntriesHydrated(false);
        setHydratedCompany('');
        setFondoEntries([]);
        storageSnapshotRef.current = null;
        let isMounted = true;

        const matchesSelectedCompany = (storage?: MovementStorage<FondoEntry> | null) => {
            if (!storage) return false;
            const storedCompany = (storage.company || '').trim();
            if (storedCompany.length === 0) return true;
            return storedCompany.toLowerCase() === normalizedCompanyLower;
        };

        const loadEntries = async () => {
            try {
                const legacyOwnerKey = resolvedOwnerId
                    ? MovimientosFondosService.buildLegacyOwnerMovementsKey(resolvedOwnerId)
                    : null;
                const parseTime = (value: string) => {
                    const timestamp = Date.parse(value);
                    return Number.isNaN(timestamp) ? 0 : timestamp;
                };

                type StorageEntriesResult = {
                    entries: FondoEntry[];
                    storage: MovementStorage<FondoEntry>;
                };

                const buildEntriesFromStorage = (rawStorage: unknown): StorageEntriesResult | null => {
                    if (!rawStorage) return null;
                    try {
                        const storage = MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
                            rawStorage,
                            normalizedCompany,
                        );
                        const movements = storage.operations?.movements ?? [];
                        const scopedEntries = movements.filter(rawEntry => {
                            const candidate = rawEntry as Partial<FondoEntry>;
                            const movementAccount = isMovementAccountKey(candidate.accountId)
                                ? candidate.accountId
                                : accountKey;
                            return movementAccount === accountKey;
                        });
                        const entries = sanitizeFondoEntries(scopedEntries, undefined, accountKey).sort(
                            (a, b) => parseTime(b.createdAt) - parseTime(a.createdAt),
                        );
                        return { entries, storage };
                    } catch (err) {
                        console.error('Error parsing stored fondo entries:', err);
                        return null;
                    }
                };

                const buildEntriesFromRaw = (rawData: string | null): StorageEntriesResult | null => {
                    if (!rawData) return null;
                    try {
                        const parsed = JSON.parse(rawData);
                        return buildEntriesFromStorage(parsed);
                    } catch (err) {
                        console.error('Error parsing stored fondo entries:', err);
                        return null;
                    }
                };

                const loadRemoteEntries = async (
                    docKey: string,
                ): Promise<{ result: StorageEntriesResult | null; status: 'success' | 'not-found' | 'error' }> => {
                    if (!docKey) return { result: null, status: 'error' };
                    try {
                        const remoteStorage = await MovimientosFondosService.getDocument<FondoEntry>(docKey);
                        if (!remoteStorage) {
                            return { result: null, status: 'not-found' };
                        }
                        return { result: buildEntriesFromStorage(remoteStorage), status: 'success' };
                    } catch (err) {
                        console.error(`Error reading fondo entries from Firestore (${docKey}):`, err);
                        return { result: null, status: 'error' };
                    }
                };

                const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
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
                    storageSnapshotRef.current = result.storage;
                    hasResolvedSource = true;
                    return true;
                };

                const tryRemoteKey = async (docKey: string | null) => {
                    if (!docKey || hasResolvedSource) return;
                    const { result, status } = await loadRemoteEntries(docKey);
                    if (status === 'error') {
                        remoteAnyError = true;
                        return;
                    }
                    if (status === 'not-found') {
                        remoteConfirmedNotFound = true;
                        return;
                    }
                    if (status === 'success' && result) {
                        assignResult(result);
                    }
                };

                await tryRemoteKey(companyKey);

                if (!hasResolvedSource && legacyOwnerKey && legacyOwnerKey !== companyKey) {
                    await tryRemoteKey(legacyOwnerKey);
                }

                if (!hasResolvedSource && remoteConfirmedNotFound && !remoteAnyError) {
                    const emptyStorage = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(normalizedCompany);
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

                if (!hasResolvedSource && legacyOwnerKey && legacyOwnerKey !== companyKey) {
                    assignResult(buildEntriesFromRaw(localStorage.getItem(legacyOwnerKey)));
                }

                if (!hasResolvedSource) {
                    const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
                    const legacyRaw = localStorage.getItem(legacyKey);
                    if (legacyRaw) {
                        try {
                            const legacyParsed = JSON.parse(legacyRaw);
                            const parsedEntries = sanitizeFondoEntries(legacyParsed, undefined, accountKey);
                            if (parsedEntries.length > 0) {
                                resolvedEntries = parsedEntries;
                                const fallbackStorage = MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(
                                    normalizedCompany,
                                );
                                fallbackStorage.operations.movements = parsedEntries.map(entry => ({
                                    ...entry,
                                    accountId: accountKey,
                                }));
                                storageSnapshotRef.current = fallbackStorage;
                            }
                        } catch (err) {
                            console.error('Error parsing legacy fondo entries:', err);
                        }
                    }
                }

                if (isMounted) {
                    setFondoEntries(resolvedEntries ?? []);
                    if (resolvedState) {
                        console.log('[LOCK-DEBUG] Loading state with lockedUntil:', resolvedState.lockedUntil);
                        applyLedgerStateFromStorage(resolvedState);
                    }
                }
            } catch (err) {
                console.error('Error reading fondo entries:', err);
                if (isMounted) {
                    setFondoEntries([]);
                }
            } finally {
                if (isMounted) {
                    setHydratedCompany(normalizedCompany);
                    setHydratedAccountKey(accountKey);
                    setEntriesHydrated(true);
                }
            }
        };

        void loadEntries();

        return () => {
            isMounted = false;
        };
    }, [namespace, resolvedOwnerId, company, applyLedgerStateFromStorage, accountKey]);

    useEffect(() => {
        if (!selectedProvider) return;
        const exists = providers.some(p => p.code === selectedProvider);
        const isEditingSameProvider = editingEntryId && editingProviderCode === selectedProvider;
        if (!exists && !isEditingSameProvider) {
            setSelectedProvider('');
        }
    }, [providers, selectedProvider, editingEntryId, editingProviderCode]);

    useEffect(() => {
        loadedDailyClosingKeysRef.current = new Set();
        loadingDailyClosingKeysRef.current = new Set();
        dailyClosingsRequestCountRef.current = 0;
        setDailyClosingsRefreshing(false);
        setDailyClosingsHydrated(false);
        setDailyClosings([]);

        if (accountKey !== 'FondoGeneral') {
            setDailyClosingsHydrated(true);
            return;
        }

        const normalizedCompany = (company || '').trim();
        if (normalizedCompany.length === 0) {
            setDailyClosingsHydrated(true);
            return;
        }

        let isActive = true;
        beginDailyClosingsRequest();

        const loadClosings = async () => {
            try {
                const document = await DailyClosingsService.getDocument(normalizedCompany);
                if (!isActive) return;
                if (document) {
                    const { records, loadedKeys } = flattenDailyClosingsDocument(document);
                    setDailyClosings(records);
                    loadedDailyClosingKeysRef.current = loadedKeys;
                    return;
                }

                if (!closingsStorageKey) {
                    setDailyClosings([]);
                    return;
                }

                const stored = localStorage.getItem(closingsStorageKey);
                if (!stored) {
                    setDailyClosings([]);
                    return;
                }
                const parsed = JSON.parse(stored) as unknown;
                setDailyClosings(sanitizeDailyClosings(parsed));
            } catch (err) {
                console.error('Error reading daily closings from Firestore:', err);
                if (!isActive) return;

                if (closingsStorageKey) {
                    try {
                        const stored = localStorage.getItem(closingsStorageKey);
                        if (stored) {
                            const parsed = JSON.parse(stored) as unknown;
                            setDailyClosings(sanitizeDailyClosings(parsed));
                            return;
                        }
                    } catch (storageErr) {
                        console.error('Error reading stored daily closings:', storageErr);
                    }
                }
                setDailyClosings([]);
            } finally {
                if (isActive) {
                    setDailyClosingsHydrated(true);
                }
                finishDailyClosingsRequest();
            }
        };

        void loadClosings();

        return () => {
            isActive = false;
        };
    }, [company, accountKey, closingsStorageKey, beginDailyClosingsRequest, finishDailyClosingsRequest]);

    useEffect(() => {
        if (!dailyClosingsHydrated || !closingsStorageKey || accountKey !== 'FondoGeneral') return;
        try {
            localStorage.setItem(closingsStorageKey, JSON.stringify(dailyClosings));
        } catch (err) {
            console.error('Error storing daily closings:', err);
        }
    }, [closingsStorageKey, dailyClosings, accountKey, dailyClosingsHydrated]);

    useEffect(() => {
        if (accountKey !== 'FondoGeneral') return;
        if (!dailyClosingsHydrated) return;
        const normalizedCompany = (company || '').trim();
        if (normalizedCompany.length === 0) return;
        const targetKey = currentDailyKey;
        if (!targetKey) return;
        if (loadedDailyClosingKeysRef.current.has(targetKey)) return;
        if (loadingDailyClosingKeysRef.current.has(targetKey)) return;

        let isActive = true;
        let shouldMarkLoaded = false;
        loadingDailyClosingKeysRef.current.add(targetKey);
        beginDailyClosingsRequest();

        const loadByDay = async () => {
            try {
                const records = await DailyClosingsService.getClosingsForDate(normalizedCompany, targetKey);
                if (!isActive) return;
                if (records.length > 0) {
                    setDailyClosings(prev => mergeDailyClosingRecords(prev, records));
                }
                shouldMarkLoaded = true;
            } catch (err) {
                console.error('Error loading daily closings for selected day:', err);
            } finally {
                loadingDailyClosingKeysRef.current.delete(targetKey);
                if (isActive && shouldMarkLoaded) {
                    loadedDailyClosingKeysRef.current.add(targetKey);
                }
                finishDailyClosingsRequest();
            }
        };

        void loadByDay();

        return () => {
            isActive = false;
        };
    }, [accountKey, company, currentDailyKey, dailyClosingsHydrated, beginDailyClosingsRequest, finishDailyClosingsRequest]);

    useEffect(() => {
        let isActive = true;
        setCompanyEmployees([]);

        if (!company) {
            setEmployeesLoading(false);
            return () => {
                isActive = false;
            };
        }

        // Solo cargar empleados de la empresa si estamos en fondogeneral (namespace 'fg')
        // Para otros fondos (BCR, BN, BAC), no cargar empleados
        if (namespace !== 'fg') {
            setEmployeesLoading(false);
            return () => {
                isActive = false;
            };
        }

        setEmployeesLoading(true);
        EmpresasService.getAllEmpresas()
            .then(empresas => {
                if (!isActive) return;
                const match = empresas.find(emp => emp.name?.toLowerCase() === company.toLowerCase());
                const names = match?.empleados?.map(emp => emp.Empleado).filter(Boolean) ?? [];
                setCompanyEmployees(names as string[]);
            })
            .catch(err => {
                console.error('Error loading company employees:', err);
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
            .then(empresas => {
                if (!isActive) return;
                const match = empresas.find(emp => emp.name?.toLowerCase() === company.toLowerCase());
                if (match) {
                    setCompanyData(match);
                }
            })
            .catch(err => {
                console.error('Error loading company data:', err);
                if (isActive) setCompanyData(null);
            });

        return () => {
            isActive = false;
        };
    }, [company]);

    useEffect(() => {
        if (manager && !employeeOptions.includes(manager)) {
            setManager('');
        }
    }, [manager, employeeOptions]);

    useEffect(() => {
        if (isIngreso) {
            setEgreso('');
        } else {
            setIngreso('');
        }
    }, [paymentType, isIngreso]);

    const resetFondoForm = useCallback(() => {
        setInvoiceNumber('');
        setEgreso('');
        setIngreso('');
        setManager('');
        setPaymentType('COMPRA INVENTARIO');
        setNotes('');
        setEditingEntryId(null);
    }, []);

    const normalizeMoneyInput = (value: string) => value.replace(/[^0-9]/g, '');

    const handleSubmitFondo = () => {
        if (!company) return;
        if (!selectedProvider) return;
        const providerExists = selectedProviderExists;
        if (!providerExists && !(editingEntryId && editingEntry?.providerCode === selectedProvider)) return;
        if (!/^[0-9]{1,4}$/.test(invoiceNumber)) return;
        if (!manager) return;

        const egresoValue = isEgreso ? Number.parseInt(egreso, 10) : 0;
        const ingresoValue = isIngreso ? Number.parseInt(ingreso, 10) : 0;
        const trimmedNotes = notes.trim();

        if (isEgreso && (Number.isNaN(egresoValue) || egresoValue <= 0)) return;
        if (isIngreso && (Number.isNaN(ingresoValue) || ingresoValue <= 0)) return;

        const paddedInvoice = invoiceNumber.padStart(4, '0');

        if (editingEntryId) {
            // Update the existing entry in-place so balances remain correct.
            const original = fondoEntries.find(e => e.id === editingEntryId);
            if (!original) return;

            const changes: string[] = [];
            if (selectedProvider !== original.providerCode) changes.push(`Proveedor: ${original.providerCode} → ${selectedProvider}`);
            if (paddedInvoice !== original.invoiceNumber) changes.push(`N° factura: ${original.invoiceNumber} → ${paddedInvoice}`);
            if (paymentType !== original.paymentType) changes.push(`Tipo: ${original.paymentType} → ${paymentType}`);
            const originalAmount = isEgresoType(original.paymentType) ? original.amountEgreso : original.amountIngreso;
            const newAmount = isEgreso ? egresoValue : ingresoValue;
            if (Number.isFinite(originalAmount) && originalAmount !== newAmount) changes.push(`Monto: ${originalAmount} → ${newAmount}`);
            if (manager !== original.manager) changes.push(`Encargado: ${original.manager} → ${manager}`);
            if (trimmedNotes !== (original.notes ?? '')) changes.push(`Notas: "${original.notes}" → "${trimmedNotes}"`);

            setFondoEntries(prev => {
                const next = prev.map(e => {
                    if (e.id !== editingEntryId) return e;
                    // append to existing history if present
                    let history: any[] = [];
                    try {
                        const existing = e.auditDetails ? JSON.parse(e.auditDetails) as any : null;
                        if (existing && Array.isArray(existing.history)) history = existing.history.slice();
                        else if (existing && existing.before && existing.after) history = [{ at: existing.at ?? e.createdAt, before: existing.before, after: existing.after }];
                    } catch {
                        history = [];
                    }

                    // Validar límite máximo de ediciones
                    if (history.length >= MAX_AUDIT_EDITS) {
                        showToast(`No se pueden realizar más de ${MAX_AUDIT_EDITS} ediciones en un mismo movimiento`, 'error');
                        return e; // No permitir más ediciones
                    }

                    // Crear registro simplificado con solo los campos que cambiaron
                    const changedFields = getChangedFields(
                        { providerCode: e.providerCode, invoiceNumber: e.invoiceNumber, paymentType: e.paymentType, amountEgreso: e.amountEgreso, amountIngreso: e.amountIngreso, manager: e.manager, notes: e.notes, currency: e.currency },
                        { providerCode: selectedProvider, invoiceNumber: paddedInvoice, paymentType, amountEgreso: isEgreso ? egresoValue : 0, amountIngreso: isEgreso ? 0 : ingresoValue, manager, notes: trimmedNotes, currency: movementCurrency }
                    );
                    const newRecord = { at: new Date().toISOString(), ...changedFields };
                    history.push(newRecord);
                    // Comprimir historial para evitar QuotaExceededError
                    const compressedHistory = compressAuditHistory(history);
                    // keep original createdAt so chronological order and balances are preserved
                    return {
                        ...e,
                        providerCode: selectedProvider,
                        invoiceNumber: paddedInvoice,
                        paymentType,
                        amountEgreso: isEgreso ? egresoValue : 0,
                        amountIngreso: isEgreso ? 0 : ingresoValue,
                        manager,
                        notes: trimmedNotes,
                        // mark as edited/audited and preserve originalEntryId (point to initial id)
                        isAudit: true,
                        originalEntryId: e.originalEntryId ?? e.id,
                        auditDetails: JSON.stringify({ history: compressedHistory }),
                        currency: movementCurrency,
                    } as FondoEntry;
                });

                try {
                    // compute simple before/after CRC balances to help debug balance update issues
                    const sumBalance = (entries: FondoEntry[]) => {
                        let ingresosCRC = 0;
                        let egresosCRC = 0;
                        entries.forEach(en => {
                            const cur = (en.currency as 'CRC' | 'USD') || 'CRC';
                            if (cur === 'CRC') {
                                ingresosCRC += en.amountIngreso || 0;
                                egresosCRC += en.amountEgreso || 0;
                            }
                        });
                        return (Number(initialAmount) || 0) + ingresosCRC - egresosCRC;
                    };
                    const beforeBalance = sumBalance(prev);
                    const afterBalance = sumBalance(next);
                    console.info('[FG-DEBUG] Edited movement saved', editingEntryId, { prevCount: prev.length, nextCount: next.length, beforeBalanceCRC: beforeBalance, afterBalanceCRC: afterBalance });
                } catch {
                    console.info('[FG-DEBUG] Edited movement saved (error computing debug balances)', editingEntryId);
                }

                return next;
            });

            resetFondoForm();
            if (!movementAutoCloseLocked) {
                setMovementModalOpen(false);
            }
            return;
        }

        const entry: FondoEntry = {
            id: String(Date.now()),
            providerCode: selectedProvider,
            invoiceNumber: paddedInvoice,
            paymentType,
            amountEgreso: isEgreso ? egresoValue : 0,
            amountIngreso: isIngreso ? ingresoValue : 0,
            manager,
            notes: trimmedNotes,
            createdAt: new Date().toISOString(),
            currency: movementCurrency,
        };

        setFondoEntries(prev => [entry, ...prev]);
        resetFondoForm();
        if (!movementAutoCloseLocked) {
            setMovementModalOpen(false);
        }
    };

    const startEditingEntry = (entry: FondoEntry) => {
        // Allow editing of entries even if previously edited; we accumulate audit history.
        setEditingEntryId(entry.id);
        setSelectedProvider(entry.providerCode);
        setInvoiceNumber(entry.invoiceNumber);
        setPaymentType(entry.paymentType);
        setManager(entry.manager);
        setNotes(entry.notes ?? '');
        setMovementCurrency((entry.currency as 'CRC' | 'USD') ?? 'CRC');
        if (isIngresoType(entry.paymentType)) {
            const ingresoValue = Math.trunc(entry.amountIngreso);
            setIngreso(ingresoValue > 0 ? ingresoValue.toString() : '');
            setEgreso('');
        } else {
            const egresoValue = Math.trunc(entry.amountEgreso);
            setEgreso(egresoValue > 0 ? egresoValue.toString() : '');
            setIngreso('');
        }
        setMovementModalOpen(true);
    };

    const isMovementLocked = useCallback((entry: FondoEntry): boolean => {
        // Los ajustes automáticos siempre están bloqueados
        if (entry.providerCode === AUTO_ADJUSTMENT_PROVIDER_CODE) {
            return true;
        }

        // El bloqueo por cierres solo aplica para Fondo General
        if (accountKey !== 'FondoGeneral') {
            return false;
        }

        // Si no hay snapshot o no hay lockedUntil, no hay bloqueo
        const lockedUntil = storageSnapshotRef.current?.state?.lockedUntil;
        console.log('[LOCK-DEBUG] Checking movement', entry.id, 'createdAt:', entry.createdAt, 'lockedUntil:', lockedUntil);
        if (!lockedUntil) {
            return false;
        }

        try {
            const movementTime = new Date(entry.createdAt).getTime();
            const lockTime = new Date(lockedUntil).getTime();

            // Bloqueado si el movimiento es anterior o igual al último cierre
            const isLocked = movementTime <= lockTime;
            console.log('[LOCK-DEBUG] Movement', entry.id, 'is', isLocked ? 'LOCKED' : 'EDITABLE');
            return isLocked;
        } catch {
            // Si hay error parseando fechas, no bloquear
            return false;
        }
    }, [accountKey]);

    const handleEditMovement = (entry: FondoEntry) => {
        if (isMovementLocked(entry)) {
            showToast('Este movimiento está bloqueado (anterior al último cierre).', 'info', 5000);
            return;
        }

        if (entry.providerCode === AUTO_ADJUSTMENT_PROVIDER_CODE) {
            showToast('Los ajustes automáticos no se pueden editar.', 'info', 5000);
            return;
        }

        // If this movement was generated from a daily closing, open the daily-closing modal
        // prefilled with that closing's values so the user edits the closing (not the generic movement).
        if (entry.originalEntryId) {
            const closingId = entry.originalEntryId;
            const record = dailyClosings.find(d => d.id === closingId);
            if (!record) {
                // If we don't have the closing record locally, fall back to the generic editor.
                startEditingEntry(entry);
                return;
            }

            const initial: DailyClosingFormValues = {
                closingDate: record.closingDate,
                manager: record.manager,
                notes: record.notes ?? '',
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
        resetFondoForm();
    };

    // Check if current user is the principal admin (owner) of the company
    const isPrincipalAdmin = useMemo(() => {
        if (!user?.id || !companyData?.ownerId) return false;
        return String(user.id) === String(companyData.ownerId);
    }, [user, companyData]);

    const handleDeleteMovement = useCallback((entry: FondoEntry) => {
        if (!isPrincipalAdmin) {
            showToast('Solo el administrador principal puede eliminar movimientos', 'error');
            return;
        }

        if (isMovementLocked(entry)) {
            showToast('Este movimiento está bloqueado (anterior al último cierre) y no puede eliminarse.', 'error');
            return;
        }

        if (entry.providerCode === AUTO_ADJUSTMENT_PROVIDER_CODE) {
            showToast('Los ajustes automáticos no se pueden eliminar.', 'error');
            return;
        }

        setConfirmDeleteEntry({ open: true, entry });
    }, [isPrincipalAdmin, isMovementLocked, showToast]);

    const confirmDeleteMovement = useCallback(() => {
        const entry = confirmDeleteEntry.entry;
        if (!entry) return;

        // Remove from fondoEntries
        setFondoEntries(prev => prev.filter(e => e.id !== entry.id));

        // Close modal
        setConfirmDeleteEntry({ open: false, entry: null });

        showToast('Movimiento eliminado exitosamente', 'success');
    }, [confirmDeleteEntry, showToast]);

    const cancelDeleteMovement = useCallback(() => {
        setConfirmDeleteEntry({ open: false, entry: null });
    }, []);

    const isProviderSelectDisabled = !company || providersLoading || providers.length === 0;
    const providersMap = useMemo(() => {
        const map = new Map<string, string>();
        providers.forEach(p => map.set(p.code, p.name));
        return map;
    }, [providers]);
    const selectedProviderExists = selectedProvider ? providers.some(p => p.code === selectedProvider) : false;

    // reset page when filters change so user sees first page of filtered results
    useEffect(() => {
        setPageIndex(0);
    }, [filterProviderCode, filterPaymentType, filterEditedOnly, searchQuery, fromFilter, toFilter]);

    const invoiceValid = /^[0-9]{1,4}$/.test(invoiceNumber) || invoiceNumber.length === 0;
    const egresoValue = Number.parseInt(egreso, 10);
    const ingresoValue = Number.parseInt(ingreso, 10);
    const egresoValid = isEgreso ? !Number.isNaN(egresoValue) && egresoValue > 0 : true;
    const ingresoValid = isIngreso ? !Number.isNaN(ingresoValue) && ingresoValue > 0 : true;
    const requiredAmountProvided = isEgreso ? egreso.trim().length > 0 : ingreso.trim().length > 0;

    const { currentBalanceCRC, currentBalanceUSD } = useMemo(() => {
        let ingresosCRC = 0;
        let egresosCRC = 0;
        let ingresosUSD = 0;
        let egresosUSD = 0;
        fondoEntries.forEach(entry => {
            const cur = (entry.currency as 'CRC' | 'USD') || 'CRC';
            if (cur === 'USD') {
                ingresosUSD += entry.amountIngreso;
                egresosUSD += entry.amountEgreso;
            } else {
                ingresosCRC += entry.amountIngreso;
                egresosCRC += entry.amountEgreso;
            }
        });
        const balanceCRC = (Number(initialAmount) || 0) + ingresosCRC - egresosCRC;
        const balanceUSD = (Number(initialAmountUSD) || 0) + ingresosUSD - egresosUSD;
        return {
            currentBalanceCRC: balanceCRC,
            currentBalanceUSD: balanceUSD,
        };
    }, [fondoEntries, initialAmount, initialAmountUSD]);

    const balanceAfterByIdCRC = useMemo(() => {
        let running = Number(initialAmount) || 0;
        const ordered = [...fondoEntries].slice().reverse().filter(e => ((e.currency as any) || 'CRC') === 'CRC');
        const map = new Map<string, number>();
        ordered.forEach(entry => {
            running += entry.amountIngreso;
            running -= entry.amountEgreso;
            map.set(entry.id, running);
        });
        return map;
    }, [fondoEntries, initialAmount]);

    const balanceAfterByIdUSD = useMemo(() => {
        let running = Number(initialAmountUSD) || 0;
        const ordered = [...fondoEntries].slice().reverse().filter(e => ((e.currency as any) || 'CRC') === 'USD');
        const map = new Map<string, number>();
        ordered.forEach(entry => {
            running += entry.amountIngreso;
            running -= entry.amountEgreso;
            map.set(entry.id, running);
        });
        return map;
    }, [fondoEntries, initialAmountUSD]);

    useEffect(() => {
        if (!entriesHydrated || hydratedAccountKey !== accountKey) return;
        const normalizedCompany = (company || '').trim();
        if (
            normalizedCompany.length === 0 ||
            hydratedCompany.toLowerCase() !== normalizedCompany.toLowerCase()
        ) {
            return;
        }

        const persistEntries = async () => {
            const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
            let storageToPersist: MovementStorage<FondoEntry> | null = null;

            const normalizedInitialCRC = initialAmount.trim().length > 0 ? initialAmount.trim() : '0';
            const normalizedInitialUSD = initialAmountUSD.trim().length > 0 ? initialAmountUSD.trim() : '0';
            const hasSnapshot = Boolean(storageSnapshotRef.current);
            const hasEntries = fondoEntries.length > 0;
            const metadataDiffers =
                normalizedInitialCRC !== '0' ||
                normalizedInitialUSD !== '0' ||
                !currencyEnabled.CRC ||
                !currencyEnabled.USD;

            if (!hasSnapshot && !hasEntries && !metadataDiffers) {
                return;
            }

            try {
                const baseStorage = storageSnapshotRef.current
                    ? MovimientosFondosService.ensureMovementStorageShape<FondoEntry>(
                        storageSnapshotRef.current,
                        normalizedCompany,
                    )
                    : MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(normalizedCompany);
                baseStorage.company = normalizedCompany;
                const normalizedEntries: FondoEntry[] = fondoEntries.map(entry => {
                    const normalizedCurrency: MovementCurrencyKey = entry.currency === 'USD' ? 'USD' : 'CRC';
                    return {
                        ...entry,
                        accountId: accountKey,
                        currency: normalizedCurrency,
                    };
                });

                const existingMovements = baseStorage.operations?.movements ?? [];
                const preservedMovements = existingMovements.filter(storedEntry => {
                    const candidate = storedEntry as Partial<FondoEntry>;
                    const storedAccount = isMovementAccountKey(candidate.accountId)
                        ? candidate.accountId
                        : 'FondoGeneral';
                    return storedAccount !== accountKey;
                });

                // SOLUCIÓN #1: Limitar movimientos en localStorage
                // Mantener solo los más recientes según MAX_LOCAL_MOVEMENTS
                const sortedRecentMovements = [...normalizedEntries]
                    .sort((a, b) => {
                        const timeA = Date.parse(a.createdAt);
                        const timeB = Date.parse(b.createdAt);
                        if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
                        return timeB - timeA; // Más reciente primero
                    })
                    .slice(0, MAX_LOCAL_MOVEMENTS);

                baseStorage.operations = {
                    movements: [...preservedMovements, ...sortedRecentMovements],
                };

                const stateSnapshot =
                    baseStorage.state ?? MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(normalizedCompany).state;
                const nextAccountBalances = stateSnapshot.balancesByAccount.filter(balance => balance.accountId !== accountKey);
                const parsedInitialCRC = Number(normalizedInitialCRC) || 0;
                const parsedInitialUSD = Number(normalizedInitialUSD) || 0;
                nextAccountBalances.push(
                    {
                        accountId: accountKey,
                        currency: 'CRC',
                        enabled: currencyEnabled.CRC,
                        initialBalance: parsedInitialCRC,
                        currentBalance: currentBalanceCRC,
                    },
                    {
                        accountId: accountKey,
                        currency: 'USD',
                        enabled: currencyEnabled.USD,
                        initialBalance: parsedInitialUSD,
                        currentBalance: currentBalanceUSD,
                    },
                );
                stateSnapshot.balancesByAccount = nextAccountBalances;
                stateSnapshot.updatedAt = new Date().toISOString();
                // Preservar lockedUntil del snapshot actual si existe
                if (storageSnapshotRef.current?.state?.lockedUntil) {
                    stateSnapshot.lockedUntil = storageSnapshotRef.current.state.lockedUntil;
                    console.log('[LOCK-DEBUG] Preserving lockedUntil in persistEntries:', stateSnapshot.lockedUntil);
                }
                baseStorage.state = stateSnapshot;
                console.log('[LOCK-DEBUG] baseStorage.state.lockedUntil before save:', baseStorage.state.lockedUntil);

                // Intentar guardar en localStorage con manejo de error
                try {
                    localStorage.setItem(companyKey, JSON.stringify(baseStorage));
                } catch (storageError) {
                    if (storageError instanceof Error && storageError.name === 'QuotaExceededError') {
                        console.error('QuotaExceededError: Reduciendo automáticamente el límite de movimientos');
                        // Si aún falla con 500, intentar con menos movimientos
                        const emergencyLimit = Math.floor(MAX_LOCAL_MOVEMENTS * 0.6); // 300 movimientos
                        const reducedMovements = [...normalizedEntries]
                            .sort((a, b) => {
                                const timeA = Date.parse(a.createdAt);
                                const timeB = Date.parse(b.createdAt);
                                if (Number.isNaN(timeA) || Number.isNaN(timeB)) return 0;
                                return timeB - timeA;
                            })
                            .slice(0, emergencyLimit);

                        baseStorage.operations = {
                            movements: [...preservedMovements, ...reducedMovements],
                        };

                        localStorage.setItem(companyKey, JSON.stringify(baseStorage));
                        console.warn(`Almacenamiento reducido a ${emergencyLimit} movimientos más recientes`);
                    } else {
                        throw storageError;
                    }
                }

                const legacyKey = buildStorageKey(namespace, FONDO_KEY_SUFFIX);
                localStorage.removeItem(legacyKey);

                if (resolvedOwnerId) {
                    const legacyOwnerKey = MovimientosFondosService.buildLegacyOwnerMovementsKey(resolvedOwnerId);
                    if (legacyOwnerKey !== companyKey) {
                        localStorage.removeItem(legacyOwnerKey);
                    }
                }

                storageSnapshotRef.current = baseStorage;
                storageToPersist = baseStorage;
            } catch (err) {
                console.error('Error preparing fondo entries for persistence:', err);
            }

            if (!storageToPersist) return;

            try {
                console.log('[LOCK-DEBUG] Saving to Firestore with lockedUntil:', storageToPersist.state?.lockedUntil);
                await MovimientosFondosService.saveDocument(companyKey, storageToPersist);
            } catch (err) {
                console.error('Error storing fondo entries to Firestore:', err);
            }
        };

        void persistEntries();
    }, [
        fondoEntries,
        namespace,
        entriesHydrated,
        company,
        hydratedCompany,
        resolvedOwnerId,
        currencyEnabled,
        initialAmount,
        initialAmountUSD,
        currentBalanceCRC,
        currentBalanceUSD,
        accountKey,
        hydratedAccountKey,
    ]);

    const isSubmitDisabled =
        !company ||
        (!editingEntryId && isProviderSelectDisabled) ||
        !invoiceValid ||
        !requiredAmountProvided ||
        !egresoValid ||
        !ingresoValid ||
        !manager ||
        employeesLoading;

    const amountFormatter = useMemo(
        () => new Intl.NumberFormat('es-CR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        [],
    );
    const amountFormatterUSD = useMemo(
        () => new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
        [],
    );
    const dailyClosingDateFormatter = useMemo(
        () => new Intl.DateTimeFormat('es-CR', { dateStyle: 'long' }),
        [],
    );
    const dateTimeFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat('es-CR', {
                dateStyle: 'short',
                timeStyle: 'short',
            }),
        [],
    );
    const formatByCurrency = (currency: 'CRC' | 'USD', value: number) =>
        currency === 'USD' ? `$ ${amountFormatterUSD.format(Math.trunc(value))}` : `₡ ${amountFormatter.format(Math.trunc(value))}`;

    const formatDailyClosingDiff = (currency: 'CRC' | 'USD', diff: number) => {
        if (diff === 0) return 'Sin diferencias';
        const sign = diff > 0 ? '+' : '-';
        return `${sign} ${formatByCurrency(currency, Math.abs(diff))}`;
    };

    const getDailyClosingDiffClass = (diff: number) => {
        if (diff === 0) return 'text-[var(--muted-foreground)]';
        return diff > 0 ? 'text-green-500' : 'text-red-500';
    };

    const buildBreakdownLines = (currency: 'CRC' | 'USD', breakdown?: Record<number, number>) => {
        if (!breakdown) return [] as string[];
        return Object.entries(breakdown)
            .filter(([, count]) => count > 0)
            .map(([denomination, count]) => `${count} x ${formatByCurrency(currency, Number(denomination))}`);
    };

    const amountClass = (isActive: boolean, inputHasValue: boolean, isValid: boolean) => {
        if (!isActive) return 'border-[var(--input-border)]';
        if (inputHasValue && !isValid) return 'border-red-500';
        return 'border-[var(--input-border)]';
    };

    const handleProviderChange = (value: string) => {
        setSelectedProvider(value);
        try {
            const prov = providers.find(p => p.code === value);
            if (prov && prov.type && isFondoMovementType(prov.type)) {
                setPaymentType(prov.type as FondoEntry['paymentType']);
            } else {
                // fallback to default when provider has no type or it's invalid
                setPaymentType('COMPRA INVENTARIO');
            }
        } catch {
            // defensive: ensure UI remains usable on unexpected provider shapes
            setPaymentType('COMPRA INVENTARIO');
        }
    };
    const handleInvoiceNumberChange = (value: string) => setInvoiceNumber(value.replace(/\D/g, '').slice(0, 4));
    // paymentType is derived from the selected provider; no manual change handler needed
    const handleEgresoChange = (value: string) => setEgreso(normalizeMoneyInput(value));
    const handleIngresoChange = (value: string) => setIngreso(normalizeMoneyInput(value));
    const handleNotesChange = (value: string) => setNotes(value);
    const handleManagerChange = (value: string) => setManager(value);

    const managerSelectDisabled = !company || employeesLoading || employeeOptions.length === 0;
    const invoiceDisabled = !company;
    const egresoBorderClass = amountClass(isEgreso, egreso.trim().length > 0, egresoValid);
    const ingresoBorderClass = amountClass(isIngreso, ingreso.trim().length > 0, ingresoValid);


    const closeMovementModal = () => {
        setMovementModalOpen(false);
        resetFondoForm();
        setMovementAutoCloseLocked(false);
    };
    const handleOpenCreateMovement = () => {
        resetFondoForm();
        setMovementCurrency(currencyEnabled.CRC ? 'CRC' : 'USD');
        // If a provider is already selected, derive paymentType from it so the form
        // doesn't stay with the reset default ('COMPRA INVENTARIO'). This prevents
        // cases where the UI shows a provider whose configured type (e.g. 'OTROS INGRESOS')
        // is ignored because resetFondoForm set the paymentType to the default.
        if (selectedProvider) {
            try {
                const prov = providers.find(p => p.code === selectedProvider);
                if (prov && prov.type && isFondoMovementType(prov.type)) {
                    setPaymentType(prov.type as FondoEntry['paymentType']);
                } else {
                    setPaymentType('COMPRA INVENTARIO');
                }
            } catch {
                setPaymentType('COMPRA INVENTARIO');
            }
        }
        // If this FondoSection instance is scoped to ingresos/egresos, force that default
        if (mode === 'ingreso') setPaymentType(FONDO_INGRESO_TYPES[0]);
        if (mode === 'egreso') setPaymentType(FONDO_EGRESO_TYPES[0]);
        setMovementModalOpen(true);
    };

    const handleOpenDailyClosing = () => {
        if (accountKey !== 'FondoGeneral') return;
        setEditingDailyClosingId(null);
        setDailyClosingInitialValues(null);
        setDailyClosingModalOpen(true);
    };

    const handleCloseDailyClosing = () => {
        setDailyClosingModalOpen(false);
        setEditingDailyClosingId(null);
        setDailyClosingInitialValues(null);
    };

    const handleConfirmDailyClosing = (closing: DailyClosingFormValues) => {
        if (accountKey !== 'FondoGeneral') {
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

        const createdAt = new Date().toISOString();
        const diffCRC = Math.trunc(closing.totalCRC) - Math.trunc(currentBalanceCRC);
        const diffUSD = Math.trunc(closing.totalUSD) - Math.trunc(currentBalanceUSD);
        const userNotes = closing.notes.trim();
        const closingDateKey = dateKeyFromDate(closingDateValue);

        const record: DailyClosingRecord = {
            id: editingDailyClosingId ?? `${Date.now()}`,
            createdAt: editingDailyClosingId ? (dailyClosings.find(d => d.id === editingDailyClosingId)?.createdAt ?? createdAt) : createdAt,
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

        setDailyClosings(prev => mergeDailyClosingRecords(prev, [record]));
        loadedDailyClosingKeysRef.current.add(closingDateKey);
        loadingDailyClosingKeysRef.current.delete(closingDateKey);
        setDailyClosingsHydrated(true);

        setDailyClosingModalOpen(false);

        const normalizedCompany = (company || '').trim();
        if (normalizedCompany.length === 0) return;

        beginDailyClosingsRequest();
        void DailyClosingsService.saveClosing(normalizedCompany, record)
            .catch(err => {
                console.error('Error saving daily closing to Firestore:', err);
            })
            .finally(() => {
                finishDailyClosingsRequest();
            });

        const notificationRecipients = new Set<string>();
        const adminRecipient = ownerAdminEmail?.trim();
        if (adminRecipient) {
            notificationRecipients.add(adminRecipient);
        } else if (activeOwnerId) {
            console.warn('Daily closing email: missing admin recipient for owner.', {
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
            console.warn('Daily closing email: skipped sending notification because no recipients were resolved.', {
                ownerId: activeOwnerId,
                company: normalizedCompany,
            });
        }

        notificationRecipients.forEach(recipient => {
            if (!recipient) return;
            void sendEmail({
                to: recipient,
                subject: emailTemplate.subject,
                text: emailTemplate.text,
                html: emailTemplate.html,
            }).catch(err => {
                console.error('Error sending daily closing email:', err);
            });
        });

        // Create or update movement(s) that reflect the difference so the balance updates accordingly.
        // We create one FondoEntry per currency where diff != 0. These are regular movements (editable)
        // and will appear in the movements list so users can later edit them (and edits will be audited
        // using the existing edit flow which marks entries as 'Editado').
        try {
            const newMovements: FondoEntry[] = [];
            const makeId = () => String(Date.now()) + Math.floor(Math.random() * 900 + 100).toString();
            // If we're editing an existing closing, compute diffs relative to the balance
            // excluding the previous generated adjustment(s). This avoids flipping an
            // existing entry from egreso -> ingreso and double-counting.
            let adjustedDiffCRC = record.diffCRC;
            let adjustedDiffUSD = record.diffUSD;
            if (editingDailyClosingId) {
                let prevCRCContribution = 0;
                let prevUSDContribution = 0;
                fondoEntries.forEach(e => {
                    if (e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL') {
                        const contrib = (e.amountIngreso || 0) - (e.amountEgreso || 0);
                        if (e.currency === 'USD') prevUSDContribution += contrib;
                        else prevCRCContribution += contrib;
                    }
                });
                const baseBalanceCRC = currentBalanceCRC - prevCRCContribution;
                const baseBalanceUSD = currentBalanceUSD - prevUSDContribution;
                adjustedDiffCRC = Math.trunc(closing.totalCRC) - Math.trunc(baseBalanceCRC);
                adjustedDiffUSD = Math.trunc(closing.totalUSD) - Math.trunc(baseBalanceUSD);
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
                    console.error('[FG-DEBUG] Error setting recordedBalance on edited closing:', rbErr);
                }

                console.info('[FG-DEBUG] Editing closing values', { closingTotalCRC: closing.totalCRC, currentBalanceCRC, prevCRCContribution, baseBalanceCRC, adjustedDiffCRC });
            }

            if (adjustedDiffCRC && adjustedDiffCRC !== 0) {
                const diff = Math.trunc(adjustedDiffCRC);
                const isPositive = diff > 0;
                const paymentType = isPositive ? AUTO_ADJUSTMENT_MOVEMENT_TYPE_INGRESO : AUTO_ADJUSTMENT_MOVEMENT_TYPE_EGRESO;
                const entry: FondoEntry = {
                    id: makeId(),
                    providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
                    invoiceNumber: String(Math.abs(diff)).padStart(4, '0'),
                    paymentType,
                    amountEgreso: isPositive ? 0 : Math.abs(diff),
                    amountIngreso: isPositive ? diff : 0,
                    manager: AUTO_ADJUSTMENT_MANAGER,
                    notes: `AJUSTE FONDO GENERAL ${closingDateKey} — Diferencia CRC: ${diff}. ${userNotes ? `Notas: ${userNotes}` : ''}`,
                    createdAt,
                    currency: 'CRC',
                    breakdown: closing.breakdownCRC ?? {},
                } as FondoEntry;
                newMovements.push(entry);
            }

            if (adjustedDiffUSD && adjustedDiffUSD !== 0) {
                const diff = Math.trunc(adjustedDiffUSD);
                const isPositive = diff > 0;
                const paymentType = isPositive ? AUTO_ADJUSTMENT_MOVEMENT_TYPE_INGRESO : AUTO_ADJUSTMENT_MOVEMENT_TYPE_EGRESO;
                const entry: FondoEntry = {
                    id: makeId(),
                    providerCode: AUTO_ADJUSTMENT_PROVIDER_CODE,
                    invoiceNumber: String(Math.abs(diff)).padStart(4, '0'),
                    paymentType,
                    amountEgreso: isPositive ? 0 : Math.abs(diff),
                    amountIngreso: isPositive ? diff : 0,
                    manager: AUTO_ADJUSTMENT_MANAGER,
                    notes: `AJUSTE FONDO GENERAL ${closingDateKey} — Diferencia USD: ${diff}. ${userNotes ? `Notas: ${userNotes}` : ''}`,
                    createdAt,
                    currency: 'USD',
                } as FondoEntry;
                if ((entry as any).currency === 'USD') (entry as any).breakdown = closing.breakdownUSD ?? {};
                newMovements.push(entry);
            }

            if (editingDailyClosingId && newMovements.length === 0) {
                // No diff now: remove previous adjustment movements linked to this closing
                console.info('[FG-DEBUG] Removing previous adjustment movements for closing', record.id, { beforeCount: fondoEntries.length });
                setFondoEntries(prev => {
                    const toRemove = prev.filter(e => e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL');
                    const filtered = prev.filter(e => !(e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL'));
                    console.info('[FG-DEBUG] After remove, count:', filtered.length);
                    if (toRemove.length > 0) {
                        try {
                            const resolution = {
                                removedAdjustments: toRemove.map(r => ({
                                    id: r.id,
                                    currency: r.currency,
                                    amount: (r.amountIngreso || 0) - (r.amountEgreso || 0),
                                    amountIngreso: r.amountIngreso || 0,
                                    amountEgreso: r.amountEgreso || 0,
                                    manager: r.manager,
                                    createdAt: r.createdAt,
                                })),
                                note: 'Ajustes eliminados manualmente al editar el cierre',
                            } as any;

                            setDailyClosings(prevClosings => {
                                const updated = prevClosings.map(d => {
                                    if (d.id !== record.id) return d;
                                    return { ...d, adjustmentResolution: resolution } as DailyClosingRecord;
                                });
                                try {
                                    const updatedRecord = updated.find(d => d.id === record.id);
                                    if (updatedRecord && normalizedCompany.length > 0) {
                                        void DailyClosingsService.saveClosing(normalizedCompany, updatedRecord).catch(saveErr => {
                                            console.error('Error saving updated daily closing with resolution:', saveErr);
                                        });
                                    }
                                } catch (saveErr) {
                                    console.error('Error persisting daily closing resolution:', saveErr);
                                }
                                return updated;
                            });
                        } catch (err) {
                            console.error('Error preparing adjustment resolution summary:', err);
                        }
                    }

                    return filtered;
                });
            }

            if (newMovements.length > 0) {
                // link movements to the daily closing via originalEntryId
                newMovements.forEach(m => (m.originalEntryId = record.id));
                if (editingDailyClosingId) {
                    // update existing related movement(s), preserve audit history
                    setFondoEntries(prev => {
                        console.info('[FG-DEBUG] Updating existing related adjustment movements for closing', record.id, { prevCount: prev.length, newMovements });
                        const updated = prev.map(e => {
                            if (e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL') {
                                const match = newMovements.find(nm => nm.currency === e.currency);
                                if (!match) return e;
                                // build audit history
                                let history: any[] = [];
                                try {
                                    const existing = e.auditDetails ? JSON.parse(e.auditDetails) as any : null;
                                    if (existing && Array.isArray(existing.history)) history = existing.history.slice();
                                    else if (existing && existing.before && existing.after) history = [{ at: existing.at ?? e.createdAt, before: existing.before, after: existing.after }];
                                } catch {
                                    history = [];
                                }
                                // Crear registro simplificado con solo los campos que cambiaron
                                const changedFields = getChangedFields(
                                    { providerCode: e.providerCode, invoiceNumber: e.invoiceNumber, paymentType: e.paymentType, amountEgreso: e.amountEgreso, amountIngreso: e.amountIngreso, manager: e.manager, notes: e.notes, currency: e.currency },
                                    { providerCode: e.providerCode, invoiceNumber: match.invoiceNumber, paymentType: match.paymentType, amountEgreso: match.amountEgreso, amountIngreso: match.amountIngreso, manager: AUTO_ADJUSTMENT_MANAGER, notes: match.notes, currency: match.currency }
                                );
                                const newRecord = { at: new Date().toISOString(), ...changedFields };
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
                                    isAudit: true,
                                    originalEntryId: e.originalEntryId ?? e.id,
                                    auditDetails: JSON.stringify({ history: compressedHistory }),
                                } as FondoEntry;
                            }
                            return e;
                        });
                        // If some newMovements have no existing entry, prepend them
                        newMovements.forEach(nm => {
                            const exists = updated.some(u => u.originalEntryId === record.id && u.currency === nm.currency && u.providerCode === 'AJUSTE FONDO GENERAL');
                            if (!exists) {
                                updated.unshift(nm);
                            }
                        });
                        console.info('[FG-DEBUG] Updated fondoEntries count after merge:', updated.length);
                        return updated;
                    });
                } else {
                    // Prepend so the most recent movement appears first (consistent with createdAt) 
                    console.info('[FG-DEBUG] Prepending new adjustment movements', newMovements);
                    setFondoEntries(prev => {
                        const next = [...newMovements, ...prev];
                        console.info('[FG-DEBUG] fondoEntries count after prepend:', next.length);
                        return next;
                    });
                }

                // Build a human-readable summary of the adjustments we just applied
                try {
                    const addedParts: string[] = newMovements.map(m => {
                        const amt = (m.amountIngreso || 0) - (m.amountEgreso || 0);
                        const sign = amt >= 0 ? '+' : '-';
                        return `${m.currency} ${sign} ${formatByCurrency(m.currency as 'CRC' | 'USD', Math.abs(amt))}`;
                    });
                    const note = `Ajustes aplicados: ${addedParts.join(' / ')}`;

                    // Compute the net added contribution by currency and the previous contribution
                    const totalNewCRC = newMovements.reduce((s, m) => s + ((m.currency === 'CRC') ? ((m.amountIngreso || 0) - (m.amountEgreso || 0)) : 0), 0);
                    const totalNewUSD = newMovements.reduce((s, m) => s + ((m.currency === 'USD') ? ((m.amountIngreso || 0) - (m.amountEgreso || 0)) : 0), 0);

                    // compute existing previous contribution linked to this closing (before we mutate fondoEntries)
                    const prevCRCContributionExisting = fondoEntries.reduce((s, e) => s + ((e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL' && (e.currency === 'CRC')) ? ((e.amountIngreso || 0) - (e.amountEgreso || 0)) : 0), 0);
                    const prevUSDContributionExisting = fondoEntries.reduce((s, e) => s + ((e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL' && (e.currency === 'USD')) ? ((e.amountIngreso || 0) - (e.amountEgreso || 0)) : 0), 0);

                    // New recorded balance = currentBalance (which includes existing adjustments) - prevExisting + newAdded
                    const postAdjustmentBalanceCRC = Math.trunc(currentBalanceCRC - prevCRCContributionExisting + totalNewCRC);
                    const postAdjustmentBalanceUSD = Math.trunc(currentBalanceUSD - prevUSDContributionExisting + totalNewUSD);
                    const hasCRCAdjustments = totalNewCRC !== 0 || prevCRCContributionExisting !== 0;
                    const hasUSDAdjustments = totalNewUSD !== 0 || prevUSDContributionExisting !== 0;

                    // Persist a readable note and store the balance after adjustments under adjustmentResolution
                    setDailyClosings(prevClosings => {
                        const updated = prevClosings.map(d => {
                            if (d.id !== record.id) return d;
                            const existingResolution = d.adjustmentResolution || {};
                            const updatedResolution: DailyClosingRecord['adjustmentResolution'] = {
                                ...(existingResolution.removedAdjustments ? { removedAdjustments: existingResolution.removedAdjustments } : {}),
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
                            const updatedRecord = updated.find(d => d.id === record.id);
                            if (updatedRecord && normalizedCompany.length > 0) {
                                void DailyClosingsService.saveClosing(normalizedCompany, updatedRecord).catch(saveErr => {
                                    console.error('Error saving daily closing with adjustment note:', saveErr);
                                });
                            }
                        } catch (saveErr) {
                            console.error('Error persisting daily closing adjustment note:', saveErr);
                        }

                        return updated;
                    });
                } catch (noteErr) {
                    console.error('Error building/persisting adjustment note:', noteErr);
                }
            }
        } catch (err) {
            console.error('Error creating movement(s) for daily closing difference:', err);
        }

        // Show toast: success when no diffs, warning when there are diffs
        try {
            const crcDiff = record.diffCRC ?? 0;
            const usdDiff = record.diffUSD ?? 0;
            if (crcDiff === 0 && usdDiff === 0) {
                try {
                    showToast('Cierre completo — sin diferencias', 'success', 4000);
                } catch {
                    // swallow toast errors to avoid breaking flow
                }
            } else {
                try {
                    const parts: string[] = [];
                    if (crcDiff !== 0) parts.push(`CRC ${formatDailyClosingDiff('CRC', crcDiff)}`);
                    if (usdDiff !== 0) parts.push(`USD ${formatDailyClosingDiff('USD', usdDiff)}`);
                    const message = `Cierre con diferencias — ${parts.join(' / ')}`;
                    showToast(message, 'warning', 6000);
                } catch {
                    // swallow toast errors
                }
            }
        } catch {
            // defensive: ignore
        }

        // Actualizar lockedUntil DESPUÉS de agregar todos los movimientos
        // para que persistEntries tenga el estado completo
        if (storageSnapshotRef.current) {
            if (!storageSnapshotRef.current.state) {
                storageSnapshotRef.current.state =
                    MovimientosFondosService.createEmptyMovementStorage<FondoEntry>(company).state;
            }
            // Bloquear hasta la fecha de creación del cierre
            storageSnapshotRef.current.state.lockedUntil = createdAt;
            console.log('[LOCK-DEBUG] Setting lockedUntil at end:', createdAt);

            // Persistir inmediatamente para asegurar que se guarde incluso sin movimientos
            const normalizedCompany = (company || '').trim();
            if (normalizedCompany.length > 0) {
                const companyKey = MovimientosFondosService.buildCompanyMovementsKey(normalizedCompany);
                try {
                    // Actualizar localStorage
                    localStorage.setItem(companyKey, JSON.stringify(storageSnapshotRef.current));
                    console.log('[LOCK-DEBUG] Force saved to localStorage after closing');
                    // Actualizar Firestore
                    void MovimientosFondosService.saveDocument(companyKey, storageSnapshotRef.current)
                        .then(() => console.log('[LOCK-DEBUG] Force saved to Firestore after closing'))
                        .catch(err => {
                            console.error('Error force saving lockedUntil to Firestore:', err);
                        });
                } catch (err) {
                    console.error('Error force persisting lockedUntil:', err);
                }
            }
        }

        // Reset editing state after confirm
        setEditingDailyClosingId(null);
        setDailyClosingInitialValues(null);
    };

    const handleAdminCompanyChange = useCallback((value: string) => {
        if (!isAdminUser) return;
        setAdminCompany(value);
        setEntriesHydrated(false);
        setHydratedCompany('');
        setFondoEntries([]);
        storageSnapshotRef.current = null;
        setInitialAmount('0');
        setInitialAmountUSD('0');
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
        setSelectedProvider('');
        setFilterProviderCode('all');
        setFilterPaymentType(mode === 'all' ? 'all' : (mode === 'ingreso' ? FONDO_INGRESO_TYPES[0] : FONDO_EGRESO_TYPES[0]));
        setFilterEditedOnly(false);
        setSearchQuery('');
        setFromFilter(null);
        setToFilter(null);
        setPageIndex(0);
    }, [isAdminUser, mode, resetFondoForm]);

    const handleFondoKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmitFondo();
        }
    };

    const displayedEntries = useMemo(() => (sortAsc ? [...fondoEntries].slice().reverse() : fondoEntries), [fondoEntries, sortAsc]);

    // days that have at least one movement (used to enable/disable dates in the calendar)
    const daysWithMovements = useMemo(() => {
        const s = new Set<string>();
        fondoEntries.forEach(entry => {
            const d = new Date(entry.createdAt);
            if (!Number.isNaN(d.getTime())) s.add(dateKeyFromDate(d));
        });
        return s;
    }, [fondoEntries]);

    // Apply all active filters to displayedEntries: date range, provider, type, manager, edited-only and free-text search
    const filteredEntries = useMemo(() => {
        let base = displayedEntries.slice();

        // date filtering (from/to)
        if (fromFilter || toFilter) {
            base = base.filter(entry => {
                const key = dateKeyFromDate(new Date(entry.createdAt));
                if (fromFilter && toFilter) return key >= fromFilter && key <= toFilter;
                if (fromFilter && !toFilter) return key === fromFilter;
                if (!fromFilter && toFilter) return key === toFilter;
                return true;
            });
        }

        // restrict by tab mode (ingreso/egreso) when applicable
        if (mode === 'ingreso') {
            base = base.filter(e => isIngresoType(e.paymentType));
        } else if (mode === 'egreso') {
            base = base.filter(e => isEgresoType(e.paymentType));
        }

        // provider filter
        if (filterProviderCode && filterProviderCode !== 'all') {
            base = base.filter(e => e.providerCode === filterProviderCode);
        }

        // payment type filter
        if (filterPaymentType && filterPaymentType !== 'all') {
            base = base.filter(e => e.paymentType === filterPaymentType);
        }

        // manager filter - not enabled in UI currently

        // edited only
        if (filterEditedOnly) {
            base = base.filter(e => !!e.isAudit);
        }

        // search across invoice, notes, provider name and manager
        const q = searchQuery.trim().toLowerCase();
        if (q.length > 0) {
            base = base.filter(e => {
                const provName = providersMap.get(e.providerCode) ?? '';
                return (
                    String(e.invoiceNumber).toLowerCase().includes(q) ||
                    String(e.notes ?? '').toLowerCase().includes(q) ||
                    provName.toLowerCase().includes(q) ||
                    String(e.manager ?? '').toLowerCase().includes(q) ||
                    String(e.paymentType ?? '').toLowerCase().includes(q)
                );
            });
        }

        return base;
    }, [displayedEntries, fromFilter, toFilter, filterProviderCode, filterPaymentType, filterEditedOnly, searchQuery, providersMap, mode]);

    const earliestEntryKey = useMemo<string | null>(() => {
        let earliest: string | null = null;
        filteredEntries.forEach(entry => {
            const date = new Date(entry.createdAt);
            if (Number.isNaN(date.getTime())) return;
            const key = dateKeyFromDate(date);
            if (!earliest || key < earliest) earliest = key;
        });
        return earliest;
    }, [filteredEntries]);

    const totalPages = useMemo(() => {
        if (pageSize === 'all' || pageSize === 'daily') return 1;
        return Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    }, [filteredEntries.length, pageSize]);

    useEffect(() => {
        // clamp pageIndex when entries or pageSize change
        setPageIndex(prev => Math.min(prev, Math.max(0, totalPages - 1)));
    }, [totalPages]);

    useEffect(() => {
        if (pageSize === 'daily') {
            setPageIndex(0);
            setCurrentDailyKey(todayKey);
            return;
        }
        // whenever user changes pageSize, reset to first page
        setPageIndex(0);
    }, [pageSize, todayKey]);

    const paginatedEntries = useMemo(() => {
        if (pageSize === 'all') return filteredEntries;
        if (pageSize === 'daily') {
            return filteredEntries.filter(entry => dateKeyFromDate(new Date(entry.createdAt)) === currentDailyKey);
        }
        const start = pageIndex * pageSize;
        return filteredEntries.slice(start, start + pageSize);
    }, [filteredEntries, pageIndex, pageSize, currentDailyKey]);

    const isDailyMode = pageSize === 'daily';

    const shiftDateKey = useCallback((key: string, delta: number) => {
        const [yearStr, monthStr, dayStr] = key.split('-');
        const year = Number(yearStr);
        const month = Number(monthStr);
        const day = Number(dayStr);
        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return key;
        const date = new Date(year, month - 1, day);
        date.setDate(date.getDate() + delta);
        return dateKeyFromDate(date);
    }, []);

    const disablePrevButton = isDailyMode
        ? (earliestEntryKey ? currentDailyKey <= earliestEntryKey : true)
        : pageIndex <= 0;
    const disableNextButton = isDailyMode
        ? currentDailyKey >= todayKey
        : pageIndex >= totalPages - 1;

    const handlePrevPage = useCallback(() => {
        if (isDailyMode) {
            if (!earliestEntryKey) return;
            setCurrentDailyKey(prev => {
                if (prev <= earliestEntryKey) return earliestEntryKey;
                const shifted = shiftDateKey(prev, -1);
                return shifted < earliestEntryKey ? earliestEntryKey : shifted;
            });
            return;
        }
        setPageIndex(p => Math.max(0, p - 1));
    }, [earliestEntryKey, isDailyMode, shiftDateKey]);

    const handleNextPage = useCallback(() => {
        if (isDailyMode) {
            setCurrentDailyKey(prev => {
                if (prev >= todayKey) return todayKey;
                const shifted = shiftDateKey(prev, 1);
                return shifted > todayKey ? todayKey : shifted;
            });
            return;
        }
        setPageIndex(p => Math.min(totalPages - 1, p + 1));
    }, [isDailyMode, shiftDateKey, todayKey, totalPages]);

    // Group visible entries by day (local date). We'll render a date header row per group.
    const groupedByDay = useMemo(() => {
        const map = new Map<string, FondoEntry[]>();
        paginatedEntries.forEach(entry => {
            const d = new Date(entry.createdAt);
            // use local date key YYYY-MM-DD
            const key = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
            const arr = map.get(key) ?? [];
            arr.push(entry);
            map.set(key, arr);
        });
        return map;
    }, [paginatedEntries]);

    const dateOnlyFormatter = useMemo(() => new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }), []);
    const formatGroupLabel = (isoDateKey: string) => {
        const [y, m, d] = isoDateKey.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        // Always show the formatted local date (no 'Hoy' / 'Ayer' labels)
        return dateOnlyFormatter.format(date);
    };

    const formatKeyToDisplay = (isoDateKey: string | null) => {
        if (!isoDateKey) return 'dd/mm/yyyy';
        const [y, m, d] = isoDateKey.split('-').map(Number);
        const dd = String(d).padStart(2, '0');
        const mm = String(m).padStart(2, '0');
        const yyyy = String(y);
        return `${dd}/${mm}/${yyyy}`;
    };

    const closingsAreLoading =
        accountKey === 'FondoGeneral' && (!dailyClosingsHydrated || dailyClosingsRefreshing);
    const visibleDailyClosings = useMemo(() => {
        if (accountKey !== 'FondoGeneral') return [] as DailyClosingRecord[];
        if (!dailyClosingsHydrated) return [] as DailyClosingRecord[];
        let base = dailyClosings;
        if (isDailyMode) {
            base = base.filter(record => {
                const key = dateKeyFromDate(new Date(record.closingDate));
                return key === currentDailyKey;
            });
        } else if (fromFilter || toFilter) {
            base = base.filter(record => {
                const key = dateKeyFromDate(new Date(record.closingDate));
                if (fromFilter && toFilter) return key >= fromFilter && key <= toFilter;
                if (fromFilter && !toFilter) return key === fromFilter;
                if (!fromFilter && toFilter) return key === toFilter;
                return true;
            });
        }
        return base;
    }, [accountKey, dailyClosings, dailyClosingsHydrated, isDailyMode, currentDailyKey, fromFilter, toFilter]);

    // Totals computed from the filtered entries (not only the current page)
    const isFilterActive = useMemo(() => {
        return Boolean(fromFilter || toFilter || (filterProviderCode && filterProviderCode !== 'all') || (filterPaymentType && filterPaymentType !== 'all') || filterEditedOnly || (searchQuery || '').trim().length > 0);
    }, [fromFilter, toFilter, filterProviderCode, filterPaymentType, filterEditedOnly, searchQuery]);

    const totalsByCurrency = useMemo(() => {
        const acc: Record<'CRC' | 'USD', { ingreso: number; egreso: number }> = { CRC: { ingreso: 0, egreso: 0 }, USD: { ingreso: 0, egreso: 0 } };
        for (const e of filteredEntries) {
            const cur = (e.currency as 'CRC' | 'USD') || 'CRC';
            const ing = Math.trunc(e.amountIngreso || 0);
            const eg = Math.trunc(e.amountEgreso || 0);
            if (ing > 0) acc[cur].ingreso += ing;
            if (eg > 0) acc[cur].egreso += eg;
        }
        return acc;
    }, [filteredEntries]);


    const companySelectId = `fg-company-select-${namespace}`;
    const showCompanySelector = isAdminUser && (ownerCompaniesLoading || sortedOwnerCompanies.length > 0 || !!ownerCompaniesError);
    const currentCompanyLabel = company || 'Sin empresa seleccionada';
    const companySelectorContent = useMemo(() => {
        if (!showCompanySelector) return null;

        return (
            <div className="flex flex-col gap-2 text-sm text-[var(--foreground)] sm:flex-row sm:items-center sm:gap-4">
                <div className="min-w-[180px]">
                    <p className="text-[11px] uppercase tracking-wide text-[var(--muted-foreground)]">Empresa actual</p>
                    <p className="text-sm font-semibold text-[var(--foreground)] truncate" title={currentCompanyLabel}>{currentCompanyLabel}</p>
                    {ownerCompaniesError && <p className="text-xs text-red-500 mt-1">{ownerCompaniesError}</p>}
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
                    <label htmlFor={companySelectId} className="text-xs font-medium text-[var(--muted-foreground)]">
                        Seleccionar empresas
                    </label>
                    <select
                        id={companySelectId}
                        value={company}
                        onChange={e => handleAdminCompanyChange(e.target.value)}
                        disabled={ownerCompaniesLoading || sortedOwnerCompanies.length === 0}
                        className="min-w-[220px] px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--foreground)]"
                    >
                        {ownerCompaniesLoading && <option value="">Cargando empresas...</option>}
                        {!ownerCompaniesLoading && sortedOwnerCompanies.length === 0 && (
                            <option value="">Sin empresas disponibles</option>
                        )}
                        {!ownerCompaniesLoading && sortedOwnerCompanies.length > 0 && (
                            <>
                                <option value="" disabled>
                                    Selecciona una empresa
                                </option>
                                {sortedOwnerCompanies.map((emp, index) => (
                                    <option key={emp.id || emp.name || `company-${index}`} value={emp.name || ''}>
                                        {emp.name || 'Sin nombre'}
                                    </option>
                                ))}
                            </>
                        )}
                    </select>
                </div>
            </div>
        );
    }, [showCompanySelector, currentCompanyLabel, ownerCompaniesError, companySelectId, company, ownerCompaniesLoading, sortedOwnerCompanies, handleAdminCompanyChange]);

    useEffect(() => {
        if (!onCompanySelectorChange) return;
        if (companySelectorPlacement === 'external') {
            onCompanySelectorChange(companySelectorContent);
            return () => onCompanySelectorChange(null);
        }
        onCompanySelectorChange(null);
    }, [companySelectorPlacement, companySelectorContent, onCompanySelectorChange]);

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
                <AccessRestrictedMessage description={`No tienes permisos para acceder a ${namespaceDescription}.`} />
            </div>
        );
    }

    return (
        <div id={id} className="mt-6 w-full max-w-6xl space-y-6 mx-auto">
            {companySelectorPlacement === 'content' && companySelectorContent && (
                <div className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-4">
                    {companySelectorContent}
                </div>
            )}

            <section className="w-full rounded-lg border border-[var(--input-border)] bg-[var(--card-bg)]/70 p-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <select
                        value={filterProviderCode}
                        onChange={e => setFilterProviderCode(e.target.value || 'all')}
                        className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--muted-foreground)]"
                        title="Filtrar por proveedor"
                        aria-label="Filtrar por proveedor"
                    >
                        <option value="all">Todos los proveedores</option>
                        {providers.map(p => (
                            <option key={p.code} value={p.code}>{p.name}</option>
                        ))}
                    </select>

                    <select
                        value={filterPaymentType}
                        onChange={e => setFilterPaymentType((e.target.value as any) || 'all')}
                        className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--muted-foreground)]"
                        title="Filtrar por tipo"
                        aria-label="Filtrar por tipo"
                    >
                        <option value="all">Todos los tipos</option>
                        <optgroup label="Ingresos">
                            {FONDO_INGRESO_TYPES.map(opt => (
                                <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Gastos">
                            {FONDO_GASTO_TYPES.map(opt => (
                                <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                            ))}
                        </optgroup>
                        <optgroup label="Egresos">
                            {FONDO_EGRESO_TYPES.map(opt => (
                                <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                            ))}
                        </optgroup>
                    </select>

                    <input
                        type="search"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar factura, notas o proveedor"
                        className="w-full px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--muted-foreground)]"
                        aria-label="Buscar movimientos"
                    />

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded border border-dashed border-[var(--input-border)] px-4 py-3 text-sm text-[var(--muted-foreground)]">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
                            <div>
                                <label className="flex items-center gap-2 ml-1">
                                    <input type="checkbox" checked={filterEditedOnly} onChange={e => setFilterEditedOnly(e.target.checked)} />
                                    <span className="ml-1">Editados</span>
                                </label>
                                {/* Moved 'Recordar filtros' next to pagination controls */}
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setFilterProviderCode('all');
                                    setFilterPaymentType('all');
                                    setFilterEditedOnly(false);
                                    setSearchQuery('');
                                    setFromFilter(null);
                                    setToFilter(null);
                                }}
                                className="self-start sm:self-center px-3 py-1 text-xs font-semibold uppercase tracking-wide border border-[var(--input-border)] rounded hover:bg-[var(--muted)]"
                                title="Limpiar filtros"
                            >
                                Limpiar
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--input-border)] pt-3">
                    <div className="flex flex-1 flex-wrap items-center gap-3 min-w-[260px]">
                        <div className="relative w-full sm:w-auto">
                            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Desde</label>
                            <button
                                type="button"
                                ref={fromButtonRef}
                                onClick={() => setCalendarFromOpen(prev => !prev)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 border border-[var(--input-border)] rounded hover:bg-[var(--muted)] bg-transparent text-[var(--muted-foreground)]"
                                title="Seleccionar fecha desde"
                                aria-label="Seleccionar fecha desde"
                            >
                                <span className="text-sm font-medium">{fromFilter ? formatKeyToDisplay(fromFilter) : 'dd/mm/yyyy'}</span>
                                <CalendarDays className="w-4 h-4" />
                            </button>

                            {calendarFromOpen && (
                                <div
                                    ref={fromCalendarRef}
                                    className="absolute left-0 top-full mt-2 z-50 w-full sm:w-64"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="w-full rounded border border-[var(--input-border)] bg-[#1f262a] p-3 text-white shadow-lg">
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
                                                {calendarFromMonth.toLocaleString('es-CR', { month: 'long', year: 'numeric' })}
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
                                            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                                                <div key={`${d}-${i}`} className="py-1">{d}</div>
                                            ))}
                                        </div>

                                        <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                                            {(() => {
                                                const cells: React.ReactNode[] = [];
                                                const year = calendarFromMonth.getFullYear();
                                                const month = calendarFromMonth.getMonth();
                                                const first = new Date(year, month, 1);
                                                const start = first.getDay();
                                                const daysInMonth = new Date(year, month + 1, 0).getDate();

                                                for (let i = 0; i < start; i++) cells.push(<div key={`pad-f-${i}`} />);

                                                for (let day = 1; day <= daysInMonth; day++) {
                                                    const d = new Date(year, month, day);
                                                    const key = dateKeyFromDate(d);
                                                    const enabled = daysWithMovements.has(key);
                                                    const isSelected = fromFilter === key;
                                                    if (enabled) {
                                                        cells.push(
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => {
                                                                    setFromFilter(key);
                                                                    setCalendarFromOpen(false);
                                                                    setPageSize('all');
                                                                    setPageIndex(0);
                                                                }}
                                                                className={`py-1 rounded ${isSelected ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--muted)]'}`}
                                                            >
                                                                {day}
                                                            </button>,
                                                        );
                                                    } else {
                                                        cells.push(
                                                            <div key={key} className="py-1 text-[var(--muted-foreground)] opacity-60">
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
                                                    setFromFilter(null);
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

                        <div className="relative w-full sm:w-auto">
                            <label className="block text-xs font-medium text-[var(--muted-foreground)] mb-1">Hasta</label>
                            <button
                                type="button"
                                ref={toButtonRef}
                                onClick={() => setCalendarToOpen(prev => !prev)}
                                className="flex w-full items-center justify-between gap-2 px-3 py-2 border border-[var(--input-border)] rounded hover:bg-[var(--muted)] bg-transparent text-[var(--muted-foreground)]"
                                title="Seleccionar fecha hasta"
                                aria-label="Seleccionar fecha hasta"
                            >
                                <span className="text-sm font-medium">{toFilter ? formatKeyToDisplay(toFilter) : 'dd/mm/yyyy'}</span>
                                <CalendarDays className="w-4 h-4" />
                            </button>

                            {calendarToOpen && (
                                <div
                                    ref={toCalendarRef}
                                    className="absolute left-0 top-full mt-2 z-50 w-full sm:w-64"
                                    onClick={e => e.stopPropagation()}
                                >
                                    <div className="w-full rounded border border-[var(--input-border)] bg-[#1f262a] p-3 text-white shadow-lg">
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
                                                {calendarToMonth.toLocaleString('es-CR', { month: 'long', year: 'numeric' })}
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
                                            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                                                <div key={`${d}-${i}`} className="py-1">{d}</div>
                                            ))}
                                        </div>

                                        <div className="mt-2 grid grid-cols-7 gap-1 text-sm">
                                            {(() => {
                                                const cells: React.ReactNode[] = [];
                                                const year = calendarToMonth.getFullYear();
                                                const month = calendarToMonth.getMonth();
                                                const first = new Date(year, month, 1);
                                                const start = first.getDay();
                                                const daysInMonth = new Date(year, month + 1, 0).getDate();

                                                for (let i = 0; i < start; i++) cells.push(<div key={`pad-t-${i}`} />);

                                                for (let day = 1; day <= daysInMonth; day++) {
                                                    const d = new Date(year, month, day);
                                                    const key = dateKeyFromDate(d);
                                                    const enabled = daysWithMovements.has(key);
                                                    const isSelected = toFilter === key;
                                                    if (enabled) {
                                                        cells.push(
                                                            <button
                                                                key={key}
                                                                type="button"
                                                                onClick={() => {
                                                                    setToFilter(key);
                                                                    setCalendarToOpen(false);
                                                                    setPageSize('all');
                                                                    setPageIndex(0);
                                                                }}
                                                                className={`py-1 rounded ${isSelected ? 'bg-[var(--accent)] text-white' : 'hover:bg-[var(--muted)]'}`}
                                                            >
                                                                {day}
                                                            </button>,
                                                        );
                                                    } else {
                                                        cells.push(
                                                            <div key={key} className="py-1 text-[var(--muted-foreground)] opacity-60">
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
                                                    setToFilter(null);
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
                    </div>

                    <div className="flex w-full items-center justify-center gap-2 sm:w-auto">
                        {accountKey === 'FondoGeneral' && (
                            <button
                                type="button"
                                onClick={handleOpenDailyClosing}
                                className="flex items-center justify-center gap-2 rounded fg-add-mov-btn px-4 py-2 text-white"
                            >
                                <Banknote className="w-4 h-4" />
                                Registrar cierre
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={handleOpenCreateMovement}
                            className="flex items-center justify-center gap-2 rounded fg-add-mov-btn px-4 py-2 text-white"
                        >
                            <Plus className="w-4 h-4" />
                            Agregar movimiento
                        </button>
                    </div>
                </div>
            </section>

            {!authLoading && !company && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    {isAdminUser
                        ? 'Selecciona una empresa para continuar.'
                        : 'Tu usuario no tiene una empresa asociada; registra una empresa para continuar.'}
                </p>
            )}

            {providersError && <div className="mb-4 text-sm text-red-500">{providersError}</div>}

            <Drawer
                anchor="right"
                open={movementModalOpen}
                onClose={closeMovementModal}
                PaperProps={{
                    sx: {
                        width: { xs: '100vw', sm: 520 },
                        maxWidth: '100vw',
                        bgcolor: '#1f262a',
                        color: '#ffffff',
                    },
                }}
            >
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', px: 3, py: 2, position: 'relative' }}>
                        <Typography variant="h6" component="h3" sx={{ fontWeight: 600, textAlign: 'center', width: '100%' }}>
                            {editingEntry ? `Editar movimiento #${editingEntry.invoiceNumber}` : 'Registrar movimiento'}
                        </Typography>
                        <Box sx={{ position: 'absolute', right: 12, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <IconButton
                                aria-label={movementAutoCloseLocked ? 'Desbloquear cierre automatico' : 'Bloquear cierre automatico'}
                                onClick={() => setMovementAutoCloseLocked(prev => !prev)}
                                sx={{ color: 'var(--foreground)' }}
                            >
                                {movementAutoCloseLocked ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
                            </IconButton>
                            <IconButton
                                aria-label="Cerrar registro de movimiento"
                                onClick={closeMovementModal}
                                sx={{ color: 'var(--foreground)' }}
                            >
                                <X className="w-4 h-4" />
                            </IconButton>
                        </Box>
                    </Box>
                    <Divider sx={{ borderColor: 'var(--input-border)' }} />
                    <Box sx={{ flex: 1, overflowY: 'auto', px: 3, py: 2 }}>
                        {editingEntry && (
                            <Typography variant="caption" component="p" sx={{ color: 'var(--muted-foreground)', mb: 2 }}>
                                Editando movimiento #{editingEntry.invoiceNumber}. Actualiza los datos y presiona &quot;Actualizar&quot; o cancela para volver al modo de registro.
                            </Typography>
                        )}
                        <AgregarMovimiento
                            selectedProvider={selectedProvider}
                            onProviderChange={handleProviderChange}
                            providers={providers}
                            providersLoading={providersLoading}
                            isProviderSelectDisabled={isProviderSelectDisabled}
                            selectedProviderExists={selectedProviderExists}
                            invoiceNumber={invoiceNumber}
                            onInvoiceNumberChange={handleInvoiceNumberChange}
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
                            managerSelectDisabled={managerSelectDisabled}
                            employeeOptions={employeeOptions}
                            employeesLoading={employeesLoading}
                            editingEntryId={editingEntryId}
                            onCancelEditing={cancelEditing}
                            onSubmit={handleSubmitFondo}
                            isSubmitDisabled={isSubmitDisabled}
                            onFieldKeyDown={handleFondoKeyDown}
                            currency={movementCurrency}
                            onCurrencyChange={c => setMovementCurrency(c)}
                            currencyEnabled={currencyEnabled}
                        />
                    </Box>
                </Box>
            </Drawer>

            {!providersLoading && providers.length === 0 && company && (
                <p className="text-sm text-[var(--muted-foreground)] mt-3">
                    Registra un proveedor para poder asociarlo a los movimientos del fondo.
                </p>
            )}

            {!employeesLoading && employeeOptions.length === 0 && company && (
                <p className="text-sm text-[var(--muted-foreground)] mt-2">
                    La empresa no tiene empleados registrados; agrega empleados para seleccionar un encargado.
                </p>
            )}

            <div className="mt-6">
                <h3 className="text-sm font-medium text-[var(--muted-foreground)] mb-2 text-center">Movimientos recientes</h3>
                {fondoEntries.length === 0 ? (
                    <p className="text-sm text-[var(--muted-foreground)] text-center">No hay movimientos aun.</p>
                ) : (
                    <div className="overflow-x-auto rounded border border-[var(--input-border)] bg-[#1f262a] text-white">
                        <div className="px-3 py-2 flex items-center justify-between bg-transparent text-sm text-[var(--muted-foreground)]">
                            <div className="flex items-center gap-2">
                                <span>Mostrar</span>
                                <select
                                    value={pageSize === 'all' ? 'all' : pageSize === 'daily' ? 'daily' : String(pageSize)}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v === 'all') setPageSize('all');
                                        else if (v === 'daily') setPageSize('daily');
                                        else setPageSize(Number.parseInt(v, 10) || 10);
                                    }}
                                    className="p-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm"
                                >
                                    <option value="daily">Mostrar diariamente</option>
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="15">15</option>
                                    <option value="all">Todos</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-3 mr-2 text-[var(--muted-foreground)]">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input aria-label="Recordar filtros" title="Recordar filtros" className="cursor-pointer" type="checkbox" checked={rememberFilters} onChange={e => setRememberFilters(e.target.checked)} />
                                        <span className="text-sm ml-1">Recordar filtros</span>
                                    </label>
                                </div>
                                <button
                                    type="button"
                                    onClick={handlePrevPage}
                                    disabled={disablePrevButton}
                                    className="px-2 py-1 border border-[var(--input-border)] rounded disabled:opacity-50"
                                >
                                    Anterior
                                </button>
                                <div className="px-2">{isDailyMode ? formatGroupLabel(currentDailyKey) : `Página ${Math.min(pageIndex + 1, totalPages)} de ${totalPages}`}</div>
                                <button
                                    type="button"
                                    onClick={handleNextPage}
                                    disabled={disableNextButton}
                                    className="px-2 py-1 border border-[var(--input-border)] rounded disabled:opacity-50"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                        <div className="max-h-[36rem] overflow-y-auto">
                            {(fromFilter || toFilter) && (
                                <div className="px-3 py-2">
                                    <div className="text-sm text-[var(--muted-foreground)]">
                                        Filtro: {fromFilter ? formatGroupLabel(fromFilter) : '—'}{toFilter ? ` → ${formatGroupLabel(toFilter)}` : ''}
                                        <button
                                            type="button"
                                            onClick={() => { setFromFilter(null); setToFilter(null); setPageIndex(0); setPageSize('daily'); }}
                                            className="ml-3 px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                                        >
                                            Limpiar filtro
                                        </button>
                                    </div>
                                </div>
                            )}
                            <table className="w-full min-w-[920px] text-sm">
                                <colgroup>
                                    <col style={{ width: columnWidths.hora }} />
                                    <col style={{ width: columnWidths.motivo }} />
                                    <col style={{ width: columnWidths.tipo }} />
                                    <col style={{ width: columnWidths.factura }} />
                                    <col style={{ width: columnWidths.monto }} />
                                    <col style={{ width: columnWidths.encargado }} />
                                    <col style={{ width: columnWidths.editar }} />
                                </colgroup>
                                <thead className="bg-[var(--muted)] text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
                                    <tr>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center gap-2">
                                                    <Clock className="w-4 h-4" />
                                                    Hora
                                                </div>
                                                <div
                                                    onMouseDown={e => startResizing(e, 'hora')}
                                                    className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center"
                                                    style={{ touchAction: 'none' }}
                                                >
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center gap-2">
                                                    <Layers className="w-4 h-4" />
                                                    Motivo
                                                </div>
                                                <div onMouseDown={e => startResizing(e, 'motivo')} className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center" style={{ touchAction: 'none' }}>
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center gap-2">
                                                    <Tag className="w-4 h-4" />
                                                    Tipo
                                                </div>
                                                <div onMouseDown={e => startResizing(e, 'tipo')} className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center" style={{ touchAction: 'none' }}>
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="w-4 h-4" />
                                                    N° factura
                                                </div>
                                                <div onMouseDown={e => startResizing(e, 'factura')} className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center" style={{ touchAction: 'none' }}>
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center gap-2">
                                                    <Banknote className="w-4 h-4" />
                                                    Monto
                                                </div>
                                                <div onMouseDown={e => startResizing(e, 'monto')} className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center" style={{ touchAction: 'none' }}>
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center gap-2">
                                                    <UserCircle className="w-4 h-4" />
                                                    Encargado
                                                </div>
                                                <div onMouseDown={e => startResizing(e, 'encargado')} className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center" style={{ touchAction: 'none' }}>
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left font-semibold">
                                            <div className="relative pr-2">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setSortAsc((prev: boolean) => !prev)}
                                                        title={sortAsc ? 'Mostrar más reciente arriba' : 'Mostrar más reciente abajo'}
                                                        aria-label="Invertir orden de movimientos"
                                                        className="p-1 border border-[var(--input-border)] rounded hover:bg-[var(--muted)]"
                                                    >
                                                        <ArrowUpDown className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div onMouseDown={e => startResizing(e, 'editar')} className="absolute top-0 right-0 h-full w-8 -mr-3 cursor-col-resize flex items-center justify-center" style={{ touchAction: 'none' }}>
                                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                                </div>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>
                                {Array.from(groupedByDay.entries()).map(([dayKey, entries]) => (
                                    <tbody key={dayKey}>
                                        {entries.map((fe) => {
                                            // the newest entry is the first element in fondoEntries (inserted at index 0)
                                            const isMostRecent = fe.id === fondoEntries[0]?.id;
                                            const providerName = providersMap.get(fe.providerCode) ?? fe.providerCode;
                                            const entryCurrency = (fe.currency as 'CRC' | 'USD') || 'CRC';
                                            const normalizedIngreso = Math.trunc(fe.amountIngreso || 0);
                                            const normalizedEgreso = Math.trunc(fe.amountEgreso || 0);
                                            let isEntryEgreso = isEgresoType(fe.paymentType) || isGastoType(fe.paymentType);
                                            if (normalizedIngreso > 0 && normalizedEgreso === 0) {
                                                isEntryEgreso = false;
                                            } else if (normalizedEgreso > 0 && normalizedIngreso === 0) {
                                                isEntryEgreso = true;
                                            }
                                            const movementAmount = isEntryEgreso ? normalizedEgreso : normalizedIngreso;
                                            const balanceAfter = entryCurrency === 'USD' ? (balanceAfterByIdUSD.get(fe.id) ?? (Number(initialAmountUSD) || 0)) : (balanceAfterByIdCRC.get(fe.id) ?? (Number(initialAmount) || 0));
                                            // compute the balance immediately before this movement was applied (in the movement currency)
                                            const previousBalance = isEntryEgreso
                                                ? balanceAfter + normalizedEgreso
                                                : balanceAfter - normalizedIngreso;
                                            const recordedAt = new Date(fe.createdAt);
                                            const formattedDate = Number.isNaN(recordedAt.getTime())
                                                ? 'Sin fecha'
                                                : dateTimeFormatter.format(recordedAt);
                                            const isAutoAdjustment = fe.providerCode === AUTO_ADJUSTMENT_PROVIDER_CODE;
                                            const amountPrefix = isEntryEgreso ? '-' : '+';
                                            // prepare tooltip text for edited entries
                                            let auditTooltip: string | undefined;
                                            let parsedAudit: any | null = null;
                                            if (fe.isAudit && fe.auditDetails) {
                                                try {
                                                    const parsed = JSON.parse(fe.auditDetails) as any;
                                                    // normalize to history array for backward compatibility
                                                    let history: any[] = [];
                                                    if (Array.isArray(parsed?.history)) {
                                                        history = parsed.history;
                                                    } else if (parsed?.before && parsed?.after) {
                                                        history = [{ at: parsed.at ?? fe.createdAt, before: parsed.before, after: parsed.after }];
                                                    }
                                                    parsedAudit = { history };

                                                    // build tooltip from accumulated history (show each change timestamp + small summary)
                                                    const lines: string[] = history.map(h => {
                                                        const at = h?.at ? dateTimeFormatter.format(new Date(h.at)) : '—';
                                                        const before = h?.before ?? {};
                                                        const after = h?.after ?? {};
                                                        const parts: string[] = [];

                                                        // Con el nuevo formato simplificado, mostramos todos los campos presentes
                                                        if ('providerCode' in before || 'providerCode' in after) {
                                                            parts.push(`Proveedor: ${before.providerCode ?? '—'} → ${after.providerCode ?? '—'}`);
                                                        }
                                                        if ('invoiceNumber' in before || 'invoiceNumber' in after) {
                                                            parts.push(`Factura: ${before.invoiceNumber ?? '—'} → ${after.invoiceNumber ?? '—'}`);
                                                        }
                                                        if ('paymentType' in before || 'paymentType' in after) {
                                                            parts.push(`Tipo: ${before.paymentType ?? '—'} → ${after.paymentType ?? '—'}`);
                                                        }

                                                        // Manejar cambio de moneda
                                                        if ('currency' in before || 'currency' in after) {
                                                            const beforeCur = before.currency || entryCurrency || 'CRC';
                                                            const afterCur = after.currency || entryCurrency || 'CRC';
                                                            if (beforeCur !== afterCur) {
                                                                parts.push(`Moneda: ${beforeCur} → ${afterCur}`);
                                                            }
                                                        }

                                                        // Manejar montos (pueden estar en amountEgreso o amountIngreso)
                                                        if ('amountEgreso' in before || 'amountEgreso' in after || 'amountIngreso' in before || 'amountIngreso' in after) {
                                                            const beforeAmt = Number(before.amountEgreso || before.amountIngreso || 0);
                                                            const afterAmt = Number(after.amountEgreso || after.amountIngreso || 0);
                                                            const beforeCur = (before.currency as 'CRC' | 'USD') || entryCurrency || 'CRC';
                                                            const afterCur = (after.currency as 'CRC' | 'USD') || entryCurrency || 'CRC';
                                                            parts.push(`Monto: ${formatByCurrency(beforeCur, beforeAmt)} → ${formatByCurrency(afterCur, afterAmt)}`);
                                                        }

                                                        if ('manager' in before || 'manager' in after) {
                                                            parts.push(`Encargado: ${before.manager ?? '—'} → ${after.manager ?? '—'}`);
                                                        }
                                                        if ('notes' in before || 'notes' in after) {
                                                            parts.push(`Notas: "${before.notes ?? ''}" → "${after.notes ?? ''}"`);
                                                        }

                                                        return `${at}: ${parts.join('; ') || 'Editado (sin cambios detectados)'} `;
                                                    });
                                                    auditTooltip = lines.join('\n');
                                                } catch {
                                                    auditTooltip = 'Editado';
                                                    parsedAudit = null;
                                                }
                                            }
                                            return (
                                                <tr
                                                    key={fe.id}
                                                    className={`border-t border-[var(--input-border)] hover:bg-[var(--muted)] ${isMostRecent ? 'bg-[#273238]' : ''
                                                        } ${isMovementLocked(fe) ? 'opacity-60' : ''
                                                        }`}
                                                >
                                                    <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">{formattedDate}</td>
                                                    <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                                        <div className="flex items-center gap-2">
                                                            <div className="font-semibold text-[var(--muted-foreground)]">{providerName}</div>
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
                                                                    onKeyDown={e => {
                                                                        if ((e.key === 'Enter' || e.key === ' ') && parsedAudit) {
                                                                            setAuditModalData(parsedAudit);
                                                                            setAuditModalOpen(true);
                                                                        }
                                                                    }}
                                                                    title={auditTooltip}
                                                                    className="inline-flex items-center gap-2 text-[11px] text-yellow-400 bg-yellow-900/10 px-2 py-0.5 rounded cursor-pointer"
                                                                >
                                                                    <Pencil className="w-3 h-3 text-yellow-300" />
                                                                    <span>Editado</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        {fe.notes && (
                                                            <div className="mt-1 text-xs text-[var(--muted-foreground)] break-words">
                                                                {fe.notes}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">
                                                        {formatMovementType(fe.paymentType)}
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">#{fe.invoiceNumber}</td>
                                                    <td className="px-3 py-2 align-top">
                                                        <div className="flex flex-col gap-1 text-right">
                                                            <div className="flex items-center justify-end gap-2">
                                                                {isEntryEgreso ? (
                                                                    <ArrowUpRight className="w-4 h-4 text-red-500" />
                                                                ) : (
                                                                    <ArrowDownRight className="w-4 h-4 text-green-500" />
                                                                )}
                                                                <span className={`font-semibold ${isEntryEgreso ? 'text-red-500' : 'text-green-600'}`}>
                                                                    {`${amountPrefix} ${formatByCurrency(entryCurrency, movementAmount)}`}
                                                                </span>
                                                            </div>
                                                            <span className="text-xs text-[var(--muted-foreground)]">
                                                                Saldo anterior: {formatByCurrency(entryCurrency, previousBalance)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-[var(--muted-foreground)]">{fe.manager}</td>
                                                    <td className="px-3 py-2 align-top">
                                                        {!isMovementLocked(fe) && (
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    type="button"
                                                                    className="inline-flex items-center gap-2 rounded border border-[var(--input-border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
                                                                    onClick={() => handleEditMovement(fe)}
                                                                    disabled={editingEntryId === fe.id}
                                                                    title={
                                                                        isAutoAdjustment
                                                                            ? 'Los ajustes automáticos no se pueden editar'
                                                                            : 'Editar movimiento'
                                                                    }
                                                                >
                                                                    <Pencil className="w-4 h-4" />
                                                                    {editingEntryId === fe.id ? 'Editando' : 'Editar'}
                                                                </button>
                                                                {isPrincipalAdmin && !isAutoAdjustment && (
                                                                    <button
                                                                        type="button"
                                                                        className="inline-flex items-center gap-2 rounded border border-red-500/50 px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-500/10"
                                                                        onClick={() => handleDeleteMovement(fe)}
                                                                        title="Eliminar movimiento (solo admin principal)"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                        Eliminar
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* Totals for the current search / filters */}
            {isFilterActive && filteredEntries.length > 0 && (
                <div className="mt-4">
                    <div className="flex justify-center">
                        <div className="w-full max-w-2xl">
                            <div className="px-4 py-3 rounded min-w-[220px] fg-balance-card">
                                <div className="mb-2 text-center font-semibold text-sm text-[var(--muted-foreground)]">Totales (según búsqueda)</div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {(['CRC', 'USD'] as ('CRC' | 'USD')[]).map(currency => {
                                        const ingreso = totalsByCurrency[currency].ingreso;
                                        const egreso = totalsByCurrency[currency].egreso;
                                        const neto = ingreso - egreso;
                                        return (
                                            <div key={currency} className="rounded border border-[var(--input-border)] bg-[var(--card-bg)] p-3">
                                                <div className="text-xs uppercase tracking-wide">{currency === 'CRC' ? 'Colones' : 'Dólares'}</div>
                                                <div className="mt-2 text-[var(--foreground)]">
                                                    <div className="flex items-center gap-2">
                                                        <ArrowDownRight className="w-4 h-4 text-green-500" />
                                                        <div>Ingresos: <span className="font-semibold text-green-500">{formatByCurrency(currency, ingreso)}</span></div>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <ArrowUpRight className="w-4 h-4 text-red-500" />
                                                        <div>Egresos: <span className="font-semibold text-red-500">{formatByCurrency(currency, egreso)}</span></div>
                                                    </div>
                                                    <div className="pt-2">
                                                        <div>Neto: <span className={`font-semibold ${neto > 0 ? 'text-green-500' : neto < 0 ? 'text-red-500' : ''}`}>{formatByCurrency(currency, neto)}</span></div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-5">
                <div className="flex justify-center">
                    <div className="w-full max-w-2xl space-y-4">
                        {enabledBalanceCurrencies.length > 0 && (
                            <div className="px-4 py-3 rounded min-w-[220px] fg-balance-card">
                                <div className="mb-3 text-center text-sm font-medium text-[var(--muted-foreground)]">Saldo Actual</div>
                                <div className="flex flex-col divide-y divide-[var(--input-border)] sm:flex-row sm:divide-y-0 sm:divide-x">
                                    {enabledBalanceCurrencies.map(currency => {
                                        const label = currency === 'CRC' ? 'Colones' : 'Dólares';
                                        const value = currency === 'CRC' ? currentBalanceCRC : currentBalanceUSD;
                                        return (
                                            <div key={currency} className="flex-1 px-3 py-2 text-center">
                                                <div className="text-xs uppercase tracking-wide text-[var(--foreground)]">{label}</div>
                                                <div className="text-lg font-semibold text-[var(--foreground)]">
                                                    {formatByCurrency(currency, value)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                {/* Registrar cierre moved next to 'Agregar movimiento' per UI changes */}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {auditModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800/60 px-4"
                    onClick={() => setAuditModalOpen(false)}
                >
                    <div
                        className="w-full max-w-2xl rounded border border-[var(--input-border)] bg-[#1f262a] p-6 shadow-lg text-white"
                        onClick={e => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="audit-modal-title"
                    >
                        <h3 id="audit-modal-title" className="text-lg font-semibold">Historial de edición</h3>
                        <div className="mt-4 space-y-3 max-h-[60vh] overflow-auto">
                            {auditModalData?.history?.map((h, idx) => (
                                <div key={idx} className="p-3 bg-[#0f1516] rounded">
                                    <div className="text-xs text-[var(--muted-foreground)]">Cambio {idx + 1} — {h?.at ? dateTimeFormatter.format(new Date(h.at)) : '—'}</div>
                                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <div className="text-xs text-[var(--muted-foreground)]">Antes</div>
                                            <pre className="mt-2 text-sm bg-[#0b1011] p-3 rounded overflow-auto max-h-48">{JSON.stringify(h?.before ?? {}, null, 2)}</pre>
                                        </div>
                                        <div>
                                            <div className="text-xs text-[var(--muted-foreground)]">Después</div>
                                            <pre className="mt-2 text-sm bg-[#0b1011] p-3 rounded overflow-auto max-h-48">{JSON.stringify(h?.after ?? {}, null, 2)}</pre>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                type="button"
                                onClick={() => setAuditModalOpen(false)}
                                className="px-4 py-2 border border-[var(--input-border)] rounded"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* daily closings block removed from inline view */}
            <DailyClosingModal
                open={dailyClosingModalOpen}
                onClose={handleCloseDailyClosing}
                onConfirm={handleConfirmDailyClosing}
                initialValues={dailyClosingInitialValues}
                editId={editingDailyClosingId}
                onShowHistory={() => setDailyClosingHistoryOpen(true)}
                employees={employeeOptions}
                loadingEmployees={employeesLoading}
                currentBalanceCRC={currentBalanceCRC}
                currentBalanceUSD={currentBalanceUSD}
            />

            <ConfirmModal
                open={confirmDeleteEntry.open}
                title="Eliminar movimiento"
                message={`¿Está seguro que desea eliminar el movimiento #${confirmDeleteEntry.entry?.invoiceNumber || ''}? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                onConfirm={confirmDeleteMovement}
                onCancel={cancelDeleteMovement}
                actionType="delete"
            />

            {dailyClosingHistoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setDailyClosingHistoryOpen(false)}>
                    <div className="w-full max-w-3xl rounded border border-[var(--input-border)] bg-[#1f262a] p-6 shadow-lg text-white max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="daily-closing-history-title">
                        <div className="flex items-center justify-between mb-4">
                            <h3 id="daily-closing-history-title" className="text-lg font-semibold">Historial de cierres diarios</h3>
                            <button type="button" onClick={() => setDailyClosingHistoryOpen(false)} className="rounded border border-[var(--input-border)] px-2 py-1 text-sm">Cerrar</button>
                        </div>
                        <div className="space-y-4">
                            {closingsAreLoading ? (
                                <p className="text-sm text-[var(--muted-foreground)]">Cargando cierres...</p>
                            ) : dailyClosings.length === 0 ? (
                                <p className="text-sm text-[var(--muted-foreground)]">Aún no has registrado cierres diarios para este fondo.</p>
                            ) : (
                                <div className="space-y-4">
                                    {visibleDailyClosings.map(record => {
                                        const closingDate = new Date(record.closingDate);
                                        const closingDateLabel = Number.isNaN(closingDate.getTime()) ? record.closingDate : dailyClosingDateFormatter.format(closingDate);
                                        const createdAtDate = new Date(record.createdAt);
                                        const createdAtLabel = Number.isNaN(createdAtDate.getTime()) ? record.createdAt : dateTimeFormatter.format(createdAtDate);
                                        const crcLines = buildBreakdownLines('CRC', record.breakdownCRC);
                                        const usdLines = buildBreakdownLines('USD', record.breakdownUSD);
                                        const showCRC = record.totalCRC !== 0 || record.recordedBalanceCRC !== 0 || record.diffCRC !== 0 || crcLines.length > 0;
                                        const showUSD = record.totalUSD !== 0 || record.recordedBalanceUSD !== 0 || record.diffUSD !== 0 || usdLines.length > 0;
                                        return (
                                            <div key={record.id} className="rounded border border-[var(--input-border)] bg-[var(--muted)]/10 p-4">
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="text-sm font-semibold text-[var(--foreground)]">{closingDateLabel}</div>
                                                        <div className="text-xs text-[var(--muted-foreground)]">Registrado: {createdAtLabel}</div>
                                                    </div>
                                                    <div className="text-xs text-[var(--muted-foreground)]">Encargado: <span className="font-medium text-[var(--foreground)]">{record.manager || '—'}</span></div>
                                                </div>
                                                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    <div className="rounded border border-[var(--input-border)]/60 bg-[var(--muted)]/10 p-3">
                                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Colones</div>
                                                        {showCRC ? (
                                                            <div className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                                                                <div>Conteo: {formatByCurrency('CRC', record.totalCRC)}</div>
                                                                <div>Saldo registrado: {formatByCurrency('CRC', record.recordedBalanceCRC)}</div>
                                                                <div className={getDailyClosingDiffClass(record.diffCRC)}>Diferencia: {formatDailyClosingDiff('CRC', record.diffCRC)}</div>
                                                                {crcLines.length > 0 && <div className="pt-1 text-xs text-[var(--muted-foreground)]">Detalle: {crcLines.join(', ')}</div>}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 text-xs text-[var(--muted-foreground)]">Sin datos en CRC</div>
                                                        )}
                                                    </div>
                                                    <div className="rounded border border-[var(--input-border)]/60 bg-[var(--muted)]/10 p-3">
                                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Dólares</div>
                                                        {showUSD ? (
                                                            <div className="mt-2 space-y-1 text-sm text-[var(--foreground)]">
                                                                <div>Conteo: {formatByCurrency('USD', record.totalUSD)}</div>
                                                                <div>Saldo registrado: {formatByCurrency('USD', record.recordedBalanceUSD)}</div>
                                                                <div className={getDailyClosingDiffClass(record.diffUSD)}>Diferencia: {formatDailyClosingDiff('USD', record.diffUSD)}</div>
                                                                {usdLines.length > 0 && <div className="pt-1 text-xs text-[var(--muted-foreground)]">Detalle: {usdLines.join(', ')}</div>}
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 text-xs text-[var(--muted-foreground)]">Sin datos en USD</div>
                                                        )}
                                                    </div>
                                                </div>
                                                {record.notes && record.notes.length > 0 && <div className="mt-3 text-xs text-[var(--muted-foreground)]">Notas: {record.notes}</div>}

                                                {/* Show related adjustment movements or an edited/resolved indicator */}
                                                {(() => {
                                                    const relatedAdjustments = fondoEntries.filter(e => e.originalEntryId === record.id && e.providerCode === 'AJUSTE FONDO GENERAL');
                                                    if (relatedAdjustments.length === 0 && (record.diffCRC === 0 && record.diffUSD === 0)) {
                                                        const isExpanded = expandedClosings.has(record.id);
                                                        return (
                                                            <div className="mt-3">
                                                                <div className="flex items-center justify-between p-3 rounded border-l-4 border-green-500 bg-green-900/5 text-sm">
                                                                    <div>
                                                                        <div className="font-medium">Cierre editado — diferencias resueltas</div>
                                                                        <div className="text-xs text-[var(--muted-foreground)]">Los ajustes previos fueron eliminados y el saldo quedó normalizado.</div>
                                                                    </div>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setExpandedClosings(prev => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(record.id)) next.delete(record.id);
                                                                                else next.add(record.id);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        aria-expanded={isExpanded}
                                                                        aria-controls={`closing-resolved-${record.id}`}
                                                                        className="ml-4 p-1 rounded border border-transparent hover:border-[var(--input-border)]"
                                                                        title={isExpanded ? 'Ocultar detalles' : 'Mostrar detalles'}
                                                                    >
                                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                                    </button>
                                                                </div>

                                                                {isExpanded && (
                                                                    <div id={`closing-resolved-${record.id}`} className="mt-2 p-3 rounded border border-[var(--input-border)] bg-[var(--muted)]/5 text-sm text-[var(--muted-foreground)]">
                                                                        <div className="mb-2">
                                                                            <div><strong>Conteo:</strong> {formatByCurrency('CRC', record.totalCRC)} / {formatByCurrency('USD', record.totalUSD)}</div>
                                                                            <div><strong>Saldo registrado:</strong> {formatByCurrency('CRC', record.recordedBalanceCRC)} / {formatByCurrency('USD', record.recordedBalanceUSD)}</div>
                                                                            <div><strong>Diferencia:</strong> {record.diffCRC === 0 && record.diffUSD === 0 ? 'Sin diferencias' : `${formatDailyClosingDiff('CRC', record.diffCRC)} / ${formatDailyClosingDiff('USD', record.diffUSD)}`}</div>
                                                                        </div>
                                                                        <div className="text-xs text-[var(--input-border)]">
                                                                            <div className="mb-1 font-medium">Resumen de resolución:</div>
                                                                            {record.adjustmentResolution?.removedAdjustments && record.adjustmentResolution.removedAdjustments.length > 0 ? (
                                                                                <ul className="list-disc pl-5 text-[var(--muted-foreground)]">
                                                                                    {record.adjustmentResolution.removedAdjustments.map((adj, idx) => (
                                                                                        <li key={idx}>
                                                                                            {adj.currency}: {adj.amount && adj.amount !== 0 ? (adj.amount > 0 ? `+ ${formatByCurrency(adj.currency as 'CRC' | 'USD', adj.amount)}` : `- ${formatByCurrency(adj.currency as 'CRC' | 'USD', Math.abs(adj.amount))}`) : `${formatByCurrency(adj.currency as 'CRC' | 'USD', (adj.amountIngreso || 0) - (adj.amountEgreso || 0))}`}
                                                                                            {adj.manager ? ` — ${adj.manager}` : ''}
                                                                                            {adj.createdAt ? ` • ${(() => { try { return dateTimeFormatter.format(new Date(adj.createdAt)); } catch { return adj.createdAt; } })()}` : ''}
                                                                                        </li>
                                                                                    ))}
                                                                                </ul>
                                                                            ) : (
                                                                                <ul className="list-disc pl-5 text-[var(--muted-foreground)]">
                                                                                    <li>Los ajustes asociados a este cierre fueron eliminados manualmente.</li>
                                                                                    <li>El saldo del fondo quedó normalizado contra el conteo proporcionado.</li>
                                                                                </ul>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    if (relatedAdjustments.length > 0) {
                                                        const postAdjBalanceCRC = record.adjustmentResolution?.postAdjustmentBalanceCRC;
                                                        const postAdjBalanceUSD = record.adjustmentResolution?.postAdjustmentBalanceUSD;
                                                        const showPostAdjustmentBalances =
                                                            typeof postAdjBalanceCRC === 'number' || typeof postAdjBalanceUSD === 'number';
                                                        return (
                                                            <div className="mt-3">
                                                                <div className="text-sm font-medium mb-2">Ajustes relacionados</div>
                                                                <div className="space-y-2">
                                                                    {relatedAdjustments.map(adj => {
                                                                        // determine displayed amount and sign
                                                                        const amt = (adj.amountIngreso || 0) - (adj.amountEgreso || 0);
                                                                        let auditHistory: any[] = [];
                                                                        try {
                                                                            const parsed = adj.auditDetails ? JSON.parse(adj.auditDetails) as any : null;
                                                                            if (parsed) {
                                                                                if (Array.isArray(parsed.history)) auditHistory = parsed.history.slice();
                                                                                else if (parsed.before && parsed.after) auditHistory = [{ at: parsed.at ?? adj.createdAt, before: parsed.before, after: parsed.after }];
                                                                            }
                                                                        } catch {
                                                                            auditHistory = [];
                                                                        }

                                                                        const lastChange = auditHistory.length > 0 ? auditHistory[auditHistory.length - 1] : null;

                                                                        return (
                                                                            <div key={adj.id} className="p-3 rounded border border-[var(--input-border)] bg-[var(--muted)]/10">
                                                                                <div className="flex items-center justify-between">
                                                                                    <div className="font-semibold">{adj.currency} — {amt >= 0 ? '+' : '-'} {formatByCurrency(adj.currency as 'CRC' | 'USD', Math.abs(amt))}</div>
                                                                                    <div className="text-xs text-[var(--muted-foreground)]">{adj.manager || '—'} • {(() => { try { return dateTimeFormatter.format(new Date(adj.createdAt)); } catch { return adj.createdAt; } })()}</div>
                                                                                </div>
                                                                                {adj.breakdown && Object.keys(adj.breakdown).length > 0 && (
                                                                                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                                                                                        <div className="font-medium">Detalle de billetes:</div>
                                                                                        <div className="text-xs mt-1">{buildBreakdownLines(adj.currency as 'CRC' | 'USD', adj.breakdown).join(', ')}</div>
                                                                                    </div>
                                                                                )}
                                                                                {lastChange ? (
                                                                                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">
                                                                                        <div className="font-medium">Último cambio registrado:</div>
                                                                                        <div>Antes: {(() => {
                                                                                            const beforeAmt = lastChange.before ? ((lastChange.before.amountIngreso || 0) - (lastChange.before.amountEgreso || 0)) : undefined;
                                                                                            return typeof beforeAmt === 'number' ? formatByCurrency(adj.currency as 'CRC' | 'USD', Math.abs(beforeAmt)) : '—';
                                                                                        })()}</div>
                                                                                        <div>Después: {(() => {
                                                                                            const afterAmt = lastChange.after ? ((lastChange.after.amountIngreso || 0) - (lastChange.after.amountEgreso || 0)) : undefined;
                                                                                            return typeof afterAmt === 'number' ? formatByCurrency(adj.currency as 'CRC' | 'USD', Math.abs(afterAmt)) : '—';
                                                                                        })()}</div>
                                                                                        {lastChange.at && <div className="text-[11px] text-[var(--muted-foreground)] mt-1">Registro: {dateTimeFormatter.format(new Date(lastChange.at))}</div>}
                                                                                    </div>
                                                                                ) : (
                                                                                    <div className="mt-2 text-xs text-[var(--muted-foreground)]">Movimiento sin historial de edición.</div>
                                                                                )}
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                                {showPostAdjustmentBalances && (
                                                                    <div className="mt-3 text-xs text-[var(--muted-foreground)]">
                                                                        <div className="font-medium text-[var(--muted-foreground)]">Saldo posterior a ajustes</div>
                                                                        {typeof postAdjBalanceCRC === 'number' && (
                                                                            <div>CRC: {formatByCurrency('CRC', postAdjBalanceCRC)}</div>
                                                                        )}
                                                                        {typeof postAdjBalanceUSD === 'number' && (
                                                                            <div>USD: {formatByCurrency('USD', postAdjBalanceUSD)}</div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    }

                                                    return null;
                                                })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export function OtraSection({ id }: { id?: string }) {
    return (
        <div id={id} className="mt-10">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                <Layers className="w-5 h-5" /> Reportes
            </h2>
            <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
                <p className="text-[var(--muted-foreground)]">Acciones adicionales proximamente.</p>
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
