"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Banknote } from 'lucide-react';

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

export default function FondoPage() {
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
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div className="flex items-center mb-4">
                    <Banknote className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Registrar movimiento de Fondo</h1>
                </div>

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

                <div className="mt-6">
                    <Link href="/fondogeneral" className="text-[var(--muted-foreground)] underline">Volver al Fondo General</Link>
                </div>
            </div>
        </div>
    );
}
