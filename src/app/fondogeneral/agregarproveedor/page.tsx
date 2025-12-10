"use client";

import React from 'react';
import { Lock } from 'lucide-react';
import { ProviderSection } from '../components/fondo';
import { useAuth } from '@/hooks/useAuth';
import { getDefaultPermissions } from '@/utils/permissions';

export default function AgregarProveedorPage() {
    const { user, loading } = useAuth();
    const permissions = user?.permissions || getDefaultPermissions(user?.role || 'user');
    const hasGeneralAccess = Boolean(permissions.fondogeneral);

    if (loading) {
        return (
            <div className="w-full max-w-4xl mx-auto py-3 px-2 sm:py-6 sm:px-4 lg:py-8">
                <div className="flex items-center justify-center p-6 sm:p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)]">
                    <p className="text-sm sm:text-base text-[var(--muted-foreground)]">Cargando permisos...</p>
                </div>
            </div>
        );
    }

    if (!hasGeneralAccess) {
        return (
            <div className="w-full max-w-4xl mx-auto py-3 px-2 sm:py-6 sm:px-4 lg:py-8">
                <div className="flex flex-col items-center justify-center p-6 sm:p-8 bg-[var(--card-bg)] rounded-lg border border-[var(--input-border)] text-center">
                    <Lock className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--muted-foreground)] mb-3 sm:mb-4" />
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--foreground)] mb-2">Acceso restringido</h3>
                    <p className="text-sm sm:text-base text-[var(--muted-foreground)]">No tienes permisos para agregar proveedores del Fondo General.</p>
                    <p className="text-xs sm:text-sm text-[var(--muted-foreground)] mt-2">Contacta a un administrador para obtener acceso.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto py-3 px-2 sm:py-6 sm:px-4 lg:py-8">
            <div className="bg-[var(--card-bg)] border border-[var(--input-border)] rounded-lg sm:rounded-xl p-3 sm:p-4 md:p-6">
                <ProviderSection />
            </div>
        </div>
    );
}
