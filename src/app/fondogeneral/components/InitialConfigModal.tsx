"use client";

import React, { useState, useEffect } from 'react';
import { X, Building2, Wallet, CheckCircle2 } from 'lucide-react';
import type { Empresas } from '@/types/firestore';

interface InitialConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    companies: Empresas[];
    availableTabs: Array<{ id: string; label: string; namespace: string }>;
    onSelect: (company: string, account: string) => void;
    initialCompany?: string;
    initialAccount?: string;
}

export default function InitialConfigModal({
    isOpen,
    onClose,
    companies,
    availableTabs,
    onSelect,
    initialCompany = '',
    initialAccount = 'fondo'
}: InitialConfigModalProps) {
    const [selectedCompany, setSelectedCompany] = useState(initialCompany);
    const [selectedAccount, setSelectedAccount] = useState(initialAccount);

    useEffect(() => {
        if (isOpen) {
            // Si hay una empresa inicial, usarla; si no, usar la primera disponible
            if (initialCompany) {
                setSelectedCompany(initialCompany);
            } else if (companies.length > 0) {
                setSelectedCompany(companies[0].name || '');
            }
            
            // Si hay una cuenta inicial, usarla; si no, usar 'fondo'
            if (initialAccount && availableTabs.some(tab => tab.id === initialAccount)) {
                setSelectedAccount(initialAccount);
            } else if (availableTabs.length > 0) {
                setSelectedAccount(availableTabs[0].id);
            }
        }
    }, [isOpen, companies, availableTabs, initialCompany, initialAccount]);

    const handleCompanySelect = (companyName: string) => {
        setSelectedCompany(companyName);
    };

    const handleAccountSelect = (accountId: string) => {
        setSelectedAccount(accountId);
    };

    const handleConfirm = () => {
        if (selectedCompany && selectedAccount) {
            // Aplicar la selección primero
            onSelect(selectedCompany, selectedAccount);
            // Cerrar el modal inmediatamente después
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
            {/* Backdrop */}
            <div 
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />
            
            {/* Modal */}
            <div className="relative w-full max-w-[95vw] sm:max-w-2xl bg-[var(--card-bg)] rounded-lg sm:rounded-xl shadow-2xl border border-[var(--input-border)] overflow-hidden max-h-[95vh] flex flex-col">
                {/* Header */}
                <div className="flex items-start justify-between p-4 sm:p-6 border-b border-[var(--input-border)] flex-shrink-0">
                    <div className="flex-1 pr-2">
                        <h2 className="text-lg sm:text-xl font-semibold text-[var(--foreground)]">
                            Configuración Inicial
                        </h2>
                        <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-1">
                            Selecciona la empresa y cuenta que deseas visualizar
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 sm:p-2 hover:bg-[var(--muted)] rounded-lg transition-colors flex-shrink-0"
                        aria-label="Cerrar"
                    >
                        <X className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--muted-foreground)]" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
                    {/* Sección de Empresas */}
                    <div>
                        <div className="flex items-center gap-2 mb-2 sm:mb-3">
                            <Building2 className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)]" />
                            <h3 className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
                                Selecciona una Empresa
                            </h3>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 max-h-48 sm:max-h-60 overflow-y-auto pr-1 sm:pr-2">
                            {companies.map((company) => {
                                const isSelected = selectedCompany === company.name;
                                return (
                                    <button
                                        key={company.name}
                                        onClick={() => handleCompanySelect(company.name || '')}
                                        className={`relative p-2.5 sm:p-3.5 rounded-lg transition-all duration-200 text-left ${
                                            isSelected
                                                ? 'border-[var(--accent)] bg-[var(--accent)]/25 shadow-lg ring-2 sm:ring-3 ring-[var(--accent)]/40 scale-[1.02]'
                                                : 'border-[var(--input-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--muted)]/50'
                                        }`}
                                        style={{ borderWidth: isSelected ? '2.5px' : '2px' }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className={`font-bold text-sm sm:text-base truncate ${
                                                    isSelected 
                                                        ? 'text-[var(--accent)]' 
                                                        : 'text-[var(--foreground)]'
                                                }`}>
                                                    {company.name}
                                                </p>
                                            </div>
                                            {isSelected && (
                                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--accent)] flex-shrink-0 drop-shadow-lg animate-in zoom-in-50 duration-200" />
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {companies.length === 0 && (
                            <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-[var(--muted-foreground)] bg-[var(--muted)]/30 rounded-lg">
                                No hay empresas disponibles
                            </div>
                        )}
                    </div>

                    {/* Sección de Cuentas */}
                    <div>
                        <div className="flex items-center gap-2 mb-2 sm:mb-3">
                            <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--accent)]" />
                            <h3 className="text-sm sm:text-base font-semibold text-[var(--foreground)]">
                                Selecciona una Cuenta
                            </h3>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                            {availableTabs.map((tab) => {
                                const isSelected = selectedAccount === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => handleAccountSelect(tab.id)}
                                        className={`relative p-3 sm:p-5 rounded-lg sm:rounded-xl transition-all duration-200 ${
                                            isSelected
                                                ? 'border-[var(--accent)] bg-[var(--accent)]/25 shadow-lg sm:shadow-xl ring-2 sm:ring-4 ring-[var(--accent)]/40 scale-[1.02] sm:scale-105'
                                                : 'border-[var(--input-border)] hover:border-[var(--accent)]/50 hover:bg-[var(--muted)]/50'
                                        }`}
                                        style={{ borderWidth: isSelected ? '2.5px' : '2px' }}
                                    >
                                        <div className="text-center relative">
                                            <p className={`font-bold text-xs sm:text-base ${
                                                isSelected 
                                                    ? 'text-[var(--accent)]' 
                                                    : 'text-[var(--foreground)]'
                                            }`}>
                                                {tab.label}
                                            </p>
                                            {isSelected && (
                                                <div className="absolute -top-1 -right-1">
                                                    
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                        
                        {availableTabs.length === 0 && (
                            <div className="p-3 sm:p-4 text-center text-xs sm:text-sm text-[var(--muted-foreground)] bg-[var(--muted)]/30 rounded-lg">
                                No hay cuentas disponibles
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-0 p-4 sm:p-6 border-t border-[var(--input-border)] bg-[var(--muted)]/20 flex-shrink-0">
                    <p className="text-[10px] sm:text-xs text-[var(--muted-foreground)] text-center sm:text-left">
                        {selectedCompany && selectedAccount 
                            ? 'Presiona Confirmar para continuar' 
                            : 'Selecciona empresa y cuenta para continuar'}
                    </p>
                    <button
                        onClick={handleConfirm}
                        disabled={!selectedCompany || !selectedAccount}
                        className={`px-4 sm:px-6 py-2.5 sm:py-2 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 whitespace-nowrap ${
                            selectedCompany && selectedAccount
                                ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent)]/90 shadow-md'
                                : 'bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed'
                        }`}
                    >
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
}
