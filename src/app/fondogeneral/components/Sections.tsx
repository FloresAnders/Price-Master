"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Layers, Plus, Settings, Trash2, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useProviders } from '../../../hooks/useProviders';
import ConfirmModal from '../../../components/ui/ConfirmModal';
import { EmpresasService } from '../../../services/empresas';
import AgregarMovimiento from './AgregarMovimiento';

const FONDO_EGRESO_TYPES = ['COMPRA', 'GASTO', 'MANTENIMIENTO', 'SALARIO'] as const;
const FONDO_INGRESO_TYPES = ['INGRESO'] as const;
const FONDO_TYPE_OPTIONS = [...FONDO_EGRESO_TYPES, ...FONDO_INGRESO_TYPES] as const;
export type FondoMovementType = typeof FONDO_EGRESO_TYPES[number] | typeof FONDO_INGRESO_TYPES[number];
const isFondoMovementType = (value: string): value is FondoMovementType =>
    FONDO_TYPE_OPTIONS.includes(value as FondoMovementType);
const isIngresoType = (type: FondoMovementType) => type === 'INGRESO';
const isEgresoType = (type: FondoMovementType) => !isIngresoType(type);
const formatMovementType = (type: FondoMovementType) => type.charAt(0) + type.slice(1).toLowerCase();
const normalizeStoredType = (value: unknown): FondoMovementType => {
    if (typeof value === 'string') {
        const upper = value.toUpperCase();
        if (isFondoMovementType(upper)) {
            return upper;
        }
        if (upper === 'EGRESO') {
            return 'COMPRA';
        }
        if (upper === 'INGRESO') {
            return 'INGRESO';
        }
    }
    return 'COMPRA';
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
};

const FONDO_KEY = 'fg_fondos_v1';
const FONDO_INITIAL_KEY = 'fg_fondo_initial_v1';
const ADMIN_CODE = '12345'; // TODO: Permitir configurar este codigo desde el perfil de un administrador.

