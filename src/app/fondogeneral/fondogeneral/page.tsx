"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { FondoSection } from '../components/fondo';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';

type TabId = 'fondo' | 'bcr' | 'bn' | 'bac';
type FondoTab = { id: TabId; label: string; namespace: 'fg' | 'bcr' | 'bn' | 'bac' };

export default function FondoPage() {
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);
    const availableTabs = useMemo<FondoTab[]>(() => {
        if (!hasGeneralAccess) return [];

        const list: FondoTab[] = [{ id: 'fondo', label: 'Fondo General', namespace: 'fg' }];
        if (permissions.fondogeneralBCR) list.push({ id: 'bcr', label: 'Cuenta BCR', namespace: 'bcr' });
        if (permissions.fondogeneralBN) list.push({ id: 'bn', label: 'Cuenta BN', namespace: 'bn' });
        if (permissions.fondogeneralBAC) list.push({ id: 'bac', label: 'Cuenta BAC', namespace: 'bac' });
        return list;
    }, [hasGeneralAccess, permissions.fondogeneralBCR, permissions.fondogeneralBN, permissions.fondogeneralBAC]);

    const [active, setActive] = useState<TabId | ''>('fondo');
    const [companySelectorSlot, setCompanySelectorSlot] = useState<React.ReactNode | null>(null);
    const activeTab = availableTabs.find(tab => tab.id === active) || null;

    useEffect(() => {
        if (availableTabs.length === 0) {
            setActive('');
            return;
        }
        const exists = availableTabs.some(tab => tab.id === active);
        if (!exists) {
            setActive(availableTabs[0].id);
        }
    }, [availableTabs, active]);

    useEffect(() => {
        if (!activeTab) {
            setCompanySelectorSlot(null);
        }
    }, [activeTab]);

    const handleCompanySelectorChange = useCallback((node: React.ReactNode | null) => {
        setCompanySelectorSlot(node);
    }, []);

    if (loading) {
        return (
            <div className="max-w-6xl mx-auto py-8 px-4">
                <div className="flex items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-[var(--muted-foreground)]">Cargando permisos...</p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="max-w-6xl mx-auto py-8 px-4">
                <div className="flex flex-col items-center justify-center p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-10 h-10 text-[var(--muted-foreground)] mb-4" />
                    <h3 className="text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-[var(--muted-foreground)]">No tienes permisos para operar el Fondo General.</p>
                    <p className="text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto py-8 px-4">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-xl p-6">
                <div>
                    <div className="flex flex-wrap items-center gap-4 border-b border-[var(--input-border)] mb-4">
                        <div role="tablist" aria-label="Cuentas" className="flex flex-wrap items-center gap-2">
                            {availableTabs.map(tab => (
                                <button
                                    key={tab.id}
                                    role="tab"
                                    aria-selected={active === tab.id}
                                    onClick={() => setActive(tab.id)}
                                    className={`py-2 px-4 -mb-px focus:outline-none ${active === tab.id
                                        ? 'border-b-2 border-[var(--accent)] font-semibold'
                                        : 'text-[var(--muted)]'
                                        }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                        {companySelectorSlot && (
                            <div className="ml-auto flex flex-wrap items-center gap-3">
                                <div className="flex-1 min-w-[260px] text-right sm:text-left">
                                    {companySelectorSlot}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        {activeTab ? (
                            <FondoSection
                                namespace={activeTab.namespace}
                                companySelectorPlacement="external"
                                onCompanySelectorChange={handleCompanySelectorChange}
                            />
                        ) : (
                            <div className="flex items-center justify-center p-6 bg-[var(--muted)] rounded border border-[var(--input-border)]">
                                <p className="text-[var(--muted-foreground)]">No hay cuentas disponibles para mostrar.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
