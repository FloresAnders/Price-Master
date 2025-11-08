"use client";

import React, { useEffect, useState } from 'react';
import { UserPlus, Banknote, Layers } from 'lucide-react';

type Provider = { code: string; name: string; createdAt: string };
type FondoEntry = {
    id: string;
    providerCode: string;
    invoiceNumber: string;
    paymentType: 'Gasto' | 'compra' | 'salario';
    amount: number;
    createdAt: string;
};

const PROVIDERS_KEY = 'fg_providers_v1';
const FONDO_KEY = 'fg_fondos_v1';

export function ProviderSection({ id }: { id?: string }) {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [providerName, setProviderName] = useState('');

    useEffect(() => {
        try {
            const raw = localStorage.getItem(PROVIDERS_KEY);
            setProviders(raw ? JSON.parse(raw) : []);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => void localStorage.setItem(PROVIDERS_KEY, JSON.stringify(providers)), [providers]);

    const nextProviderCode = () => {
        if (providers.length === 0) return '0000';
        const max = providers.reduce((acc, p) => Math.max(acc, Number(p.code || 0)), -1);
        return String(max + 1).padStart(4, '0');
    };

    const handleAddProvider = () => {
        const name = providerName.trim();
        if (!name) return;
        const p = { code: nextProviderCode(), name, createdAt: new Date().toISOString() };
        setProviders(prev => [p, ...prev]);
        setProviderName('');
    };

    return (
        <div id={id} className="mt-10">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2"><UserPlus className="w-5 h-5" /> Agregar proveedor</h2>
            <div className="flex gap-3 items-start mb-4">
                <input
                    className="flex-1 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                    placeholder="Nombre del proveedor"
                    value={providerName}
                    onChange={e => setProviderName(e.target.value)}
                />
                <button
                    className="px-4 py-3 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                    onClick={handleAddProvider}
                    disabled={!providerName.trim()}
                >
                    Guardar
                </button>
            </div>

            <div>
                <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Lista de Proveedores</h3>
                <ul className="space-y-2">
                    {providers.length === 0 && <li className="text-[var(--muted-foreground)]">Aún no hay proveedores.</li>}
                    {providers.map(p => (
                        <li key={p.code} className="flex items-center justify-between bg-[var(--muted)] p-3 rounded">
                            <div>
                                <div className="text-[var(--foreground)] font-semibold">{p.name}</div>
                                <div className="text-xs text-[var(--muted-foreground)]">Código: {p.code}</div>
                            </div>
                            <div className="text-xs text-[var(--muted-foreground)]">{new Date(p.createdAt).toLocaleString()}</div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}

export function FondoSection({ id }: { id?: string }) {
    const [providers, setProviders] = useState<Provider[]>([]);
    const [fondoEntries, setFondoEntries] = useState<FondoEntry[]>([]);

    const [selectedProvider, setSelectedProvider] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [paymentType, setPaymentType] = useState<FondoEntry['paymentType']>('Gasto');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        try {
            const raw = localStorage.getItem(PROVIDERS_KEY);
            setProviders(raw ? JSON.parse(raw) : []);
        } catch (e) {
            console.error(e);
        }
        try {
            const rawF = localStorage.getItem(FONDO_KEY);
            setFondoEntries(rawF ? JSON.parse(rawF) : []);
        } catch (e) {
            console.error(e);
        }
    }, []);

    useEffect(() => void localStorage.setItem(FONDO_KEY, JSON.stringify(fondoEntries)), [fondoEntries]);

    const handleAddFondo = () => {
        if (!selectedProvider) return;
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

    return (
        <div id={id} className="mt-10">
            <h2 className="text-xl font-semibold text-[var(--foreground)] mb-3 flex items-center gap-2"><Banknote className="w-5 h-5" /> Registrar movimiento de Fondo</h2>
            <div className="space-y-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={selectedProvider}
                        onChange={e => setSelectedProvider(e.target.value)}
                        className="flex-1 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                    >
                        <option value="">Seleccionar proveedor</option>
                        {providers.map(p => (
                            <option key={p.code} value={p.code}>{`${p.name} (${p.code})`}</option>
                        ))}
                    </select>

                    <input
                        placeholder="Número de factura (4 dígitos)"
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value.replace(/\D/g, '').slice(0, 4))}
                        className="w-48 p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
                    />
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <select
                        value={paymentType}
                        onChange={e => setPaymentType(e.target.value as FondoEntry['paymentType'])}
                        className="p-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded"
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
                    />

                    <div className="flex items-center">
                        <button
                            className="px-4 py-3 bg-[var(--accent)] text-white rounded disabled:opacity-50"
                            onClick={handleAddFondo}
                            disabled={!selectedProvider || invoiceNumber.length === 0 || amount.trim().length === 0}
                        >
                            Guardar
                        </button>
                    </div>
                </div>
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
                                    <div className="font-semibold text-[var(--foreground)]">{prov ? prov.name : fe.providerCode} <span className="text-xs text-[var(--muted-foreground)]">#{fe.invoiceNumber}</span></div>
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