export function ProviderSection({ id }: { id?: string }) {
    const { user, loading: authLoading } = useAuth();
    const company = user?.ownercompanie?.trim() ?? '';
    const { providers, loading: providersLoading, error, addProvider, removeProvider } = useProviders(company);

    const [providerName, setProviderName] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingCode, setDeletingCode] = useState<string | null>(null);
    const [confirmState, setConfirmState] = useState<{ open: boolean; code: string; name: string }>({
        open: false,
        code: '',
        name: '',
    });

    const handleAddProvider = async () => {
        const name = providerName.trim().toUpperCase();
        if (!name) return;

        if (!company) {
            setFormError('Tu usuario no tiene una empresa asignada.');
            return;
        }

        if (providers.some(p => p.name.toUpperCase() === name)) {
            setFormError(`El proveedor "${name}" ya existe.`);
            return;
        }

        try {
            setSaving(true);
            setFormError(null);
            await addProvider(name);
            setProviderName('');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'No se pudo guardar el proveedor.';
            setFormError(message);
        } finally {
            setSaving(false);
        }
    };

    const openRemoveModal = (code: string, name: string) => {
        if (!company) return;
        setConfirmState({ open: true, code, name });
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
        <div id={id} className="mt-10">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2">
                <UserPlus className="w-5 h-5" /> Agregar proveedor
            </h2>

            {company && (
                <p className="text-xs text-[var(--muted-foreground)] mb-3">
                    Empresa asignada: <span className="font-medium text-[var(--foreground)]">{company}</span>
                </p>
            )}

            {!authLoading && !company && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Tu usuario no tiene una empresa asociada; no es posible registrar proveedores.
                </p>
            )}

            {resolvedError && <div className="mb-4 text-sm text-red-500">{resolvedError}</div>}

            <div className="flex gap-3 items-start mb-4">
                <input
                    className="flex-1 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                    placeholder="Nombre del proveedor"
                    value={providerName}
                    onChange={e => setProviderName(e.target.value.toUpperCase())}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleAddProvider();
                        }
                    }}
                    disabled={!company || saving || deletingCode !== null}
                />
                <button
                    className="px-4 py-3 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                    onClick={handleAddProvider}
                    disabled={!company || !providerName.trim() || saving || deletingCode !== null}
                >
                    {saving ? 'Guardando...' : 'Guardar'}
                </button>
            </div>

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
    const [paymentType, setPaymentType] = useState<FondoEntry['paymentType']>('COMPRA');
    const [egreso, setEgreso] = useState('');
    const [ingreso, setIngreso] = useState('');
    const [manager, setManager] = useState('');
    const [notes, setNotes] = useState('');
    const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
    const [initialAmount, setInitialAmount] = useState('0');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsUnlocked, setSettingsUnlocked] = useState(false);
    const [adminCodeInput, setAdminCodeInput] = useState('');
    const [settingsError, setSettingsError] = useState<string | null>(null);
    const [movementModalOpen, setMovementModalOpen] = useState(false);

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

            const sanitized = parsed
                .map((entry: Partial<FondoEntry>) => ({
                    ...entry,
                    paymentType: normalizeStoredType(entry.paymentType),
                    amountEgreso: Math.trunc(
                        typeof entry.amountEgreso === 'number' ? entry.amountEgreso : Number(entry.amountEgreso) || 0,
                    ),
                    amountIngreso: Math.trunc(
                        typeof entry.amountIngreso === 'number' ? entry.amountIngreso : Number(entry.amountIngreso) || 0,
                    ),
                    notes: typeof entry.notes === 'string' ? entry.notes : '',
                }))
                .filter((entry): entry is FondoEntry =>
                    typeof entry.id === 'string' &&
                    typeof entry.providerCode === 'string' &&
                    typeof entry.invoiceNumber === 'string' &&
                    typeof entry.paymentType === 'string' &&
                    typeof entry.manager === 'string' &&
                    typeof entry.notes === 'string' &&
                    typeof entry.createdAt === 'string',
                )
                .map(entry => ({
                    ...entry,
                    amountEgreso: isEgresoType(entry.paymentType) ? entry.amountEgreso : 0,
                    amountIngreso: isIngresoType(entry.paymentType) ? entry.amountIngreso : 0,
                }));

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
        } catch (err) {
            console.error('Error storing initial fondo amount to localStorage:', err);
        }
    }, [initialAmount]);

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
        setPaymentType('COMPRA');
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
            setFondoEntries(prev =>
                prev.map(entry =>
                    entry.id === editingEntryId
                        ? {
                            ...entry,
                            providerCode: selectedProvider,
                            invoiceNumber: paddedInvoice,
                            paymentType,
                            amountEgreso: isEgreso ? egresoValue : 0,
                            amountIngreso: isIngreso ? ingresoValue : 0,
                            manager,
                            notes: trimmedNotes,
                        }
                        : entry,
                ),
            );
            resetFondoForm();
            setMovementModalOpen(false);
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
        };

        setFondoEntries(prev => [entry, ...prev]);
        resetFondoForm();
        setMovementModalOpen(false);
    };

    const startEditingEntry = (entry: FondoEntry) => {
        setEditingEntryId(entry.id);
        setSelectedProvider(entry.providerCode);
        setInvoiceNumber(entry.invoiceNumber);
        setPaymentType(entry.paymentType);
        setManager(entry.manager);
        setNotes(entry.notes ?? '');
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

    const invoiceValid = /^[0-9]{1,4}$/.test(invoiceNumber) || invoiceNumber.length === 0;
    const egresoValue = Number.parseInt(egreso, 10);
    const ingresoValue = Number.parseInt(ingreso, 10);
    const egresoValid = isEgreso ? !Number.isNaN(egresoValue) && egresoValue > 0 : true;
    const ingresoValid = isIngreso ? !Number.isNaN(ingresoValue) && ingresoValue > 0 : true;
    const requiredAmountProvided = isEgreso ? egreso.trim().length > 0 : ingreso.trim().length > 0;
    const initialAmountValue = Number.parseInt(initialAmount, 10) || 0;

    const { totalIngresos, totalEgresos, currentBalance } = useMemo(() => {
        let ingresos = 0;
        let egresos = 0;
        fondoEntries.forEach(entry => {
            ingresos += entry.amountIngreso;
            egresos += entry.amountEgreso;
        });
        const balance = initialAmountValue + ingresos - egresos;
        return { totalIngresos: ingresos, totalEgresos: egresos, currentBalance: balance };
    }, [fondoEntries, initialAmountValue]);

    const balanceAfterById = useMemo(() => {
        let running = initialAmountValue;
        const ordered = [...fondoEntries].slice().reverse();
        const map = new Map<string, number>();
        ordered.forEach(entry => {
            running += entry.amountIngreso;
            running -= entry.amountEgreso;
            map.set(entry.id, running);
        });
        return map;
    }, [fondoEntries, initialAmountValue]);

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
    const formatAmount = (value: number) => amountFormatter.format(Math.trunc(value));

    const amountClass = (isActive: boolean, inputHasValue: boolean, isValid: boolean) => {
        if (!isActive) return 'border-[var(--input-border)]';
        if (inputHasValue && !isValid) return 'border-red-500';
        return 'border-[var(--input-border)]';
    };

    const handleProviderChange = (value: string) => setSelectedProvider(value);
    const handleInvoiceNumberChange = (value: string) => setInvoiceNumber(value.replace(/\D/g, '').slice(0, 4));
    const handlePaymentTypeChange = (value: string) => {
        if (isFondoMovementType(value)) {
            setPaymentType(value);
        }
    };
    const handleEgresoChange = (value: string) => setEgreso(normalizeMoneyInput(value));
    const handleIngresoChange = (value: string) => setIngreso(normalizeMoneyInput(value));
    const handleNotesChange = (value: string) => setNotes(value);
    const handleManagerChange = (value: string) => setManager(value);

    const managerSelectDisabled = !company || employeesLoading || employeeOptions.length === 0;
    const invoiceDisabled = !company;
    const egresoBorderClass = amountClass(isEgreso, egreso.trim().length > 0, egresoValid);
    const ingresoBorderClass = amountClass(isIngreso, ingreso.trim().length > 0, ingresoValid);
    const formatMovementTypeForSelect = (value: string) =>
        formatMovementType(isFondoMovementType(value) ? value : 'COMPRA');

    const closeMovementModal = () => {
        setMovementModalOpen(false);
        resetFondoForm();
    };
    const handleOpenCreateMovement = () => {
        resetFondoForm();
        setMovementModalOpen(true);
    };

    const handleFondoKeyDown = (event: React.KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            handleSubmitFondo();
        }
    };

    return (
        <div id={id} className="mt-10">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold text-[var(--foreground)] flex items-center gap-2">
                    <Banknote className="w-5 h-5" /> Registrar movimiento de Fondo
                </h2>
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleOpenCreateMovement}
                        className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded hover:opacity-90"
                    >
                        <Plus className="w-4 h-4" />
                        Agregar movimiento
                    </button>
                    <div className="px-3 py-2 bg-[var(--muted)] border border-[var(--input-border)] rounded text-right min-w-[160px]">
                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo actual</div>
                        <div className="text-lg font-semibold text-[var(--foreground)]">
                            {formatAmount(currentBalance)}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={openSettings}
                        className="p-2 border border-[var(--input-border)] rounded hover:bg-[var(--muted)]"
                        title="Abrir configuracion del fondo"
                        aria-label="Abrir configuracion del fondo"
                    >
                        <Settings className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {!authLoading && !company && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Tu usuario no tiene una empresa asociada; registra una empresa para continuar.
                </p>
            )}

            {providersError && <div className="mb-4 text-sm text-red-500">{providersError}</div>}

            {movementModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={closeMovementModal}>
                    <div
                        className="w-full max-w-5xl rounded border border-[var(--input-border)] bg-[var(--background)] p-6 shadow-lg"
                        onClick={event => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-[var(--foreground)]">
                                {editingEntry ? `Editar movimiento #${editingEntry.invoiceNumber}` : 'Registrar movimiento'}
                            </h3>
                            <button
                                type="button"
                                onClick={closeMovementModal}
                                className="p-2 rounded border border-[var(--input-border)] hover:bg-[var(--muted)]"
                                aria-label="Cerrar modal"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        {editingEntry && (
                            <p className="mb-3 text-xs text-[var(--muted-foreground)]">
                                Editando movimiento #{editingEntry.invoiceNumber}. Actualiza los datos y presiona &quot;Actualizar&quot; o cancela para volver al modo de registro.
                            </p>
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
                            onPaymentTypeChange={handlePaymentTypeChange}
                            movementTypeOptions={FONDO_TYPE_OPTIONS}
                            formatMovementType={formatMovementTypeForSelect}
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
                        />
                    </div>
                </div>
            )}

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
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Movimientos recientes</h3>
                <ul className="space-y-2">
                    {fondoEntries.length === 0 && <li className="text-[var(--muted-foreground)]">No hay movimientos aun.</li>}
                    {fondoEntries.map(fe => {
                        const providerName = providersMap.get(fe.providerCode) ?? fe.providerCode;
                        const isEntryEgreso = isEgresoType(fe.paymentType);
                        const amountLabel = isEntryEgreso
                            ? formatAmount(fe.amountEgreso)
                            : formatAmount(fe.amountIngreso);
                        const balanceAfter = balanceAfterById.get(fe.id) ?? initialAmountValue;
                        return (
                            <li key={fe.id} className="bg-[var(--muted)] p-3 rounded">
                                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                                    <div>
                                        <div className="font-semibold text-[var(--foreground)]">
                                            {providerName} <span className="text-xs text-[var(--muted-foreground)]">#{fe.invoiceNumber}</span>
                                        </div>
                                        <div className="text-xs text-[var(--muted-foreground)] space-x-3">
                                            <span>Tipo: {formatMovementType(fe.paymentType)}</span>
                                            <span>{isEntryEgreso ? 'Monto egreso' : 'Monto ingreso'}: {amountLabel}</span>
                                            <span>Encargado: {fe.manager}</span>
                                            <span>Saldo despues: {formatAmount(balanceAfter)}</span>
                                        </div>
                                        {fe.notes && (
                                            <div className="text-xs text-[var(--muted-foreground)] mt-1">
                                                Observacion: {fe.notes}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                                        <button
                                            type="button"
                                            className="px-3 py-1 border border-[var(--input-border)] rounded hover:bg-[var(--muted)] disabled:opacity-50"
                                            onClick={() => startEditingEntry(fe)}
                                            disabled={editingEntryId === fe.id}
                                        >
                                            {editingEntryId === fe.id ? 'Editando' : 'Editar'}
                                        </button>
                                        <span>{new Date(fe.createdAt).toLocaleString()}</span>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>

            {settingsOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
                    onClick={closeSettings}
                >
                    <div
                        className="w-full max-w-2xl rounded border border-[var(--input-border)] bg-[var(--background)] p-6 shadow-lg"
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
                                            Monto inicial del fondo
                                        </label>
                                        <input
                                            value={initialAmount}
                                            onChange={e => handleInitialAmountChange(e.target.value)}
                                            onBlur={handleInitialAmountBlur}
                                            className="w-full p-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                                            placeholder="0"
                                            inputMode="numeric"
                                            disabled={!company}
                                        />
                                        <p className="mt-2 text-[11px] text-[var(--muted-foreground)]">
                                            Se usa como base para calcular el saldo disponible tras cada movimiento.
                                        </p>
                                    </div>
                                </div>
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo inicial</div>
                                        <div className="text-lg font-semibold text-[var(--foreground)]">
                                            {formatAmount(initialAmountValue)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total ingresos</div>
                                        <div className="text-lg font-semibold text-emerald-600">
                                            {formatAmount(totalIngresos)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Total egresos</div>
                                        <div className="text-lg font-semibold text-red-600">
                                            {formatAmount(totalEgresos)}
                                        </div>
                                    </div>
                                    <div className="p-3 bg-[var(--muted)] border border-[var(--input-border)] rounded">
                                        <div className="text-xs uppercase tracking-wide text-[var(--muted-foreground)]">Saldo actual</div>
                                        <div className="text-lg font-semibold text-[var(--foreground)]">
                                            {formatAmount(currentBalance)}
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
