"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';

type Provider = { code: string; name: string; createdAt: string };

const PROVIDERS_KEY = 'fg_providers_v1';

export default function AgregarProveedorPage() {
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
        <div className="max-w-3xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div className="flex items-center mb-4">
                    <UserPlus className="w-8 h-8 mr-3 text-[var(--foreground)]" />
                    <h1 className="text-2xl font-bold text-[var(--foreground)]">Agregar proveedor</h1>
                </div>

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
                    <h3 className="text-sm font-medium text-[var(--foreground)] mb-2">Proveedores (más recientes primero)</h3>
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

                <div className="mt-6">
                    <Link href="/fondogeneral" className="text-[var(--muted-foreground)] underline">Volver al Fondo General</Link>
                </div>
            </div>
        </div>
    );
}
