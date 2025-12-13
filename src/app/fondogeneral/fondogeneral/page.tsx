"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { FondoSection } from '../components/fondo';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';
import { EmpresasService } from '@/services/empresas';
import { useActorOwnership } from '@/hooks/useActorOwnership';
import type { Empresas } from '@/types/firestore';
import InitialConfigModal from '../components/InitialConfigModal';

type TabId = 'fondo' | 'bcr' | 'bn' | 'bac';
type FondoTab = { id: TabId; label: string; namespace: 'fg' | 'bcr' | 'bn' | 'bac' };

// Clave para persistir la selección del tab de cuenta en localStorage
const ACCOUNT_TAB_STORAGE_KEY = 'fg_selected_account_tab';
// Clave para persistir la selección de empresa para admin (debe coincidir con fondo.tsx)
const ADMIN_COMPANY_STORAGE_KEY = 'fg_selected_company_shared';

export default function FondoPage() {
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);
    const isAdmin = user?.role === 'admin';
    const { ownerIds: actorOwnerIds } = useActorOwnership(user);
    
    // Estado para el modal de configuración inicial
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [availableCompanies, setAvailableCompanies] = useState<Empresas[]>([]);
    const [companiesLoading, setCompaniesLoading] = useState(false);
    const [adminSelectedCompany, setAdminSelectedCompany] = useState(() => {
        if (typeof window === 'undefined') return '';
        try {
            return localStorage.getItem(ADMIN_COMPANY_STORAGE_KEY) || '';
        } catch {
            return '';
        }
    });
    const availableTabs = useMemo<FondoTab[]>(() => {
        if (!hasGeneralAccess) return [];

        const list: FondoTab[] = [{ id: 'fondo', label: 'Fondo General', namespace: 'fg' }];
        if (permissions.fondogeneralBCR) list.push({ id: 'bcr', label: 'Cuenta BCR', namespace: 'bcr' });
        if (permissions.fondogeneralBN) list.push({ id: 'bn', label: 'Cuenta BN', namespace: 'bn' });
        if (permissions.fondogeneralBAC) list.push({ id: 'bac', label: 'Cuenta BAC', namespace: 'bac' });
        return list;
    }, [hasGeneralAccess, permissions.fondogeneralBCR, permissions.fondogeneralBN, permissions.fondogeneralBAC]);

    const [active, setActiveState] = useState<TabId | ''>(() => {
        if (typeof window === 'undefined') return 'fondo';
        try {
            const stored = localStorage.getItem(ACCOUNT_TAB_STORAGE_KEY);
            if (stored && ['fondo', 'bcr', 'bn', 'bac'].includes(stored)) {
                return stored as TabId;
            }
        } catch {
            // Ignorar errores de localStorage
        }
        return 'fondo';
    });

    // Wrapper para guardar la selección del tab en localStorage
    const setActive = useCallback((tabId: TabId | '') => {
        setActiveState(tabId);
        if (tabId && typeof window !== 'undefined') {
            try {
                localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, tabId);
            } catch (error) {
                console.error('Error saving selected tab to localStorage:', error);
            }
        }
    }, []);

    const [companySelectorSlot, setCompanySelectorSlot] = useState<React.ReactNode | null>(null);
    const activeTab = availableTabs.find(tab => tab.id === active) || null;

    // Cargar empresas disponibles para el admin
    useEffect(() => {
        if (!isAdmin || !hasGeneralAccess) return;
        
        const allowedOwnerIds = new Set<string>();
        actorOwnerIds.forEach(id => {
            const normalized = typeof id === 'string' ? id.trim() : String(id || '').trim();
            if (normalized) allowedOwnerIds.add(normalized);
        });
        if (user?.ownerId) {
            const normalized = String(user.ownerId).trim();
            if (normalized) allowedOwnerIds.add(normalized);
        }

        if (allowedOwnerIds.size === 0) return;

        setCompaniesLoading(true);
        EmpresasService.getAllEmpresas()
            .then(empresas => {
                const filtered = empresas.filter(emp => {
                    const owner = (emp.ownerId || '').trim();
                    if (!owner) return false;
                    return allowedOwnerIds.has(owner);
                });
                setAvailableCompanies(filtered);
            })
            .catch(err => {
                console.error('Error loading companies:', err);
                setAvailableCompanies([]);
            })
            .finally(() => {
                setCompaniesLoading(false);
            });
    }, [isAdmin, hasGeneralAccess, actorOwnerIds, user?.ownerId]);

    // Mostrar modal de configuración cada vez que el admin entre
    useEffect(() => {
        if (!isAdmin || !hasGeneralAccess || loading || companiesLoading) return;
        
        // Mostrar el modal siempre que el admin entre a la página
        setShowConfigModal(true);
    }, [isAdmin, hasGeneralAccess, loading, companiesLoading]);

    // Handler para cuando el admin selecciona empresa y cuenta en el modal
    const handleConfigSelect = useCallback((company: string, account: string) => {
        setAdminSelectedCompany(company);
        setActive(account as TabId);
        
        if (typeof window !== 'undefined') {
            try {
                localStorage.setItem(ADMIN_COMPANY_STORAGE_KEY, company);
                localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, account);
                
                // Disparar evento de storage para que FondoSection lo detecte
                window.dispatchEvent(new StorageEvent('storage', {
                    key: ADMIN_COMPANY_STORAGE_KEY,
                    newValue: company,
                    url: window.location.href
                }));
            } catch (error) {
                console.error('Error saving admin config:', error);
            }
        }
        
        setShowConfigModal(false);
    }, [setActive]);

    useEffect(() => {
        // No ejecutar mientras se cargan los permisos
        if (loading) return;

        if (availableTabs.length === 0) {
            setActiveState('');
            return;
        }
        const exists = availableTabs.some(tab => tab.id === active);
        if (!exists) {
            // Si el tab guardado no está disponible, usar el primero disponible
            const firstTab = availableTabs[0].id;
            setActiveState(firstTab);
            if (typeof window !== 'undefined') {
                try {
                    localStorage.setItem(ACCOUNT_TAB_STORAGE_KEY, firstTab);
                } catch {
                    // Ignorar errores de localStorage
                }
            }
        }
    }, [availableTabs, active, loading]);

    useEffect(() => {
        if (!activeTab) {
            setCompanySelectorSlot(null);
        }
    }, [activeTab]);

    const handleCompanySelectorChange = useCallback((node: React.ReactNode | null) => {
        setCompanySelectorSlot(node);
    }, []);

    if (loading || (isAdmin && companiesLoading)) {
        return (
            <div className="w-full max-w-7xl mx-auto py-3 px-2 sm:py-6 sm:px-4 lg:py-8">
                <div className="flex items-center justify-center p-6 sm:p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-sm sm:text-base text-[var(--muted-foreground)]">
                        {loading ? 'Cargando permisos...' : 'Cargando empresas...'}
                    </p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="w-full max-w-7xl mx-auto py-3 px-2 sm:py-6 sm:px-4 lg:py-8">
                <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--muted-foreground)] mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-sm sm:text-base text-[var(--muted-foreground)]">No tienes permisos para operar el Fondo General.</p>
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Modal de configuración inicial para admin */}
            {isAdmin && (
                <InitialConfigModal
                    isOpen={showConfigModal}
                    onClose={() => setShowConfigModal(false)}
                    companies={availableCompanies}
                    availableTabs={availableTabs}
                    onSelect={handleConfigSelect}
                    initialCompany={adminSelectedCompany}
                    initialAccount={active as TabId}
                />
            )}
            
            <div className="w-full max-w-7xl mx-auto py-3 px-2 sm:py-6 sm:px-4 lg:py-8">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6">
                <div>
                    {/* Tabs de cuentas - Responsive */}
                    <div className="flex flex-col gap-3 border-b border-[var(--input-border)] pb-3 mb-3 sm:pb-4 sm:mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                            <div role="tablist" aria-label="Cuentas" className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
                                {availableTabs.map(tab => {
                                    const isActive = active === tab.id;
                                    return (
                                        <button
                                            key={tab.id}
                                            type="button"
                                            role="tab"
                                            tabIndex={isActive ? 0 : -1}
                                            aria-selected={isActive}
                                            onClick={() => setActive(tab.id)}
                                            className={`relative flex-shrink-0 rounded-md px-3 py-2 sm:px-4 text-sm font-semibold whitespace-nowrap transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--card-bg)] ${isActive
                                                ? 'border-[var(--accent)] text-[var(--foreground)] bg-[var(--accent)]/15 shadow-md'
                                                : 'border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/10'
                                                }`}
                                        >
                                            <span className="flex items-center gap-1.5">
                                                {isActive && (
                                                    <div className="w-2 h-2 bg-[var(--accent)] rounded-full" />
                                                )}
                                                {tab.label}
                                            </span>
                                            {isActive && (
                                                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[var(--accent)] rounded-full" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                            {companySelectorSlot && (
                                <div className="w-full sm:w-auto sm:ml-auto">
                                    <div className="w-full sm:min-w-[220px] md:min-w-[260px]">
                                        {companySelectorSlot}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Contenido principal */}
                    <div className="mt-3 sm:mt-4">
                        {activeTab ? (
                            <FondoSection
                                namespace={activeTab.namespace}
                                companySelectorPlacement="external"
                                onCompanySelectorChange={handleCompanySelectorChange}
                            />
                        ) : (
                            <div className="flex items-center justify-center p-4 sm:p-6 bg-[var(--muted)] rounded border border-[var(--input-border)]">
                                <p className="text-xs sm:text-sm text-[var(--muted-foreground)]">No hay cuentas disponibles para mostrar.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
        </>
    );
}
