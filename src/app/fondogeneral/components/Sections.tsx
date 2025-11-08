"use client";

import React, { useEffect, useState } from 'react';
import { UserPlus, Banknote, Layers, Trash2 } from 'lucide-react';
import { useAuth } from '../../../hooks/useAuth';
import { useProviders } from '../../../hooks/useProviders';
import ConfirmModal from '../../../components/ui/ConfirmModal';

type FondoEntry = {
    id: string;
    providerCode: string;
    invoiceNumber: string;
    paymentType: 'Gasto' | 'compra' | 'salario';
    amount: number;
    createdAt: string;
};

const FONDO_KEY = 'fg_fondos_v1';

export function ProviderSection({ id }: { id?: string }) {
    const { user, loading: authLoading } = useAuth();
    const company = user?.ownercompanie?.trim() ?? '';
    const { providers, loading: providersLoading, error, addProvider, removeProvider } = useProviders(company);

    const [providerName, setProviderName] = useState('');
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingCode, setDeletingCode] = useState<string | null>(null);
    const [confirmState, setConfirmState] = useState<{ open: boolean; code: string; name: string }>(
        { open: false, code: '', name: '' }
    );

    const handleAddProvider = async () => {
        const name = providerName.trim().toUpperCase();
        if (!name) return;

        const duplicate = providers.some(p => p.name.toUpperCase() === name);
        if (duplicate) {
            setFormError(`El proveedor "${name}" ya existe.`);
            return;
        }

        if (!company) {
            setFormError('Tu usuario no tiene una empresa asignada.');
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

    const closeRemoveModal = () => {
        setConfirmState({ open: false, code: '', name: '' });
    };

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
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2"><UserPlus className="w-5 h-5" /> Agregar proveedor</h2>

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

            {resolvedError && (
                <div className="mb-4 text-sm text-red-500">
                    {resolvedError}
                </div>
            )}

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
                        {providers.length === 0 && <li className="text-[var(--muted-foreground)]">Aún no hay proveedores.</li>}
                        {providers.map(p => (
                            <li key={p.code} className="flex items-center justify-between bg-[var(--muted)] p-3 rounded">
                                <div>
                                    <div className="text-[var(--foreground)] font-semibold">{p.name}</div>
                                    <div className="text-xs text-[var(--muted-foreground)]">Código: {p.code}</div>
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
                message={`¿Quieres eliminar el proveedor "${confirmState.name || confirmState.code}"? Esta acción no se puede deshacer.`}
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
    const [selectedProvider, setSelectedProvider] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentType, setPaymentType] = useState<FondoEntry['paymentType']>('Gasto');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        try {
            const rawF = localStorage.getItem(FONDO_KEY);
            setFondoEntries(rawF ? JSON.parse(rawF) : []);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => void localStorage.setItem(FONDO_KEY, JSON.stringify(fondoEntries)), [fondoEntries]);

    useEffect(() => {
        if (selectedProvider && !providers.some(p => p.code === selectedProvider)) {
            setSelectedProvider('');
        }
    }, [providers, selectedProvider]);

    const handleAddFondo = () => {
        if (!company) return;
        if (!selectedProvider) return;
        if (!providers.some(p => p.code === selectedProvider)) return;
        if (!/^[0-9]{1,4}$/.test(invoiceNumber)) return;
        const amt = parseFloat(amount);
        if (Number.isNaN(amt)) return;
        const entry: FondoEntry = {
            id: String(Date.now()),
            providerCode: selectedProvider,
            invoiceNumber: invoiceNumber.padStart(4, '0'),
            paymentType,
            amount: amt,
            createdAt: new Date().toISOString(),
        };
        setFondoEntries(prev => [entry, ...prev]);
        setInvoiceNumber('');
        setAmount('');
    };

    const isProviderSelectDisabled = !company || providersLoading || providers.length === 0;

    return (
        <div id={id} className="mt-10">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2"><Banknote className="w-5 h-5" /> Registrar movimiento de Fondo</h2>

            {!authLoading && !company && (
                <p className="text-sm text-[var(--muted-foreground)] mb-4">
                    Tu usuario no tiene una empresa asociada; registra una empresa para continuar.
                </p>
            )}

            {providersError && (
                <div className="mb-4 text-sm text-red-500">
                    {providersError}
                </div>
            )}

            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={selectedProvider}
                        onChange={e => setSelectedProvider(e.target.value)}
                        className="flex-1 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        disabled={isProviderSelectDisabled}
                    >
                        <option value="">
                            {providersLoading ? 'Cargando proveedores...' : 'Seleccionar proveedor'}
                        </option>
                        {providers.map(p => (
                            <option key={p.code} value={p.code}>{`${p.name} (${p.code})`}</option>
                        ))}
                    </select>

                    <input
                        placeholder="Número de factura (4 dígitos)"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-48 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        disabled={!company}
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={paymentType}
                        onChange={e => setPaymentType(e.target.value as FondoEntry['paymentType'])}
                        className="p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        disabled={!company}
                    >
                        <option value="Gasto">Gasto</option>
                        <option value="compra">compra</option>
                        <option value="salario">salario</option>
                    </select>

                    <input
                        placeholder="Monto"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="flex-1 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                        inputMode="decimal"
                        disabled={!company}
                    />

                    <div className="flex items-center">
                        <button
                            className="px-4 py-3 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                            onClick={handleAddFondo}
                            disabled={
                                !company ||
                                !selectedProvider ||
                                invoiceNumber.length === 0 ||
                                amount.trim().length === 0 ||
                                isProviderSelectDisabled ||
                                providersLoading
                            }
                        >
                            Guardar
                        </button>
                    </div>
                </div>

                {!providersLoading && providers.length === 0 && company && (
                    <p className="text-sm text-[var(--muted-foreground)]">
                        Registra un proveedor para poder asociarlo a los movimientos del fondo.
                    </p>
                )}
            </div>

            <div className="mt-6">
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Movimientos recientes</h3>
                <ul className="space-y-2">
                    {fondoEntries.length === 0 && <li className="text-[var(--muted-foreground)]">No hay movimientos aún.</li>}
                    {fondoEntries.map(fe => {
                        const prov = providers.find(p => p.code === fe.providerCode);
                        return (
                            <li key={fe.id} className="bg-[var(--muted)] p-3 rounded flex justify-between items-start">
                                <div>
                                    <div className="font-semibold text-[var(--foreground)]">
                                        {prov ? prov.name : fe.providerCode} <span className="text-xs text-[var(--muted-foreground)]">#{fe.invoiceNumber}</span>
                                    </div>
                                    <div className="text-xs text-[var(--muted-foreground)]">{fe.paymentType} — {fe.amount}</div>
                                </div>
                                <div className="text-xs text-[var(--muted-foreground)]">{new Date(fe.createdAt).toLocaleString()}</div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}

export function OtraSection({ id }: { id?: string }) {
    return (
        <div id={id} className="mt-10">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2"><Layers className="w-5 h-5" /> Otra</h2>
            <div className="p-4 bg-[var(--muted)] border border-[var(--border)] rounded">
                <p className="text-[var(--muted-foreground)]">Acciones adicionales próximamente.</p>
            </div>
        </div>
    );
}
