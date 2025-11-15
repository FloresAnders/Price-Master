"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Settings,
    Lock,
    LockOpen,
    CalendarDays,
    ChevronLeft,
    ChevronRight,
    Wallet,
} from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useProviders } from '../../../hooks/useProviders';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { EmpresasService } from '../../../services/empresas';
import AgregarMovimiento from './AgregarMovimiento';

const FONDO_INGRESO_TYPES = ['VENTAS', 'OTROS INGRESOS'] as const;
const FONDO_EGRESO_TYPES = [
    'COMPRA INVENTARIO',
    'SALARIOS',
    'REPARACION EQUIPO',
    'PAGO TIEMPOS',
    'PAGO BANCA',
    'CARGAS SOCIALES',
    'ELECTRICIDAD',
] as const;

// Opciones visibles en el selector
const FONDO_TYPE_OPTIONS = [...FONDO_INGRESO_TYPES, ...FONDO_EGRESO_TYPES] as const;

export type FondoMovementType = typeof FONDO_INGRESO_TYPES[number] | typeof FONDO_EGRESO_TYPES[number];

const isFondoMovementType = (value: string): value is FondoMovementType =>
    FONDO_TYPE_OPTIONS.includes(value as FondoMovementType);

const isIngresoType = (type: FondoMovementType) => (FONDO_INGRESO_TYPES as readonly string[]).includes(type);
const isEgresoType = (type: FondoMovementType) => !isIngresoType(type);

// Formatea en Titulo Caso cada palabra
const formatMovementType = (type: FondoMovementType) =>
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
        if (upper === 'MANTENIMIENTO') return 'REPARACION EQUIPO';
        if (upper === 'SALARIO' || upper === 'SALARIOS') return 'SALARIOS';
        if (upper === 'GASTO') return 'ELECTRICIDAD'; // categoria generica de gasto
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
    currency?: 'CRC' | 'USD';
    // audit fields: when an edit is recorded, we create an audit movement
    isAudit?: boolean;
    originalEntryId?: string;
    auditDetails?: string;
};

const FONDO_KEY = 'fg_fondos_v1';
const FONDO_INITIAL_KEY = 'fg_fondo_initial_v1';
const FONDO_INITIAL_USD_KEY = 'fg_fondo_initial_usd_v1';
const ADMIN_CODE = '12345'; // TODO: Permitir configurar este codigo desde el perfil de un administrador.

export function ProviderSection({ id }: { id?: string }) {
    const { user, loading: authLoading } = useAuth();
    const company = user?.ownercompanie?.trim() ?? '';
    const { providers, loading: providersLoading, error, addProvider, removeProvider, updateProvider } = useProviders(company);

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
                <div className="flex items-center">
                    <button
                        type="button"
                        onClick={() => {
                            setEditingProviderCode(null);
                            setProviderName('');
                            setProviderType('');
                            setProviderDrawerOpen(true);
                        }}
                        className="px-4 py-2 border border-[var(--input-border)] rounded flex items-center gap-2 hover:bg-[var(--muted)]"
                        disabled={!company}
                    >
                        <Plus className="w-4 h-4" />
                        Agregar proveedor
                    </button>
                </div>
            </div>

            {!authLoading && !company && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Tu usuario no tiene una empresa asociada; no es posible registrar proveedores.
                </p>
            )}

            {resolvedError && <div className="mb-4 text-sm text-red-500">{resolvedError}</div>}



            <div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Lista de Proveedores</h3>
                {isLoading ? (
                    <p className="text-[var(--muted-foreground)]">Cargando proveedores...</p>
                ) : (
                    <ul className="space-y-2">
                        {providers.length === 0 && <li className="text-[var(--muted-foreground)]">Aun no hay proveedores.</li>}
                        {providers.map(p => (
                            <li key={p.code} className="flex items-center justify-between bg-[var(--muted)] p-3 rounded">
                                <div>
                                    <div className="text-[var(--foreground)] font-semibold">{p.name}</div>
                                    <div className="text-xs text-[var(--muted-foreground)]">Codigo: {p.code}</div>
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
                                <option value="">Tipo</option>
                                {FONDO_TYPE_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                                ))}
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

export function FondoSection({ id }: { id?: string }) {
    const { user, loading: authLoading } = useAuth();
    const company = user?.ownercompanie?.trim() ?? '';
    const { providers, loading: providersLoading, error: providersError } = useProviders(company);

    const [fondoEntries, setFondoEntries] = useState<FondoEntry[]>([]);
    const [companyEmployees, setCompanyEmployees] = useState<string[]>([]);
    const [employeesLoading, setEmployeesLoading] = useState(false);

    const [selectedProvider, setSelectedProvider] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentType, setPaymentType] = useState<FondoEntry['paymentType']>('COMPRA INVENTARIO');
    const [egreso, setEgreso] = useState('');
    const [ingreso, setIngreso] = useState('');
    const [manager, setManager] = useState('');
    const [notes, setNotes] = useState('');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [initialAmount, setInitialAmount] = useState('0');
    const [initialAmountUSD, setInitialAmountUSD] = useState('0');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsUnlocked, setSettingsUnlocked] = useState(false);
    const [adminCodeInput, setAdminCodeInput] = useState('');
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [movementModalOpen, setMovementModalOpen] = useState(false);
    const [movementAutoCloseLocked, setMovementAutoCloseLocked] = useState(false);
    const [movementCurrency, setMovementCurrency] = useState<'CRC' | 'USD'>('CRC');
    // Audit modal state: show full before/after history when an edited entry is clicked
    const [auditModalOpen, setAuditModalOpen] = useState(false);
    const [auditModalData, setAuditModalData] = useState<{ history?: any[] } | null>(null);
    // sortAsc: when true we show oldest first (so newest appears at the bottom).
    // Default true per UX: the most recent movement should appear below.
    const [sortAsc, setSortAsc] = useState(true);

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
    const [fromFilter, setFromFilter] = useState<string | null>(null);
    const [toFilter, setToFilter] = useState<string | null>(null);

    // Advanced filters
    const [filterProviderCode, setFilterProviderCode] = useState<string | 'all'>('all');
    const [filterPaymentType, setFilterPaymentType] = useState<FondoEntry['paymentType'] | 'all'>('all');
    const [filterEditedOnly, setFilterEditedOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

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
    const isEgreso = isEgresoType(paymentType);

    const employeeOptions = useMemo(
        () => companyEmployees.filter(name => !!name && name.trim().length > 0),
        [companyEmployees],
    );

    const editingEntry = useMemo(
        () => (editingEntryId ? fondoEntries.find(entry => entry.id === editingEntryId) ?? null : null),
        [editingEntryId, fondoEntries],
    );
    const editingProviderCode = editingEntry?.providerCode ?? null;

    useEffect(() => {
        try {
            const rawF = localStorage.getItem(FONDO_KEY);
            if (!rawF) {
                setFondoEntries([]);
                return;
            }

            const parsed = JSON.parse(rawF);
            if (!Array.isArray(parsed)) {
                setFondoEntries([]);
                return;
            }

            const sanitized: FondoEntry[] = (parsed as any[]).reduce<FondoEntry[]>((acc, raw) => {
                const entry = raw as Partial<FondoEntry>;

                const id = typeof entry.id === 'string' ? entry.id : undefined;
                const providerCode = typeof entry.providerCode === 'string' ? entry.providerCode : undefined;
                const invoiceNumber = typeof entry.invoiceNumber === 'string' ? entry.invoiceNumber : '';
                const paymentType = normalizeStoredType(entry.paymentType);
                const manager = typeof entry.manager === 'string' ? entry.manager : undefined;
                const createdAt = typeof entry.createdAt === 'string' ? entry.createdAt : undefined;

                // required runtime fields: id, providerCode, manager, createdAt
                if (!id || !providerCode || !manager || !createdAt) return acc;

                const rawEgreso = typeof entry.amountEgreso === 'number' ? entry.amountEgreso : Number(entry.amountEgreso) || 0;
                const rawIngreso = typeof entry.amountIngreso === 'number' ? entry.amountIngreso : Number(entry.amountIngreso) || 0;

                const amountEgreso = Math.trunc(rawEgreso);
                const amountIngreso = Math.trunc(rawIngreso);

                const normalized: FondoEntry = {
                    id,
                    providerCode,
                    invoiceNumber,
                    paymentType,
                    currency: (entry as any).currency === 'USD' ? 'USD' : 'CRC',
                    amountEgreso: isEgresoType(paymentType) ? amountEgreso : 0,
                    amountIngreso: isIngresoType(paymentType) ? amountIngreso : 0,
                    manager,
                    notes: typeof entry.notes === 'string' ? entry.notes : '',
                    createdAt,
                    isAudit: !!entry.isAudit,
                    originalEntryId: typeof entry.originalEntryId === 'string' ? entry.originalEntryId : undefined,
                    auditDetails: typeof entry.auditDetails === 'string' ? entry.auditDetails : undefined,
                };

                acc.push(normalized);
                return acc;
            }, []);

            setFondoEntries(sanitized);
        } catch (err) {
            console.error('Error reading fondo entries from localStorage:', err);
        }
    }, []);

    useEffect(() => {
        try {
            const storedInitial = localStorage.getItem(FONDO_INITIAL_KEY);
            if (storedInitial !== null) {
                setInitialAmount(storedInitial);
            }
            const storedInitialUsd = localStorage.getItem(FONDO_INITIAL_USD_KEY);
            if (storedInitialUsd !== null) setInitialAmountUSD(storedInitialUsd);
        } catch (err) {
            console.error('Error reading initial fondo amount from localStorage:', err);
        }
    }, []);

    useEffect(() => {
        localStorage.setItem(FONDO_KEY, JSON.stringify(fondoEntries));
    }, [fondoEntries]);

    useEffect(() => {
        try {
            const normalized = initialAmount.trim().length > 0 ? initialAmount : '0';
            localStorage.setItem(FONDO_INITIAL_KEY, normalized);
            const normalizedUsd = initialAmountUSD.trim().length > 0 ? initialAmountUSD : '0';
            localStorage.setItem(FONDO_INITIAL_USD_KEY, normalizedUsd);
        } catch (err) {
            console.error('Error storing initial fondo amount to localStorage:', err);
        }
    }, [initialAmount, initialAmountUSD]);

    useEffect(() => {
        if (!selectedProvider) return;
        const exists = providers.some(p => p.code === selectedProvider);
        const isEditingSameProvider = editingEntryId && editingProviderCode === selectedProvider;
        if (!exists && !isEditingSameProvider) {
            setSelectedProvider('');
        }
    }, [providers, selectedProvider, editingEntryId, editingProviderCode]);

    useEffect(() => {
        let isActive = true;
        if (!company) {
            setCompanyEmployees([]);
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

    const resetFondoForm = () => {
        setInvoiceNumber('');
        setEgreso('');
        setIngreso('');
        setManager('');
        setPaymentType('COMPRA INVENTARIO');
        setNotes('');
        setEditingEntryId(null);
    };

    const normalizeMoneyInput = (value: string) => value.replace(/[^0-9]/g, '');

    const handleInitialAmountChange = (value: string) => {
        setInitialAmount(normalizeMoneyInput(value));
    };

    const handleInitialAmountBlur = () => {
        setInitialAmount(prev => {
            const normalized = prev.trim().length > 0 ? normalizeMoneyInput(prev) : '0';
            return normalized.length > 0 ? normalized : '0';
        });
    };

    const openSettings = () => {
        setSettingsOpen(true);
        setSettingsUnlocked(false);
        setAdminCodeInput('');
        setSettingsError(null);
    };

    const closeSettings = useCallback(() => {
        setSettingsOpen(false);
        setSettingsUnlocked(false);
        setAdminCodeInput('');
        setSettingsError(null);
    }, []);

    const handleAdminCodeSubmit = (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (adminCodeInput.trim() === ADMIN_CODE) {
            setSettingsUnlocked(true);
            setSettingsError(null);
            setAdminCodeInput('');
            return;
        }
        setSettingsError('Codigo incorrecto.');
    };

    useEffect(() => {
        if (!settingsOpen) return;
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                closeSettings();
            }
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [settingsOpen, closeSettings]);

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

            setFondoEntries(prev => prev.map(e => {
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
                const newRecord = { at: new Date().toISOString(), before: { ...e }, after: { providerCode: selectedProvider, invoiceNumber: paddedInvoice, paymentType, amountEgreso: isEgreso ? egresoValue : 0, amountIngreso: isEgreso ? 0 : ingresoValue, manager, notes: trimmedNotes } };
                history.push(newRecord);
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
                    auditDetails: JSON.stringify({ history }),
                    currency: movementCurrency,
                } as FondoEntry;
            }));

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

    const cancelEditing = () => {
        resetFondoForm();
    };

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
    const initialAmountValue = Number.parseInt(initialAmount, 10) || 0;

    const { totalIngresosCRC, totalEgresosCRC, currentBalanceCRC, totalIngresosUSD, totalEgresosUSD, currentBalanceUSD } = useMemo(() => {
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
            totalIngresosCRC: ingresosCRC,
            totalEgresosCRC: egresosCRC,
            currentBalanceCRC: balanceCRC,
            totalIngresosUSD: ingresosUSD,
            totalEgresosUSD: egresosUSD,
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
    const dateTimeFormatter = useMemo(
        () =>
            new Intl.DateTimeFormat('es-CR', {
                dateStyle: 'short',
                timeStyle: 'short',
            }),
        [],
    );
    const formatAmount = (value: number) => amountFormatter.format(Math.trunc(value));
    const formatByCurrency = (currency: 'CRC' | 'USD', value: number) =>
        currency === 'USD' ? `$ ${amountFormatterUSD.format(Math.trunc(value))}` : `₡ ${amountFormatter.format(Math.trunc(value))}`;

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
        setMovementCurrency('CRC');
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
        setMovementModalOpen(true);
    };

    const handleFondoKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmitFondo();
        }
    };

    const displayedEntries = useMemo(() => (sortAsc ? [...fondoEntries].slice().reverse() : fondoEntries), [fondoEntries, sortAsc]);

    const dateKeyFromDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

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
    }, [displayedEntries, fromFilter, toFilter, filterProviderCode, filterPaymentType, filterEditedOnly, searchQuery, providersMap]);

    // Pagination: pageSize may be 5,10,15 or 'all'. Default to 10 visible items.
    const [pageSize, setPageSize] = useState<number | 'all'>(10);
    const [pageIndex, setPageIndex] = useState(0);

    const totalPages = useMemo(() => {
        if (pageSize === 'all') return 1;
        return Math.max(1, Math.ceil(filteredEntries.length / pageSize));
    }, [filteredEntries.length, pageSize]);

    useEffect(() => {
        // clamp pageIndex when entries or pageSize change
        setPageIndex(prev => Math.min(prev, Math.max(0, totalPages - 1)));
    }, [totalPages]);

    useEffect(() => {
        // whenever user changes pageSize, reset to first page
        setPageIndex(0);
    }, [pageSize]);

    const paginatedEntries = useMemo(() => {
        if (pageSize === 'all') return filteredEntries;
        const start = pageIndex * pageSize;
        return filteredEntries.slice(start, start + pageSize);
    }, [filteredEntries, pageIndex, pageSize]);

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

    return (
        <div id={id} className="mt-6">
            {/* Main title at the very top - centered with icon above */}
            <div className="mb-4 flex flex-col items-center justify-center">
                <Wallet className="w-8 h-8 text-[var(--accent)] mb-1.5" />
                <h2 className="text-xl font-semibold text-[var(--foreground)] text-center">
                    Registrar movimiento de Fondo
                </h2>
            </div>

            {/* Professional filter bar - centered */}
            <div className="mb-4 flex flex-col items-center justify-center gap-3 pb-3 border-b border-[var(--input-border)]">
                <div className="flex flex-wrap items-center justify-center gap-2">
                    <select
                        value={filterProviderCode}
                        onChange={e => setFilterProviderCode(e.target.value || 'all')}
                        className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--muted-foreground)]"
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
                        className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm text-[var(--muted-foreground)]"
                        title="Filtrar por tipo"
                        aria-label="Filtrar por tipo"
                    >
                        <option value="all">Todas las categorías</option>
                        {FONDO_TYPE_OPTIONS.map(opt => (
                            <option key={opt} value={opt}>{formatMovementType(opt)}</option>
                        ))}
                    </select>

                    <input
                        type="search"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Buscar factura, notas o proveedor"
                        className="px-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm w-48 text-[var(--muted-foreground)]"
                        aria-label="Buscar movimientos"
                    />

                    <label className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
                        <input type="checkbox" checked={filterEditedOnly} onChange={e => setFilterEditedOnly(e.target.checked)} />
                        Editados
                    </label>

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
                        className="px-3 py-2 bg-transparent border border-[var(--input-border)] rounded text-sm text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                        title="Limpiar filtros"
                    >
                        Limpiar
                    </button>
                </div>
            </div>

            {/* Calendars and Add button - all centered */}
            <div className="mb-4 flex flex-col items-center justify-center gap-3">
                <div className="flex items-center justify-center gap-3 relative flex-wrap">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            ref={fromButtonRef}
                            onClick={() => setCalendarFromOpen(prev => !prev)}
                            className="flex items-center gap-2 px-3 py-2 border border-[var(--input-border)] rounded hover:bg-[var(--muted)] bg-transparent text-[var(--muted-foreground)]"
                            title="Seleccionar fecha desde"
                            aria-label="Seleccionar fecha desde"
                        >
                            <span className="text-sm font-medium">{fromFilter ? formatKeyToDisplay(fromFilter) : 'dd/mm/yyyy'}</span>
                            <CalendarDays className="w-4 h-4" />
                        </button>

                        {calendarFromOpen && (
                            <div ref={fromCalendarRef} className="absolute left-0 top-full mt-2 z-50" onClick={e => e.stopPropagation()}>
                                <div className="w-64 bg-[#1f262a] border border-[var(--input-border)] rounded p-3 shadow-lg text-white">
                                    <div className="flex items-center justify-between mb-2">
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

                                    <div className="grid grid-cols-7 gap-1 mt-2 text-sm">
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
                                            className="px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCalendarFromOpen(false)}
                                            className="px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <button
                            type="button"
                            ref={toButtonRef}
                            onClick={() => setCalendarToOpen(prev => !prev)}
                            className="flex items-center gap-2 px-3 py-2 border border-[var(--input-border)] rounded hover:bg-[var(--muted)] bg-transparent text-[var(--muted-foreground)]"
                            title="Seleccionar fecha hasta"
                            aria-label="Seleccionar fecha hasta"
                        >
                            <span className="text-sm font-medium">{toFilter ? formatKeyToDisplay(toFilter) : 'dd/mm/yyyy'}</span>
                            <CalendarDays className="w-4 h-4" />
                        </button>

                        {calendarToOpen && (
                            <div ref={toCalendarRef} className="absolute left-40 top-full mt-2 z-50" onClick={e => e.stopPropagation()}>
                                <div className="w-64 bg-[#1f262a] border border-[var(--input-border)] rounded p-3 shadow-lg text-white">
                                    <div className="flex items-center justify-between mb-2">
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

                                    <div className="grid grid-cols-7 gap-1 mt-2 text-sm">
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
                                            className="px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCalendarToOpen(false)}
                                            className="px-2 py-1 border border-[var(--input-border)] rounded text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                                        >
                                            Cerrar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={handleOpenCreateMovement}
                        className="flex items-center gap-2 px-4 py-2 text-white rounded fg-add-mov-btn"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar movimiento
                    </button>
                    {/* Settings button moved into the balance card below */}
                </div>
            </div>

            {!authLoading && !company && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Tu usuario no tiene una empresa asociada; registra una empresa para continuar.
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
                        <div className="max-h-[36rem] overflow-y-auto">
                            {(fromFilter || toFilter) && (
                                <div className="px-3 py-2">
                                    <div className="text-sm text-[var(--muted-foreground)]">
                                        Filtro: {fromFilter ? formatGroupLabel(fromFilter) : '—'}{toFilter ? ` → ${formatGroupLabel(toFilter)}` : ''}
                                        <button
                                            type="button"
                                            onClick={() => { setFromFilter(null); setToFilter(null); setPageIndex(0); setPageSize(10); }}
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
                                                        onClick={() => setSortAsc(prev => !prev)}
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
                                            const isEntryEgreso = isEgresoType(fe.paymentType);
                                            const movementAmount = isEntryEgreso ? fe.amountEgreso : fe.amountIngreso;
                                            const entryCurrency = (fe.currency as 'CRC' | 'USD') || 'CRC';
                                            const balanceAfter = entryCurrency === 'USD' ? (balanceAfterByIdUSD.get(fe.id) ?? (Number(initialAmountUSD) || 0)) : (balanceAfterByIdCRC.get(fe.id) ?? (Number(initialAmount) || 0));
                                            // compute the balance immediately before this movement was applied (in the movement currency)
                                            const previousBalance = isEntryEgreso
                                                ? balanceAfter + fe.amountEgreso
                                                : balanceAfter - fe.amountIngreso;
                                            const recordedAt = new Date(fe.createdAt);
                                            const formattedDate = Number.isNaN(recordedAt.getTime())
                                                ? 'Sin fecha'
                                                : dateTimeFormatter.format(recordedAt);
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
                                                        if (before.providerCode !== after.providerCode) parts.push(`Proveedor: ${before.providerCode} → ${after.providerCode}`);
                                                        if (before.invoiceNumber !== after.invoiceNumber) parts.push(`Factura: ${before.invoiceNumber} → ${after.invoiceNumber}`);
                                                        if (before.paymentType !== after.paymentType) parts.push(`Tipo: ${before.paymentType} → ${after.paymentType}`);
                                                        const beforeAmt = before && before.paymentType ? (isEgresoType(before.paymentType) ? Number(before.amountEgreso || 0) : Number(before.amountIngreso || 0)) : undefined;
                                                        const afterAmt = after && (after.paymentType ?? before.paymentType) ? (isEgresoType(after.paymentType ?? before.paymentType) ? Number(after.amountEgreso || 0) : Number(after.amountIngreso || 0)) : undefined;
                                                        const beforeCur = (before && (before.currency as 'CRC' | 'USD')) || entryCurrency || 'CRC';
                                                        const afterCur = (after && (after.currency as 'CRC' | 'USD')) || entryCurrency || 'CRC';
                                                        if (typeof beforeAmt === 'number' && typeof afterAmt === 'number' && beforeAmt !== afterAmt) {
                                                            parts.push(`Monto: ${formatByCurrency(beforeCur, beforeAmt)} → ${formatByCurrency(afterCur, afterAmt)}`);
                                                        }
                                                        if (before.manager !== after.manager) parts.push(`Encargado: ${before.manager} → ${after.manager}`);
                                                        if ((before.notes ?? '') !== (after.notes ?? '')) parts.push(`Notas: "${before.notes ?? ''}" → "${after.notes ?? ''}"`);
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
                                                    className={`border-t border-[var(--input-border)] hover:bg-[var(--muted)] ${isMostRecent ? 'bg-[#273238]' : ''}`}
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
                                                        <button
                                                            type="button"
                                                            className="inline-flex items-center gap-2 rounded border border-[var(--input-border)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] hover:bg-[var(--muted)] disabled:opacity-50"
                                                            onClick={() => startEditingEntry(fe)}
                                                            disabled={editingEntryId === fe.id}
                                                            title={'Editar movimiento'}
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                            {editingEntryId === fe.id ? 'Editando' : 'Editar'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                ))}
                            </table>
                        </div>
                        <div className="px-3 py-2 flex items-center justify-between bg-transparent text-sm text-[var(--muted-foreground)]">
                            <div className="flex items-center gap-2">
                                <span>Mostrar</span>
                                <select
                                    value={pageSize === 'all' ? 'all' : String(pageSize)}
                                    onChange={e => {
                                        const v = e.target.value;
                                        if (v === 'all') setPageSize('all');
                                        else setPageSize(Number.parseInt(v, 10) || 10);
                                    }}
                                    className="p-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-sm"
                                >
                                    <option value="5">5</option>
                                    <option value="10">10</option>
                                    <option value="15">15</option>
                                    <option value="all">Todos</option>
                                </select>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPageIndex(p => Math.max(0, p - 1))}
                                    disabled={pageIndex <= 0}
                                    className="px-2 py-1 border border-[var(--input-border)] rounded disabled:opacity-50"
                                >
                                    Anterior
                                </button>
                                <div className="px-2">Página {Math.min(pageIndex + 1, totalPages)} de {totalPages}</div>
                                <button
                                    type="button"
                                    onClick={() => setPageIndex(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={pageIndex >= totalPages - 1}
                                    className="px-2 py-1 border border-[var(--input-border)] rounded disabled:opacity-50"
                                >
                                    Siguiente
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="mt-5">
                <div className="grid items-center grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-4">
                    <a
                        href="/fondogeneral"
                        className="text-sm text-[var(--muted-foreground)] sm:justify-self-start flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                            <path d="M19 12H5" />
                            <path d="M12 19l-7-7 7-7" />
                        </svg>
                        <span>Volver</span>
                    </a>

                    <div className="w-full sm:w-auto sm:justify-self-center">
                        <div className="px-4 py-3 rounded min-w-[320px] fg-balance-card relative">
                            <div className="sr-only">Saldo actual</div>
                            <div className="flex items-center">
                                <div className="flex-1 text-center">
                                    <div className="text-xs uppercase tracking-wide">Colones</div>
                                    <div className="text-lg font-semibold">
                                        {formatByCurrency('CRC', currentBalanceCRC)}
                                    </div>
                                </div>

                                <div className="mx-3 flex items-center" aria-hidden>
                                    <div style={{ width: 2, height: '70%', background: 'rgba(255,255,255,0.18)', borderRadius: 3 }} />
                                </div>

                                <div className="flex-1 text-center">
                                    <div className="text-xs uppercase tracking-wide">Dólares</div>
                                    <div className="text-lg font-semibold">
                                        {formatByCurrency('USD', currentBalanceUSD)}
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={openSettings}
                                title="Abrir configuracion del fondo"
                                aria-label="Abrir configuracion del fondo"
                                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded border border-transparent hover:bg-[var(--muted)]"
                            >
                                <Settings className="w-4 h-4 text-[var(--foreground)]" />
                            </button>
                        </div>
                    </div>

                    <div className="hidden sm:block" />
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
            {settingsOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-gray-800/40 px-4"
                    onClick={closeSettings}
                >
                    <div
                        className="w-full max-w-2xl rounded border border-[var(--input-border)] bg-[#1f262a] p-6 shadow-lg text-white"
                        onClick={event => event.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="fondo-settings-title"
                    >
                        <h3 id="fondo-settings-title" className="text-lg font-semibold text-[var(--foreground)]">
                            Configuracion del fondo
                        </h3>
                        {!settingsUnlocked ? (
                            <form onSubmit={handleAdminCodeSubmit} className="mt-4 space-y-4">
                                <p className="text-sm text-[var(--muted-foreground)]">
                                    Ingresa el codigo de administrador para acceder a la configuracion.
                                </p>
                                <input
                                    type="password"
                                    value={adminCodeInput}
                                    onChange={e => {
                                        setAdminCodeInput(e.target.value);
                                        if (settingsError) setSettingsError(null);
                                    }}
                                    className={`w-full p-2 bg-[var(--input-bg)] border ${settingsError ? 'border-red-500' : 'border-[var(--input-border)]'} rounded`}
                                    placeholder="Codigo de administrador"
                                    autoFocus
                                />
                                {settingsError && <p className="text-sm text-red-500">{settingsError}</p>}
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={closeSettings}
                                        className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)]"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-4 py-2 bg-[var(--accent)] text-white rounded"
                                    >
                                        Validar
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="mt-4 space-y-5">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start">
                                    <div className="rounded border border-[var(--input-border)] bg-[var(--muted)] p-4 md:w-80">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                                            Monto inicial del fondo (Colones)
                                        </label>
                                        <input
                                            value={initialAmount.trim().length > 0 ? formatByCurrency('CRC', Number(initialAmount)) : ''}
                                            onChange={e => handleInitialAmountChange(e.target.value)}
                                            onBlur={() => handleInitialAmountBlur()}
                                            className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                                            placeholder="0"
                                            inputMode="numeric"
                                            disabled={!company}
                                        />
                                        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                                            Se usa como base para calcular el saldo disponible tras cada movimiento (colones).
                                        </p>
                                    </div>
                                    <div className="rounded border border-[var(--input-border)] bg-[var(--muted)] p-4 md:w-80">
                                        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)] mb-1">
                                            Monto inicial del fondo (Dólares)
                                        </label>
                                        <input
                                            value={initialAmountUSD.trim().length > 0 ? formatByCurrency('USD', Number(initialAmountUSD)) : ''}
                                            onChange={e => {
                                                const digits = normalizeMoneyInput(e.target.value);
                                                setInitialAmountUSD(digits);
                                            }}
                                            onBlur={() => {
                                                setInitialAmountUSD(prev => {
                                                    const normalized = prev.trim().length > 0 ? normalizeMoneyInput(prev) : '0';
                                                    return normalized.length > 0 ? normalized : '0';
                                                });
                                            }}
                                            className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                                            placeholder="0"
                                            inputMode="numeric"
                                            disabled={!company}
                                        />
                                        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                                            Monto inicial en dólares (saldo separado por moneda).
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo inicial (CRC)</div>
                                        <div className="text-lg font-semibold text-[var(--foreground)]">
                                            {formatByCurrency('CRC', Number(initialAmount) || 0)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total ingresos (CRC)</div>
                                        <div className="text-lg font-semibold text-emerald-600">
                                            {formatByCurrency('CRC', totalIngresosCRC)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total egresos (CRC)</div>
                                        <div className="text-lg font-semibold text-red-600">
                                            {formatByCurrency('CRC', totalEgresosCRC)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo actual (CRC)</div>
                                        <div className="text-lg font-semibold text-[var(--foreground)]">
                                            {formatByCurrency('CRC', currentBalanceCRC)}
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo inicial (USD)</div>
                                        <div className="text-lg font-semibold text-[var(--foreground)]">
                                            {formatByCurrency('USD', Number(initialAmountUSD) || 0)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total ingresos (USD)</div>
                                        <div className="text-lg font-semibold text-emerald-600">
                                            {formatByCurrency('USD', totalIngresosUSD)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total egresos (USD)</div>
                                        <div className="text-lg font-semibold text-red-600">
                                            {formatByCurrency('USD', totalEgresosUSD)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo actual (USD)</div>
                                        <div className="text-lg font-semibold text-[var(--foreground)]">
                                            {formatByCurrency('USD', currentBalanceUSD)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex justify-end gap-2">
                                    <button
                                        type="button"
                                        onClick={closeSettings}
                                        className="px-4 py-2 border border-[var(--input-border)] rounded text-[var(--foreground)] hover:bg-[var(--muted)]"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        )}
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
                <Layers className="w-5 h-5" /> Otra
            </h2>
            <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
                <p className="text-[var(--muted-foreground)]">Acciones adicionales proximamente.</p>
            </div>
        </div>
    );
}
